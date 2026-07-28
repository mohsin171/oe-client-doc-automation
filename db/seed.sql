-- Orca Edge Tool 2 seed. Safe to re-run.
-- Adds nothing destructive. No truncates, no cascade deletes.
-- All strings are single line on purpose: the Neon SQL editor can roll back on multi-line literals.

-- Demo firm (illustrative, fictional)
INSERT INTO firms (name, slug, vertical, branding, settings)
VALUES (
  'Harrow & Fenn Solicitors',
  'harrow-fenn',
  'law',
  '{"letterhead":"Harrow & Fenn Solicitors","shortName":"Harrow & Fenn","address":"18 Bishopsgate Row, Leeds LS1 4TQ","headingFont":"Georgia","bodyFont":"Arial","refFormat":"HF/{year}/{seq}","signatureBlock":"Harrow & Fenn Solicitors, regulated by the Solicitors Regulation Authority","initials":"HF","markFrom":"#1B3A5C","markTo":"#0E2237","accent":"#8C6B3F","phone":"0113 246 8800","website":"www.harrowfenn.example","email":"enquiries@harrowfenn.example"}',
  '{"senderPolicy":"assigned_fee_earner","baselineMinutes":{"engagement_letter":95,"client_care_letter":45,"status_letter":25},"currency":"GBP"}'
)
ON CONFLICT (slug) DO NOTHING;

-- Owner account
INSERT INTO users (firm_id, email, name, role, charge_rate)
SELECT id, 'mohsinali.05961@gmail.com', 'Mohsin Ali', 'owner', NULL
FROM firms WHERE slug = 'harrow-fenn'
ON CONFLICT (firm_id, email) DO NOTHING;

-- No other people are seeded. The owner invites their own team from the
-- Team screen, which is also how a real firm would be onboarded.

-- Starter template: engagement letter.
-- blocks are ordered. kind is fixed | field | bespoke.
-- Nothing in a fixed block is ever seen by the model.
INSERT INTO templates (firm_id, name, doc_type, version, definition)
SELECT
  f.id,
  'Engagement Letter',
  'engagement_letter',
  1,
  '{"requiredFields":["client_legal_name","client_address","matter_type","fee_basis","hourly_rate","scope_summary","fee_earner_name","engagement_date"],"blocks":[{"key":"header","kind":"fixed","body":"Private and confidential"},{"key":"salutation","kind":"field","body":"Dear {client_legal_name},"},{"key":"intro","kind":"fixed","body":"Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which we will act for you, together with our estimate of costs and the basis on which we will charge."},{"key":"scope","kind":"bespoke","prompt":"Describe the agreed scope of work for this matter in two short paragraphs, in the firm voice. State clearly what is included and what is excluded. Use only the facts supplied."},{"key":"fees","kind":"field","body":"Our charges will be calculated on a {fee_basis} basis at a rate of {hourly_rate} per hour, exclusive of VAT and disbursements."},{"key":"fee_cap","kind":"fixed","body":"We will not exceed the agreed estimate without first discussing it with you and obtaining your written authority."},{"key":"complaints","kind":"fixed","body":"If you are unhappy with any aspect of our service you may raise it with the supervising partner. You may also be entitled to complain to the Legal Ombudsman."},{"key":"closing","kind":"field","body":"Yours sincerely, {fee_earner_name}, Harrow & Fenn Solicitors"}],"reviewRules":[{"code":"fee_cap_present","severity":"blocking","check":"fixed_block_present","target":"fee_cap","message":"The fee cap clause is missing. This firm requires it on every engagement letter."},{"code":"rate_consistency","severity":"blocking","check":"numeric_consistency","fields":["hourly_rate"],"message":"The hourly rate appears in more than one form in this document."},{"code":"name_consistency","severity":"blocking","check":"name_consistency","fields":["client_legal_name"],"message":"The client name appears in more than one form."},{"code":"date_not_past","severity":"blocking","check":"date_not_past","fields":["engagement_date"],"message":"The engagement date is in the past."},{"code":"scope_exclusions","severity":"advisory","check":"bespoke_mentions","target":"scope","keywords":["not include","excluded","outside the scope"],"message":"The scope section does not state any exclusions. Consider whether it should."}]}'
FROM firms f WHERE f.slug = 'harrow-fenn'
  AND NOT EXISTS (SELECT 1 FROM templates t WHERE t.firm_id = f.id AND t.doc_type = 'engagement_letter');

-- A precedent to ground bespoke drafting
INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT f.id, 'engagement_letter', 'scope', 'We will act for you in connection with the purchase of the freehold property described above. Our work includes reviewing the contract and title, raising and reporting on searches and enquiries, reporting to you before exchange, and completing the purchase and registration. Our work does not include advice on the physical condition of the property, tax planning, or any dispute arising after completion, on which we would be pleased to advise separately.'
FROM firms f WHERE f.slug = 'harrow-fenn'
  AND NOT EXISTS (SELECT 1 FROM precedents p WHERE p.firm_id = f.id AND p.section_key = 'scope');
