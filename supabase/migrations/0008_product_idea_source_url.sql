-- Add source_url column to store the product page URL a submitter scraped from.
ALTER TABLE product_ideas
  ADD COLUMN IF NOT EXISTS source_url TEXT;
