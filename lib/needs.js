// What this letter needs that the file does not already hold.
//
// The capture form asks the same three questions every time: who is the client, what
// was said on the call, check what I read from it. That is right for the first letter
// on a new matter and wrong for every letter after it.
//
// A closing letter is written six months later on a file that already knows the
// client, the reference, the fee earner, the rate, the scope and everything that has
// happened. There was no call. Asking for one implies there was, and asking again for
// facts already on the record is how a product earns a reputation for wasting time.
//
// So nothing here is declared by a template. It is worked out: take what the letter
// needs, subtract what the file holds, and ask for the difference. The same code gives
// a long form on a new matter and two questions on an old one, because the matter is
// at a different stage, not because someone configured it.

import {
  canonicalKey, fieldMeta, isSystemField, isHardFact, isFurnitureField,
  satisfiedByAlternative,
} from './fields.js';

// A note is the fee earner's account of something the file cannot know. How much it
// matters depends on the letter, and that is derivable rather than declared.
//
//   essential  The letter has sections that must be written fresh and the file holds
//              nothing to write them from. An engagement letter on a new matter: only
//              the person who took the call knows what was agreed.
//
//   useful     The file has history to draw on, and a note may add to it. A closing
//              letter where something happened that was never written down.
//
//   optional   Everything the letter needs is on the record. A chasing letter listing
//              what is outstanding needs no account from anybody.
export function noteImportance({ template, fields = [], history = [] }) {
  const blocks = template?.definition?.blocks || [];
  const bespoke = blocks.filter((b) => b.kind === 'bespoke').length;
  const known = fields.filter((f) => String(f.value ?? '').trim()).length;

  if (bespoke === 0) return 'optional';
  if (history.length === 0 && known < 4) return 'essential';
  if (history.length === 0) return 'essential';
  return 'useful';
}

// Everything this letter draws on, sorted into what is already known and what has to
// be asked for.
export function whatIsNeeded({ template, fields = [], history = [], matter = {} }) {
  const definition = template?.definition || {};
  const required = (definition.requiredFields || []).map(canonicalKey);

  const byKey = new Map(
    fields
      .filter((f) => String(f.value ?? '').trim())
      .map((f) => [canonicalKey(f.key), f]),
  );

  const seen = new Set();
  const have = [];
  const need = [];

  const values = Object.fromEntries(
    fields.map((f) => [canonicalKey(f.key), f.value]),
  );

  for (const raw of required) {
    const key = canonicalKey(raw);
    if (seen.has(key) || isSystemField(key)) continue;
    // A heading is not a fact, and a field answered another way is not a gap: an hourly
    // rate is not missing on a matter agreed at a fixed fee.
    if (isFurnitureField(raw) || isFurnitureField(key)) continue;
    if (satisfiedByAlternative(key, values)) continue;
    seen.add(key);

    const held = byKey.get(key);
    if (held) {
      have.push({
        key,
        label: fieldMeta(key).label,
        value: held.value,
        source: held.source,
        provenance: held.provenance,
        // A figure the file holds from an earlier letter is still a figure, and a
        // person should look at it again before it goes out on a new one.
        recheck: Boolean(held.is_numeric),
      });
    } else {
      need.push({ ...fieldMeta(key), key, hard: isHardFact(key) });
    }
  }

  // A figure taken from the record was agreed for an earlier letter and may have moved
  // since. It is not missing, so it does not block anything, but a person should look
  // at it before it goes out again.
  const recheck = have.filter((h) => h.recheck);

  return {
    have,
    need,
    recheck,
    // A letter written on a file with history can say what has happened. One written on
    // an empty file cannot, and should not try.
    canDrawOnHistory: history.length > 0,
    note: noteImportance({ template, fields, history }),
  };
}

// How the capture step should introduce itself, given what it found. A form that opens
// with "tell me about the call" when there was no call is a form that misunderstands
// the situation it is in.
export function captureIntro({ need = [], recheck = [], note, canDrawOnHistory }) {
  // Nothing to ask for. Say that plainly rather than counting to zero, which is how the
  // first version of this greeted a complete file: "0 things still needed".
  if (need.length === 0) {
    const source = canDrawOnHistory
      ? 'from the record and what has happened on this matter'
      : 'from the record';
    return {
      title: 'Everything needed is already on file',
      hint: recheck.length > 0
        ? `It will be written ${source}. Check the figures below are still right.`
        : note === 'optional'
          ? `It will be written ${source}.`
          : `It will be written ${source}. Add anything the file would not know.`,
    };
  }

  if (note === 'essential') {
    return {
      title: 'What was agreed',
      hint: 'Nothing on this file records the conversation, so the letter is written from '
        + 'what you say here.',
    };
  }

  const asks = need.length === 1 ? 'One thing' : `${need.length} things`;
  return {
    title: `${asks} still needed`,
    hint: canDrawOnHistory
      ? 'The rest comes from the file and what has happened on this matter so far.'
      : 'The rest is already on the record.',
  };
}
