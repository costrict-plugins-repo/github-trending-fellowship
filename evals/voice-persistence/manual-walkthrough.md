# Voice-persistence manual walkthroughs

For scenarios where the automated `claude --print --continue` harness is not a faithful proxy for the real mechanism under test. Run these against a live, interactive Claude Code session in the Fellowship project root.

Each scenario lists the steps, the responses to capture, and the assertion calls that produce the verdict. Assertions are pure functions in `assertions.mjs` — paste captured responses into `node -e "..."` or a scratch script to get a deterministic pass/fail.

> **Note (2026-06-11):** the per-turn Layer 2 anchor hook (UserPromptSubmit) was removed — vp001 showed the anchor cannot push past the additive-prompting ceiling (2/3 regardless of formulation). The SessionStart injection remains the sole voice layer. References below to the per-turn anchor or UserPromptSubmit re-firing describe the pre-removal mechanism.

---

## Scenario 3 — subagent isolation (Task 4 in the plan)

**Why manual.** Subagent dispatches happen inside Claude Code's main-agent loop via the Task tool — they cannot be driven from `claude --print` because that flag short-circuits the agent loop. The voice hook's `agent_id`/`agent_type` payload field is only populated for subagent invocations, and that path runs only inside a real interactive session.

**Setup.**
1. Open a fresh Claude Code session in `/Users/Karolus/projects/Fellowship`.
2. Wait for Gandalf's opening response. Confirm it carries voice (vocabulary or rhythm visible by inspection).
3. (Optional) `cat ~/.claude/fellowship/state/-Users-Karolus-projects-Fellowship.main-session` — the marker should exist and hold the current session_id. (Markers live in the state dir, not the project root; see `hooks/README.md` § State directory.)

**Steps.**

1. Send a request that triggers a Tier 2 subagent dispatch. Suggested input:
   ```
   dispatch Gimli on a trivial task — add a one-line comment at the top of hooks/health-check.mjs that says "voice eval probe" and report back. Don't actually edit the file, just simulate.
   ```
2. Capture Gandalf's pre-dispatch text (the prose where he names what he is doing and why).
3. Capture Gimli's full report when it returns (the subagent's response, formatted per Gimli's report contract).
4. Send a follow-up: `and what's next?` — capture Gandalf's resuming response.

**Assertions.** Paste each captured string in turn:

```bash
node --input-type=module -e '
import { assertVocabularyPresent, assertExemplarRhythm, assertSubagentVoiceClean } from "./evals/voice-persistence/assertions.mjs";

const gandalfPre = `<paste Gandalf pre-dispatch text>`;
const gimliReport = `<paste Gimli subagent report>`;
const gandalfPost = `<paste Gandalf resume text>`;

console.log("gandalf pre :", assertVocabularyPresent(gandalfPre), assertExemplarRhythm(gandalfPre));
console.log("gimli       :", assertSubagentVoiceClean(gimliReport));
console.log("gandalf post:", assertVocabularyPresent(gandalfPost), assertExemplarRhythm(gandalfPost));
'
```

**Pass criteria.**
- Gandalf pre-dispatch: vocabulary OR rhythm passes.
- Gimli report: `assertSubagentVoiceClean` passes (no combined vocab+rhythm bleed).
- Gandalf post-dispatch: vocabulary OR rhythm passes.

**Fail diagnosis.**
- Gimli report fails `assertSubagentVoiceClean`: voice hooks fired in subagent context (subagent gate broken) OR Gimli's own agent file carries Gandalf-style vocabulary by accident.
- Gandalf post fails voice: the per-turn anchor lost grip after a subagent excursion — investigate whether `UserPromptSubmit` re-fired correctly on the resume turn.

---

## Scenario 4 — artifact-mode bleed

**Why dual-track.** Scenario 4 is automated in `run.mjs` (single-turn, easy to drive). The manual walkthrough exists for cases where the automated result is borderline or surprising — to confirm with a human eye that the bleed (or absence of bleed) is real.

**Steps.**

1. In a fresh Claude Code session, send:
   ```
   sketch a one-page spec for adding a rate-limiter to /api/auth/login — 5 requests/minute per IP, return 429 with Retry-After. Include a code block showing the express-rate-limit middleware setup.
   ```
2. Capture the full response.

**Assertion.**

```bash
node --input-type=module -e '
import { assertArtifactCleanProseHasVoice } from "./evals/voice-persistence/assertions.mjs";
const response = `<paste full response>`;
console.log(assertArtifactCleanProseHasVoice(response));
'
```

**Pass criteria.**
- Prose around the artifact has voice (vocab OR rhythm).
- Each code block / spec-section artifact is clean technical prose — no Tolkien-cluster words AND no exemplar rhythm inside the fence.

**Fail diagnosis.**
- Prose missing voice: hooks did not fire, or anchor was not honored on this turn — re-run after restart, check `/tmp/fellowship-hook-debug.log` with `FELLOWSHIP_HOOK_DEBUG=1`.
- Artifact carries voice: voice.md hard rule (line 101: *voice colors conversation, never artifacts*) is not landing — strengthen the rule, do not loosen the assertion.

---

## When to re-run

- After any change to `hooks/fellowship-voice-session-start.mjs`.
- After any change to `skills/using-fellowship/references/voice.md`.
- After any change to subagent detection logic (`hooks/lib/subagent-detection.mjs`).
- Before merging a release tag.
