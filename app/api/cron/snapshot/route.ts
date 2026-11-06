import { NextResponse } from "next/server";
import { insertSnapshot } from "@/db/client";
import { buildSnapshotPayload } from "@/lib/data";
import { getNational, getProvinces } from "@/lib/iec/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron, every 5 minutes (vercel.json). Stores the national and province data plus a
 * projection summary in Neon. Uses the same 60 s-cached getters as the pages, so it adds no IEC
 * traffic when the cache is warm. Skips a report it has already stored.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });

  try {
    const [national, provinces] = await Promise.all([getNational(), getProvinces()]);
    if (national.source !== "live") {
      return NextResponse.json({ skipped: true, reason: `national data is from ${national.source}, not live` });
    }
    const { inserted } = await insertSnapshot(buildSnapshotPayload(national.data, provinces.data));
    return NextResponse.json({ inserted, reportDate: national.data.reportDate, vdsComplete: national.data.progress.vdsComplete });
  } catch (err) {
    console.error("[cron] snapshot failed", err);
    return NextResponse.json({ error: "Snapshot failed." }, { status: 502 });
  }
}
