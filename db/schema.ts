import { index, integer, jsonb, pgTable, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { SnapshotPayload } from "./payload";

/**
 * One row per distinct IEC national report (the cron skips a report it has already stored).
 * Used for the count timeline (phase 2) and as the durable last-good copy if the IEC is down.
 */
export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
    reportDate: timestamp("report_date", { withTimezone: true }).notNull(),
    payload: jsonb("payload").$type<SnapshotPayload>().notNull(),
    vdsComplete: integer("vds_complete").notNull(),
    hung: integer("hung").notNull(),
    majority: integer("majority").notNull(),
  },
  (t) => [uniqueIndex("snapshots_report_date_uq").on(t.reportDate), index("snapshots_taken_at_idx").on(t.takenAt)],
);

export type SnapshotRow = typeof snapshots.$inferSelect;
