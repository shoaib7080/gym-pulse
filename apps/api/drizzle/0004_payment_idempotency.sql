ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "request_hash" text;
CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_uq" ON "payments" USING btree ("gym_id","idempotency_key") WHERE "idempotency_key" IS NOT NULL;
