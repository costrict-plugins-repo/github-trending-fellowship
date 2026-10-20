#!/usr/bin/env node
// SessionStart hook for Fellowship session-opener (Layer 2).
//
// Makes Gandalf's first response in a RETURNING session open with project
// status — recent commits, open quest-log items, in-flight memories — before
// addressing the user's prompt. The voice hook (registered before this one)
// sets register; this hook injects content + an instruction to open in that
// register.
//
// Gating is by a history marker `<slug>.session-history` in the per-project
// state dir (`${CLAUDE_CONFIG_DIR:-~/.claude}/fellowship/state/` — resolution
// lives in hooks/lib/subagent-detection.mjs; nothing is written into the
// user's project tree). This is a DIFFERENT marker from `<slug>.main-session`
// (the subagent-detection marker): the history marker is never deleted, only
// created and timestamp-updated. Its existence distinguishes "first session
// ever in this project" (skip the opener — nothing to recap) from "returning
// session" (fire the opener).
//
// Subagent context: SessionStart does not fire inside subagents per the
// Claude Code hook docs. Belt-and-braces, this hook bails if the documented
// `agent_id`/`agent_type` payload fields are present — companions never open
// with status; only Gandalf does.
//
// Fail-silent: every error path exits 0 with no stdout. A broken opener must
// never break a session. The marker write uses write-then-rename so a partial
// write cannot corrupt the file.
//
// Spec: docs/fellowship/specs/2026-05-17-session-opener-design.md
// Plan: docs/fellowship/plans/2026-05-17-session-opener.md

import {
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  readStdinPayloadSync,
  stateMarkerPath,
  ensureStateDir,
  migrateLegacyMarkers,
  debugLogIfEnabled,
} from './lib/subagent-detection.mjs';

const QUEST_LOG_RELPATH = 'docs/fellowship/quest-log.md';
const COMMIT_SUBJECT_MAX = 80;
const QUEST_LINE_MAX = 200;
const MEMORY_DESC_MAX = 200;
const MAX_QUEST_ITEMS = 3;
const MAX_MEMORY_FILES = 5;
const GIT_TIMEOUT_MS = 2000;

/** Resolve the project directory the same way the lib does. */
function projectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

/**
 * Resolve the history-marker path in the per-project state dir. Null when
 * the state dir is unresolvable — callers treat null as "marker absent,
 * skip writes" (degrades to first-session behavior, documented).
 */
function markerPath() {
  return stateMarkerPath('session-history');
}

/** Truncate a string to max chars, appending an ellipsis when cut. */
function truncate(s, max) {
  if (typeof s !== 'string') return '';
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

/**
 * Write the marker via write-then-rename. A partial write lands in the temp
 * file (same state dir, same filesystem — renameSync stays atomic), so the
 * marker is never left half-written. Best-effort: returns nothing, throws
 * nothing the caller needs to handle beyond the top-level catch.
 *
 * If the state dir is unavailable, skip silently — NO fallback into the
 * project tree. Every session then looks like a first session; the opener
 * stays quiet. Documented degradation.
 *
 * If renameSync fails (e.g. the marker path is a directory, or a permission
 * change), the temp file is already on disk. Clean it up before the error
 * propagates so a failed write never leaves an orphaned `.<pid>.tmp` behind.
 */
function writeMarker(timestampIso) {
  const target = markerPath();
  if (!target || !ensureStateDir()) return;
  const tmp = target + '.' + process.pid + '.tmp';
  const body = JSON.stringify({ last_session_ended: timestampIso }) + '\n';
  writeFileSync(tmp, body, 'utf8');
  try {
    renameSync(tmp, target);
  } catch (err) {
    // Rename failed; the temp file is orphaned. Best-effort cleanup, then
    // re-throw so the caller's fail-silent path still applies.
    try {
      unlinkSync(tmp);
    } catch {
      // Nothing more we can do; it sits in the state dir, not the project.
    }
    throw err;
  }
}

/** Recent commits: `git log --oneline -5`, subjects truncated. */
function recentCommits() {
  try {
    const r = spawnSync('git', ['log', '--oneline', '-5'], {
      cwd: projectDir(),
      timeout: GIT_TIMEOUT_MS,
      encoding: 'utf8',
    });
    if (r.status !== 0 || !r.stdout) return [];
    return r.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        // `<sha> <subject>` — keep the sha, truncate only the subject.
        const sp = l.indexOf(' ');
        if (sp < 0) return truncate(l, COMMIT_SUBJECT_MAX);
        const sha = l.slice(0, sp);
        const subject = l.slice(sp + 1);
        return `${sha} ${truncate(subject, COMMIT_SUBJECT_MAX)}`;
      });
  } catch {
    return [];
  }
}

/** Open quest-log items: top N lines matching `^- [ ]`, truncated. */
function openQuestItems() {
  try {
    const p = resolve(projectDir(), QUEST_LOG_RELPATH);
    if (!existsSync(p)) return [];
    const content = readFileSync(p, 'utf8');
    const items = [];
    for (const line of content.split('\n')) {
      if (/^- \[ \]/.test(line)) {
        items.push(truncate(line, QUEST_LINE_MAX));
        if (items.length >= MAX_QUEST_ITEMS) break;
      }
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * In-flight project memories: `description:` frontmatter from up to N
 * `project_*.md` files in this project's memory dir. Slug derivation: the
 * project path with `/` replaced by `-`
 * (e.g. /Users/x/Fellowship -> -Users-x-Fellowship). Best-effort; any error
 * yields an empty list and the opener fires without this section.
 */
function inFlightMemories() {
  try {
    const slug = projectDir().replace(/\//g, '-');
    const memDir = join(homedir(), '.claude', 'projects', slug, 'memory');
    if (!existsSync(memDir)) {
      // Slug derivation depends on the project path matching the
      // ~/.claude/projects/<slug>/ encoding. If it doesn't, the memory
      // section silently empties. Log under FELLOWSHIP_HOOK_DEBUG=1 so the
      // mismatch is diagnosable; behavior is unchanged (opener still fires).
      debugLogIfEnabled('fellowship-opener-session-start:memory-dir-missing', {
        derived_slug: slug,
        memory_dir: memDir,
      });
      return [];
    }
    const files = readdirSync(memDir)
      .filter((f) => /^project_.*\.md$/.test(f))
      .sort()
      .slice(0, MAX_MEMORY_FILES);
    const descs = [];
    for (const f of files) {
      try {
        const content = readFileSync(join(memDir, f), 'utf8');
        // Match `description:` in the frontmatter, quoted or bare, first line.
        const m = content.match(/^description:\s*["']?(.+?)["']?\s*$/m);
        if (m && m[1]) descs.push(truncate(m[1], MEMORY_DESC_MAX));
      } catch {
        // Skip this file; continue with the rest.
      }
    }
    return descs;
  } catch {
    return [];
  }
}

/** Render a markdown section: heading + bullet list, or "(none)" if empty. */
function section(heading, items) {
  const lines = [`## ${heading}`];
  if (items.length === 0) {
    lines.push('(none)');
  } else {
    for (const it of items) {
      // Quest-log items already start with `- [ ]`; don't double-bullet.
      lines.push(/^- /.test(it) ? it : `- ${it}`);
    }
  }
  return lines.join('\n');
}

try {
  const payload = readStdinPayloadSync();
  debugLogIfEnabled('fellowship-opener-session-start', payload);

  // Subagent guard (belt-and-braces; SessionStart should never fire in a
  // subagent per the docs). Bail silently if agent fields are present.
  if (
    payload &&
    typeof payload === 'object' &&
    ((typeof payload.agent_id === 'string' && payload.agent_id.trim()) ||
      (typeof payload.agent_type === 'string' && payload.agent_type.trim()))
  ) {
    process.exit(0);
  }

  // One-shot legacy cleanup (also called by the voice hook, which registers
  // first — this is belt-and-braces so the opener never depends on hook
  // registration order). Must run BEFORE the presence check: a returning
  // project whose marker still sits at the legacy path would otherwise be
  // misread as a first session.
  migrateLegacyMarkers();

  const nowIso = new Date().toISOString();
  const target = markerPath();
  const present = target ? existsSync(target) : false;

  if (!present) {
    // First session in this project: create the marker, emit nothing.
    writeMarker(nowIso);
    process.exit(0);
  }

  // Returning session: read the marker best-effort (ignore parse errors),
  // compute content, emit the opener, update the timestamp.
  let lastEnded = null;
  try {
    const raw = readFileSync(target, 'utf8');
    if (raw && raw.trim()) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.last_session_ended === 'string') {
        lastEnded = parsed.last_session_ended;
      }
    }
  } catch {
    // Best-effort: a corrupt or empty marker still counts as "present".
  }

  const commits = recentCommits();
  const quest = openQuestItems();
  const memories = inFlightMemories();

  const out = [
    '# Session Continuation — Open With Status',
    '',
    'INSTRUCTION to Gandalf: this is a returning session. Open your first response',
    'with three short observations in your register — a brief welcome, what was left',
    'off, and what to tackle next — drawn from the sections below. Then address the',
    "user's actual prompt. No bullet template, no headers in your response: the",
    'opener IS your voice applied to status.',
    '',
    section('Recent commits', commits),
    '',
    section('Open quest-log items', quest),
    '',
    section('In-flight project memories', memories),
    '',
  ].join('\n');

  process.stdout.write(out);

  // Update the marker timestamp (write-then-rename). Wrapped so a write
  // failure here still exits 0 — the opener already emitted.
  try {
    writeMarker(nowIso);
  } catch {
    // Best-effort; the opener content already landed.
  }
  void lastEnded; // reserved for v2 "you last worked N ago"; read for parity.

  process.exit(0);
} catch {
  // Fail-silent: a broken opener must never break a session.
  process.exit(0);
}
