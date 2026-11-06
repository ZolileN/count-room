"use client";

import { useEffect, useState } from "react";
import { DEVELOPER } from "@/lib/config";

const QUIPS = [
  "No ballots were harmed in the making of this site.",
  "Refreshes every minute. The coffee refreshes more often.",
  "Every vote counts. So does every pixel.",
  "Built with maths, patience and far too many IEC tabs.",
  "Tallying 23,696 voting districts so you don't have to.",
  "Hung councils, steady hands.",
];

/** Developer credit with a tally that finishes itself on hover, and a rotating one-liner. */
export function Credit() {
  const [quip, setQuip] = useState(0);
  useEffect(() => {
    setQuip(Math.floor(Math.random() * QUIPS.length));
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-line pt-3">
      <a
        href={DEVELOPER.url}
        target="_blank"
        rel="noopener"
        className="credit inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-2 pr-3 text-sm text-ink no-underline hover:border-line-strong"
      >
        <svg aria-hidden viewBox="0 0 28 20" className="h-4 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M5 3v14M10 3v14M15 3v14M20 3v14" />
          <path className="credit-strike" d="M2 15L24 5" stroke="var(--hung)" />
        </svg>
        <span>
          Counted, crunched and coded by <span className="credit-name font-semibold">{DEVELOPER.name}</span>
        </span>
      </a>
      <button
        type="button"
        onClick={() => setQuip((q) => (q + 1) % QUIPS.length)}
        className="text-left text-xs text-ink-3 hover:text-ink-2"
        title="Another one"
      >
        {QUIPS[quip]}
      </button>
    </div>
  );
}
