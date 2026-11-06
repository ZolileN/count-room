/**
 * Grounding context for the AI analyst: a compact, factual dump of what the site shows. Pure.
 * The model is told to answer only from this text.
 */
import type { CouncilAnalysis } from "../model/council";
import type { ProjectionResult } from "../model/projection";
import type { CouncilSwing } from "../model/swing";
import { closeWards } from "../model/swing";
import type { MunicData, NationalData, PreviousCouncil } from "../iec/types";
import { OTHER_ID } from "../iec/types";

const r1 = (x: number) => Math.round(x * 10) / 10;

export function nationalContext(n: NationalData, projection: ProjectionResult | null, projectionAsOf: string | null): string {
  const short = new Map(n.parties.map((p) => [p.id, p.short]));
  const lines: string[] = [];
  lines.push(`# National (IEC report ${n.reportDate})`);
  lines.push(`Voting districts reported: ${n.progress.vdsComplete} of ${n.progress.vdsExpected}. Councils declared: ${n.progress.municsComplete} of ${n.progress.municsExpected} (hung ${n.hung}, majority ${n.majority}). Registered voters: ${n.registered}.`);
  lines.push(`Raw national vote share so far (ward+PR ballots), seats awarded so far, outright majorities:`);
  for (const p of n.parties) lines.push(`- ${p.short} (${p.name}): ${r1(p.pct)}%, seats ${p.seats}${p.id !== OTHER_ID && p.majoritiesWon !== undefined ? `, majorities ${p.majoritiesWon}` : ""}`);
  if (projection) {
    lines.push(`\n# Projection (province files as of ${projectionAsOf ?? "unknown"}; re-weights provinces to full count; arithmetic, not a forecast)`);
    for (const p of projection.parties) lines.push(`- ${p.id === OTHER_ID ? "Other" : (short.get(p.id) ?? p.id)}: counted ${r1(p.raw)}%, projected ${r1(p.projected)}%, 90% range ${r1(p.p5)}-${r1(p.p95)}%`);
  }
  lines.push(`\n# Provinces`);
  for (const p of n.provinces) {
    lines.push(`- ${p.name}: ${p.progress.vdsComplete}/${p.progress.vdsExpected} VDs; ${p.hung} hung, ${p.majority} majority, ${p.progress.municsExpected - p.progress.municsComplete} counting; top: ${p.parties.filter((x) => x.id !== OTHER_ID).map((x) => `${x.short} ${r1(x.pct)}%`).join(", ")}`);
  }
  lines.push(`\n# Councils (code, name, province, status, seats, largest/leading party)`);
  for (const c of n.councils) {
    const lead = c.leader ? (c.declared ? `${c.leader.short} ${c.leaderSeats}/${c.totalSeats} seats` : `${c.leader.short} leads on votes ${r1(c.leader.pct)}%`) : "no data";
    lines.push(`- ${c.code} ${c.name} (${c.province}): ${c.status}${c.status === "counting" ? ` ${Math.round((c.progress.vdsComplete / Math.max(1, c.progress.vdsExpected)) * 100)}% VDs` : ""}, ${c.totalSeats} seats, ${lead}`);
  }
  return lines.join("\n");
}

export function councilContext(m: MunicData, a: CouncilAnalysis, swing: CouncilSwing | null, prev: PreviousCouncil | null): string {
  const lines: string[] = [];
  const short = new Map(m.parties.map((p) => [p.id, p.short]));
  const sh = (id: number) => short.get(id) ?? prev?.parties.find((p) => p.id === id)?.short ?? String(id);
  lines.push(`# Council in focus: ${m.name} (${m.code}), ${m.province} (IEC report ${m.reportDate})`);
  lines.push(`Status: ${m.status}. ${m.totalSeats} seats; majority line ${a.majority}. VDs reported ${m.progress.vdsComplete}/${m.progress.vdsExpected}; wards declared ${m.progress.wardsComplete}/${m.progress.wardsExpected}.`);
  lines.push(`Seats are ${a.seatsSource === "declared" ? "declared by the IEC (final)" : `modelled from votes counted so far (${a.model === "mmp" ? "Schedule 1 compensatory formula" : "Droop quota on PR votes"}; 90% range from ${a.sims} simulations)`}:`);
  for (const r of a.rows) lines.push(`- ${r.short}: ${r1(r.pct)}% of votes, ${r.wardSeats} ward seats, ${r.seats} seats${a.seatsSource === "model" ? ` (range ${r.low}-${r.high})` : ""}`);
  lines.push(`Minimal winning combinations (seat arithmetic only${a.seatsSource === "model" ? "; share of simulations reaching the majority line" : ""}):`);
  for (const c of a.coalitions.slice(0, 15)) lines.push(`- ${c.members.map(sh).join(" + ")}: ${c.seats} seats${a.seatsSource === "model" ? `, ${Math.round(c.probability * 100)}%` : ""}`);
  if (swing && prev) {
    lines.push(`Change since 2021 on ${swing.overall.matchedVds} matched voting districts (${Math.round(swing.overall.coverage * 100)}% of counted votes), share of all valid votes:`);
    const ids = Object.keys({ ...swing.overall.now, ...swing.overall.then }).map(Number).filter((id) => (swing.overall.now[id] ?? 0) >= 1 || (swing.overall.then[id] ?? 0) >= 1);
    for (const id of ids) lines.push(`- ${sh(id)}: 2021 ${r1(swing.overall.then[id] ?? 0)}%, 2026 ${r1(swing.overall.now[id] ?? 0)}%`);
    lines.push(`2021 council seats: ${prev.parties.filter((p) => p.seats > 0).map((p) => `${p.short} ${p.seats}`).join(", ")} of ${prev.totalSeats}.`);
  }
  const close = closeWards(m.wards, 5).slice(0, 8);
  if (close.length) {
    lines.push(`Closest wards (ward ballot):`);
    for (const c of close) lines.push(`- Ward ${c.ward.number}: ${sh(c.leaderId)} ${c.ward.declared ? "won" : "leads"} over ${sh(c.runnerUpId)} by ${c.margin} votes (${r1(c.marginPct)} pts)`);
  }
  return lines.join("\n");
}

export const SYSTEM_INSTRUCTIONS = `You answer questions about the 2026 South African local government election results for Count Room, a non-commercial, politically neutral results site.

Rules:
- Use only the data provided below. Every number you give must come from it; mention the report time when it matters. If the data does not answer the question, say so plainly.
- Be strictly neutral. Do not predict final results or who will govern, do not say who should win, form a coalition or be voted for, and do not characterise parties, candidates or voters. Coalition figures are seat arithmetic only; say so if asked who will govern.
- Results are provisional until the IEC declares them. The projection is arithmetic on the count, not a forecast.
- Decline anything unrelated to these election results.
- Reply in plain text (no Markdown headings or tables), at most about 120 words. Short "- " lists are fine.`;
