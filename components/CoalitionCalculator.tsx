"use client";

import { useMemo, useState } from "react";
import { partyColour } from "@/lib/parties";

export interface CalcParty {
  id: number;
  short: string;
  name: string;
  seats: number;
  low: number;
  high: number;
  /** Independents are individual councillors, not a bloc. */
  isIndependent: boolean;
}

export interface CalcCoalition {
  members: number[];
  seats: number;
  probability: number;
}

function pctLabel(p: number): string {
  if (p >= 0.995) return ">99%";
  if (p > 0 && p < 0.005) return "<1%";
  return `${Math.round(p * 100)}%`;
}

export function CoalitionCalculator({
  parties,
  totalSeats,
  majority,
  coalitions,
  declared,
  sims,
}: {
  parties: CalcParty[];
  totalSeats: number;
  majority: number;
  coalitions: CalcCoalition[];
  declared: boolean;
  sims: number;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const byId = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);
  const sel = new Set(selected);
  const chosen = selected.map((id) => byId.get(id)).filter((p): p is CalcParty => !!p);
  const seats = chosen.reduce((a, p) => a + p.seats, 0);
  const short = majority - seats;
  const key = [...selected].sort((a, b) => a - b).join(",");
  const match = coalitions.find((c) => [...c.members].sort((a, b) => a - b).join(",") === key);

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const names = (ids: number[]) => ids.map((id) => byId.get(id)?.short ?? String(id)).join(" + ");

  let x = 0;
  return (
    <div>
      <p className="mb-3 text-sm text-ink-2">
        Tap parties to add their seats together. This is seat arithmetic only: it shows which combinations hold enough seats
        between them, not whether those parties would agree to govern together.
      </p>

      <ul className="flex flex-wrap gap-2" aria-label="Parties">
        {parties.map((p) => {
          const on = sel.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={`flex min-h-10 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  on ? "border-ink bg-surface-2 font-semibold text-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong"
                }`}
                title={p.isIndependent ? "Independent councillors are counted together here, but each decides for themselves." : p.name}
              >
                <span aria-hidden className="inline-block size-2.5 rounded-[3px]" style={{ background: partyColour(p.id) }} />
                <span>{p.short}</span>
                <span className="tally text-ink-2">{p.seats}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 rounded-lg border border-line bg-surface p-3">
        <svg width="100%" height="28" role="img" aria-label={`${seats} of ${totalSeats} seats selected; ${majority} needed for a majority.`} className="block overflow-visible">
          <rect x="0" y="6" width="100%" height="16" rx="4" fill="var(--track)" />
          {chosen.map((p) => {
            const w = (p.seats / totalSeats) * 100;
            const r = <rect key={p.id} x={`${x}%`} y="6" width={`${w}%`} height="16" rx="3" fill={partyColour(p.id)} stroke="var(--surface)" strokeWidth="2" />;
            x += w;
            return r;
          })}
          <line x1={`${(majority / totalSeats) * 100}%`} x2={`${(majority / totalSeats) * 100}%`} y1="0" y2="28" stroke="var(--ink)" strokeWidth="2" strokeDasharray="3 2" />
        </svg>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm" aria-live="polite">
            <span className="tally text-lg font-semibold text-ink">{seats}</span>
            <span className="text-ink-2"> of {totalSeats} seats · majority line {majority}</span>
          </p>
          <p className="text-sm font-medium">
            {selected.length === 0 ? (
              <span className="text-ink-3">Nothing selected</span>
            ) : short > 0 ? (
              <span className="text-ink-2">{short} short of a majority</span>
            ) : (
              <span className="text-ink">Clears the majority line by {seats - majority + 1}</span>
            )}
          </p>
        </div>
        {!declared && selected.length > 0 ? (
          <p className="mt-1 text-xs text-ink-3">
            Uses modelled seats while counting continues.
            {match ? ` This combination reaches ${majority} in ${pctLabel(match.probability)} of ${sims.toLocaleString("en-GB")} seat simulations.` : ""}
          </p>
        ) : null}
        {selected.length > 0 ? (
          <button type="button" onClick={() => setSelected([])} className="mt-2 text-sm text-ink-2 underline">
            Clear selection
          </button>
        ) : null}
      </div>

      <h3 className="display mt-6 text-lg font-bold">Minimal winning combinations</h3>
      <p className="mb-2 max-w-prose text-sm text-ink-2">
        Every set of up to four of the ten largest parties that reaches the majority line, where dropping any one member would
        fall short. Independents are left out because each votes individually.
        {declared
          ? " Seats are final."
          : ` The percentage is the share of ${sims.toLocaleString("en-GB")} seat simulations, with the uncounted vote varied, in which the combination still reaches the line. It is not a chance of governing.`}
      </p>
      {coalitions.length === 0 ? (
        <p className="text-sm text-ink-2">No combination of four or fewer of the largest parties reaches a majority.</p>
      ) : (
        <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
          {coalitions.slice(0, 30).map((c) => (
            <li key={c.members.join("-")}>
              <button
                type="button"
                onClick={() => setSelected(c.members)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2"
                aria-label={`${names(c.members)}: ${c.seats} seats${declared ? "" : `, reaches majority in ${pctLabel(c.probability)} of simulations`}. Select in calculator.`}
              >
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  {c.members.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 text-sm font-medium">
                      <span aria-hidden className="inline-block size-2.5 rounded-[3px]" style={{ background: partyColour(id) }} />
                      {byId.get(id)?.short}
                    </span>
                  ))}
                </span>
                <span className="tally text-sm text-ink-2">{c.seats}</span>
                {!declared ? <span className="tally w-12 text-right text-sm font-semibold">{pctLabel(c.probability)}</span> : null}
              </button>
            </li>
          ))}
        </ol>
      )}
      {coalitions.length > 30 ? <p className="mt-2 text-xs text-ink-3">Showing 30 of {coalitions.length}.</p> : null}
    </div>
  );
}
