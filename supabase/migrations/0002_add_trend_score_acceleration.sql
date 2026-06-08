-- Add the leading-indicator column to trend_scores.
-- acceleration = growth-of-growth (positive = demand is accelerating).
ALTER TABLE trend_scores ADD COLUMN IF NOT EXISTS acceleration DOUBLE PRECISION NOT NULL DEFAULT 0.0;
