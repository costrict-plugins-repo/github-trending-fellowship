#!/usr/bin/env node
// Fellowship context monitor - PostToolUse hook
// Monitors context usage and injects warnings when the window is getting full.
//
// How it works:
// 1. Reads remaining context directly from hook input (context_window.remaining_percentage)
// 2. Tracks warning state in a per-session tmpfile — env vars don't survive
//    across PostToolUse invocations (each is a fresh process)
// 3. Emits warning when context crosses thresholds, with severity escalation
//
// Thresholds:
//   WARNING  (remaining <= 35%): Agent should wrap up current task
//   CRITICAL (remaining <= 25%): Agent should stop immediately and save state
//
// Debounce: Emits only on level change or escalation (WARNING -> CRITICAL).
// State is persisted in os.tmpdir() as `fellowship-ctx-warn-${sessionId}.json`.
// Note: this is a DIFFERENT file from any statusline bridge — purpose is
// warning-level state, not context-percentage data.

import fs from 'fs';
import path from 'path';
import os from 'os';

const WARNING_THRESHOLD = 35;  // remaining_percentage <= 35%
const CRITICAL_THRESHOLD = 25; // remaining_percentage <= 25%

let input = '';
// Timeout guard: if stdin doesn't close within 10s (e.g. pipe issues on
// Windows/Git Bash, or slow Claude Code piping during large outputs),
// exit silently instead of hanging. See gsd #775, #1162.
const stdinTimeout = setTimeout(() => process.exit(0), 10000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const sessionId = data.session_id;

    if (!sessionId) {
      process.exit(0);
    }

    // Use context data already in hook input — avoids filesystem I/O on hot path
    const remaining = data.context_window?.remaining_percentage ?? null;

    // No context data available — exit silently
    if (remaining == null) {
      process.exit(0);
    }

    // No warning needed
    if (remaining > WARNING_THRESHOLD) {
      process.exit(0);
    }

    // Debounce: persist previous warning level in a per-session tmpfile.
    // Env vars do not survive across PostToolUse invocations — each is a
    // fresh process — so disk is the only place cross-invocation state lives.
    // path.basename strips any directory traversal (e.g. "../") that could
    // appear if a malicious sessionId ever leaks through hook input. Without
    // it, `..` segments would let the state file land outside os.tmpdir().
    const safeSessionId = path.basename(String(sessionId));
    const statePath = path.join(os.tmpdir(), `fellowship-ctx-warn-${safeSessionId}.json`);
    let previousLevel = null;
    try {
      if (fs.existsSync(statePath)) {
        const stored = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        previousLevel = stored.level ?? null;
      }
    } catch {
      // Corrupt or unreadable state file — treat as no prior level
      previousLevel = null;
    }

    const isCritical = remaining <= CRITICAL_THRESHOLD;
    const currentLevel = isCritical ? 'critical' : 'warning';

    // Severity escalation (WARNING -> CRITICAL) always emits
    const severityEscalated = currentLevel === 'critical' && previousLevel === 'warning';

    // Skip if same level (debounce across invocations)
    if (previousLevel === currentLevel && !severityEscalated) {
      process.exit(0);
    }

    // Persist new level before emitting
    try {
      fs.writeFileSync(statePath, JSON.stringify({ level: currentLevel }));
    } catch {
      // Best-effort — if we can't write, still emit the warning
    }

    // Build warning message
    let message;
    if (isCritical) {
      message = `\u{1F6A8} CONTEXT CRITICAL (${remaining}% remaining): Context window is nearly exhausted. Stop new work immediately. Write your current progress and state to a file. Report back to Gandalf with what's done and what remains.`;
    } else {
      message = `\u26A0\uFE0F CONTEXT WARNING (${remaining}% remaining): Context window is getting full. Avoid starting new complex work. Finish what's in progress or save state to a file before the window closes.`;
    }

    const output = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: message
      }
    };

    process.stdout.write(JSON.stringify(output));
  } catch (e) {
    // Silent fail — never block tool execution
    process.exit(0);
  }
});
