import type { CouncilStatus } from "@/lib/iec/types";

/** Hung councils get the amber state; the word is always shown, never colour alone. */
export function StatusBadge({ status, drawn = false }: { status: CouncilStatus; drawn?: boolean }) {
  if (status === "hung") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-hung/50 bg-hung-bg px-2 py-0.5 text-xs font-semibold text-hung-ink">
        <svg aria-hidden viewBox="0 0 8 8" className="size-2"><path d="M0 4h8" stroke="currentColor" strokeWidth="2" /></svg>
        Hung{drawn ? " · drawn" : ""}
      </span>
    );
  }
  if (status === "majority") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 text-xs font-semibold text-ink">
        <svg aria-hidden viewBox="0 0 8 8" className="size-2"><circle cx="4" cy="4" r="3.5" fill="currentColor" /></svg>
        Majority
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-xs font-medium text-ink-2">
      <svg aria-hidden viewBox="0 0 8 8" className="size-2"><circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      Counting
    </span>
  );
}
