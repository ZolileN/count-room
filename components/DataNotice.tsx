import type { Sourced } from "@/lib/iec/types";
import { fmtAsOf } from "@/lib/format";

/** Says plainly when the data is not fresh from the IEC. Renders nothing when it is. */
export function DataNotice({ s }: { s: Pick<Sourced<unknown>, "stale" | "source" | "fetchedAt" | "warnings"> }) {
  if (s.source === "fixtures") {
    return (
      <p role="status" className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2">
        Local fixture data (saved {fmtAsOf(s.fetchedAt)}). Set IEC_SOURCE=live to use the IEC feed.
      </p>
    );
  }
  if (!s.stale && s.source === "live") return null;
  const what = s.source === "snapshot" ? "our last stored snapshot" : "the last copy we received";
  return (
    <p role="status" className="mb-4 rounded-md border border-hung/40 bg-hung-bg px-3 py-2 text-sm text-hung-ink">
      The IEC results feed is not responding. Showing {what}, fetched {fmtAsOf(s.fetchedAt)}. We will keep retrying.
    </p>
  );
}

export function Unavailable({ what }: { what: string }) {
  return (
    <div role="alert" className="rounded-lg border border-line bg-surface p-5">
      <h2 className="display text-lg font-semibold">{what} unavailable right now</h2>
      <p className="mt-1 text-sm text-ink-2">
        We could not reach the IEC results feed and have no earlier copy stored yet. This page retries every minute.
      </p>
    </div>
  );
}
