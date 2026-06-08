-- Published read-model the dashboard consumes (the `rsi export` output).
-- One row per export; the web reads the most recent via the anon key. RLS allows
-- public SELECT (dashboard data is non-sensitive); writes go through the pipeline's
-- direct Postgres connection (service role), which bypasses RLS.

CREATE TABLE IF NOT EXISTS snapshots (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB NOT NULL
);

ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshots public read" ON snapshots;
CREATE POLICY "snapshots public read" ON snapshots
  FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS snapshots_created_at_idx ON snapshots (created_at DESC);
