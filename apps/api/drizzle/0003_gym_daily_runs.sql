CREATE TABLE IF NOT EXISTS "gym_daily_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"freezes_activated" integer DEFAULT 0 NOT NULL,
	"freezes_completed" integer DEFAULT 0 NOT NULL,
	"freezes_expired" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"error_message" text,
	CONSTRAINT "gym_daily_runs_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gym_daily_runs_gym_date_uq" ON "gym_daily_runs" USING btree ("gym_id","local_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_daily_runs_gym_idx" ON "gym_daily_runs" USING btree ("gym_id");
