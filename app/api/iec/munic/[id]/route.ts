import { NextResponse } from "next/server";
import { getMunic } from "@/lib/iec/client";
import { findCouncil, loadNational } from "@/lib/data";
import { cacheHeaders } from "@/lib/http";

export const revalidate = 60;

/** Trimmed, normalised results for one council: wards and full party list. Cached 60 s. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!/^\d{1,6}$/.test(raw)) return NextResponse.json({ error: "Invalid municipality ID." }, { status: 400 });

  // Only fetch files for councils that exist in the national file.
  const nat = await loadNational();
  if (!nat.ok) return NextResponse.json({ error: "IEC results are unavailable right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!findCouncil(nat.value.data, id)) return NextResponse.json({ error: "Unknown municipality ID." }, { status: 404 });

  try {
    const m = await getMunic(id);
    return NextResponse.json(m, { headers: cacheHeaders(m.stale) });
  } catch {
    return NextResponse.json({ error: "This council's results are unavailable right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
