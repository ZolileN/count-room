import { NextResponse } from "next/server";
import { loadNational } from "@/lib/data";
import { cacheHeaders } from "@/lib/http";

export const revalidate = 60;

/** Trimmed, normalised national results. Cached at the edge for 60 s. */
export async function GET() {
  const r = await loadNational();
  if (!r.ok) {
    return NextResponse.json({ error: "IEC national results are unavailable right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(r.value, { headers: cacheHeaders(r.value.stale) });
}
