CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "membership_freezes" ADD CONSTRAINT "freeze_dates_valid"
  CHECK (end_date >= start_date);--> statement-breakpoint
ALTER TABLE "membership_freezes" ADD CONSTRAINT "no_overlapping_freezes"
  EXCLUDE USING gist (
    membership_id WITH =,
    daterange(start_date, end_date + 1, '[]') WITH &&
  ) WHERE (status IN ('pending_review', 'scheduled', 'active'));