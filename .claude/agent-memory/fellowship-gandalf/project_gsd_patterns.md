---
name: GSD Architecture Patterns
description: Key actionable patterns from GSD (Get Shit Done) — context monitor hook, debug knowledge base, model profiles, wave execution
type: project
---

GSD is the most architecturally mature Claude Code plugin studied (2026-03-23). Three patterns are directly applicable to Fellowship.

**Why:** GSD explicitly solves context rot (quality degradation as context fills). Its patterns are proven in production.

**Key patterns:**

1. **Context monitor hook** — PostToolUse hook that injects context warnings into the agent's conversation (not just the user's status bar). At ≤35% remaining: "avoid starting new complex work." At ≤25%: "stop immediately, save state to files." This prevents companions reporting DONE after running out of context mid-task.

2. **Debug knowledge base** — `gsd-debugger` appends resolved sessions to `.planning/debug/knowledge-base.md`. Consulted at the start of new debug sessions. Short format: problem / root cause / solution / relevant files. We have no equivalent — Gimli's debug discoveries are lost after each session.

3. **Model profiles** — 4 profiles (quality/balanced/budget/inherit). Planners get Opus (architecture decisions), executors get Sonnet (follows instructions), mappers get Haiku (pattern extraction). Rationale is explicit: "the plan already contains the reasoning; execution is implementation." This validates our Tier scoring model routing.

4. **Wave execution** — plans analyzed for dependencies, grouped into parallel waves. File locking (O_EXCL atomic creation) prevents state race conditions in parallel waves. Directly applicable to Tier 4 parallel Gimli dispatches.

5. **Artifact pyramid** — each workflow stage writes structured files. Any stage can restart from the prior artifact. For Tier 4 work, companions should write to `CLAUDE_SCRATCHPAD_DIR` rather than just returning text.

**How to apply:** When building context monitor hook (next infrastructure item), study GSD's `hooks/gsd-context-monitor.js`. When Gimli's memory files mature, add a debug-knowledge-base entry format.
