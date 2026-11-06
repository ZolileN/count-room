CREATE TABLE "latest_snapshot" (
	"id" integer PRIMARY KEY NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"report_date" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"report_date" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"vds_complete" integer NOT NULL,
	"hung" integer NOT NULL,
	"majority" integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_report_date_uq" ON "snapshots" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX "snapshots_taken_at_idx" ON "snapshots" USING btree ("taken_at");