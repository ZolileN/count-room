"use client";

import { useState } from "react";

const MAX = 300;

export function AskPanel({ suggestions, councilId, scopeLabel }: { suggestions: string[]; councilId: number | null; scopeLabel: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ q: string; text: string; asOf: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, councilId }),
      });
      const data = (await res.json()) as { answer?: string; asOf?: string; error?: string };
      if (!res.ok || !data.answer) setError(data.error ?? "Something went wrong.");
      else setAnswer({ q: text, text: data.answer, asOf: data.asOf ?? "" });
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(q);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label className="flex-1">
          <span className="sr-only">Your question about {scopeLabel}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value.slice(0, MAX))}
            maxLength={MAX}
            placeholder={`Ask about ${scopeLabel}`}
            className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base"
          />
        </label>
        <button type="submit" disabled={busy || q.trim().length < 3} className="min-h-11 rounded-md bg-ink px-4 font-medium text-bg disabled:opacity-50">
          {busy ? "Thinking…" : "Ask"}
        </button>
      </form>

      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setQ(s);
                void submit(s);
              }}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm text-ink-2 hover:border-line-strong"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>

      <div aria-live="polite" className="mt-4">
        {error ? <p role="alert" className="rounded-lg border border-line bg-surface p-3 text-sm">{error}</p> : null}
        {answer ? (
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs font-medium text-ink-3">{answer.q}</p>
            <div className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{answer.text}</div>
            <p className="mt-3 text-xs text-ink-3">
              AI-generated from the IEC figures on this site{answer.asOf ? ` (report ${answer.asOf.slice(11, 16)} SAST)` : ""}. It can make mistakes: check
              the numbers on the relevant page.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
