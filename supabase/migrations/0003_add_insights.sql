-- Add the procurement insights table (orchestrator output).
-- GENERATED from models.py via: uv run rsi schema --dialect postgres

CREATE TABLE insights (
	id SERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	category_id INTEGER, 
	market_code VARCHAR(2), 
	action VARCHAR(16) NOT NULL, 
	score FLOAT NOT NULL, 
	confidence FLOAT NOT NULL, 
	headline VARCHAR(512) NOT NULL, 
	narrative VARCHAR(4096) NOT NULL, 
	narrator VARCHAR(16) NOT NULL, 
	evidence JSON NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(category_id) REFERENCES product_categories (id), 
	FOREIGN KEY(market_code) REFERENCES countries (code)
);
