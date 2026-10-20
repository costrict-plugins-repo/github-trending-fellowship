# Voice persistence — eval suite

Verifies that Gandalf's voice survives long main-agent conversations, that the subagent gate prevents voice leakage into companion subagents, and that voice does not bleed into structured artifacts.

The four scenarios trace to Task 4 of `docs/fellowship/plans/2026-05-16-voice-persistence.md` and the success criteria in `docs/fellowship/specs/2026-05-16-voice-persistence-spec.md`.

## What is here

- `assertions.mjs` — pure functions that scan a response for vocabulary, forbidden phrases, exemplar rhythm, drift, subagent bleed, and artifact bleed. No I/O, no Claude calls; safe to import from any harness.
- `assertions.test.mjs` — unit tests for the assertion library (`node --test`).
- `scenarios.jsonl` — four scenario specs, in the project's existing scenarios.jsonl shape, extended with a `turns` array for multi-turn flows and a `mode` field (`multi_turn_auto` | `single_turn_auto` | `manual_walkthrough`).
- `run.mjs` — automated runner for the `*_auto` scenarios. Drives multi-turn conversations via `claude --print --continue`, runs assertions, writes a report, diffs against the baseline.
- `manual-walkthrough.md` — step-by-step instructions for the `manual_walkthrough` scenario (subagent isolation) and the optional human-check pass for artifact bleed.

## How to run

### Unit tests (no Claude required)

Verifies the assertion library logic itself.

```bash
node --test evals/voice-persistence/assertions.test.mjs
```

37 tests, ~150ms.

### Automated scenarios (drives Claude)

Requires `claude` CLI on PATH and Keychain/subscription auth. Strips `ANTHROPIC_API_KEY` from the env so we don't double-bill.

```bash
# Run all auto scenarios with default model (haiku — fast and cheap)
node evals/voice-persistence/run.mjs

# One scenario at a time
node evals/voice-persistence/run.mjs --scenario vp001

# Different model
node evals/voice-persistence/run.mjs --model claude-opus-4-1

# Establish or overwrite the baseline
node evals/voice-persistence/run.mjs --baseline
```

The runner writes:
- `last-report.json` — full per-turn diagnostics for the most recent run.
- `.last-run.jsonl` — incremental log, one record per scenario as it completes (tail this for live progress).
- `baseline.json` — pass/fail snapshot, written only with `--baseline`. Subsequent runs diff against it.

**Exit codes.** `0` clean, `1` assertion failures (no regression), `2` regression vs. baseline.

### Manual walkthroughs

Scenario 3 (subagent isolation) is fundamentally not automatable via `claude --print` — the subagent dispatch happens inside the agent loop. Run it interactively per `manual-walkthrough.md`.

## How the automation works (and where it diverges from reality)

> **Note (2026-06-11):** the per-turn Layer 2 anchor hook (UserPromptSubmit) was removed — vp001 showed it cannot push past the additive-prompting ceiling. The SessionStart injection remains the sole voice layer. Lifecycle descriptions below that count a voice-related UserPromptSubmit hook describe the pre-removal mechanism.

`claude --print` drives a single user turn through a real Claude Code session — including hook firing. We empirically verified on Claude Code 2.1.142 that:

- `SessionStart` fires (with payload `session_id`, `transcript_path`, `cwd`, `hook_event_name=SessionStart`, `source`).
- `UserPromptSubmit` fires (with `prompt`).
- `SessionEnd` fires.

All three voice-related hooks therefore execute exactly as in an interactive session, for that single turn.

`claude --print --continue` chains turns on the same conversation. Empirically (same Claude Code version): **every continuation re-fires all three hooks**. This is NOT the lifecycle of an interactive session, where `SessionStart` fires once and `UserPromptSubmit` fires per turn.

**Practical implication.** Under `--continue`, the model gets the full voice.md re-injected via SessionStart stdout on every turn — more reinforcement than reality. A drift signal observed under `--continue` is therefore a **lower bound** on real-session drift. Failure here is decisive; "passing" leaves real-session behavior un-disproved but increases confidence.

If you need to verify against the real lifecycle, run the manual walkthrough.

## How to debug a failing run

1. Look at `last-report.json` — the `per_turn` array shows which turn produced which forbidden phrases.
2. For voice-mechanism faults, re-run with `FELLOWSHIP_HOOK_DEBUG=1` exported and inspect `/tmp/fellowship-hook-debug.log` — every hook invocation appends a record with the stdin payload, CLAUDE-prefixed env vars, and the marker state.
3. If `assertSubagentVoiceClean` fails: check the marker file (`${CLAUDE_CONFIG_DIR:-~/.claude}/fellowship/state/<slug>.main-session`, where `<slug>` is the project path with every non-alphanumeric character replaced by `-`) is present and `hooks/lib/subagent-detection.mjs` is reading the same session_id. The two-tier detection (payload `agent_id`/`agent_type` then marker comparison) is the authoritative gate.
4. If `assertNoForbiddenPhrases` fails on a single phrase only: voice.md may have grown a new forbidden phrase that the anchor does not name. Either reinforce the anchor or accept the phrase as benign and remove from `ALL_FORBIDDEN` — but only after Gandalf's voice has demonstrated stability without it.

## Caveats and known limits

- **Per-turn cost.** Running `vp002` (20-turn conversation) makes 20 `claude --print` calls plus 20 hook cycles. At ~3s per turn it's about a minute of wall time; at typical input pricing it's a few cents on haiku, more on opus. Not free — don't run on every commit.
- **Heuristic exemplar rhythm.** The "comma or em-dash followed by ≤4 words" rule will false-positive on incidental comma-final lists. Reports include the matched sentence — verify failures by reading the evidence, not the count.
- **Vocabulary cluster includes "mark" and "burden".** Both are common English; the `assertSubagentVoiceClean` function intentionally requires BOTH vocabulary AND rhythm before flagging bleed to keep false-positive rates manageable.
- **Drift tolerance.** `assertNoDrift` uses a default `tolerance=0.05` tells-per-response — small enough to catch real drift, large enough to absorb the noise floor. If your run sits exactly at the threshold, repeat 2–3 times before declaring a regression.

## Updating the suite when voice.md changes

If `skills/using-fellowship/references/voice.md` changes (especially the Never-list or the vocabulary cluster), update:

1. `assertions.mjs` — the `TOLKIEN_VOCABULARY` and `ALL_FORBIDDEN` exports.
2. `assertions.test.mjs` — the "closed-list integrity" tests (canary for drift between voice.md and the assertion library).
3. `manual-walkthrough.md` — only if assertion names change.

The canary tests are intentionally rigid — they SHOULD fail when voice.md changes, prompting a deliberate update to keep the suite aligned with the source of truth.
