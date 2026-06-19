-- Add the product_idea_comments table for the "feedback on a product idea"
-- feature (team members leave comments on a submitted product idea). Additive;
-- models.py is the source of truth (regenerate, don't hand-edit, per the repo
-- convention) — this DDL mirrors ProductIdeaComment.
--
-- The web app writes rows via the service-role key; ids are UUIDs minted in the
-- web app (like product_ideas). Deleting an idea cascades to its comments.

CREATE TABLE IF NOT EXISTS product_idea_comments (
	id VARCHAR(36) NOT NULL,
	idea_id VARCHAR(36) NOT NULL,
	author VARCHAR(128),
	body VARCHAR(4096) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
	PRIMARY KEY (id),
	FOREIGN KEY(idea_id) REFERENCES product_ideas (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS product_idea_comments_idea_idx ON product_idea_comments (idea_id, created_at);
