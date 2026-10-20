// Unit tests for evals/voice-persistence/assertions.mjs.
//
// Strategy: these tests exercise the pure assertion functions against
// hand-crafted strings derived from the spec. They do not touch Claude.
// Run with: node --test evals/voice-persistence/assertions.test.mjs
//
// Why these matter: the four scenarios in the plan rely on these
// assertions. If the assertion logic itself is wrong, a passing eval is
// meaningless. These tests verify the assertions match the spec language.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertVocabularyPresent,
  assertNoForbiddenPhrases,
  assertExemplarRhythm,
  assertNoDrift,
  assertSubagentVoiceClean,
  assertArtifactCleanProseHasVoice,
  extractArtifactsAndProse,
  TOLKIEN_VOCABULARY,
  ALL_FORBIDDEN,
} from './assertions.mjs';

// ── Vocabulary presence ────────────────────────────────────────────────────

describe('assertVocabularyPresent', () => {
  it('passes when a single Tolkien word appears', () => {
    const r = assertVocabularyPresent('That is folly — better paths exist.');
    assert.equal(r.pass, true);
    assert.deepEqual(r.evidence, ['folly']);
  });

  it('passes when multiple cluster words appear', () => {
    const r = assertVocabularyPresent('Counsel before haste — that is prudent.');
    assert.equal(r.pass, true);
    assert.equal(r.evidence.length, 3);
  });

  it('fails when no cluster word appears', () => {
    const r = assertVocabularyPresent('That looks good. We should ship it.');
    assert.equal(r.pass, false);
    assert.deepEqual(r.evidence, []);
  });

  it('is case-insensitive', () => {
    const r = assertVocabularyPresent('PERIL ahead.');
    assert.equal(r.pass, true);
  });

  it('uses whole-word matching — "councillor" does not satisfy "counsel"', () => {
    const r = assertVocabularyPresent('The councillor spoke at length.');
    assert.equal(r.pass, false, '"councillor" must not match "counsel"');
  });

  it('does not count vocabulary inside code blocks', () => {
    // Voice does not bleed into artifacts; assertion should not credit
    // vocabulary that appears only inside code.
    const r = assertVocabularyPresent('```\nconst counsel = 1;\n```\nNothing here.');
    assert.equal(r.pass, false);
  });

  it('respects minCount when >1', () => {
    const r = assertVocabularyPresent('Folly.', { minCount: 2 });
    assert.equal(r.pass, false);
  });
});

// ── Forbidden phrases ──────────────────────────────────────────────────────

describe('assertNoForbiddenPhrases', () => {
  it('passes when no forbidden phrase appears', () => {
    const r = assertNoForbiddenPhrases('Gimli next — this is builder\'s work.');
    assert.equal(r.pass, true);
    assert.deepEqual(r.evidence, []);
  });

  it('catches filler words (whole-word)', () => {
    const r = assertNoForbiddenPhrases('That is really not the path.');
    assert.equal(r.pass, false);
    assert.ok(r.evidence.includes('really'));
  });

  it('does not flag "really" inside "realistically"', () => {
    const r = assertNoForbiddenPhrases('Realistically we have time.');
    // Should NOT trigger on "really" — substring trap.
    assert.equal(r.pass, true, 'whole-word match must avoid substring false positives');
  });

  it('catches pleasantries', () => {
    const r = assertNoForbiddenPhrases('Great question! Let me think.');
    assert.equal(r.pass, false);
    assert.ok(r.evidence.includes('great question'));
  });

  it('catches multi-word trailing fluff', () => {
    const r = assertNoForbiddenPhrases('Done. Hope this helps.');
    assert.equal(r.pass, false);
    assert.ok(r.evidence.includes('hope this helps'));
  });

  it('catches the original five', () => {
    const r = assertNoForbiddenPhrases('That makes sense to me.');
    assert.equal(r.pass, false);
    assert.ok(r.evidence.includes('makes sense'));
  });

  it('does not penalize forbidden tokens inside code blocks', () => {
    // Code is exempt per voice.md hard rule.
    const r = assertNoForbiddenPhrases('```\n// just an example\n```\nThe path is clear.');
    assert.equal(r.pass, true, 'forbidden tokens inside code must not fail the prose assertion');
  });

  it('does not penalize forbidden tokens inside XML-ish artifact blocks', () => {
    const r = assertNoForbiddenPhrases('<plan>just do this</plan>\nThe path is clear.');
    assert.equal(r.pass, true);
  });
});

// ── Exemplar rhythm ────────────────────────────────────────────────────────

describe('assertExemplarRhythm', () => {
  it('catches the canonical exemplar rhythm (em-dash, short tail)', () => {
    const r = assertExemplarRhythm('Gimli next — this is builder\'s work.');
    assert.equal(r.pass, true);
    assert.equal(r.evidence.length, 1);
  });

  it('catches comma-pivot rhythm', () => {
    const r = assertExemplarRhythm('When in doubt, follow your nose.');
    assert.equal(r.pass, true);
  });

  it('rejects sentences with no pivot at all', () => {
    const r = assertExemplarRhythm('This is a flat statement of fact.');
    assert.equal(r.pass, false);
  });

  it('rejects sentences with a long tail after the pivot', () => {
    // Eight words after the comma — not the rhythm.
    const r = assertExemplarRhythm('I read the code, and it works very well indeed for production purposes.');
    assert.equal(r.pass, false);
  });

  it('excludes quoted exemplars (avoids echo-of-voice.md false positive)', () => {
    // If the model echoes an exemplar wholesale, that is not the model
    // writing in voice — it is quoting. The assertion should not credit it.
    const r = assertExemplarRhythm('I will reply with "When in doubt, follow your nose." then move on.');
    assert.equal(r.pass, false, 'pure echoes inside quotes should not count');
  });

  it('does not evaluate code-block content for rhythm', () => {
    const r = assertExemplarRhythm('```\nsome code, with commas.\n```\nFlat statement here.');
    assert.equal(r.pass, false);
  });

  it('requires em-dash (U+2014), not hyphen-minus', () => {
    // Spec uses em-dash explicitly. Hyphen-only fallback is a drift signal.
    const r = assertExemplarRhythm('Gimli next - this is work.');
    assert.equal(r.pass, false, 'hyphen-minus must not satisfy em-dash rhythm');
  });
});

// ── Drift rate ─────────────────────────────────────────────────────────────

describe('assertNoDrift', () => {
  it('passes when both halves are clean', () => {
    const r = assertNoDrift(
      ['Counsel before haste.', 'Mark the cost.'],
      ['Folly avoided.', 'Prudent path.']
    );
    assert.equal(r.pass, true);
  });

  it('fails when second half has materially more forbidden phrases', () => {
    const r = assertNoDrift(
      ['Counsel before haste.', 'Mark the cost.'],
      ['That makes sense, I think.', 'Sounds like a plan, really.']
    );
    assert.equal(r.pass, false);
  });

  it('passes when second half is the same or slightly noisier within tolerance', () => {
    const r = assertNoDrift(
      ['Folly.', 'Folly.'],
      ['Folly.', 'Folly.']
    );
    assert.equal(r.pass, true);
  });

  it('reports rates in evidence for diagnosis', () => {
    const r = assertNoDrift(['clean'], ['really really clean']);
    assert.ok('first_half_rate' in r.evidence);
    assert.ok('second_half_rate' in r.evidence);
  });
});

// ── Subagent voice cleanliness (Scenario 3) ───────────────────────────────

describe('assertSubagentVoiceClean', () => {
  it('passes for a flat technical response with no voice', () => {
    const r = assertSubagentVoiceClean('Status: DONE. All 14 tests pass. Files: src/auth.ts.');
    assert.equal(r.pass, true);
  });

  it('does not flag a single common-English vocab word in isolation', () => {
    // "mark" is in the cluster but also normal English. Without rhythm,
    // we accept it as common-English, not voice bleed.
    const r = assertSubagentVoiceClean('Done. The mark on line 14 was updated.');
    assert.equal(r.pass, true, 'isolated vocab without rhythm is not bleed');
  });

  it('flags clear voice bleed (vocab AND rhythm together)', () => {
    const r = assertSubagentVoiceClean('Counsel before haste — that is prudent.');
    assert.equal(r.pass, false);
  });
});

// ── Artifact mode (Scenario 4) ────────────────────────────────────────────

describe('extractArtifactsAndProse', () => {
  it('separates fenced code from prose', () => {
    const { prose, artifacts } = extractArtifactsAndProse(
      'Here is the change — read it carefully.\n```\nconst x = 1;\n```\nThe seams hold.'
    );
    assert.equal(artifacts.length, 1);
    assert.ok(prose.includes('Here is the change'));
    assert.ok(!prose.includes('const x = 1'));
  });

  it('captures XML-ish blocks as artifacts', () => {
    const { artifacts } = extractArtifactsAndProse(
      '<plan>step 1\nstep 2</plan>\nThat is the path.'
    );
    assert.equal(artifacts.length, 1);
  });
});

describe('assertArtifactCleanProseHasVoice', () => {
  it('passes when prose has voice and artifact is clean technical prose', () => {
    const text = [
      'Counsel before haste — that is prudent.',
      '```',
      'function add(a, b) { return a + b; }',
      '```',
    ].join('\n');
    const r = assertArtifactCleanProseHasVoice(text);
    assert.equal(r.pass, true, r.reason);
  });

  it('fails when the artifact itself carries voice (bleed)', () => {
    const text = [
      'Counsel before haste — that is prudent.',
      '```',
      '// Counsel before haste — write tests first.',
      'function add(a, b) { return a + b; }',
      '```',
    ].join('\n');
    const r = assertArtifactCleanProseHasVoice(text);
    assert.equal(r.pass, false);
    assert.ok(r.evidence.dirty_artifacts.length >= 1);
  });

  it('fails when prose has no voice', () => {
    const text = [
      'OK here is the code.',
      '```',
      'function add(a, b) { return a + b; }',
      '```',
    ].join('\n');
    const r = assertArtifactCleanProseHasVoice(text);
    assert.equal(r.pass, false);
  });

  it('fails when no artifact present (scenario setup error)', () => {
    const r = assertArtifactCleanProseHasVoice('Just prose, no artifact.');
    assert.equal(r.pass, false);
    assert.ok(r.reason.includes('no artifact'));
  });
});

// ── Sanity checks on the closed lists ──────────────────────────────────────
//
// If the Never-list changes in voice.md, these tests should be the canary.
// They are intentionally rigid — fail loudly when voice.md drifts from the
// assertion library.

describe('closed-list integrity', () => {
  it('TOLKIEN_VOCABULARY matches the spec/voice.md cluster (no extras, no missing)', () => {
    // Source of truth: voice.md line 19 + anchor "words that do the work" +
    // meaningful hedges (perhaps, suspect).
    const expected = [
      'counsel', 'folly', 'haste', 'peril', 'mark', 'prudent', 'burden',
      'perhaps', 'suspect',
    ].sort();
    assert.deepEqual([...TOLKIEN_VOCABULARY].sort(), expected);
  });

  it('ALL_FORBIDDEN contains representative tokens from each of the five groups', () => {
    const lower = ALL_FORBIDDEN.map((s) => s.toLowerCase());
    // Filler
    assert.ok(lower.includes('just'));
    // Pleasantries
    assert.ok(lower.includes('great question'));
    // Empty hedges
    assert.ok(lower.includes('i think'));
    // Trailing fluff
    assert.ok(lower.includes('in summary'));
    // Original five
    assert.ok(lower.includes('makes sense'));
  });
});
