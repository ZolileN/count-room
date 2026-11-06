/**
 * The AI analyst (server only). Off unless ANTHROPIC_API_KEY is set. Cost controls, in order:
 * per-visitor rate limit, cached answers (same question + same data = no API call), a site-wide
 * daily cap (stored in Neon when configured, else per instance), short answers, low effort, and
 * prompt caching on the data block.
 */
import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";
import { hashSeed } from "../model/rng";
import { loadCouncil, loadProjection } from "../data";
import { councilContext, nationalContext, SYSTEM_INSTRUCTIONS } from "./context";

export const AI_MODEL = "claude-opus-5-5";
export const MAX_QUESTION_CHARS = 300;
const PER_IP_LIMIT = 6;
const PER_IP_WINDOW_MS = 10 * 60_000;

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function dailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(n) && n >= 0 ? n : 300;
}

export type AskResult =
  | { ok: true; answer: string; asOf: string; cached: boolean }
  | { ok: false; status: number; error: string };

const recent = new Map<string, number[]>();

/** Best-effort per-visitor limit (per server instance). */
export function rateLimited(ip: string, now = Date.now()): boolean {
  const list = (recent.get(ip) ?? []).filter((t) => now - t < PER_IP_WINDOW_MS);
  if (list.length >= PER_IP_LIMIT) {
    recent.set(ip, list);
    return true;
  }
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 10_000) recent.clear();
  return false;
}

let localDay = "";
let localCount = 0;

async function underDailyCap(): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  let count: number | null = null;
  try {
    const { incrementAiUsage } = await import("../../db/client");
    count = await incrementAiUsage(day);
  } catch (err) {
    console.error("[ai] usage counter failed", err);
  }
  if (count === null) {
    if (localDay !== day) {
      localDay = day;
      localCount = 0;
    }
    count = ++localCount;
  }
  return count <= dailyLimit();
}

export function normaliseQuestion(q: string): string {
  return q.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_CHARS);
}

async function buildContext(councilId: number | null): Promise<{ text: string; asOf: string } | null> {
  const proj = await loadProjection();
  if (!proj.ok) return null;
  const { national, projection, asOf } = proj.value;
  let text = nationalContext(national.data, projection, asOf);
  if (councilId !== null) {
    const c = await loadCouncil(councilId);
    if (c?.ok && c.value.detail) {
      text += "\n\n" + councilContext(c.value.detail.munic.data, c.value.detail.analysis, c.value.swing, c.value.previous);
    }
  }
  return { text, asOf: national.data.reportDate };
}

async function callClaude(question: string, context: string): Promise<string> {
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  const response = await client.beta.messages.create({
    model: AI_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [
      { type: "text", text: SYSTEM_INSTRUCTIONS },
      { type: "text", text: `Data:\n${context}`, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: question }],
  });
  if (response.stop_reason === "refusal") return "I can't help with that question.";
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || "I couldn't produce an answer from the current data.";
}

export async function ask(rawQuestion: string, councilId: number | null, ip: string): Promise<AskResult> {
  if (!aiEnabled()) return { ok: false, status: 503, error: "The AI analyst is switched off on this site." };
  const question = normaliseQuestion(rawQuestion);
  if (question.length < 3) return { ok: false, status: 400, error: "Please type a question." };
  if (rateLimited(ip)) return { ok: false, status: 429, error: "Too many questions in a short time. Please try again in a few minutes." };

  const ctx = await buildContext(councilId);
  if (!ctx) return { ok: false, status: 503, error: "Results data is unavailable right now." };

  // Same question, same scope, same data: serve the stored answer.
  const key = `${hashSeed(question.toLowerCase())}:${councilId ?? "nat"}:${hashSeed(ctx.text)}`;
  let generated = false;
  const getAnswer = unstable_cache(
    async () => {
      if (!(await underDailyCap())) throw new DailyCapError();
      generated = true;
      return callClaude(question, ctx.text);
    },
    ["ai-answer", key],
    { revalidate: 600, tags: ["ai"] },
  );
  try {
    const answer = await getAnswer();
    return { ok: true, answer, asOf: ctx.asOf, cached: !generated };
  } catch (err) {
    if (err instanceof DailyCapError) {
      return { ok: false, status: 429, error: "The AI analyst has reached today's limit. The rest of the site is unaffected." };
    }
    if (err instanceof Anthropic.RateLimitError) return { ok: false, status: 429, error: "The AI service is busy. Please try again shortly." };
    if (err instanceof Anthropic.APIError) {
      console.error("[ai] API error", err.status, err.message);
      return { ok: false, status: 502, error: "The AI service could not answer just now." };
    }
    console.error("[ai] failed", err);
    return { ok: false, status: 500, error: "Something went wrong answering that." };
  }
}

class DailyCapError extends Error {}
