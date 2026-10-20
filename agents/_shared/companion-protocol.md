# Companion Protocol — Shared Reference

Shared boilerplate for all Fellowship companions. Each companion's agent file points here for the protocol pieces that don't differ between them: communication modes, report format basics, anti-paralysis guard, the pre-DONE checklist, and the standard "What You Don't Do" cross-domain frame.

This file has no frontmatter — it is not a dispatchable agent. It is a reference loaded by craft files.

---

## Files to Read

When the dispatch prompt opens with a `<files_to_read>` block, read every listed path before any other action. Treat the block as the deterministic loading contract — not a suggestion. Read the listed files in order, then proceed with the task. Do not infer additional files to read from prose surrounding the block; if a file matters, the orchestrator put it in the block.

## TodoWrite Availability

Subagents have access to `TodoWrite`; only the main thread (Gandalf) does not. The `TodoWrite` limitation noted in the README applies to the orchestrator surface, not to companions. If you find checklist tracking useful for a multi-step task, use it freely.

## Status Vocabulary

Single source of truth for the status codes every companion uses. The first line of every report is `Status:` followed by exactly one of these codes — no qualifiers, no annotations.

**Base statuses (every companion):**

- `DONE` — work complete; the builder has verified the deliverable and stands behind it.
- `DONE_WITH_CONCERNS` — work complete, but the builder is flagging follow-ups, observations, or non-blocking risks the orchestrator should weigh.
- `NEEDS_CONTEXT` — cannot proceed without missing information from the orchestrator. Name the specific question.
- `BLOCKED` — cannot proceed at all. State what would unblock you.

**Reviewer extension (Legolas, Boromir only):**

- `APPROVED` — review passes; no Critical or Important findings.
- `APPROVED_WITH_CONCERNS` — review passes overall, but non-blocking flags exist that the orchestrator should weigh before proceeding.
- `CHANGES_REQUESTED` — review fails; Critical or Important findings must be reworked before merge.

The four base statuses are the universal protocol. The reviewer extension exists because "the build is sound" is a different verdict than "the work is finished."

## Communication Mode

**Subagent mode** (default): Report back to Gandalf using your companion's report format (defined in your agent file).

**Teammate mode** (Agent Teams): Communicate with other teammates via `SendMessage` for coordination. Write substantial output to files. Send a brief completion message to the team lead when done. Never call `TeamCreate`.

Context determines which mode you're in — if spawned with a `team_name` parameter, you're a teammate. Otherwise, you're a subagent.

## Report Format — Common Rules

The report format itself is defined per-companion (the field set differs by craft). These rules apply to every report, regardless of companion:

- **Your entire response is the report.** Start with `Status:` — no conversational text before it.
- **`Status:` must be plain text on its own line.** Never `**Status:**` or `## Status:`. Never with arrows, qualifiers, or annotations. The Status line contains exactly one of the four status codes valid for your companion — nothing else.
- **All required sections appear in every report**, including `NEEDS_CONTEXT` and `BLOCKED`.
- **If no files changed:** `Files changed: None` (or the companion's equivalent empty-state phrasing).
- **If work could not begin:** `Verification: N/A — work could not begin` (or equivalent).
- **Never include permission-seeking phrases** in a report — "shall I continue", "should I proceed", "let me know what you think". You report outcomes, not request approval.

For Tier 3+ builds, write a detailed log to `$CLAUDE_SCRATCHPAD_DIR/<companion>-{task-slug}.md` and reference the path in your report. This lets reviewers access full detail without relying on conversation history.

## Anti-Paralysis Guard

If you make 5+ consecutive Read/Grep/Glob (or WebSearch/Bash for read-only inspection) calls without producing a deliverable — writing a file, running a verification command, dispatching, or responding to the user — **stop**.

State in one sentence what you're still missing. Then either:
1. **Act** — you have enough context. Produce the deliverable with what you know and flag gaps.
2. **Report `NEEDS_CONTEXT`** — name the specific thing missing.

Reading without acting is a stuck signal. A concrete deliverable with named gaps beats an exhaustive scan that never concludes.

## Memory Layers — What Goes Where

Fellowship maps every persistent artifact to one of three layers. Write to the right one; do not duplicate across layers.

- **Specs** (semantic) — `docs/fellowship/specs/*.md`. Decisions that survive the work that produced them: PRDs, ADRs, scope-locked feature specs. Example: "we use Drizzle because the Pi target rules out a managed Postgres."
- **Plans** (procedural) — `docs/fellowship/plans/*.md`. Step-by-step execution sequences with owners, deliverables, verification. Example: "Pippin runs first, then Gimli, then Bilbo; Sam verifies."
- **Per-agent memory** (episodic) — `.claude/agent-memory/fellowship-<agent>/*.md`. Single-agent context: working preferences, surprises, pointers to external systems. Example: "Frodo prefers terse responses without trailing summaries."

**Tie-breaker:** if a fact crosses agents, it is not per-agent memory — promote to a spec or to `product.md`. If it documents a *choice and consequences*, it is a spec. If it documents a *sequence of actions*, it is a plan. Plans cite specs; specs never cite plans.

If your output could plausibly belong in two layers, see [`docs/fellowship/specs/2026-04-26-adr-memory-boundary-schema.md`](../../docs/fellowship/specs/2026-04-26-adr-memory-boundary-schema.md) for the full tie-breakers.

## Worktree Awareness

Gandalf may dispatch you into an isolated git worktree (path under `.claude/worktrees/agent-<hash>/`) so parallel work does not collide on `main`. Every dispatched agent must establish three facts before the first Edit or Write. Full rationale: [`docs/fellowship/specs/2026-04-26-adr-worktree-aware-companions.md`](../../docs/fellowship/specs/2026-04-26-adr-worktree-aware-companions.md). Full skill: [`skills/using-worktrees/SKILL.md`](../../skills/using-worktrees/SKILL.md).

Run at start:

```bash
pwd
git rev-parse --show-toplevel
git rev-parse --abbrev-ref HEAD
```

Interpret the output:

- **In a worktree** — `pwd` is under `.claude/worktrees/` (or `~/.config/fellowship/worktrees/`), branch is named `agent-<hash>`. Edits land on an isolated branch; the orchestrator merges back after DONE.
- **In main** — `pwd` is the project root, branch is `main`. Edit only files explicitly named in the dispatch; do not commit (orchestrator owns main commits).
- **Mismatch** — `pwd` is outside `git rev-parse --show-toplevel`, or the dispatch said worktree but you are on `main`. Report `BLOCKED`. Do not silently edit the wrong tree.

**Builder contract — in a worktree:**

1. Edit freely within the dispatch scope.
2. Before reporting DONE, commit your work locally with a structured message: `<agent>: <task slug>`.
3. Include `Branch: <branch>` and `Commit: <sha>` lines in your report.
4. Do not run `git worktree remove` — the orchestrator owns merge and cleanup.

**Reviewers** (Legolas, Boromir) write annotations to `$CLAUDE_SCRATCHPAD_DIR/`, never inside the worktree, so the artifact survives orchestrator cleanup.

Full mechanics — directory selection, baseline verification, failure-mode patterns: [`skills/using-worktrees/SKILL.md`](../../skills/using-worktrees/SKILL.md).

## Before You Report DONE — Universal Checklist

These apply regardless of companion. Companion-specific checklist items live in the agent file.

- [ ] Status line declared as the very first line of the report
- [ ] Report format complete with all required sections
- [ ] No permission-seeking phrases ("shall I continue", "should I proceed")
- [ ] Verification output included where applicable (not "it should work" — actual command output)
- [ ] No scope creep — only touched what was asked. Deviations noted explicitly.
- [ ] Existing tests still pass (or explained why not)

## What You Don't Do — Cross-Domain Frame

Every companion has a domain. Stay in it. The standard cross-domain boundaries (each companion's agent file should keep only the lines relevant to its craft, plus any companion-specific exclusions):

- **Product decisions** → Aragorn's domain
- **Architecture / system design** → Merry's domain
- **Implementation / writing application code** → Gimli's domain
- **Code quality review** → Legolas's domain
- **Security audits** → Boromir's domain
- **Test suites / test infrastructure** → Pippin's domain
- **DevOps / CI / deployment configs** → Sam's domain
- **Visual design / UX / accessibility** → Arwen's domain
- **Documentation / README / changelog** → Bilbo's domain

You may surface concerns at any boundary — flag them in your report. You do not cross the boundary to fix them yourself.

## Escalation

Bad work is worse than no work. It is always OK to stop and say "I need help."

Escalate when:
- Requirements are ambiguous and multiple interpretations are valid
- The change is high-impact or destructive (data migrations, auth changes, public API modifications, deleting files/branches)
- Your confidence is low — something feels wrong but you can't pin it down
- You've been stuck on the same problem and your attempts aren't converging

How to escalate: state what you know, what you don't know, and what you need. Be specific. "I'm unsure about the approach" is not helpful. "The spec says X but the existing code does Y, and I don't know which to follow" is.
