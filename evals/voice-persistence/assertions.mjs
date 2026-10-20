// Pure assertion functions for voice-persistence evals.
//
// Derived from the specification — not from observed model output. The
// vocabulary cluster, Never-list, and exemplar rhythm rules trace back to:
//   - skills/using-fellowship/references/voice.md (canonical source)
//   - docs/fellowship/specs/2026-05-16-voice-persistence-spec.md
//
// Each assertion takes a single argument shape and returns
//   { pass: boolean, reason: string, evidence: array }
// where `evidence` carries the matched (or missing) tokens so a failing
// scenario can be diagnosed without re-running.
//
// Design constraint: pure functions, no I/O, no Claude calls. Live-session
// driving lives in run.mjs; this module is unit-testable in isolation.

// ── Vocabulary cluster ─────────────────────────────────────────────────────
//
// Source: voice.md line 19, "Vocabulary." section, plus the anchor's six
// "words that do the work". The cluster spans both — the anchor names six,
// voice.md adds *haste*. We include both, plus the meaningful-hedge tokens
// *perhaps* and *I suspect* (voice.md line 33: "Hedges with meaning").
//
// Match is whole-word, case-insensitive. Substring matches would catch
// "councillor" for "counsel" — we reject that.
export const TOLKIEN_VOCABULARY = [
  'counsel', 'folly', 'haste', 'peril', 'mark', 'prudent', 'burden',
  'perhaps', 'suspect',
];

// ── Forbidden phrases (the Never-list) ─────────────────────────────────────
//
// Source: voice.md lines 21–31, the closed-list "Never" section. Grouped here
// to keep failure reports readable. Match is case-insensitive substring with
// word boundary handling — we do NOT want "really" matching inside
// "realistically".
//
// Note on "I think": voice.md says "I think (when not load-bearing)". The
// load-bearing distinction cannot be made by string match. We include it
// anyway because the anchor is supposed to suppress empty hedges; if it
// fires often, the failing-scenario evidence shows the surrounding context
// and a human can adjudicate. Pragmatic call: false positives are visible,
// false negatives are not.
export const FORBIDDEN_FILLER = [
  'just', 'really', 'basically', 'actually', 'simply', 'literally',
  'definitely', 'certainly', 'essentially',
];
export const FORBIDDEN_PLEASANTRIES = [
  'great question', 'happy to help', 'sure thing', 'no problem',
  'absolutely', 'of course',
];
export const FORBIDDEN_EMPTY_HEDGES = [
  'i think', 'i believe', 'it seems like', 'sort of', 'kind of', "i'd say",
];
export const FORBIDDEN_TRAILING_FLUFF = [
  'at the end of the day', 'to wrap up', 'in summary', 'hope this helps',
  'let me know',
];
export const FORBIDDEN_ORIGINAL_FIVE = [
  'sounds like', 'makes sense', "that's fair", 'totally', 'looks good',
];

// Single closed list for scanning. Order matters only for the evidence
// output (longer phrases first so we don't double-count "of course" inside
// some longer phrase that contains it — none currently, but defensive).
export const ALL_FORBIDDEN = [
  ...FORBIDDEN_PLEASANTRIES,
  ...FORBIDDEN_EMPTY_HEDGES,
  ...FORBIDDEN_TRAILING_FLUFF,
  ...FORBIDDEN_ORIGINAL_FIVE,
  ...FORBIDDEN_FILLER,
].sort((a, b) => b.length - a.length);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Strip code blocks, fenced blocks, and inline code from a response. Voice
 * does not bleed into code per voice.md hard rule (line 101) — assertions
 * on conversational prose must exclude code regions, or a JSON payload
 * containing "just" or "really" would false-positive.
 */
export function stripArtifacts(text) {
  if (!text) return '';
  let out = String(text);
  // Fenced code blocks (```...```).
  out = out.replace(/```[\s\S]*?```/g, ' ');
  // Inline code spans (`...`).
  out = out.replace(/`[^`\n]+`/g, ' ');
  // XML-ish artifact blocks (<files_to_read>, <plan>, etc.) — voice should
  // not be evaluated inside these per voice.md "voice colors conversation,
  // never artifacts."
  out = out.replace(/<([a-z_][a-z0-9_-]*)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  return out;
}

/**
 * Whole-word case-insensitive find. Returns an array of matched tokens
 * (deduplicated, preserving order of first appearance).
 */
function findWholeWord(text, words) {
  const lower = text.toLowerCase();
  const found = [];
  const seen = new Set();
  for (const w of words) {
    // \b is unicode-naive but adequate for ASCII tokens we use here.
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower) && !seen.has(w)) {
      found.push(w);
      seen.add(w);
    }
  }
  return found;
}

/**
 * Case-insensitive phrase scan (no word-boundary requirement — phrases like
 * "sure thing" are multi-word and \b at both ends is fine, but "i think"
 * inside "i thinking" would be a false positive. We anchor on word boundary
 * at the end of the phrase to defend against that.
 */
function findPhrase(text, phrases) {
  const lower = text.toLowerCase();
  const found = [];
  const seen = new Set();
  for (const p of phrases) {
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(lower) && !seen.has(p)) {
      found.push(p);
      seen.add(p);
    }
  }
  return found;
}

// ── Assertion 1 — vocabulary presence ──────────────────────────────────────
//
// Spec: "At least one Tolkien-vocabulary word appears" across the response
// (or across the response set, depending on caller). We expose both
// granularities — per-response and aggregate — so the eval can attribute
// failure to a specific turn vs. the whole conversation.
export function assertVocabularyPresent(text, { minCount = 1 } = {}) {
  const cleaned = stripArtifacts(text);
  const found = findWholeWord(cleaned, TOLKIEN_VOCABULARY);
  return {
    pass: found.length >= minCount,
    reason: found.length >= minCount
      ? `found ${found.length} vocabulary token(s)`
      : `expected >=${minCount} vocabulary token(s), found ${found.length}`,
    evidence: found,
  };
}

// ── Assertion 2 — forbidden-phrase absence ─────────────────────────────────
//
// Spec: "Zero occurrences of the forbidden-phrase set". Stripped of
// artifacts (code, structured blocks) before scanning.
export function assertNoForbiddenPhrases(text) {
  const cleaned = stripArtifacts(text);
  const found = findPhrase(cleaned, ALL_FORBIDDEN);
  return {
    pass: found.length === 0,
    reason: found.length === 0
      ? 'no forbidden phrases'
      : `found forbidden: ${found.join(', ')}`,
    evidence: found,
  };
}

// ── Assertion 3 — exemplar rhythm ──────────────────────────────────────────
//
// Spec heuristic: "sentence with a comma or em-dash followed by a four-word-
// or-shorter final clause." We split on sentence terminators (. ! ?) and
// check each sentence for the pattern:
//
//   <leading content>[,—] <1–4 words> <terminator>
//
// Em-dash here is U+2014 (—). Hyphen-minus (-) does not count. Voice.md
// uses em-dashes explicitly; if a model dropped to hyphens that is a drift
// signal in itself.
//
// Edge cases:
//   - Quoted exemplars in the response (the model echoing voice.md back at
//     the user) would false-positive. Mitigated by stripping any sentence
//     wrapped in quote characters before scanning.
//   - Bullet lists end with terminators sometimes — included.
//   - Lists with a single trailing comma "X, Y, and Z." are not "clause +
//     short landing"; the 4-word window catches "Z." vs. "and Z." — both
//     short — and would mislabel. Accepted false-positive rate; spec
//     describes this as a heuristic, not a precise rule.
export function assertExemplarRhythm(text, { minCount = 1 } = {}) {
  const cleaned = stripArtifacts(text);

  // Strip quoted sentences (single, double, smart quotes). A quoted phrase
  // inside a sentence is fine; an entirely quoted sentence (echo of an
  // exemplar) we exclude.
  const withoutQuoted = cleaned.replace(/(["'“”‘’])[^"'“”‘’]{8,}\1/g, ' ');

  const sentences = withoutQuoted
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/);

  const hits = [];
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    // Pattern: pivot is the LAST comma or em-dash in the sentence.
    const m = s.match(/^(.*[,—])\s+([^,—]+?)([.!?])\s*$/);
    if (!m) continue;
    const tail = m[2].trim();
    const tailWords = tail.split(/\s+/).filter(Boolean);
    // 1 to 4 words inclusive. A two-clause sentence ending in a single short
    // verb-phrase is the rhythm; a sentence ending in five words is not.
    if (tailWords.length >= 1 && tailWords.length <= 4) {
      hits.push(s);
    }
  }
  return {
    pass: hits.length >= minCount,
    reason: hits.length >= minCount
      ? `found ${hits.length} exemplar-rhythm sentence(s)`
      : `expected >=${minCount} exemplar-rhythm sentence(s), found ${hits.length}`,
    evidence: hits.slice(0, 5),
  };
}

// ── Assertion 4 — drift rate ───────────────────────────────────────────────
//
// Spec: "register tells per response should not increase between turns 1–10
// and turns 11–20." A "register tell" is one forbidden-phrase occurrence.
// The rate is sum(occurrences) / number_of_responses for each half.
//
// We compare halves, not the global rate, because the failure mode is
// monotonic drift — the second half should not be worse than the first.
//
// Tolerance: an exact-equality comparison is brittle (zero in both halves
// would also fail under strict "strictly decreasing"). We define pass as:
// "second-half rate is not strictly greater than first-half rate", with a
// small absolute tolerance for noise (0.05 tells/response).
export function assertNoDrift(firstHalf, secondHalf, { tolerance = 0.05 } = {}) {
  const rate = (responses) => {
    if (responses.length === 0) return 0;
    let total = 0;
    for (const r of responses) {
      const cleaned = stripArtifacts(r);
      total += findPhrase(cleaned, ALL_FORBIDDEN).length;
    }
    return total / responses.length;
  };
  const r1 = rate(firstHalf);
  const r2 = rate(secondHalf);
  const pass = r2 <= r1 + tolerance;
  return {
    pass,
    reason: pass
      ? `no drift (first=${r1.toFixed(3)}, second=${r2.toFixed(3)}, tol=${tolerance})`
      : `drift detected (first=${r1.toFixed(3)}, second=${r2.toFixed(3)}, tol=${tolerance})`,
    evidence: { first_half_rate: r1, second_half_rate: r2, tolerance },
  };
}

// ── Assertion 5 — subagent voice isolation (Scenario 3) ────────────────────
//
// A subagent response should NOT carry Gandalf vocabulary or exemplar rhythm.
// This is the inverse of Assertion 1 + 3 — we want absence, not presence.
export function assertSubagentVoiceClean(text) {
  const cleaned = stripArtifacts(text);
  const vocab = findWholeWord(cleaned, TOLKIEN_VOCABULARY);
  const rhythm = assertExemplarRhythm(text, { minCount: 1 });
  // Some Tolkien-cluster words are common English (`mark`, `burden`). To
  // reduce false positives, we count it as bleed only if BOTH vocabulary
  // AND rhythm appear — Gandalf voice is the combination, not a single
  // shared word.
  const bleed = vocab.length >= 1 && rhythm.pass;
  return {
    pass: !bleed,
    reason: bleed
      ? `voice bleed: vocabulary=[${vocab.join(', ')}], rhythm=${rhythm.evidence.length} hit(s)`
      : 'subagent voice clean',
    evidence: { vocabulary: vocab, rhythm: rhythm.evidence },
  };
}

// ── Assertion 6 — artifact bleed (Scenario 4) ──────────────────────────────
//
// Scenario 4 asserts (a) the conversational prose retains voice (vocab +
// rhythm) AND (b) the artifact ITSELF is clean technical prose with no
// vocab and no rhythm.
//
// To split, we use the same artifact-extraction regexes as stripArtifacts
// in reverse: anything inside a fenced code block, inline code, or XML-ish
// block IS the artifact; everything else is conversational prose.
export function extractArtifactsAndProse(text) {
  if (!text) return { prose: '', artifacts: [] };
  const artifacts = [];

  // Capture fenced code blocks.
  let working = String(text).replace(/```[\s\S]*?```/g, (m) => {
    artifacts.push(m);
    return ' __ARTIFACT__ ';
  });
  // Capture XML-ish blocks.
  working = working.replace(/<([a-z_][a-z0-9_-]*)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => {
    artifacts.push(m);
    return ' __ARTIFACT__ ';
  });
  // Inline code we DON'T treat as a full artifact — too small to evaluate
  // independently. Strip from prose, don't add to artifacts.
  const prose = working.replace(/`[^`\n]+`/g, ' ').trim();
  return { prose, artifacts };
}

export function assertArtifactCleanProseHasVoice(text) {
  const { prose, artifacts } = extractArtifactsAndProse(text);

  const proseVocab = assertVocabularyPresent(prose);
  const proseRhythm = assertExemplarRhythm(prose);
  const proseHasVoice = proseVocab.pass || proseRhythm.pass;

  // Check artifacts. If no artifacts present, this assertion is N/A — the
  // caller should not have invoked it. We return pass=false with a clear
  // reason in that case so the eval flags a setup error rather than
  // silently passing.
  if (artifacts.length === 0) {
    return {
      pass: false,
      reason: 'no artifact found in response — scenario setup expected one',
      evidence: { prose_has_voice: proseHasVoice, artifacts: [] },
    };
  }

  // Each artifact should be clean — no vocabulary, no rhythm.
  const dirtyArtifacts = [];
  for (const a of artifacts) {
    const aVocab = findWholeWord(a, TOLKIEN_VOCABULARY);
    const aRhythm = assertExemplarRhythm(a);
    if (aVocab.length > 0 || aRhythm.pass) {
      dirtyArtifacts.push({
        preview: a.slice(0, 120),
        vocabulary: aVocab,
        rhythm: aRhythm.evidence,
      });
    }
  }

  const pass = proseHasVoice && dirtyArtifacts.length === 0;
  return {
    pass,
    reason: pass
      ? 'prose has voice, artifacts clean'
      : !proseHasVoice
        ? 'prose lacks voice (vocab and rhythm both absent)'
        : `voice bled into ${dirtyArtifacts.length} artifact(s)`,
    evidence: {
      prose_has_voice: proseHasVoice,
      prose_vocab: proseVocab.evidence,
      prose_rhythm: proseRhythm.evidence,
      dirty_artifacts: dirtyArtifacts,
      artifact_count: artifacts.length,
    },
  };
}
