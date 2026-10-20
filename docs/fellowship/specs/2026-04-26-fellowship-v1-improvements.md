# Fellowship v1.0 Improvements — Consolidated Spec

**Date:** 2026-04-26
**Source dispatches:** six parallel deep-comparison audits against `examples/superpowers/`, `examples/wshobson-agents/`, `examples/gsd-get-shit-done/`, `examples/barkain-workflow/`, `examples/ruflo/`, and `docs/fellowship/research.md`.

This is the synthesis. Per-lane findings live in:
- [`comparison-skills-agents.md`](./2026-04-26-comparison-skills-agents.md) — Legolas (file-by-file content audit, the Bilbo-finding lens)
- [`comparison-architecture.md`](./2026-04-26-comparison-architecture.md) — Merry (hooks, manifests, commands, namespacing)
- [`comparison-best-practices.md`](./2026-04-26-comparison-best-practices.md) — Aragorn (research.md conformance)
- [`comparison-cleanliness.md`](./2026-04-26-comparison-cleanliness.md) — Sam (dead/unused code)
- [`comparison-multi-agent-plugins.md`](./2026-04-26-comparison-multi-agent-plugins.md) — Gimli (other multi-agent plugins in examples/)
- [`comparison-tests-evals.md`](./2026-04-26-comparison-tests-evals.md) — Pippin (tests and evals freshness)

---

## Verdict

Fellowship is structurally sound and conformant — **17 of ~22 cited best practices genuinely implemented**, **25/26 tests pass clean**, marketplace metadata complete. The migration to Gandalf-as-skill landed correctly. But four ship-blockers exist that will produce broken behavior or stale-doc embarrassment in front of a marketplace user, and a systemic Bilbo-class anti-pattern persists in agent files that the prior bloat audit missed. **Do not tag v1.0 before the four blockers are resolved.** Should-fix items can land in v1.0.1; v1.1 candidates are documented and deferred.

---

## Ship-Blockers — must resolve before `v1.0.0` tag

### B1. AutoImprove for Gandalf is broken

**Where:** `evals/_runner/run_eval.py:131`, `evals/_runner/improve.sh:183,201,214,229,243,251,317`, `evals/gandalf/holdout.py:10`, `evals/gandalf/holdout_validation.py:10`, `evals/gandalf/test_holdout.py:10`.

**What:** All five files read `agents/gandalf.md`. That file was deleted in this session. `./improve.sh gandalf` will crash on first invocation after a user installs and runs the AutoImprove loop.

**Fix:** Update every reference to read `skills/using-fellowship/SKILL.md` instead. Any frontmatter-parsing logic must be aware that the new target is a skill (no `tools:` list, no `model:` field at the agent level).

**Source:** Pippin §B-1.

### B2. Three documented slash commands do not exist

**Where:** Promised in `skills/using-fellowship/SKILL.md:171,173` and `README.md:30`. Missing files: `commands/fellowship-brainstorming.md`, `commands/fellowship-planning.md`, `commands/fellowship-map.md` (or wherever the canonical command location lives).

**What:** Users who type `/fellowship:brainstorming` or `/fellowship:planning` per the documented invocation will get a "command not found" error.

**Fix:** Either create the missing command files (route to the corresponding skill) or remove the invocations from documentation. Decision needed: are these commands intentional or aspirational? If intentional, they need files. If aspirational, the docs need to retract.

**Source:** Merry §3.

### B3. `docs/fellowship/codebase-map.md` is stale

**Where:** Lines 11, 32, 109. References `agents/gandalf.md` as a current file (deleted) and lists the manifest at `v1.5.0` (now `v1.0.0`).

**What:** The codebase map is auto-injected into Tier 3+ dispatches and is the new-contributor's first orientation. Stale here means every future Gandalf dispatch carries the wrong picture of what the repo looks like.

**Fix:** Regenerate via `/fellowship:map` (per the established pattern), or edit by hand to reflect: nine agents (no Gandalf), `skills/using-fellowship/SKILL.md` as the orchestrator entry, manifests at v1.0.0, agents/_shared/ + agents/references/ + skills/using-fellowship/references/ as established directories.

**Source:** Sam §3.

### B4. Orphan `hooks/fellowship-statusline.mjs`

**Where:** `hooks/fellowship-statusline.mjs` exists; the runtime explicitly does not honor `statusLine` for plugin settings (per `health-check.mjs:146` and Claude Code docs — only `agent` and `subagentStatusLine` are supported keys).

**What:** Dead code that ships in the public artifact. Implements an unsupported feature; would confuse anyone reading the source to understand the plugin.

**Fix:** Delete the file. Or, if the feature is meant for `subagentStatusLine`, port and rename. Default is delete.

**Source:** Sam §2.

---

## Should-Fix — before v1.0.1, not blocking the tag

### S1. Methodology and authoring templates inline in agent files (the Bilbo-class anti-pattern across six files)

**Where:** Bilbo's templates (README, changelog, JSDoc, architecture overview) inline at lines ~80-330. Same pattern in Aragorn (PRD template), Merry (ADR + interface contract templates), and three other agent files per Legolas's file-by-file audit.

**What:** This is exactly the pattern Gimli extracted from `using-fellowship/SKILL.md` into `references/*.md`. Inline templates load in every dispatch, blow context, and violate the same Anthropic context-engineering principle (every unnecessary word degrades performance) the prior refactor honored elsewhere. The prior bloat audit missed it because it counted lines and named categories rather than reading each file end-to-end against the Superpowers reference.

**Fix:** Extract per-agent templates to `agents/references/*-templates.md` files. Each agent body keeps a one-line pointer. Same surgical pattern Gimli already executed; six more files remain.

**Source:** Legolas headline finding + Aragorn §3.

### S2. `using-fellowship/SKILL.md` tells Gandalf to use `TodoWrite` despite documented platform block

**Where:** `skills/using-fellowship/SKILL.md` (multiple sections describing TodoWrite as the orchestrator's checklist mechanism).

**What:** README has a "Known Limitations" section honestly documenting that TodoWrite is unavailable to the main thread. The skill itself does not — it instructs the orchestrator to call a tool that will return the documented "exists but is not enabled" error every time.

**Fix:** Add a brief paragraph or footnote in the skill acknowledging the limitation and pointing to `quest-log.md` checkboxes as the working substitute. Or remove the TodoWrite instructions from the skill entirely until the blocker resolves.

**Source:** Aragorn §3 + my own observation in this session.

### S3. SessionStart hook injects stale handoffs on `resume` matcher

**Where:** `hooks/session-start` lines 92-106 (handoff injection block) plus the `resume` matcher in `hooks/hooks.json`.

**What:** When a session resumes from compact/clear, the hook re-injects the most recent handoff (within 7 days). Resume already restores conversation context; re-injecting a handoff produces duplication and stale context overlap.

**Fix:** Either limit the matcher to `startup|clear` only (skip `resume`), or have the handoff injection check whether the session is a fresh start vs a resume.

**Source:** Merry §2.

### S4. `hooks/session-start` is untested

**Where:** `hooks/session-start` (10 KB, the entire identity injection — eight context blocks, two output formats, fail-silent error paths).

**What:** Catastrophic if broken. A regression here means Gandalf does not load at session start, and every project goes back to vanilla Claude with no Fellowship behavior. Currently zero test coverage.

**Fix:** Add a `tests/session-start.test.mjs` covering: bootstrap-only path (no `docs/fellowship/`), fellowship-present path (with quest log, product, debug log, handoff, codebase-map), Cursor JSON output shape vs Claude Code JSON output shape, fail-silent on missing `using-fellowship/SKILL.md`. At minimum five tests.

**Source:** Pippin §A-3.

### S5. Cold-install primes Gandalf identity even on projects without `docs/fellowship/`

**Where:** `hooks/session-start` line 35-42 (using-fellowship injection always fires).

**What:** A user installs Fellowship and opens it in a project that has no `docs/fellowship/` directory — the hook still injects Gandalf identity. For a user evaluating the plugin (a "tire-kicker"), this is heavy priming on every session before they have even decided to bootstrap.

**Fix:** Gate Gandalf-identity injection on either (a) presence of `docs/fellowship/`, or (b) a one-time bootstrap prompt (`Run /fellowship:start to enable Gandalf in this project`). Default A is simpler; default B is more discoverable. Frodo's call.

**Source:** Merry §9.

### S6. Three slash-command invocation grammars in use, no canonical rule documented

**Where:** Across the plugin: slash commands (`/fellowship:add-ethos`), subagent_type (`fellowship:gimli`), bare skill name (`brainstorming`).

**What:** A contributor adding a new affordance has no documented rule for which grammar to use. `using-fellowship/SKILL.md` doesn't state the convention.

**Fix:** Add one paragraph to `using-fellowship/SKILL.md` (or to a contributor guide) stating the rule: slash commands are `fellowship:<command>`, subagent_type is `fellowship:<agent>`, skill invocation is bare name when loaded by an agent / `fellowship:<skill>` when invoked as a slash command.

**Source:** Merry §10.

---

## v1.1+ Candidates — documented, deferred

### V1. Plan-before-build as hook-enforced gate (not advisory string)

**Why it matters:** Aragorn's conformance audit notes our plan-before-build is a string Gandalf is told to paste into Gimli's prompt. Barkain ships 14 enforcement hooks. Our flexibility is a feature, but the absence of any mechanical gate means the rule is honored only when Gandalf remembers.

**Cost:** PreToolUse hook on Gimli's first `Edit`/`Write`, requiring a plan file in `$CLAUDE_SCRATCHPAD_DIR`. Modest. **Source:** Aragorn §3.

### V2. Wave-based parallel execution with file-ownership boundaries

**Why it matters:** Gimli's headline finding. wshobson agent-teams + gsd execute-phase ship a pattern where the orchestrator stays under ~15% context while subagents get fresh windows. Fellowship dispatches in worktrees but lacks the wave/phase formalism. For Tier 3+ multi-file work, this would significantly reduce context rot.

**Cost:** Hook + skill + minor agent-file additions. Substantial. **Source:** Gimli headline.

### V3. Artifact contract for subagent reports (Barkain's `DONE|{path}` pattern)

**Why it matters:** Solves Tier-3 handoff context-exhaustion more rigorously than our `$CLAUDE_SCRATCHPAD_DIR` references. Barkain explicitly bans reading `TaskOutput` ("context exhaustion: ~20K tokens per agent"). If we adopt V2, this is the natural complement.

**Cost:** Skill change + dispatch-protocol update. Moderate. **Source:** Gimli §3.

### V4. `<files_to_read>` block in dispatch prompts

**Why it matters:** GSD's pattern — cheap, high-leverage reproducibility improvement. Small skill-methodology change in Gandalf's dispatch protocol; makes every dispatch self-documenting about what context the subagent should load.

**Cost:** Documentation + skill edit. Trivial. **Source:** Gimli §3.

### V5. Three-layer memory boundary schema

**Why it matters:** Aragorn flagged that semantic (specs) / episodic (per-agent) / procedural (plans) layers are conceptually mapped but unprotected. Specs/plans/per-agent can bleed. A schema document or hook-enforced rule would prevent drift.

**Cost:** Documentation + optional hook. Modest. **Source:** Aragorn §3.

### V6. Worktree-aware agent files

**Why it matters:** Superpowers ships `using-git-worktrees/SKILL.md`. Zero of our agent files mention worktrees. Gandalf dispatches into worktrees, but the agents aren't told what worktree semantics mean for their work (cross-worktree merges, shared resources, branch hygiene).

**Cost:** Skill creation or per-agent paragraph. Modest. **Source:** Merry §6.

### V7. AutoImprove generality

**Why it matters:** Aragorn flagged we claim AutoImprove generality but only 4 of 9 companions have eval suites (Pippin confirmed). The claim becomes true when we add suites for Aragorn, Arwen, Bilbo, Boromir, Merry, Sam.

**Cost:** Per-companion eval scenarios + judges. High. **Source:** Aragorn §3 + Pippin §B.

### V8. Three regression scenarios for the v1.0 migration

**Why it matters:** Pippin flagged: TodoWrite-blocker honesty (Gandalf should use quest-log checkboxes, not pretend); role-first opener regression-protection (the dispatcher-framing fix we just made should not silently revert); skill-injection success (verify Gandalf identity establishes at message one).

**Cost:** Three new eval scenarios. Modest. **Source:** Pippin §B-3.

### V9. Cursor cross-platform support — finish or remove

**Why it matters:** `hooks/session-start` carries Cursor JSON output branches. `hooks-cursor.json` does not exist. Either dead code or unfinished feature. Decide.

**Cost:** Either delete the Cursor branches (small) or write `hooks-cursor.json` and verify on Cursor (modest). **Source:** Merry §7.

---

## What works — credit for the marketplace listing

These are genuine differentiators worth surfacing in the marketplace card or README opening:

- **Health-check script** — Superpowers and most other plugins have nothing comparable. Validates manifests, hook scripts, agent frontmatter, skill presence, plugin.json version semver.
- **Per-agent tool scoping** — Legolas and Boromir cannot Write/Edit; Pippin can; Bilbo has WebSearch. Real character-as-craft expressed through Claude Code's tool scoping primitive.
- **Skill ↔ agent dual-mode** — most plugins are skill-only or agent-only. Fellowship lets a companion be loaded as a skill in-session (`/aragorn`) or dispatched as an agent. Real flexibility.
- **Cross-platform hooks** — `run-hook.cmd` polyglot dispatcher works on macOS/Linux/Windows. Superpowers ships a separate `hooks-cursor.json`; ours is more elegant.
- **Settings.json restraint** — we ship none, and document the rationale (most plugins ship one and fight users' settings; we don't).
- **Hard.py protected evaluator** — AutoImprove cannot reward-hack the eval harness because the evaluator is `chmod 444` in `/tmp` before the loop runs. Honored as research.md claims.
- **Project memory across sessions** — quest log + product context + handoffs + per-agent native memory is a real differentiator vs Superpowers' explicitly-no-memory model.
- **17 of 22 best practices genuinely implemented** — most plugins cite sources without honoring them. Aragorn's audit confirms ours has substance behind the citations.

---

## Recommended sequence

1. **Now (pre-tag):** Resolve B1–B4. ~1 hour total. All four are factual fixes with no design judgment required.
2. **Before tag:** Run health-check (must stay 26/0) and `node --test tests/health-check.test.mjs` (must stay 25/1 skipped).
3. **Tag v1.0.0.** Cut the GitHub release.
4. **v1.0.1 (within a week):** Resolve S1–S6. S1 is the largest (six files of agent template extraction); the others are individually small.
5. **v1.1 planning:** Score V1–V9 against effort/value. V4 (`<files_to_read>` block) is the cheapest and arguably highest-leverage; V2 (waves) is the most ambitious. Frodo decides the order.
