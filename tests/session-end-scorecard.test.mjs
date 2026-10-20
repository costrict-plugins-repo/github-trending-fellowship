/**
 * Tests for the scorecard ledger in hooks/fellowship-session-end.mjs.
 *
 * Strategy: run the hook as a subprocess with a stdin payload, a fixture
 * JSONL transcript, and temp CLAUDE_CONFIG_DIR / CLAUDE_PROJECT_DIR / HOME
 * (HOME redirected so the trace log never touches the real one). Covers:
 *
 *   - one JSONL record per DONE/APPROVED report block, with the v1 fields
 *   - failure-shape statuses (CHANGES_REQUESTED) recorded; review_cycle
 *     increments per verdict on the same artifact; reconciliation untouched
 *   - the report-format template line produces no records
 *   - state dir uncreatable → no write anywhere, exit 0 (fail-silent)
 *   - malformed transcript → no records, exit clean
 *   - append preserves prior ledger lines
 *   - ambiguous artifact attribution (two paths in window) → field omitted
 *
 * Invariant checked throughout: the hook never creates files in the user's
 * project tree.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync,
  mkdtempSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { projectSlug } from '../hooks/lib/subagent-detection.mjs';

const REPO_ROOT = join(import.meta.dirname, '..');
const HOOK_PATH = join(REPO_ROOT, 'hooks', 'fellowship-session-end.mjs');

const ARTIFACT_RELPATH = 'docs/fellowship/specs/2026-06-01-auth.md';

let configDir;
let projDir;
let homeDir;
let scratchDir;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), 'scorecard-config-'));
  projDir = mkdtempSync(join(tmpdir(), 'scorecard-project-'));
  homeDir = mkdtempSync(join(tmpdir(), 'scorecard-home-'));
  scratchDir = mkdtempSync(join(tmpdir(), 'scorecard-scratch-'));

  // The hook bails before the scan when docs/fellowship/ is absent.
  mkdirSync(join(projDir, 'docs', 'fellowship', 'specs'), { recursive: true });
  writeFileSync(
    join(projDir, ARTIFACT_RELPATH),
    '---\nstatus: active\n---\n# Auth spec\n',
  );
});

afterEach(() => {
  for (const dir of [configDir, projDir, homeDir, scratchDir]) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function transcriptLine(text) {
  return JSON.stringify({ message: { content: [{ type: 'text', text }] } });
}

/** Write a fixture transcript (one text block per entry) outside the project tree. */
function writeTranscript(texts) {
  const p = join(scratchDir, 'transcript.jsonl');
  writeFileSync(p, texts.map(transcriptLine).join('\n') + '\n');
  return p;
}

/** Run the hook with a SessionEnd payload. Returns { status, stdout, stderr }. */
function runHook(transcriptPath, env = {}) {
  const payload = {
    session_id: 'sess-scorecard-1',
    reason: 'exit',
    cwd: projDir,
    hook_event_name: 'SessionEnd',
    transcript_path: transcriptPath,
  };
  return spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      PATH: process.env.PATH,
      HOME: homeDir,
      CLAUDE_CONFIG_DIR: configDir,
      CLAUDE_PROJECT_DIR: projDir,
      ...env,
    },
  });
}

function ledgerPath() {
  return join(
    configDir, 'fellowship', 'state',
    projectSlug(projDir) + '.scorecard.jsonl',
  );
}

function readLedger() {
  return readFileSync(ledgerPath(), 'utf8')
    .trim().split('\n').map((l) => JSON.parse(l));
}

const DONE_REPORT = [
  'Status: DONE',
  '',
  'What was built:',
  '  Auth middleware per the spec.',
  '',
  `Files changed: ${ARTIFACT_RELPATH}`,
  '',
  'Gimli verified the build.',
].join('\n');

const APPROVED_REPORT = [
  'Status: APPROVED',
  '',
  `Legolas reviewed ${ARTIFACT_RELPATH}. The build holds.`,
].join('\n');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scorecard ledger — record append', () => {
  it('appends one record per DONE/APPROVED report with the v1 fields', () => {
    const res = runHook(writeTranscript([DONE_REPORT, APPROVED_REPORT]));
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);

    const records = readLedger();
    assert.equal(records.length, 2);

    const [done, approved] = records;
    assert.equal(done.status, 'DONE');
    assert.equal(done.companion, 'gimli');
    assert.equal(done.artifact, ARTIFACT_RELPATH);
    assert.equal(done.session_id, 'sess-scorecard-1');
    assert.equal(done.source, 'session-end-v1');
    assert.ok(!Number.isNaN(Date.parse(done.ts)), 'ts must be ISO-parseable');
    assert.ok(!('review_cycle' in done), 'review_cycle only on reviewer verdicts');

    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.companion, 'legolas');
    assert.equal(approved.artifact, ARTIFACT_RELPATH);
    assert.equal(approved.review_cycle, 1);

    // Invariant: nothing new lands in the project tree.
    assert.deepEqual(readdirSync(projDir), ['docs']);
  });

  it('records failure shapes and increments review_cycle per verdict on the same artifact', () => {
    const changesRequested = [
      'Status: CHANGES_REQUESTED',
      '',
      `Legolas reviewed ${ARTIFACT_RELPATH}. Two critical findings.`,
    ].join('\n');
    const res = runHook(writeTranscript([changesRequested, APPROVED_REPORT]));
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);

    const records = readLedger();
    assert.equal(records.length, 2);
    assert.equal(records[0].status, 'CHANGES_REQUESTED');
    assert.equal(records[0].review_cycle, 1);
    assert.equal(records[1].status, 'APPROVED');
    assert.equal(records[1].review_cycle, 2);

    // Reconciliation isolation: neither status transitions an `active`
    // artifact (CHANGES_REQUESTED is ledger-only; APPROVED requires
    // `implemented`), so the spec must be untouched and unarchived.
    const artifact = readFileSync(join(projDir, ARTIFACT_RELPATH), 'utf8');
    assert.match(artifact, /^status: active$/m);
  });

  it('omits the artifact field when the report window names more than one path', () => {
    const ambiguous = [
      'Status: DONE',
      '',
      'Gimli touched docs/fellowship/specs/2026-06-01-auth.md and',
      'docs/fellowship/plans/2026-06-01-auth-plan.md in one pass.',
    ].join('\n');
    const res = runHook(writeTranscript([ambiguous]));
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);

    const records = readLedger();
    assert.equal(records.length, 1);
    assert.equal(records[0].status, 'DONE');
    assert.ok(!('artifact' in records[0]), 'ambiguous attribution must be omitted, not guessed');
  });

  it('ignores the report-format template line (Status: DONE | ...)', () => {
    const template = [
      'Report format:',
      '',
      'Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED',
      '',
      `See ${ARTIFACT_RELPATH} for the spec.`,
    ].join('\n');
    const res = runHook(writeTranscript([template]));
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    assert.equal(existsSync(ledgerPath()), false, 'template must produce no records');
  });
});

describe('scorecard ledger — fail-silent posture', () => {
  it('skips the write when the state dir cannot be created; exit stays 0', () => {
    // A regular file where a directory must go → mkdirSync fails (ENOTDIR).
    const blocker = join(configDir, 'blocker');
    writeFileSync(blocker, 'file, not dir');
    const res = runHook(writeTranscript([DONE_REPORT, APPROVED_REPORT]), {
      CLAUDE_CONFIG_DIR: join(blocker, 'nested'),
    });
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    assert.match(res.stdout, /\{\}\s*$/, 'SessionEnd contract output intact');
    assert.equal(existsSync(ledgerPath()), false);
    // No project-tree fallback.
    assert.deepEqual(readdirSync(projDir), ['docs']);
  });

  it('malformed transcript → no records, exit clean', () => {
    const p = join(scratchDir, 'transcript.jsonl');
    writeFileSync(p, 'not json at all {{{\n garbage\n');
    const res = runHook(p);
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    assert.match(res.stdout, /\{\}\s*$/);
    assert.equal(existsSync(ledgerPath()), false);
  });

  it('missing transcript_path → no ledger, exit clean', () => {
    const res = runHook(null);
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    assert.equal(existsSync(ledgerPath()), false);
  });
});

describe('scorecard ledger — JSONL append semantics', () => {
  it('preserves prior ledger lines across sessions', () => {
    mkdirSync(join(configDir, 'fellowship', 'state'), { recursive: true });
    const prior = JSON.stringify({ ts: '2026-06-10T00:00:00.000Z', status: 'DONE', source: 'session-end-v1' });
    writeFileSync(ledgerPath(), prior + '\n');

    const res = runHook(writeTranscript([APPROVED_REPORT]));
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);

    const lines = readFileSync(ledgerPath(), 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
    assert.equal(lines[0], prior, 'prior line must survive byte-identical');
    assert.equal(JSON.parse(lines[1]).status, 'APPROVED');
  });
});
