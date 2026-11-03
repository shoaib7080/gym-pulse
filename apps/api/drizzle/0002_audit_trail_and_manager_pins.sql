-- 1. Manager PINs table
CREATE TABLE IF NOT EXISTS "manager_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"pin_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_pins_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "manager_pins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "manager_pins_gym_user_uq" ON "manager_pins" USING btree ("gym_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "manager_pins_gym_idx" ON "manager_pins" USING btree ("gym_id");--> statement-breakpoint

-- 2. Audit logs cryptographic chain columns
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "chain_key" text;--> statement-breakpoint
UPDATE "audit_logs" SET "chain_key" = COALESCE("gym_id"::text, 'platform') WHERE "chain_key" IS NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "chain_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "hash_version" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_chain_key_id_idx" ON "audit_logs" USING btree ("chain_key","id");--> statement-breakpoint

-- 3. Strip legacy managerPin from gym settings JSON
UPDATE "gyms" SET "settings" = "settings" - 'managerPin' WHERE "settings" ? 'managerPin';--> statement-breakpoint

-- 4. Immutable append-only triggers for audit_logs, invoices, membership_adjustments, check_ins
CREATE OR REPLACE FUNCTION forbid_update_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only: updates and deletes are forbidden', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;--> statement-breakpoint
CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS invoices_immutable ON invoices;--> statement-breakpoint
CREATE TRIGGER invoices_immutable
BEFORE UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS membership_adjustments_immutable ON membership_adjustments;--> statement-breakpoint
CREATE TRIGGER membership_adjustments_immutable
BEFORE UPDATE OR DELETE ON membership_adjustments
FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS check_ins_immutable ON check_ins;--> statement-breakpoint
CREATE TRIGGER check_ins_immutable
BEFORE UPDATE OR DELETE ON check_ins
FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();
