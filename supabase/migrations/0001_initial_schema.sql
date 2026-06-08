-- Retail Supply Intel — initial schema
-- GENERATED from pipelines/src/rsi/models.py via: uv run rsi schema --dialect postgres
-- Regenerate after model changes; keep models.py as the source of truth.
-- Layers: reference (countries, product_categories) · demand (trends,
-- trend_observations, trend_scores) · supply (suppliers, trade_flows,
-- competitors, competitor_sourcing) · output (triggers).

CREATE TABLE countries (
	code VARCHAR(2) NOT NULL, 
	iso3 VARCHAR(3), 
	name VARCHAR(128) NOT NULL, 
	region VARCHAR(64), 
	PRIMARY KEY (code)
);

CREATE TABLE product_categories (
	id SERIAL NOT NULL, 
	name VARCHAR(128) NOT NULL, 
	hs_code VARCHAR(6), 
	parent_id INTEGER, 
	keywords JSON NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name), 
	FOREIGN KEY(parent_id) REFERENCES product_categories (id)
);

CREATE TABLE competitors (
	id SERIAL NOT NULL, 
	name VARCHAR(128) NOT NULL, 
	home_country VARCHAR(2), 
	PRIMARY KEY (id), 
	UNIQUE (name), 
	FOREIGN KEY(home_country) REFERENCES countries (code)
);

CREATE TABLE suppliers (
	id SERIAL NOT NULL, 
	name VARCHAR(256) NOT NULL, 
	country_code VARCHAR(2), 
	category_id INTEGER, 
	external_id VARCHAR(128), 
	source VARCHAR(32), 
	PRIMARY KEY (id), 
	FOREIGN KEY(country_code) REFERENCES countries (code), 
	FOREIGN KEY(category_id) REFERENCES product_categories (id)
);

CREATE TABLE trade_flows (
	id SERIAL NOT NULL, 
	reporter_code VARCHAR(2), 
	partner_code VARCHAR(2), 
	category_id INTEGER, 
	hs_code VARCHAR(6), 
	period VARCHAR(8) NOT NULL, 
	flow VARCHAR(8) NOT NULL, 
	trade_value FLOAT NOT NULL, 
	qty FLOAT, 
	source VARCHAR(32) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_trade_flow UNIQUE (reporter_code, partner_code, hs_code, period, flow), 
	FOREIGN KEY(reporter_code) REFERENCES countries (code), 
	FOREIGN KEY(partner_code) REFERENCES countries (code), 
	FOREIGN KEY(category_id) REFERENCES product_categories (id)
);

CREATE TABLE trends (
	id SERIAL NOT NULL, 
	term VARCHAR(256) NOT NULL, 
	platform VARCHAR(32) NOT NULL, 
	category_id INTEGER, 
	first_seen TIMESTAMP WITH TIME ZONE NOT NULL, 
	last_seen TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_trend_term_platform UNIQUE (term, platform), 
	FOREIGN KEY(category_id) REFERENCES product_categories (id)
);

CREATE TABLE competitor_sourcing (
	id SERIAL NOT NULL, 
	competitor_id INTEGER NOT NULL, 
	supplier_id INTEGER, 
	partner_code VARCHAR(2), 
	category_id INTEGER, 
	period VARCHAR(8), 
	signal FLOAT NOT NULL, 
	source VARCHAR(32), 
	PRIMARY KEY (id), 
	FOREIGN KEY(competitor_id) REFERENCES competitors (id), 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id), 
	FOREIGN KEY(partner_code) REFERENCES countries (code), 
	FOREIGN KEY(category_id) REFERENCES product_categories (id)
);

CREATE TABLE trend_observations (
	id SERIAL NOT NULL, 
	trend_id INTEGER NOT NULL, 
	country_code VARCHAR(2), 
	observed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	value FLOAT NOT NULL, 
	source VARCHAR(32) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_obs UNIQUE (trend_id, country_code, observed_at, source), 
	FOREIGN KEY(trend_id) REFERENCES trends (id), 
	FOREIGN KEY(country_code) REFERENCES countries (code)
);

CREATE TABLE trend_scores (
	id SERIAL NOT NULL, 
	trend_id INTEGER NOT NULL, 
	country_code VARCHAR(2), 
	as_of TIMESTAMP WITH TIME ZONE NOT NULL, 
	momentum FLOAT NOT NULL, 
	growth_rate FLOAT NOT NULL, 
	volume FLOAT NOT NULL, 
	rank INTEGER, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_score UNIQUE (trend_id, country_code, as_of), 
	FOREIGN KEY(trend_id) REFERENCES trends (id), 
	FOREIGN KEY(country_code) REFERENCES countries (code)
);

CREATE TABLE triggers (
	id SERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	trend_id INTEGER, 
	country_code VARCHAR(2), 
	category_id INTEGER, 
	partner_code VARCHAR(2), 
	supplier_id INTEGER, 
	score FLOAT NOT NULL, 
	rationale VARCHAR(1024) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	payload JSON NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(trend_id) REFERENCES trends (id), 
	FOREIGN KEY(country_code) REFERENCES countries (code), 
	FOREIGN KEY(category_id) REFERENCES product_categories (id), 
	FOREIGN KEY(partner_code) REFERENCES countries (code), 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id)
);

