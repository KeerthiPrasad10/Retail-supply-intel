-- Per-connector ingest telemetry — the "signal sources" panel reads this
-- (last run, status, rows) for each feed. Written by `rsi ingest` via the
-- pipeline's service-role connection; the dashboard consumes it indirectly
-- through the published snapshot, so no anon RLS policy is needed (matching
-- the other pipeline-only tables in 0001).
-- GENERATED from models.py via: uv run rsi schema --dialect postgres

CREATE TABLE IF NOT EXISTS source_status (
	name VARCHAR(32) NOT NULL,
	last_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
	status VARCHAR(16) NOT NULL,
	rows INTEGER NOT NULL,
	detail VARCHAR(256),
	PRIMARY KEY (name)
);
