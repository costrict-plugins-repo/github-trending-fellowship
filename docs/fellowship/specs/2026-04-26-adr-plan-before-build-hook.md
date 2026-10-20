# ADR: Plan-before-build as a hook-enforced gate

**Status:** Proposed
**Date:** 2026-04-26
**Decider:** Merry (technical) + Frodo (final call on fail-open vs fail-closed and on opt-out marker shape)

## Context

The plan-before-build rule today is a string. `skills/using-fellowship/SKILL.md:162` instructs Gandalf to paste a sentence into Gimli's Tier 3+ dispatch: *"Write your plan to `$CLAUDE_SCRATCHPAD_DIR/gimli-plan-[slug].md` before writing any code…"*. Gimli's own file repeats it (`agents/gimli.md:69-78`). If Gandalf forgets the paste — or omits it because the task feels Tier 2 when it isn't — Gimli builds without a plan and the orchestrator-side correction loop is gone.

Barkain ships 14 enforcement hooks. We ship zero on this axis. The consolidated v1.0 spec lifted this from v1.1 to v1.0 (see `2026-04-26-fellowship-v1-improvements.md` §V1). What follows is the design.

## Decision

Add a `PreToolUse` hook scoped to `Edit|Write|MultiEdit` tools. When it fires, the hook checks for a plan file at `$CLAUDE_SCRATCHPAD_DIR/gimli-plan-*.md`. If absent **and** the current invocation looks like a Tier 3+ Gimli dispatch (matcher described below), block with a structured error directing the agent to write the plan first. Otherwise allow.

## Hook event and subagent context

`PreToolUse` is the only event that can block a tool call. It fires inside subagent contexts — confirmed by Claude Code docs and by our existing `PostToolUse` hook (`hooks/hooks.json:20-30`), which already runs unconditionally on every tool call and demonstrates that subagent tool calls reach our hook surface. **If subagent PreToolUse turns out to be unreliable in practice**, the fallback is a SessionStart-equivalent "agent-start" matcher — but we have no evidence that's needed; ship PreToolUse first.

The hook reads the tool input from stdin (Claude Code's documented protocol), inspects `$CLAUDE_AGENT_TYPE` (or whatever env Claude Code exposes for subagent identity — `health-check.mjs:251-260` proves agent metadata is available; the hook will probe and fall back gracefully if the var name differs).

## The check

1. If `$CLAUDE_AGENT_TYPE` is not `fellowship:gimli`, **allow** (other agents have their own plan customs; this gate is Gimli-specific in v1.0).
2. If `$CLAUDE_SCRATCHPAD_DIR` resolves and a glob `gimli-plan-*.md` matches at least one file, **allow**.
3. If the dispatch prompt (passed via tool input or read from `$CLAUDE_DISPATCH_PROMPT` if surfaced) contains the literal marker `<no-plan>` or `Tier: 1` / `Tier: 2`, **allow**. This is the opt-out for legitimate plan-skip cases (one-line config edits, bumping a version string, fixing a typo).
4. Otherwise **block** with an error JSON: `{"decision":"block","reason":"Plan required before edit. Write plan to $CLAUDE_SCRATCHPAD_DIR/gimli-plan-<slug>.md, then retry."}`

## False-positive avoidance

The `<no-plan>` marker (or `Tier: 1|2` declaration) in the dispatch is the orchestrator's explicit opt-out. Gandalf already classifies tier — surfacing the classification into the prompt costs nothing and makes the gate honest. **Frodo's call:** which marker shape — `<no-plan>` (explicit), `Tier: 1` / `Tier: 2` (declarative), or both? Recommend declarative; it doubles as routing documentation.

## Rollback / failure mode

If the hook script crashes or times out:
- **Fail-open** (default recommended for v1.0): allow the tool call, print a stderr warning. Rationale: a broken gate that bricks every Gimli edit is worse than a missed gate. Consistent with `run-hook.cmd:38` "loud failure, continue" pattern.
- **Fail-closed**: block. Safer in principle; risky on first ship.

**Frodo's call.** Recommend fail-open with a stderr warning that surfaces in the next session-start banner ("plan-gate hook failed N times last session — investigate"). Upgrade to fail-closed in v1.1 once the hook is proven.

## Implementation outline (for Gimli)

- File: `hooks/fellowship-plan-gate.mjs`, registered in `hooks/hooks.json` under `PreToolUse` with `matcher: "Edit|Write|MultiEdit"`.
- Wrap via `hooks/run-hook.cmd plan-gate` for cross-platform parity.
- Logic: parse stdin JSON → check agent type → glob `$CLAUDE_SCRATCHPAD_DIR/gimli-plan-*.md` → emit allow/block JSON to stdout.
- Tests: add `tests/plan-gate.test.mjs` covering: no plan + no marker → block; plan present → allow; `<no-plan>` marker → allow; non-Gimli agent → allow; missing scratchpad dir → fail-open + stderr.
- Health check: extend `hooks/health-check.mjs` to verify the new hook script exists and is executable (existing pattern at `:113-135`).

## Recommendation

Ship the gate. Default fail-open. Use declarative `Tier: N` opt-out (Gandalf already knows the tier; surfacing it costs nothing and creates a paper trail). Defer fail-closed and a broader "plan required for Aragorn/Merry too" expansion to v1.1.
