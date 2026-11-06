import { NextResponse } from "next/server";
import { getWardMap } from "@/lib/iec/client";
import { findCouncil, loadNational } from "@/lib/data";

/** One council's simplified ward boundaries. Boundaries don't change: cached for a day at the edge. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  if (!/^\d{1,6}$/.test(raw)) return NextResponse.json({ error: "Invalid municipality ID." }, { status: 400 });
  const nat = await loadNational();
  if (!nat.ok || !findCouncil(nat.value.data, Number(raw))) return NextResponse.json({ error: "Unknown municipality ID." }, { status: 404 });
  try {
    const g = await getWardMap(Number(raw));
    return NextResponse.json(g.data, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "Ward boundaries unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
