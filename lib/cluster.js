// Sorting a pile of letters into kinds.
//
// A firm hands over its correspondence folder. It contains engagement letters, status
// updates, chases, completion letters and closing letters, and nobody has sorted them,
// because why would they.
//
// The counting that finds a firm's standard clauses depends on comparing like with like.
// Given one hundred and forty letters of seven kinds it found four standard clauses:
// the confidentiality marking, the letterhead, the complaints clause and "Yours
// sincerely". Everything else appears in one seventh of the pile and reads as variation.
// The result was a single useless template, and the instruction "upload one kind at a
// time" is not an answer, it is asking the firm to do the work.
//
// So the letters are grouped first. Two letters of the same kind share most of their
// paragraphs: the same headings, the same boilerplate, the same order. Two letters of
// different kinds share only the house style, which is a handful of paragraphs out of
// twenty. That difference is large and reliable, and it needs no model: it is counting.

const MIN_PARAGRAPH = 12;

function paragraphsOf(text) {
  return new Set(
    String(text || '')
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length >= MIN_PARAGRAPH),
  );
}

// How much two letters have in common, as a proportion of the smaller one. Overlap
// rather than Jaccard, because a long letter and a short one of the same kind should
// still count as related: the short one's paragraphs nearly all appear in the long one.
function overlap(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const p of small) if (large.has(p)) shared += 1;
  return shared / small.size;
}

// The house style appears in every kind, so it inflates every comparison. Paragraphs
// present in more than half the pile are set aside for the purpose of grouping: they say
// which firm wrote a letter, not which kind of letter it is.
function houseStyle(sets) {
  const counts = new Map();
  for (const s of sets) for (const p of s) counts.set(p, (counts.get(p) || 0) + 1);
  const half = sets.length / 2;
  const house = new Set();
  for (const [p, n] of counts) if (n > half) house.add(p);
  return house;
}

// Group by kind. Greedy and deterministic: walk the letters, put each with the group it
// most resembles, start a new group when it resembles none of them.
//
// The threshold is deliberately generous. Putting two kinds in one group produces a
// template with almost no standard clauses, which is visibly wrong and was the fault
// this fixes. Splitting one kind into two groups produces two similar templates, which
// is untidy but harmless, and a person can remove one.
// The wording most of a group shares. Not every member, because one letter of a kind
// often omits a clause, and not any member, because that is how a signature ends up
// describing an outlier.
function signatureOf(group) {
  const counts = new Map();
  for (const m of group.members) {
    for (const p of m.distinctive) counts.set(p, (counts.get(p) || 0) + 1);
  }
  const most = group.members.length * 0.6;
  const sig = new Set();
  for (const [p, n] of counts) if (n >= most) sig.add(p);
  return sig;
}

function mergeAlike(groups, threshold) {
  let merged = true;
  while (merged) {
    merged = false;
    const sigs = groups.map(signatureOf);

    let bestPair = null;
    let bestScore = threshold;
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const score = overlap(sigs[i], sigs[j]);
        if (score > bestScore) {
          bestScore = score;
          bestPair = [i, j];
        }
      }
    }

    if (bestPair) {
      const [i, j] = bestPair;
      groups[i].members.push(...groups[j].members);
      groups.splice(j, 1);
      merged = true;
    }
  }
}

export function groupByKind(documents, { threshold = 0.34, minGroup = 3 } = {}) {
  const docs = documents
    .map((d, i) => ({
      index: i,
      name: d.name || `document ${i + 1}`,
      text: d.text || d.body || '',
      paragraphs: paragraphsOf(d.text || d.body || ''),
    }))
    .filter((d) => d.paragraphs.size > 0);

  if (docs.length === 0) return { groups: [], ungrouped: [], house: 0 };

  const house = houseStyle(docs.map((d) => d.paragraphs));

  // Compare on what distinguishes a kind, not on what identifies the firm.
  for (const d of docs) {
    d.distinctive = new Set([...d.paragraphs].filter((p) => !house.has(p)));
  }

  const groups = [];
  for (const doc of docs) {
    let best = null;
    let bestScore = 0;

    for (const g of groups) {
      // Against the first member only, which is the cautious choice and splits a kind
      // into several groups when its letters vary. Comparing against the closest member
      // instead let a group chain from one kind into another: status updates were
      // absorbed into client care, and the standard clauses collapsed from fourteen to
      // five. The over-splitting is repaired in the second pass below, where merging can
      // be judged on a whole group rather than on one letter at a time.
      const score = overlap(doc.distinctive, g.members[0].distinctive);
      if (score > bestScore) {
        bestScore = score;
        best = g;
      }
    }

    if (best && bestScore >= threshold) best.members.push(doc);
    else groups.push({ members: [doc] });
  }

  // Second pass: put back together what the first pass split.
  //
  // A kind whose letters vary comes out as several groups. Completion letters split into
  // three, because they differ by area of work. Merging is decided on what a group has in
  // common rather than on any single letter: a group's signature is the wording most of
  // its members share, and two groups of the same kind have nearly the same signature
  // while two kinds share only the house style, which is already excluded.
  mergeAlike(groups, threshold);

  // Third pass: a group turns out a member that does not match it.
  //
  // Seven letters out of a hundred and forty landed in the wrong group, because a status
  // update that dwells on costs reads a little like an estimate revision. One stranger in
  // twenty is enough to cost a group several standard clauses, since a clause missing from
  // one letter is no longer in all of them. Better to set the stranger aside and say so
  // than to let it quietly weaken the counting.
  const rejected = [];
  for (const g of groups) {
    if (g.members.length < 5) continue;
    const sig = signatureOf(g);
    if (sig.size === 0) continue;
    const keep = [];
    for (const m of g.members) {
      if (overlap(m.distinctive, sig) >= 0.5) keep.push(m);
      else rejected.push(m);
    }
    if (keep.length >= minGroup) g.members = keep;
  }

  // A group of one or two is not a corpus. Nothing can be counted from it, and calling
  // two letters a kind would produce a template asserting that everything in them is
  // standard.
  const kept = groups.filter((g) => g.members.length >= minGroup);
  const ungrouped = [
    ...groups.filter((g) => g.members.length < minGroup).flatMap((g) => g.members.map((m) => m.name)),
    ...rejected.map((m) => m.name),
  ];

  return {
    groups: kept
      .sort((a, b) => b.members.length - a.members.length)
      .map((g) => ({
        size: g.members.length,
        names: g.members.map((m) => m.name),
        documents: g.members.map((m) => ({ name: m.name, text: m.text })),
      })),
    ungrouped,
    house: house.size,
  };
}

// A short description of what was found, for a person deciding whether to accept it.
export function describeGrouping({ groups, ungrouped, house }) {
  const parts = groups.map((g, i) => `${g.size} of one kind`);
  return {
    kinds: groups.length,
    sizes: groups.map((g) => g.size),
    houseClauses: house,
    ungrouped: ungrouped.length,
    summary: groups.length === 0
      ? 'No group large enough to count from.'
      : groups.length === 1
        ? `All ${groups[0].size} look like the same kind of letter.`
        : `${groups.length} kinds of letter: ${parts.join(', ')}.`
      + (ungrouped.length ? ` ${ungrouped.length} did not match any group.` : ''),
  };
}
