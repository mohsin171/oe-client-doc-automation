-- Make the firm's letters searchable, so drafting can be shown the closest ones
-- rather than the most recent ones.
--
-- The column is generated rather than maintained, so it cannot fall out of step
-- with the text it indexes: Postgres recomputes it whenever the body changes, and
-- no application code has to remember to.
--
-- 'english' gives stemming and stopwords for free, which matters more than it
-- sounds. It means a search for "divorce" finds "divorcing", and that the word
-- "the" carries no weight. Ranking then favours terms that are rare across the
-- corpus, so "freehold" counts for far more than "letter" or "client", which
-- appear in everything a solicitor writes.
--
-- Safe to re-run.

ALTER TABLE precedents
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(body, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_precedents_tsv ON precedents USING GIN (tsv);

-- Ranking is always scoped to one firm and one kind of document, so the index
-- that narrows to those is worth having alongside.
CREATE INDEX IF NOT EXISTS idx_precedents_firm_type
  ON precedents (firm_id, doc_type);

SELECT count(*) AS letters_indexed,
       count(tsv) FILTER (WHERE tsv IS NOT NULL) AS with_index
FROM precedents;
