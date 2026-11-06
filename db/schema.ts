import { index, integer, jsonb, pgTable, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { SnapshotPayload } from "./payload";
import type { TimelinePoint } from "../lib/snapshot";

/**
 * One row per distinct IEC national report: a compact timeline point (~2 KB), so months of
 * five-minute snapshots fit comfortably in a free Neon database.
 */
export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
    reportDate: timestamp("report_date", { withTimezone: true }).notNull(),
    payload: jsonb("payload").$type<TimelinePoint>().notNull(),
    vdsComplete: integer("vds_complete").notNull(),
    hung: integer("hung").notNull(),
    majority: integer("majority").notNull(),
  },
  (t) => [uniqueIndex("snapshots_report_date_uq").on(t.reportDate), index("snapshots_taken_at_idx").on(t.takenAt)],
);

/**
 * A single row holding the most recent full payload (national + provinces, ~170 KB): the durable
 * last-good copy served if the IEC is down and an instance has nothing in memory.
 */
export const latestSnapshot = pgTable("latest_snapshot", {
  id: integer("id").primaryKey(),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  reportDate: timestamp("report_date", { withTimezone: true }).notNull(),
  payload: jsonb("payload").$type<SnapshotPayload>().notNull(),
});

export type SnapshotRow = typeof snapshots.$inferSelect;
