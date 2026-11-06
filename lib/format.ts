import { TIME_ZONE } from "./config";

const intFmt = new Intl.NumberFormat("en-GB");

export function fmtInt(n: number): string {
  return intFmt.format(Math.round(n));
}

/** 1.2m / 845k / 950 */
export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}m`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return fmtInt(n);
}

export function fmtPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

/** Signed percentage-point change, e.g. "+0.7" or "−1.2" (true minus sign). */
export function fmtShift(n: number, digits = 1): string {
  const r = Number(n.toFixed(digits));
  if (r === 0) return (0).toFixed(digits);
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(digits)}`;
}

export function pctOf(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });

/** "12:48 SAST, Fri 6 Nov" */
export function fmtAsOf(iso: string | null | undefined): string {
  if (!iso) return "time unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "time unknown";
  return `${timeFmt.format(d)} SAST, ${dayFmt.format(d)}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--:--" : timeFmt.format(d);
}
