# Plan — Voice Persistence v1

**Date:** 2026-05-16
**Design spec:** `docs/fellowship/specs/2026-05-16-voice-persistence-spec.md`
**Research brief:** `docs/fellowship/specs/2026-05-15-voice-persistence-research.md`

## Goal

Make Gandalf's voice survive long main-agent conversations. Current state: voice rules exist in `references/voice.md` but the model is *instructed* to read them, not *given* them — nothing forces the content into context. Diagnosis is mechanical: add hook-driven reinforcement modelled on the Caveman plugin pattern.

## Key decisions from brainstorming

- **Two-layer mechanism, not one.** SessionStart injects the full voice.md (Layer 1, the missing piece); UserPromptSubmit injects a ~270-char anchor every turn (Layer 2, the drift mitigation). Per the persona-drift literature, this is the highest-leverage combination available without model access.
- **Skip Output Style for v1.** Anthropic's claimed adherence reminders are uncharacterized; revisit only if Layers 1+2 prove insufficient.
- **Per-turn anchor is exemplar-led, not rule-led.** Literature (Crafting a Good Prompt vs. Providing Exemplary Dialogues, Li et al.) is unambiguous: exemplars beat abstract style descriptions under attention pressure.
- **Voice.md compressed but LotR character protected.** Cut meta-framing and explanatory tags, not exemplars or character prose. Frodo's guardrail: *"the tone and the inspiration must be highly inspired by Lord of the Rings."*
- **Caveman cut-list discipline brought into voice.md "Never:" section** — enumeration of filler/pleasantries/empty hedges/trailing fluff. Lives in Layer 1 (SessionStart), not Layer 2 (per-turn) — pink-elephant problem is bounded once per session.
- **Companion-aware gating.** Hooks bail in subagent context; Tier 2 in-session companion skill loads stay Gandalf voice.
- **v1 = Gandalf only.** Per-companion voices listed as v1.1 follow-on; mechanism must prove itself first.

## Tech stack

- Node.js (`.mjs`) hooks, fail-silent contract, invoked via `hooks/run-hook.cmd`
- Hooks registered in `hooks/hooks.json` (matchers, command paths, async flag)
- `${CLAUDE_PLUGIN_ROOT}` for path resolution
- Existing hook patterns to follow: `hooks/fellowship-session-end.mjs` (defensive, fail-silent, JSON output)

## Tier recommendation

**Tier 3 — sequential chain with Round 1 parallelism.**

Round 1 dispatches Gimli (hook code) and Bilbo (voice.md compression) in parallel — they touch disjoint files. Round 2 dispatches Legolas to review Gimli's hooks (every-turn execution is security-adjacent; file reads from disk; subagent gate is correctness-critical). Round 3 dispatches Pippin to write voice-persistence evals once the system is working.

---

## File map

**Created:**
- `hooks/fellowship-voice-session-start.mjs` — Layer 1 hook
- `hooks/fellowship-voice-prompt-submit.mjs` — Layer 2 hook
- `hooks/fellowship-voice-session-start` — shell wrapper (if `run-hook.cmd` dispatch pattern requires it; check existing wrapper conventions)
- `hooks/fellowship-voice-prompt-submit` — shell wrapper (same condition)

**Modified:**
- `hooks/hooks.json` — register both new hooks
- `skills/using-fellowship/references/voice.md` — compress, extend "Never:" section, remove read-once meta-instruction
- `skills/using-fellowship/SKILL.md` — adjust the line that currently points at voice.md to reflect hook-driven injection
- `docs/fellowship/quest-log.md` — already updated in spec session (entry marked implementation-pending, v1.1 follow-on added)

---

## Quest Log

### Round 1 — parallel dispatch (Gimli + Bilbo)

1. ⬜ **Hook implementation** — Gimli — write both hooks, wire `hooks.json`, determine subagent-detection mechanism
2. ⬜ **Voice.md compression + Never-list extension** — Bilbo — compress to ~3.5–4 KB, protect exemplars and LotR character, extend Never-list, remove read-once line, update SKILL.md reference

### Round 2 — sequential after Round 1

3. ⬜ **Hook code review** — Legolas — review both hooks for correctness, every-turn latency, subagent gate, fail-silent behavior, file-read safety

### Round 3 — sequential after Round 2

4. ⬜ **Voice-persistence evals** — Pippin — scenarios exercising 10+ turn conversations, assertions on vocabulary cluster presence, forbidden-phrase absence, exemplar rhythm

---

## Task 1: Hook implementation

**Assigned to:** Gimli
**Depends on:** none

**Files:**
- Create: `hooks/fellowship-voice-session-start.mjs`
- Create: `hooks/fellowship-voice-prompt-submit.mjs`
- Create (if pattern requires): shell wrappers without extension, mirroring `hooks/fellowship-session-end`
- Modify: `hooks/hooks.json`

**What to build:**

### Hook A — `fellowship-voice-session-start.mjs` (Layer 1)

Reads `skills/using-fellowship/references/voice.md` from plugin root and writes contents to stdout, prefixed with a short framing line. Claude Code adds SessionStart stdout to context automatically.

```javascript
#!/usr/bin/env node
// SessionStart hook for Fellowship voice persistence (Layer 1).
// Reads voice.md from plugin root and writes it to stdout, where
// Claude Code injects it into the main agent's context.
//
// Skips injection for subagent context — companions have their own voice.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

try {
  // Drain stdin (hook contract)
  try { readFileSync('/dev/stdin', 'utf8'); } catch {}

  // Subagent gate — see Task 1.4 for detection mechanism
  if (isSubagentContext()) {
    process.exit(0);
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const voicePath = resolve(__dirname, '..', 'skills', 'using-fellowship', 'references', 'voice.md');
  const voiceContent = readFileSync(voicePath, 'utf8');

  process.stdout.write(`# Gandalf Voice — Active Throughout This Conversation\n\n${voiceContent}\n`);
  process.exit(0);
} catch {
  // Fail-silent: session continues without voice reinforcement
  process.exit(0);
}

function isSubagentContext() {
  // TODO: implementation per Task 1.4
  return false;
}
```

**Acceptance criteria:**
- [ ] Reads voice.md from `${CLAUDE_PLUGIN_ROOT}/skills/using-fellowship/references/voice.md` regardless of cwd.
- [ ] Writes content to stdout with the framing header.
- [ ] Exits 0 on any error (fail-silent — no thrown exceptions, no stderr output, no non-zero exit).
- [ ] Subagent context detection bails with exit 0 and no output.
- [ ] Executes in <100ms for a ~4 KB voice.md.

### Hook B — `fellowship-voice-prompt-submit.mjs` (Layer 2)

Emits fixed anchor as `additionalContext` JSON on every user message.

```javascript
#!/usr/bin/env node
// UserPromptSubmit hook for Fellowship voice persistence (Layer 2).
// Injects a fixed Gandalf-voice anchor as additionalContext on every turn.

import { readFileSync } from 'fs';

const ANCHOR = `GANDALF VOICE ACTIVE. Speak in this register: "Even the very wise cannot see all ends." "When in doubt, follow your nose." "Gimli next — this is builder's work." A clause of context, then the sentence lands short. Counsel, folly, mark, prudent, peril, burden — words that do the work.`;

try {
  try { readFileSync('/dev/stdin', 'utf8'); } catch {}

  if (isSubagentContext()) {
    process.stdout.write(JSON.stringify({}) + '\n');
    process.exit(0);
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: ANCHOR
    }
  }) + '\n');
  process.exit(0);
} catch {
  process.stdout.write(JSON.stringify({}) + '\n');
  process.exit(0);
}

function isSubagentContext() {
  // TODO: implementation per Task 1.4
  return false;
}
```

**Acceptance criteria:**
- [ ] Emits the exact anchor string verbatim — character-for-character match with the spec.
- [ ] JSON output is valid and matches Claude Code's `UserPromptSubmit` hook output shape.
- [ ] Subagent context bails with empty JSON (`{}`) and exit 0.
- [ ] Executes in <100ms (must fit inside the 30-second `UserPromptSubmit` timeout with massive headroom — this runs on the hot path).
- [ ] Anchor string defined as a constant, not constructed dynamically.

### Task 1.3 — Wire `hooks/hooks.json`

Extend the existing `SessionStart` block (matcher already covers `startup|clear|compact` and `resume`) and add a new `UserPromptSubmit` block.

```json
"SessionStart": [
  {
    "matcher": "startup|clear|compact",
    "hooks": [
      { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" session-start", "async": false },
      { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" fellowship-voice-session-start", "async": false }
    ]
  },
  {
    "matcher": "resume",
    "hooks": [
      { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" session-start --resume", "async": false },
      { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" fellowship-voice-session-start", "async": false }
    ]
  }
],
"UserPromptSubmit": [
  {
    "hooks": [
      { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" fellowship-voice-prompt-submit", "async": false }
    ]
  }
]
```

**Why `async: false` for the voice hooks:**
- SessionStart: stdout must be captured and injected before the model's first response. Async would race.
- UserPromptSubmit: `additionalContext` must land alongside the user message. Async would miss the window.

### Task 1.4 — Subagent-detection mechanism

Investigate detection paths in priority order:

1. **Hook input payload.** SessionStart and UserPromptSubmit hooks receive structured stdin JSON. Inspect the input fields — `session_id`, `cwd`, possibly `subagent_type` or equivalent. Easiest if present.
2. **Environment variables.** Look for `CLAUDE_SUBAGENT_TYPE`, `CLAUDE_AGENT_NAME`, or similar set by the dispatch wrapper. Read `process.env` from inside a subagent dispatch to enumerate what's actually set.
3. **Sentinel file.** Last resort: dispatching parent writes a marker before invocation, removes after. Adds coordination complexity.

Document findings in `hooks/README.md` (create if missing) for v1.1 reference when per-companion voices ship.

**Acceptance criteria for Task 1.4:**
- [ ] Mechanism documented in `hooks/README.md` with the exact env var name or input payload field used.
- [ ] `isSubagentContext()` stub in both hooks replaced with the working implementation.
- [ ] Manual test: dispatch any Fellowship subagent (e.g. Gimli for a trivial task) and confirm both hooks bail without injecting Gandalf voice into the subagent's context.

**Verification (full task 1):**
- Run: `node hooks/fellowship-voice-session-start.mjs < /dev/null` → Expected: stdout contains the framing header followed by voice.md contents; exit 0.
- Run: `echo '{}' | node hooks/fellowship-voice-prompt-submit.mjs` → Expected: stdout is valid JSON matching `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"GANDALF VOICE ACTIVE..."}}`; exit 0.
- Run: start a fresh Claude Code session in this project; first response should reflect Gandalf register without the user invoking any skill.
- Run: dispatch a subagent (e.g. via `/fellowship:gimli` for a trivial task); confirm the subagent doesn't receive the Gandalf voice content.

**Notes:**
- Follow the pattern at `hooks/fellowship-session-end.mjs` for the defensive stdin drain and fail-silent contract.
- Do not throw under any circumstance. A broken voice hook should never break a session.
- Voice.md path must use `${CLAUDE_PLUGIN_ROOT}` relative resolution (the hook is invoked from the user's cwd, not the plugin root).

---

## Task 2: Voice.md compression + Never-list extension

**Assigned to:** Bilbo
**Depends on:** none (truly parallel with Task 1)

**Files:**
- Modify: `skills/using-fellowship/references/voice.md`
- Modify: `skills/using-fellowship/SKILL.md`

**What to build:**

### 2.1 — Compress voice.md

**Target:** ~5 KB → ~3.5–4 KB. The file ships in every session via the Layer 1 hook; token cost compounds across the project lifetime.

**Cut (remove or compress):**
- Lines 3 (`Read once at session start. Internalize, then speak that way every turn. Do not re-read between turns — the manner is yours, not a checklist to consult.`) — the hook is reading the file for the model; this instruction is obsolete and misleading.
- Explanatory tags after exemplars where the exemplar speaks for itself. Example: `*"He that ships without tests to find out if it works has left the path of wisdom."* ← formal subject, principle, verdict. The structure for naming a mistake.` — the post-arrow explanation can collapse to a one-clause tag or be cut entirely.
- Structural redundancy across sections — places where the same point is made in different sections.

**Protect (do not cut):**
- Every Tolkien exemplar in the "Voice anchors" section (lines 42–58).
- Every software-applied exemplar (lines 60–71).
- Every "thinking aloud" pattern exemplar (lines 73–87).
- Every "You do not sound like this" counter-example (lines 89–97).
- The vocabulary cluster (line 30).
- The hard rules (lines 99–104).
- LotR character framing — metaphor cluster (*bridges, foundations, weather, craftsmanship*), personality prose (*you notice more than you say*, *urgency exists but panic doesn't*). The user's explicit guardrail.

### 2.2 — Extend the "Never:" list (Caveman cut-list discipline)

Current voice.md line 31: `Never: "sounds like," "makes sense," "that's fair," "totally," "looks good"`

This list is too short. Default Claude register includes a wider filler/pleasantry/hedge inventory. Extend, grouped:

```markdown
**Never (closed list — these are the register tells):**

*Filler:* just, really, basically, actually, simply, literally, definitely, certainly, essentially.

*Pleasantries:* great question, happy to help, sure thing, no problem, absolutely, of course.

*Empty hedges:* I think (when not load-bearing), I believe, it seems like, sort of, kind of, I'd say. (Gandalf hedges with *perhaps* and *I suspect* — and only when he means them.)

*Trailing fluff:* at the end of the day, to wrap up, in summary, hope this helps, let me know.

*The original five:* sounds like, makes sense, that's fair, totally, looks good.
```

This *grows* voice.md slightly, which is intentional. The Caveman cut-list earns its tokens — paid once per session, gives the model a closed set of register tells to suppress.

### 2.3 — Update `skills/using-fellowship/SKILL.md`

The existing line reads: *"Voice register, anchors, applied examples, and anti-patterns: see `references/voice.md`. Read once at session start; do not re-read between turns."*

After the hook ships, voice.md is injected automatically. The line should reflect that:

> *"Voice register, anchors, applied examples, and anti-patterns are injected at session start by `hooks/fellowship-voice-session-start.mjs`; the reference at `references/voice.md` is the canonical source. The per-turn anchor at `hooks/fellowship-voice-prompt-submit.mjs` reinforces the register on every user message."*

**Acceptance criteria:**
- [ ] voice.md final size between 3.5 and 4 KB after compression + Never-list extension.
- [ ] No exemplar removed (manual diff against current voice.md confirms).
- [ ] No LotR character prose removed (metaphor cluster, personality bits preserved).
- [ ] "Read once at session start" instruction removed.
- [ ] Never-list extended per the four groups above.
- [ ] SKILL.md reference line updated to point at the hooks.

**Verification:**
- Run: `wc -c skills/using-fellowship/references/voice.md` → Expected: between 3500 and 4200 bytes.
- Diff: every Tolkien quote and software exemplar from the current file appears in the new file (manual visual diff acceptable).

**Notes:**
- The file is human-edited regularly by Frodo. It must stay readable as prose, not be compressed to incomprehensibility.
- If a cut feels load-bearing on second look, leave it. The token budget is a soft target; voice fidelity is hard.

---

## Task 3: Hook code review

**Assigned to:** Legolas
**Depends on:** Task 1

**Files:**
- Read: `hooks/fellowship-voice-session-start.mjs`
- Read: `hooks/fellowship-voice-prompt-submit.mjs`
- Read: `hooks/hooks.json` (the diff)
- Read: `hooks/README.md` (subagent-detection documentation)

**What to review:**

- **Fail-silent contract upheld.** Both hooks must exit 0 under all error conditions. No thrown exceptions, no non-zero exits, no stderr noise.
- **Path resolution correctness.** voice.md must be located relative to the plugin root (via `import.meta.url`), not the user's cwd.
- **Subagent gate correctness.** The detection mechanism Gimli chose must work. Verify by tracing the code path under both contexts.
- **Latency.** Layer 2 fires on the hot path — every user message. Confirm there is no synchronous I/O beyond the stdin drain and the JSON write. No file reads, no network, no sleeps.
- **JSON output shape.** Layer 2 output must exactly match Claude Code's documented `UserPromptSubmit` schema. A typo here means silent injection failure.
- **Anchor string drift.** Verify the Layer 2 anchor matches the spec exactly. Character-for-character.
- **Hooks.json correctness.** Both new hooks registered with `async: false`. SessionStart hook entries are additive — the existing `session-start` invocations must not be removed.
- **No regressions to existing hooks.** Confirm `fellowship-session-end.mjs`, `fellowship-plan-gate.mjs`, `fellowship-context-monitor.mjs` are untouched.

**Acceptance criteria:**
- [ ] Legolas verdict: APPROVED, APPROVED_WITH_CONCERNS, or REQUEST_CHANGES.
- [ ] If concerns or changes requested, findings go back to Gimli via SendMessage; re-review after fixes.

---

## Task 4: Voice-persistence evals

**Assigned to:** Pippin
**Depends on:** Tasks 1, 2, 3 complete and merged

**Files:**
- Create: `evals/voice-persistence/` or equivalent per existing eval structure (Pippin verifies the pattern).

**What to build:**

Scenarios exercising the persistence claim across realistic conversation lengths.

**Scenario 1 — 10-turn conversation, recognizability.**
Start a session, run a varied 10-turn exchange (routing question, code question, casual exchange, follow-up). Assert across all assistant responses:
- At least one Tolkien-vocabulary word appears (*counsel, folly, mark, prudent, peril, burden, hark, mark, perhaps, suspect, prudent*).
- Zero occurrences of the forbidden-phrase set (current Never-list + extended Caveman cut-list).
- At least one exemplar-rhythm sentence (clause of context, then short final landing — heuristic: sentence with a comma or em-dash followed by a four-word-or-shorter final clause).

**Scenario 2 — 20-turn conversation, drift resistance.**
Same as Scenario 1 but extended. Assert the rate of register tells (forbidden phrases per response) does not increase between turns 1–10 and turns 11–20.

**Scenario 3 — subagent isolation.**
Dispatch a Fellowship companion subagent in the middle of a conversation. Confirm the subagent's response does *not* contain Gandalf-specific vocabulary or exemplar rhythm. Confirm the main thread's voice resumes correctly after the subagent returns.

**Scenario 4 — artifact mode.**
Ask Gandalf to produce a structured artifact (a plan, a spec section, a code block). Assert the artifact itself is clean technical prose (voice does not bleed in) while the surrounding conversational prose retains voice.

**Acceptance criteria:**
- [ ] All four scenarios implemented and runnable.
- [ ] Initial run establishes a baseline; subsequent runs flag regressions.
- [ ] Failing scenarios produce actionable output (which response failed which assertion).

---

## After Execution

When all four tasks land:

1. **Update quest-log.** Move the "Voice persistence — implementation pending" entry to completed state (per the new contract, this means trimming or moving the bullet). Confirm the v1.1 follow-on entry remains.
2. **Run the eval suite once in live use.** Real validation, not synthetic. Frodo runs a real session of meaningful length, observes whether the voice holds.
3. **Token cost measurement.** Capture actual token consumption over a 50-turn session. Confirm the ~4500-token estimate in the spec holds; adjust the anchor length if cost is materially higher.
4. **Decision: ship or iterate.** If voice holds across 20+ turn live sessions, v1 ships. If drift is still observable, evaluate whether Layer 3 (Output Style) earns inclusion, or whether the per-turn anchor needs tightening.

---

## Principles

- **The spec is the source of truth.** Every task here traces back to a decision in `2026-05-16-voice-persistence-spec.md`.
- **Voice fidelity is hard, token budget is soft.** If a cut feels load-bearing, leave it.
- **Fail-silent everywhere.** A broken voice hook must never break a session.
- **Subagent isolation is correctness, not nice-to-have.** Each companion has its own voice; cross-contamination is a v1.1 regression source.
