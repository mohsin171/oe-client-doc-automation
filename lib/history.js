// A matter's history, in words.
//
// Everything that has happened on a file is recorded as events: a code, a timestamp,
// a payload. That is the right shape for an audit trail and the wrong shape for a
// letter. A closing letter has to say what was done and when, and until now the only
// source for that was a fee earner typing it out again from a file the system already
// holds.
//
// Two rules run through this.
//
// Only what a client would recognise. A file records who signed in, who was granted
// cover, which precedents a draft was grounded on. None of that belongs in a letter to
// the client, and some of it should never leave the firm.
//
// Only what happened. This renders the record and adds nothing to it. If a fee was
// agreed on the phone and never written down, the history will not mention it, and the
// letter must not either. The file knows what was recorded, which is not the same as
// what occurred, and a letter drafted from it reads more authoritatively than it has
// earned. That is why the account is shown to the fee earner alongside the draft.

const CLIENT_FACING = {
  matter_created: () => 'the file was opened',
  matter_opened: () => 'the file was opened',
  document_generated: (e) => `${article(label(e))} ${label(e)} was drafted`,
  document_approved: (e) => `the ${label(e)} was approved internally`,
  document_issued: (e) => `the ${label(e)} was issued`,
  document_sent: (e) => `the ${label(e)} was sent to the client`,
  document_revised: (e) => `the ${label(e)} was revised`,
  matter_closed: () => 'the matter was closed',
};

// Changes to the record that a client would notice, because they change what the firm
// told them. A corrected email address is housekeeping; a changed fee is not.
const NOTABLE_CORRECTIONS = new Set([
  'hourly_rate', 'fixed_fee', 'fee_estimate', 'disbursements',
  'scope_summary', 'exclusions', 'completion_date',
]);

function label(event) {
  const t = event?.payload?.doc_type || event?.payload?.docType || 'letter';
  return String(t).replace(/_/g, ' ');
}

// "a engagement letter" is the kind of thing a reader notices and a writer does not.
function article(word) {
  return /^[aeiou]/i.test(String(word).trim()) ? 'an' : 'a';
}

function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// The account, oldest first, as a fee earner would recount it.
export function accountOf(timeline = []) {
  const lines = [];

  for (const e of [...timeline].reverse()) {
    const kind = String(e.kind || '');

    const render = CLIENT_FACING[kind];
    if (render) {
      const text = render(e);
      const date = when(e.created_at);
      if (text) lines.push(date ? `${date}: ${text}` : text);
      continue;
    }

    // A correction that changed something the client was told.
    if (kind === 'matter_corrected' || kind === 'client_details_corrected') {
      const changed = e.payload?.changed || {};
      for (const [field, move] of Object.entries(changed)) {
        if (!NOTABLE_CORRECTIONS.has(field)) continue;
        const date = when(e.created_at);
        const from = move?.from ?? '';
        const to = move?.to ?? '';
        const what = String(field).replace(/_/g, ' ');
        lines.push(date
          ? `${date}: the ${what} changed from ${from} to ${to}`
          : `the ${what} changed from ${from} to ${to}`);
      }
    }
  }

  // The same thing twice running is noise from a retry, not two events.
  return lines.filter((line, i) => line !== lines[i - 1]);
}

// What goes into the prompt. Empty on a new matter, which is correct: there is nothing
// to recount and a letter that invents a history is worse than one without.
export function historyForDrafting(timeline = []) {
  const lines = accountOf(timeline);
  if (lines.length === 0) return '';
  return [
    'What has happened on this file, from the record. Use it where the letter should say',
    'what was done and when. It is what was written down, which is not necessarily',
    'everything that happened, so do not present it as a complete account and do not add',
    'to it.',
    '',
    ...lines.map((l) => `- ${l}`),
  ].join('\n');
}
