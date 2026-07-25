-- Bring already-captured fields onto the shared vocabulary.
--
-- Values entered before the alias map existed were stored under whatever name
-- the extraction happened to use, so a fact captured as matter_description and
-- a template asking for scope_summary looked like two different things.
--
-- Safe to re-run. Where a matter already holds the canonical key, the older
-- duplicate is dropped rather than overwriting the newer value.

-- 1. Remove duplicates first, so the rename cannot collide.
DELETE FROM matter_fields old
USING matter_fields keep
WHERE old.matter_id = keep.matter_id
  AND keep.key = 'scope_summary'
  AND old.key IN ('matter_description', 'description', 'work_description');

DELETE FROM matter_fields old
USING matter_fields keep
WHERE old.matter_id = keep.matter_id
  AND keep.key = 'client_legal_name'
  AND old.key IN ('client_name', 'client_full_name', 'addressee', 'addressee_name');

DELETE FROM matter_fields old
USING matter_fields keep
WHERE old.matter_id = keep.matter_id
  AND keep.key = 'fee_earner_name'
  AND old.key IN ('sender_name', 'author_name', 'solicitor_name', 'fee_earner', 'handler_name');

DELETE FROM matter_fields old
USING matter_fields keep
WHERE old.matter_id = keep.matter_id
  AND keep.key = 'hourly_rate'
  AND old.key IN ('rate', 'charge_rate', 'hourly_charge');

-- 2. Rename what remains.
UPDATE matter_fields SET key = 'scope_summary'
  WHERE key IN ('matter_description', 'description', 'work_description');

UPDATE matter_fields SET key = 'client_legal_name'
  WHERE key IN ('client_name', 'client_full_name', 'addressee', 'addressee_name');

UPDATE matter_fields SET key = 'fee_earner_name'
  WHERE key IN ('sender_name', 'author_name', 'solicitor_name', 'fee_earner', 'handler_name');

UPDATE matter_fields SET key = 'hourly_rate'
  WHERE key IN ('rate', 'charge_rate', 'hourly_charge');

UPDATE matter_fields SET key = 'matter_type' WHERE key = 'work_type';
UPDATE matter_fields SET key = 'client_address'
  WHERE key IN ('client_address_block', 'addressee_address', 'recipient_address');

-- 3. Drop values the system now supplies itself. Keeping them means a stale
--    reference or a date from last week ends up on a letter.
DELETE FROM matter_fields
WHERE key IN ('letter_date', 'matter_reference', 'client_salutation',
              'firm_name', 'firm_address', 'fee_earner_title', 'matter_subject',
              'reference_code', 'date_of_letter', 'document_date', 'todays_date',
              'our_reference', 'file_reference', 'salutation', 'sender_title');

-- 4. What each matter now holds.
SELECT matter_id, string_agg(key, ', ' ORDER BY key) AS fields
FROM matter_fields GROUP BY matter_id ORDER BY matter_id;
