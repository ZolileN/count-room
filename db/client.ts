import { neon } from "@neondatabase/serverless";
import { desc } from "drizzle-orm";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { snapshots } from "./schema";
import type { SnapshotPayload } from "./payload";

let db: NeonHttpDatabase | null | undefined;

/** Drizzle client over Neon's HTTP driver, or null when DATABASE_URL is not set. */
export function getDb(): NeonHttpDatabase | null {
  if (db !== undefined) return db;
  const url = process.env.DATABASE_URL;
  db = url ? drizzle(neon(url)) : null;
  return db;
}

export async function insertSnapshot(payload: SnapshotPayload): Promise<{ inserted: boolean }> {
  const d = getDb();
  if (!d) throw new Error("DATABASE_URL is not set");
  const n = payload.national;
  const rows = await d
    .insert(snapshots)
    .values({
      reportDate: new Date(n.reportDate),
      payload,
      vdsComplete: n.progress.vdsComplete,
      hung: n.hung,
      majority: n.majority,
    })
    .onConflictDoNothing({ target: snapshots.reportDate })
    .returning({ id: snapshots.id });
  return { inserted: rows.length > 0 };
}

/** The most recent stored snapshot, or null (no database configured, empty table, or error). */
export async function latestSnapshot(): Promise<{ takenAt: Date; payload: SnapshotPayload } | null> {
  const d = getDb();
  if (!d) return null;
  try {
    const rows = await d
      .select({ takenAt: snapshots.takenAt, payload: snapshots.payload })
      .from(snapshots)
      .orderBy(desc(snapshots.reportDate))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error("[db] could not read latest snapshot", err);
    return null;
  }
}
