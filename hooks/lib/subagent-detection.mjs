// Shared subagent-detection mechanism for Fellowship hooks.
//
// Two-tier detection, in priority order:
//
//   1. Stdin payload `agent_id` / `agent_type` fields. Per the Claude Code
//      hooks docs ("when running with --agent or inside a subagent, two
//      additional fields are included"), these are the official signals.
//      If present, the hook is unambiguously inside a subagent.
//
//   2. Marker file in the per-project state directory (OUTSIDE the project
//      tree — see "State directory" below), written by the main thread's
//      SessionStart hook. The main thread claims its session_id; later
//      PreToolUse hooks (which DO fire inside subagents per the docs)
//      compare their own session_id against the marker.
//
// Why both. Legolas's empirical investigation on Claude Code 2.1.142 found
// no usable CLAUDE-prefixed env var (the six present —
// `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_EXECPATH`,
// `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, `CLAUDE_CODE_SESSION_ID`,
// `CLAUDE_EFFORT` — none identify agent type). The investigation predates
// the `agent_id`/`agent_type` payload fields the docs describe; whether they
// are actually populated in 2.1.142 is unverified. The marker file is the
// empirically-validated fallback that works regardless.
//
// State directory. Markers live OUTSIDE the user's project tree, under
// `${CLAUDE_CONFIG_DIR:-~/.claude}/fellowship/state/`, keyed by a project
// slug derived with Claude Code's own convention: the absolute project dir
// with every character outside [A-Za-z0-9] replaced by `-`
// (e.g. /Users/x/Fellowship → -Users-x-Fellowship). Flat files:
// `<slug>.main-session` and `<slug>.session-history`. A plugin must never
// create untracked clutter in a user's working tree — that was the bug the
// previous in-project location shipped with. If the state dir cannot be
// created, writes are SKIPPED (no project-root fallback): subagent detection
// degrades to tier 1, the opener treats the session as first. Both are
// already-documented degradations.
//
// Atomicity. Main `SessionStart` fires before any tool call (Claude Code
// lifecycle), so the marker is always in place before any subagent's
// `PreToolUse` can run. Per the docs, `SessionStart` does NOT fire inside
// subagent processes — only at top level — so SessionStart claiming the
// marker can never be wrong.
//
// Failure modes (see hooks/README.md for the full table):
//   - Stale marker after crash: overwritten on next SessionStart.
//   - Concurrent main sessions in the same project dir: last writer wins;
//     earlier session's hooks may misidentify as subagent. Accepted.
//   - Marker missing on a subagent hook: treated as main (false negative).
//     Mitigation: tier 1 (`agent_id`/`agent_type`) catches it if Claude Code
//     populates those fields. If neither catches it, voice leaks once.
//     Low-probability (main SessionStart fires first), documented.
//   - State dir uncreatable (permissions, read-only home): all marker ops
//     no-op silently. Tier-1 fields are the only remaining signal.
//
// Debug. Set FELLOWSHIP_HOOK_DEBUG=1 to append the full stdin payload and
// CLAUDE-prefixed env keys to /tmp/fellowship-hook-debug.log on every hook
// invocation. Use this to verify the mechanism empirically or to investigate
// future Claude Code releases.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  appendFileSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const DEBUG_LOG_PATH = '/tmp/fellowship-hook-debug.log';

// Legacy in-project marker filenames — only referenced by the one-shot
// migration below. New code never writes these into a project tree.
const LEGACY_MAIN_MARKER = '.fellowship-main-session';
const LEGACY_HISTORY_MARKER = '.fellowship-session-history';

/**
 * Read JSON payload from stdin synchronously. Returns {} on any error.
 * Used by hooks that need the payload before deciding what to do.
 */
export function readStdinPayloadSync() {
  try {
    const raw = readFileSync('/dev/stdin', 'utf8');
    if (!raw || !raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Resolve the project directory. Prefer CLAUDE_PROJECT_DIR (set by Claude
 * Code in hook env per docs); fall back to process.cwd().
 */
function projectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

/**
 * Slug a project path with Claude Code's own convention: every character
 * outside [A-Za-z0-9] becomes `-`. /Users/x/Fellowship → -Users-x-Fellowship.
 */
function projectSlug(dir) {
  return String(dir).replace(/[^A-Za-z0-9]/g, '-');
}

/**
 * Resolve the per-project state directory:
 * `${CLAUDE_CONFIG_DIR:-~/.claude}/fellowship/state`. Returns null when no
 * base is resolvable (CLAUDE_CONFIG_DIR unset AND homedir() empty) — callers
 * treat null as "skip the operation".
 */
function stateDir() {
  const config = process.env.CLAUDE_CONFIG_DIR;
  if (config && config.trim()) return resolve(config, 'fellowship', 'state');
  const home = homedir();
  if (home && home.trim()) return resolve(home, '.claude', 'fellowship', 'state');
  return null;
}

/**
 * Resolve the absolute path of a per-project state file. `kind` is
 * 'main-session', 'session-history', or 'scorecard.jsonl' (the SessionEnd
 * scorecard ledger). Returns null when the state dir is unresolvable. Does
 * NOT create the directory — writers must call ensureStateDir() first.
 */
export function stateMarkerPath(kind) {
  const dir = stateDir();
  if (!dir) return null;
  return join(dir, projectSlug(resolve(projectDir())) + '.' + kind);
}

/**
 * Create the state dir with mkdir -p semantics. Best-effort: returns true
 * when the dir exists afterwards, false on any failure (writers then skip —
 * NO fallback to the project tree).
 */
export function ensureStateDir() {
  const dir = stateDir();
  if (!dir) return false;
  try {
    mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/** Main-session marker path (subagent-detection marker). Null = unavailable. */
function markerPath() {
  return stateMarkerPath('main-session');
}

/**
 * One-shot legacy migration. Earlier releases wrote both markers into the
 * USER'S PROJECT ROOT — untracked clutter in every non-Fellowship repo. On
 * SessionStart, if legacy files exist there:
 *
 *   1. Migrate the history marker's content to the new location, but only
 *      when no new-location file exists yet (the new file is authoritative).
 *   2. Delete the legacy history marker, the legacy main-session marker, and
 *      any orphaned `.fellowship-session-history.*.tmp` left by a failed
 *      write-then-rename. We created them; removing them is cleanup, not
 *      intrusion.
 *
 * The legacy main-session content is NOT migrated — it is a stale session id
 * from a previous session; SessionStart writes a fresh marker at the new
 * location immediately after.
 *
 * Idempotent (second call finds nothing to do) and best-effort: every error
 * path is silent. If the migration write fails, the legacy files are still
 * removed — the cost is one "treated as first session" opener skip, an
 * already-documented degradation.
 */
export function migrateLegacyMarkers() {
  try {
    const proj = resolve(projectDir());
    const legacyHistory = join(proj, LEGACY_HISTORY_MARKER);
    const legacyMain = join(proj, LEGACY_MAIN_MARKER);

    // 1. Migrate history content if the new location is still empty.
    try {
      if (existsSync(legacyHistory)) {
        const dst = stateMarkerPath('session-history');
        if (dst && !existsSync(dst) && ensureStateDir()) {
          writeFileSync(dst, readFileSync(legacyHistory, 'utf8'), 'utf8');
        }
      }
    } catch {
      // Best-effort; deletion below still applies.
    }

    // 2. Delete legacy files + orphaned temps. Each unlink isolated so one
    //    failure doesn't strand the rest.
    for (const p of [legacyHistory, legacyMain]) {
      try {
        if (existsSync(p)) unlinkSync(p);
      } catch {
        // Silent.
      }
    }
    try {
      for (const entry of readdirSync(proj)) {
        if (entry.startsWith(LEGACY_HISTORY_MARKER + '.') && entry.endsWith('.tmp')) {
          try {
            unlinkSync(join(proj, entry));
          } catch {
            // Silent.
          }
        }
      }
    } catch {
      // Silent.
    }
  } catch {
    // Best-effort; silent.
  }
}

/**
 * Write the current session_id to the marker file. Idempotent: writes even
 * if the marker exists (overwrites). Called by the main-thread SessionStart
 * hook to claim ownership of "main" for this project dir.
 *
 * Best-effort: returns true on success, false on any error. Errors do not
 * propagate — a broken marker write must not break the session. An
 * uncreatable state dir skips the write entirely (no project-tree fallback).
 */
export function markMainSession(payload) {
  const sessionId = payload && typeof payload.session_id === 'string'
    ? payload.session_id
    : null;
  if (!sessionId) return false;
  try {
    const p = markerPath();
    if (!p || !ensureStateDir()) return false;
    writeFileSync(p, sessionId, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove the marker file IF it still belongs to the given session_id.
 * Called by SessionEnd on graceful shutdown so a stale marker doesn't
 * influence the next session's detection.
 *
 * The session_id guard prevents a cross-session stomp: if session A claims
 * the marker, session B starts in the same project dir and overwrites it,
 * then session A's SessionEnd fires last — without the guard, session A
 * would delete session B's live marker, silently breaking subagent
 * detection (plan-gate would then fail-open without warning for any
 * subagent dispatched from session B).
 *
 * Behavior:
 *   - sessionId missing or empty: safe no-op. Better to leave a stale
 *     marker for the next SessionStart to overwrite than to risk
 *     deleting a live marker we can't verify ownership of.
 *   - marker missing: no-op.
 *   - marker present, stored value matches sessionId: unlink.
 *   - marker present, stored value differs: leave alone. Another session
 *     has claimed it; that session's own SessionEnd is responsible.
 *
 * Best-effort: any error path is silent.
 */
export function clearMainSessionMarker(sessionId) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) return;
  try {
    const p = markerPath();
    if (!p || !existsSync(p)) return;
    const stored = readFileSync(p, 'utf8').trim();
    if (stored === sessionId) unlinkSync(p);
  } catch {
    // Best-effort; silent.
  }
}

/**
 * Decide whether the current hook invocation is running in a Fellowship
 * companion subagent.
 *
 * Two-tier check:
 *   1. If the stdin payload contains `agent_id` or `agent_type` (Claude
 *      Code's documented subagent-context indicators), it's a subagent.
 *   2. Otherwise, if a marker file exists AND its stored session_id differs
 *      from the payload's session_id, it's a subagent.
 *
 * Returns false in all other cases (no markers, no documented fields,
 * session_id matches the marker).
 *
 * Conservative posture for ambiguous cases (no marker, no session_id, no
 * agent_id/agent_type): return false (treat as main). The only way to hit
 * a false negative is for a subagent's hook to run before any main
 * SessionStart wrote a marker AND for Claude Code to omit the documented
 * agent fields — which contradicts both the documented lifecycle and the
 * documented payload schema simultaneously.
 */
export function isSubagentContext(payload) {
  // Tier 1: documented payload fields. Present only inside subagents per
  // Claude Code hook docs. The most authoritative signal we have.
  if (payload && typeof payload === 'object') {
    if (typeof payload.agent_id === 'string' && payload.agent_id.trim().length > 0) return true;
    if (typeof payload.agent_type === 'string' && payload.agent_type.trim().length > 0) return true;
  }

  // Tier 2: marker-file comparison. Robust regardless of what Claude Code
  // chooses to populate in any given release.
  const mySessionId = payload && typeof payload.session_id === 'string'
    ? payload.session_id
    : null;
  if (!mySessionId) return false;

  const p = markerPath();
  if (!p || !existsSync(p)) return false;

  let mainSessionId;
  try {
    mainSessionId = readFileSync(p, 'utf8').trim();
  } catch {
    return false;
  }

  // Empty or unreadable marker → can't differentiate → treat as main.
  if (!mainSessionId) return false;

  return mainSessionId !== mySessionId;
}

/**
 * Append a debug record (payload + CLAUDE env keys + hook name) to a shared
 * log file when FELLOWSHIP_HOOK_DEBUG=1. Use during investigations of new
 * Claude Code releases. No-op otherwise.
 *
 * Writes are best-effort and silent on failure — the debug logger must
 * never break a hook.
 */
export function debugLogIfEnabled(hookName, payload) {
  if (process.env.FELLOWSHIP_HOOK_DEBUG !== '1') return;
  try {
    const claudeEnv = {};
    for (const k of Object.keys(process.env).sort()) {
      if (/CLAUDE/i.test(k)) claudeEnv[k] = process.env[k];
    }
    const p = markerPath();
    const markerExists = p ? existsSync(p) : false;
    const record = {
      timestamp: new Date().toISOString(),
      hook: hookName,
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      payload_keys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
      payload_session_id: payload && payload.session_id || null,
      payload_hook_event_name: payload && payload.hook_event_name || null,
      payload_transcript_path: payload && payload.transcript_path || null,
      payload_agent_id: payload && payload.agent_id || null,
      payload_agent_type: payload && payload.agent_type || null,
      claude_env: claudeEnv,
      marker_path: p,
      marker_exists: markerExists,
      marker_value: markerExists ? readFileSync(p, 'utf8').trim() : null,
    };
    appendFileSync(DEBUG_LOG_PATH, JSON.stringify(record) + '\n', 'utf8');
  } catch {
    // Best-effort; silent.
  }
}

// Re-exported for tests/callers that want to know the marker location.
export { markerPath, projectSlug };
