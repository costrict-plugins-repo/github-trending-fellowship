#!/usr/bin/env node
// SessionStart hook for Fellowship voice persistence (Layer 1).
//
// Reads `skills/using-fellowship/references/voice.md` from the plugin root and
// writes its contents to stdout. Claude Code's SessionStart contract injects
// hook stdout into the main agent's context automatically — this is how the
// Caveman plugin pattern delivers a full ruleset on session start.
//
// Subagent context: Claude Code's hook docs state SessionStart does NOT fire
// inside subagent processes — it fires only at the top level (`claude`
// invocation, `--resume`, `/clear`, `/compact`). This hook therefore always
// runs on the main thread and unconditionally claims the main-session
// marker (see hooks/lib/subagent-detection.mjs). The marker enables OTHER
// hooks (notably PreToolUse, which DOES fire inside subagents) to
// distinguish subagent vs. main thread.
//
// Defensive belt-and-braces: if Claude Code ever ships SessionStart to
// subagents in a future release, the payload's documented `agent_id` or
// `agent_type` field would identify the subagent, and isSubagentContext()
// would catch it. We still bail in that case rather than overwriting the
// main marker with a subagent's session_id.
//
// Fail-silent: any error path exits 0 with no output. A broken voice hook
// must never break a session.
//
// Spec: docs/fellowship/specs/2026-05-16-voice-persistence-spec.md
// Plan: docs/fellowship/plans/2026-05-16-voice-persistence.md

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readStdinPayloadSync,
  markMainSession,
  migrateLegacyMarkers,
  debugLogIfEnabled,
} from './lib/subagent-detection.mjs';

try {
  const payload = readStdinPayloadSync();
  debugLogIfEnabled('fellowship-voice-session-start', payload);

  // Defensive: only fires in subagent if Claude Code's documented behavior
  // changes. The tier-1 check (agent_id/agent_type) is the authoritative
  // signal; the tier-2 marker check is not used here (SessionStart writes
  // the marker, doesn't read it).
  if (payload && typeof payload === 'object' &&
      ((typeof payload.agent_id === 'string' && payload.agent_id.trim()) ||
       (typeof payload.agent_type === 'string' && payload.agent_type.trim()))) {
    process.exit(0);
  }

  // One-shot legacy cleanup: earlier releases wrote markers into the user's
  // project root. Migrate/delete them before claiming the new-location
  // marker. Idempotent, best-effort, silent.
  migrateLegacyMarkers();

  // Main thread: unconditionally claim the marker. Overwrites any stale
  // marker from a previous session that crashed without SessionEnd.
  markMainSession(payload);

  // Resolve voice.md relative to this hook's location, not the user's cwd.
  // The hook is invoked from the user's working directory; only `import.meta.url`
  // reliably points back to the plugin root regardless of where Claude Code runs.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const voicePath = resolve(__dirname, '..', 'skills', 'using-fellowship', 'references', 'voice.md');
  const voiceContent = readFileSync(voicePath, 'utf8');

  process.stdout.write(`# Gandalf Voice — Active Throughout This Conversation\n\n${voiceContent}\n`);
  process.exit(0);
} catch {
  // Fail-silent: session continues without voice reinforcement.
  process.exit(0);
}
