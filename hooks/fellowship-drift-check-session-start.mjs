#!/usr/bin/env node
// SessionStart hook for Fellowship drift detection.
//
// Walks `docs/fellowship/` top-level once per session and surfaces any file or
// directory outside the project-state contract's canonical tree. Notice only:
// emits one stdout line if drift is found, nothing otherwise. The user reads
// and reacts; the hook does not prompt and does not inject additionalContext.
//
// Subagent context: SessionStart does not fire inside subagents per the
// Claude Code hook docs. Belt-and-braces, this hook bails if the documented
// `agent_id`/`agent_type` payload fields are present.
//
// Fail-silent: every error path exits 0 with no stdout. A broken drift-check
// must never break a session.
//
// Output channel: plain stdout (terminal text), NOT a JSON additionalContext
// wrapper. Drift is the user's housekeeping signal; it does not need to
// occupy Gandalf's context window.
//
// Spec: docs/fellowship/specs/2026-05-15-project-state-contract.md
// ADR:  docs/fellowship/specs/2026-05-24-adr-cluster-d-hooks.md (Hook 2)

import { readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { readStdinPayloadSync, debugLogIfEnabled } from './lib/subagent-detection.mjs';

// Canonical top-level shape of docs/fellowship/. Files or directories outside
// this set are drift. v1: inline constant; v1.1 migrates this to a Set built
// from `skills/using-fellowship/references/contract.yaml` (Cluster E). The
// drift-check logic does not change — only the source of the data structure.
const CANONICAL_TOP_LEVEL = new Set([
  'README.md',
  'product.md',
  'quest-log.md',
  'quest-log-archive.md',
  'codebase-map.md',
  'debug-log.md', // optional — contracted by gimli/investigate/using-fellowship, ingested by session-start (admitted 2026-06-11)
  'ethos-overrides.md', // optional, user-opt-in
  'specs',
  'plans',
  'handoffs',
  'design',
  'research', // model/landscape research briefs (admitted 2026-06-11)
  'archive',
]);

// First-class artifact folders must be flat: no nested directories inside.
// A nested dir under any of these IS drift (per ADR D9). `design` is exempt
// (ruling 2026-06-11): the directory guide permits `design/{feature-slug}/`
// and visual-exploration persists mockups under `design/mockups/<session>/` —
// design artifacts nest by nature; the lifecycle dirs do not.
const FIRST_CLASS_ARTIFACT_DIRS = ['specs', 'plans', 'handoffs'];

const MAX_DRIFT_ENTRIES = 5;
const DOCS_FELLOWSHIP_RELPATH = 'docs/fellowship';

/** Resolve the project directory the same way other hooks do. */
function projectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

/**
 * Test whether a path is a directory. Best-effort — returns false on stat
 * failure (file vanished between readdir and stat, permission error, etc.).
 */
function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Render one drift entry: backtick-quoted relative path. Directories get a
 * trailing slash so the user can distinguish files from folders at a glance.
 */
function renderDriftEntry(relPath, isDirectory) {
  const suffix = isDirectory ? '/' : '';
  return '`' + relPath + suffix + '`';
}

try {
  const payload = readStdinPayloadSync();
  debugLogIfEnabled('fellowship-drift-check-session-start', payload);

  // Tier-1 subagent guard (matches voice/opener pattern). SessionStart
  // shouldn't fire in subagents per the docs, but belt-and-braces if a
  // future Claude Code release changes that.
  if (
    payload &&
    typeof payload === 'object' &&
    ((typeof payload.agent_id === 'string' && payload.agent_id.trim()) ||
      (typeof payload.agent_type === 'string' && payload.agent_type.trim()))
  ) {
    process.exit(0);
  }

  const root = resolve(projectDir(), DOCS_FELLOWSHIP_RELPATH);
  if (!existsSync(root)) {
    // No Fellowship project state present — nothing to flag. Stay silent.
    process.exit(0);
  }

  const drifts = [];

  // Top-level walk: anything outside the canonical set is drift.
  let topLevel = [];
  try {
    topLevel = readdirSync(root);
  } catch {
    // Permission error or other read failure. Cannot inspect — exit silently.
    process.exit(0);
  }

  for (const entry of topLevel) {
    if (CANONICAL_TOP_LEVEL.has(entry)) continue;
    const full = join(root, entry);
    drifts.push(renderDriftEntry(entry, isDir(full)));
  }

  // Nested-dir check inside first-class artifact folders. The contract permits
  // flat folders only; a directory under specs/, plans/, handoffs/, or design/
  // IS drift, rendered as the full relative path.
  for (const dir of FIRST_CLASS_ARTIFACT_DIRS) {
    const dirPath = join(root, dir);
    if (!existsSync(dirPath)) continue;
    let children = [];
    try {
      children = readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const child of children) {
      const childFull = join(dirPath, child);
      if (isDir(childFull)) {
        drifts.push(renderDriftEntry(`${dir}/${child}`, true));
      }
    }
  }

  if (drifts.length === 0) {
    process.exit(0);
  }

  // Output budget: cap at MAX_DRIFT_ENTRIES; suffix with the overflow count.
  let shown = drifts;
  let overflow = 0;
  if (drifts.length > MAX_DRIFT_ENTRIES) {
    shown = drifts.slice(0, MAX_DRIFT_ENTRIES);
    overflow = drifts.length - MAX_DRIFT_ENTRIES;
  }

  const list = shown.join(', ');
  const suffix = overflow > 0 ? ` (+${overflow} more)` : '';
  process.stdout.write(`Drift detected — ${list}${suffix} outside the contract.\n`);
  process.exit(0);
} catch {
  // Fail-silent: a broken drift-check must never break a session.
  process.exit(0);
}
