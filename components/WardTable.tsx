import Link from "next/link";
import type { Ward } from "@/lib/iec/types";
import { fmtInt, fmtPct } from "@/lib/format";
import { Swatch } from "./Party";
import { titleCase } from "@/lib/parties";

/** Ward winners (or leaders) and margins from the ward ballot. */
export function WardTable({ wards, councilId }: { wards: Ward[]; councilId: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">Ward ballot results by ward</caption>
        <thead className="text-left text-xs text-ink-2">
          <tr className="border-b border-line">
            <th scope="col" className="px-3 py-2 font-medium">Ward</th>
            <th scope="col" className="px-3 py-2 font-medium">Winner or leader</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Margin</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Votes</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">VDs in</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {wards.map((w) => {
            const [a, b] = w.parties;
            const margin = a && w.valid > 0 ? ((a.votes - (b?.votes ?? 0)) / w.valid) * 100 : null;
            return (
              <tr key={w.id}>
                <th scope="row" className="tally px-3 py-2 text-left font-medium">
                  <Link href={`/councils/${councilId}/wards/${w.number}`} className="underline decoration-line-strong">{w.number}</Link>
                </th>
                <td className="px-3 py-2">
                  {a ? (
                    <span className="flex items-center gap-1.5">
                      <Swatch id={a.id} />
                      <span className="font-medium">{a.short}</span>
                      {a.candidate ? <span className="truncate text-ink-2">{titleCase(a.candidate)}</span> : null}
                      <span className={`ml-auto shrink-0 text-xs ${w.declared ? "text-ink-2" : "text-ink-3"}`}>{w.declared ? "won" : "leads"}</span>
                    </span>
                  ) : (
                    <span className="text-ink-3">No votes yet</span>
                  )}
                </td>
                <td className="tally px-3 py-2 text-right">{margin === null ? "–" : fmtPct(margin)}</td>
                <td className="tally px-3 py-2 text-right">{fmtInt(w.valid)}</td>
                <td className="tally px-3 py-2 text-right text-ink-2">
                  {w.vdsReported}/{w.vdsTotal}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
