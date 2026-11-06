import { NextResponse } from "next/server";
import { ask, MAX_QUESTION_CHARS } from "@/lib/ai/ask";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = body as { question?: unknown; councilId?: unknown };
  if (typeof b.question !== "string" || b.question.length > MAX_QUESTION_CHARS * 2) {
    return NextResponse.json({ error: "Invalid question." }, { status: 400 });
  }
  const councilId = typeof b.councilId === "number" && Number.isInteger(b.councilId) && b.councilId > 0 && b.councilId < 1_000_000 ? b.councilId : null;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const r = await ask(b.question, councilId, ip);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ answer: r.answer, asOf: r.asOf, cached: r.cached }, { headers: { "Cache-Control": "no-store" } });
}
