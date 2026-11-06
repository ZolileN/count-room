import { fmtAsOf } from "@/lib/format";

/** "As of 12:48 SAST, Fri 6 Nov", in a <time> element. */
export function AsOf({ iso, label = "As of", className = "" }: { iso: string | null | undefined; label?: string; className?: string }) {
  return (
    <span className={`text-xs text-ink-3 ${className}`}>
      {label} <time dateTime={iso ?? undefined}>{fmtAsOf(iso)}</time>
    </span>
  );
}
