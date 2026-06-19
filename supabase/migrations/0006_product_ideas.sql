-- Add the product_ideas table for the "Validate" feature (submit a product idea
-- -> multi-agent research & benchmark). Additive; models.py is the source of
-- truth (regenerate, don't hand-edit, per the repo convention).
--
-- The web app writes rows via the service-role key; the idea's analysis is also
-- fanned out onto suppliers / competitors / triggers (no snapshots row).

CREATE TABLE IF NOT EXISTS product_ideas (
	id VARCHAR(36) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
	title VARCHAR(256) NOT NULL,
	description VARCHAR(4096) NOT NULL DEFAULT '',
	category_id INTEGER,
	image_url VARCHAR(2048),
	target_market VARCHAR(256),
	price_target VARCHAR(64),
	category VARCHAR(128),
	audience VARCHAR(256),
	features VARCHAR(4096),
	submitted_by VARCHAR(128),
	status VARCHAR(16) NOT NULL DEFAULT 'queued',
	research JSON NOT NULL DEFAULT '{}',
	PRIMARY KEY (id),
	FOREIGN KEY(category_id) REFERENCES product_categories (id)
);

CREATE INDEX IF NOT EXISTS product_ideas_created_at_idx ON product_ideas (created_at DESC);
