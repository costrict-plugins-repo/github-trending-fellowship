/**
 * Tests for hooks/lib/subagent-detection.mjs — state-dir marker mechanics.
 *
 * Strategy: the lib reads CLAUDE_CONFIG_DIR / CLAUDE_PROJECT_DIR per call
 * (no import-time state), so each test points both at fresh temp dirs and
 * calls the exported functions in-process. Covers:
 *
 *   - stateMarkerPath slug generation (Claude Code convention: every char
 *     outside [A-Za-z0-9] → `-`)
 *   - markMainSession / isSubagentContext / clearMainSessionMarker
 *     round-trip, including the session-id guard on clear
 *   - the no-project-tree-writes invariant
 *   - legacy in-project marker migration (content move + deletion + orphaned
 *     temp cleanup + new-location-wins precedence)
 *   - fail-silent posture when the state dir cannot be created
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  writeFileSync, readFileSync, readdirSync, existsSync, rmSync,
  mkdtempSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  stateMarkerPath,
  ensureStateDir,
  markMainSession,
  clearMainSessionMarker,
  isSubagentContext,
  migrateLegacyMarkers,
  projectSlug,
} from '../hooks/lib/subagent-detection.mjs';

let configDir;
let projectDir;
let savedConfig;
let savedProject;

beforeEach(() => {
  savedConfig = process.env.CLAUDE_CONFIG_DIR;
  savedProject = process.env.CLAUDE_PROJECT_DIR;
  configDir = mkdtempSync(join(tmpdir(), 'fellowship-config-'));
  projectDir = mkdtempSync(join(tmpdir(), 'fellowship-project-'));
  process.env.CLAUDE_CONFIG_DIR = configDir;
  process.env.CLAUDE_PROJECT_DIR = projectDir;
});

afterEach(() => {
  if (savedConfig === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = savedConfig;
  if (savedProject === undefined) delete process.env.CLAUDE_PROJECT_DIR;
  else process.env.CLAUDE_PROJECT_DIR = savedProject;
  rmSync(configDir, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
});

describe('projectSlug', () => {
  it('replaces every non-alphanumeric character with a dash', () => {
    assert.equal(
      projectSlug('/Users/Karolus/projects/Fellowship'),
      '-Users-Karolus-projects-Fellowship',
    );
    assert.equal(projectSlug('/tmp/my_app.v2 (copy)'), '-tmp-my-app-v2--copy-');
  });
});

describe('stateMarkerPath', () => {
  it('resolves under CLAUDE_CONFIG_DIR/fellowship/state with the project slug', () => {
    const p = stateMarkerPath('main-session');
    assert.equal(
      p,
      join(configDir, 'fellowship', 'state', projectSlug(projectDir) + '.main-session'),
    );
  });

  it('keys main-session and session-history to distinct files', () => {
    assert.notEqual(stateMarkerPath('main-session'), stateMarkerPath('session-history'));
  });
});

describe('mark / detect / clear round-trip', () => {
  it('markMainSession writes the session id to the state dir, not the project', () => {
    assert.equal(markMainSession({ session_id: 'abc123' }), true);
    const p = stateMarkerPath('main-session');
    assert.equal(readFileSync(p, 'utf8'), 'abc123');
    // Invariant: nothing lands in the user's project tree.
    assert.deepEqual(readdirSync(projectDir), []);
  });

  it('isSubagentContext: same session id → main; different → subagent', () => {
    markMainSession({ session_id: 'abc123' });
    assert.equal(isSubagentContext({ session_id: 'abc123' }), false);
    assert.equal(isSubagentContext({ session_id: 'zzz999' }), true);
  });

  it('isSubagentContext tier 1: agent fields win without any marker', () => {
    assert.equal(isSubagentContext({ session_id: 'x', agent_id: 'a1' }), true);
    assert.equal(isSubagentContext({ session_id: 'x', agent_type: 'gimli' }), true);
    assert.equal(isSubagentContext({ session_id: 'x' }), false);
  });

  it('clearMainSessionMarker honors the session-id guard', () => {
    markMainSession({ session_id: 'abc123' });
    const p = stateMarkerPath('main-session');
    clearMainSessionMarker('not-mine');
    assert.equal(existsSync(p), true, 'foreign session id must not clear the marker');
    clearMainSessionMarker('abc123');
    assert.equal(existsSync(p), false, 'owning session id clears the marker');
  });
});

describe('migrateLegacyMarkers', () => {
  it('moves legacy history content, deletes all legacy files and orphaned temps', () => {
    const body = JSON.stringify({ last_session_ended: '2026-01-01T00:00:00.000Z' }) + '\n';
    writeFileSync(join(projectDir, '.fellowship-session-history'), body);
    writeFileSync(join(projectDir, '.fellowship-main-session'), 'stale-id');
    writeFileSync(join(projectDir, '.fellowship-session-history.4242.tmp'), 'partial');

    migrateLegacyMarkers();

    assert.equal(readFileSync(stateMarkerPath('session-history'), 'utf8'), body);
    assert.deepEqual(readdirSync(projectDir), [], 'project root swept clean');
    // Main-session content is intentionally NOT migrated (stale session id).
    assert.equal(existsSync(stateMarkerPath('main-session')), false);
  });

  it('does not overwrite an existing new-location history marker', () => {
    ensureStateDir();
    writeFileSync(stateMarkerPath('session-history'), 'authoritative');
    writeFileSync(join(projectDir, '.fellowship-session-history'), 'legacy');

    migrateLegacyMarkers();

    assert.equal(readFileSync(stateMarkerPath('session-history'), 'utf8'), 'authoritative');
    assert.deepEqual(readdirSync(projectDir), [], 'legacy file still deleted');
  });

  it('is idempotent and silent when there is nothing to migrate', () => {
    migrateLegacyMarkers();
    migrateLegacyMarkers();
    assert.deepEqual(readdirSync(projectDir), []);
  });
});

describe('fail-silent when the state dir cannot be created', () => {
  it('markMainSession returns false and writes nowhere', () => {
    // A regular file where a directory must go → mkdirSync fails (ENOTDIR).
    const blocker = join(configDir, 'blocker');
    writeFileSync(blocker, 'file, not dir');
    process.env.CLAUDE_CONFIG_DIR = join(blocker, 'nested');

    assert.equal(ensureStateDir(), false);
    assert.equal(markMainSession({ session_id: 'abc123' }), false);
    assert.equal(isSubagentContext({ session_id: 'other' }), false, 'degrades to main');
    assert.doesNotThrow(() => clearMainSessionMarker('abc123'));
    assert.deepEqual(readdirSync(projectDir), [], 'no project-root fallback');
  });
});
