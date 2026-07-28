-- Contact details for the letter's footer band.
--
-- The letterhead already held the firm name and address. A letter also carries a
-- telephone number, a website and a general email at the foot, and those were
-- nowhere on the firm record.
--
-- Safe to re-run: merges into the existing branding rather than replacing it, so
-- nothing already set is lost.

UPDATE firms
SET branding = branding || jsonb_build_object(
  'phone',   COALESCE(branding->>'phone',   '0113 246 8800'),
  'website', COALESCE(branding->>'website', 'www.harrowfenn.example'),
  'email',   COALESCE(branding->>'email',   'enquiries@harrowfenn.example')
)
WHERE slug = 'harrow-fenn';

SELECT name, branding->>'phone' AS phone, branding->>'website' AS website,
       branding->>'email' AS email
FROM firms;
