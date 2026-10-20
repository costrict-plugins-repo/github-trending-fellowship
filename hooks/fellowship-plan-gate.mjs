#!/usr/bin/env node

/**
 * Fellowship Plan Gate (v1.0 — fail-open)
 *
 * PreToolUse hook scoped to Edit|Write|MultiEdit. When invoked in a
 * Fellowship subagent context, checks for a plan file at
 * $CLAUDE_SCRATCHPAD_DIR/gimli-plan-*.md. If absent and no Tier: 1|2 opt-out
 * marker is present in the dispatch, emits a stderr warning and exits 0
 * (fail-open). v1.1 will upgrade to fail-closed.
 *
 * Subagent detection: marker-file mechanism from
 * `hooks/lib/subagent-detection.mjs`. The previous env-var heuristic was
 * empirically broken in Claude Code 2.1.142 (none of CLAUDE_AGENT_TYPE /
 * CLAUDE_SUBAGENT_TYPE / CLAUDE_AGENT are set during subagent dispatch); the
 * shared module replaces it with a session_id comparison against the marker
 * the main thread's SessionStart writes. See `hooks/README.md`.
 *
 * Note on scope: this gate previously aimed at Gimli specifically by name.
 * Claude Code does not expose the agent type to hooks in any release we
 * have access to, so the gate is necessarily broader — it fires for any
 * subagent that edits without a plan file. In practice Gimli is the only
 * subagent expected to run plan-gated tasks, and the file-presence check
 * works regardless of identity. Documented as a known behavior change in
 * `hooks/README.md`.
 *
 * Spec: docs/fellowship/specs/2026-04-26-adr-plan-before-build-hook.md
 */

import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  readStdinPayloadSync,
  isSubagentContext,
  debugLogIfEnabled,
} from './lib/subagent-detection.mjs';

const TARGET_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);
const SCRATCHPAD_FALLBACK = '/tmp/scratchpad';
const PLAN_GLOB = /^gimli-plan-.*\.md$/;
const OPT_OUT_RE = /(?:^|\s)Tier:\s*[12]\b|<no-plan>/;

function silentExit() {
  process.exit(0);
}

function warnAndExit(msg) {
  process.stderr.write(`[fellowship-plan-gate] ${msg}\n`);
  process.exit(0);
}

function planFilePresent(dir) {
  if (!dir || !existsSync(dir)) return false;
  try {
    return readdirSync(dir).some((f) => PLAN_GLOB.test(f));
  } catch {
    return false;
  }
}

function optOutPresent(payload) {
  // Check tool_input fields and dispatch prompt env for declarative markers.
  const haystacks = [];
  if (payload && typeof payload === 'object') {
    const ti = payload.tool_input;
    if (ti && typeof ti === 'object') {
      for (const v of Object.values(ti)) {
        if (typeof v === 'string') haystacks.push(v);
      }
    }
    if (typeof payload.prompt === 'string') haystacks.push(payload.prompt);
  }
  if (process.env.CLAUDE_DISPATCH_PROMPT) {
    haystacks.push(process.env.CLAUDE_DISPATCH_PROMPT);
  }
  return haystacks.some((s) => OPT_OUT_RE.test(s));
}

function main() {
  const payload = readStdinPayloadSync();
  debugLogIfEnabled('fellowship-plan-gate', payload);

  const toolName = payload.tool_name || payload.tool || '';
  if (!TARGET_TOOLS.has(toolName)) silentExit();

  // Subagent gate via shared marker-file mechanism. If we're on the main
  // thread, fail-open silently (the user is editing directly, no gating).
  if (!isSubagentContext(payload)) silentExit();

  const scratchpad = process.env.CLAUDE_SCRATCHPAD_DIR || SCRATCHPAD_FALLBACK;

  if (planFilePresent(resolve(scratchpad))) silentExit();

  if (optOutPresent(payload)) silentExit();

  warnAndExit(
    `no gimli-plan-*.md found in ${scratchpad}. ` +
    `Write a plan before editing (Tier 3+). ` +
    `Fail-open in v1.0; this will block in v1.1.`
  );
}

try {
  main();
} catch (err) {
  // Any uncaught error → fail-open with diagnostic.
  warnAndExit(`hook error: ${err && err.message ? err.message : String(err)}`);
}
