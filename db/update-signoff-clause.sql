-- Replace the sign-and-return clause in the saved template.
--
-- The letter asked the client to sign and return an enclosed copy. There is no
-- enclosure, and no way for them to sign and send one back, so the letter was
-- asking for something the firm cannot receive.
--
-- Changed here rather than by editing each letter, because the wording belongs
-- to the template: every future letter should carry the new sentence, and the
-- letters already issued keep what they actually said.
--
-- Safe to re-run: matches on the old text, so a second run changes nothing.

UPDATE templates SET definition = jsonb_set(
  definition,
  '{blocks}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN block->>'body' LIKE 'Please sign and return the enclosed copy%'
        THEN jsonb_set(block, '{body}', to_jsonb(
          'Please confirm by return that you agree to these terms, so that we may begin '
          || 'work. If anything in this letter does not match your understanding of what we '
          || 'discussed, tell us before you do so.'
        ))
        ELSE block
      END
      ORDER BY ordinality
    )
    FROM jsonb_array_elements(definition->'blocks') WITH ORDINALITY AS t(block, ordinality)
  )
)
WHERE definition->'blocks' @> '[{"kind":"fixed"}]'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(definition->'blocks') AS b
    WHERE b->>'body' LIKE 'Please sign and return the enclosed copy%'
  );

-- The corpus keeps the wording it was written with, since those are the letters
-- the firm actually sent. Only the derived template changes.

SELECT name,
       (SELECT count(*) FROM jsonb_array_elements(definition->'blocks') b
         WHERE b->>'body' LIKE 'Please confirm by return%') AS updated_clauses
FROM templates;
