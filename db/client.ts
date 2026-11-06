import { neon } from "@neondatabase/serverless";
import { asc, sql } from "drizzle-orm";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { aiUsage, latestSnapshot as latestTable, snapshots } from "./schema";
import type { SnapshotPayload } from "./payload";
import { timelinePoint, type TimelinePoint } from "../lib/snapshot";

let db: NeonHttpDatabase | null | undefined;

/** Drizzle client over Neon's HTTP driver, or null when DATABASE_URL is not set. */
export function getDb(): NeonHttpDatabase | null {
  if (db !== undefined) return db;
  const url = process.env.DATABASE_URL;
  db = url ? drizzle(neon(url)) : null;
  return db;
}

/**
 * Store a snapshot: a timeline row (skipped if this IEC report is already stored) and the full
 * payload as the latest copy.
 */
export async function insertSnapshot(payload: SnapshotPayload): Promise<{ inserted: boolean }> {
  const d = getDb();
  if (!d) throw new Error("DATABASE_URL is not set");
  const n = payload.national;
  const now = new Date();
  const reportDate = new Date(n.reportDate);
  const rows = await d
    .insert(snapshots)
    .values({
      takenAt: now,
      reportDate,
      payload: timelinePoint(payload, now.toISOString()),
      vdsComplete: n.progress.vdsComplete,
      hung: n.hung,
      majority: n.majority,
    })
    .onConflictDoNothing({ target: snapshots.reportDate })
    .returning({ id: snapshots.id });
  if (rows.length > 0) {
    await d
      .insert(latestTable)
      .values({ id: 1, takenAt: now, reportDate, payload })
      .onConflictDoUpdate({ target: latestTable.id, set: { takenAt: now, reportDate, payload } });
  }
  return { inserted: rows.length > 0 };
}

/** The most recent full payload, or null (no database configured, nothing stored, or error). */
export async function latestSnapshot(): Promise<{ takenAt: Date; payload: SnapshotPayload } | null> {
  const d = getDb();
  if (!d) return null;
  try {
    const rows = await d.select({ takenAt: latestTable.takenAt, payload: latestTable.payload }).from(latestTable).limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error("[db] could not read latest snapshot", err);
    return null;
  }
}

/** Every timeline point, oldest first (at most `limit`, newest kept). */
export async function timelinePoints(limit = 2000): Promise<TimelinePoint[]> {
  const d = getDb();
  if (!d) return [];
  const rows = await d
    .select({ payload: snapshots.payload })
    .from(snapshots)
    .where(sql`${snapshots.id} in (select id from snapshots order by report_date desc limit ${limit})`)
    .orderBy(asc(snapshots.reportDate));
  return rows.map((r) => r.payload);
}

/** Atomically count one AI answer for today; returns today's total, or null without a database. */
export async function incrementAiUsage(day: string): Promise<number | null> {
  const d = getDb();
  if (!d) return null;
  const rows = await d
    .insert(aiUsage)
    .values({ day, count: 1 })
    .onConflictDoUpdate({ target: aiUsage.day, set: { count: sql`${aiUsage.count} + 1` } })
    .returning({ count: aiUsage.count });
  return rows[0]?.count ?? null;
}
