# Changelog

All notable changes to Fellowship are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — 2026-06-12

### Added

- **SessionEnd scorecard ledger.** The session-end hook now appends one JSONL record per detected companion report — all seven protocol statuses, with artifact and review-cycle count when derivable — to the state-dir `<slug>.scorecard.jsonl`. The evidence base for "does the orchestration earn its cost": cycles-to-APPROVED and failure shapes accumulate from real sessions. Data capture only (no rendering, no analysis); fail-silent; never touches the project tree. A template-line guard keeps the report-format boilerplate quoted in agent files from fabricating records.
- **Transport-agnostic dispatch.** Tier 2+ dispatches state intent neutrally and defer the *how* to a deference ladder: environment-provided instructions (herdr skill, Conductor skill/prompt, `$TMUX`) → native agent teams → background task → in-session. The handoff file contract (`docs/fellowship/handoffs/<date>-<quest-slug>-brief.md` in, `-report.md` out, observation by report file) is the dispatch protocol; panes are presentation. Fellowship carries no per-terminal adapters and no watcher tooling — permanently out of scope. New `skills/using-fellowship/references/dispatch-transport.md` carries the full doctrine; spec at `docs/fellowship/specs/2026-06-11-transport-agnostic-dispatch.md`.
- **Worktree stand-down guard.** `skills/using-worktrees/SKILL.md` now instructs agents to check, before creating any worktree, whether the session is already isolated — `pwd` under `.claude/worktrees/`, or `git rev-parse --git-common-dir` differing from `--git-dir` (the generic signal, which also covers Conductor workspaces and other pre-isolating wrappers). Already isolated → dispatch in-place; never nest a worktree inside a worktree.

### Changed

- **AutoImprove repointed at process outcomes.** Improvement cycles now target planted-defect catch rate, cycles-to-APPROVED, and validation-contract assertions missed; voice/register evals are a regression floor whose drop triggers revert, never an optimization target (`skills/autoimprove/SKILL.md` § What to Improve Toward).
- **Agent files trimmed (−372 lines across all nine companions).** Voice blocks condensed from ~48-line galleries to ~9-line register sketches (vocabulary cluster and never-lists kept, character studies and anchor-quote exemplars removed); protocol-duplicated status tables replaced with one-line pointers to `companion-protocol.md` with craft-specific nuance folded in. Craft methodology, report formats, and reference pointers untouched.

- **Session markers relocated out of the user's project tree.** `.fellowship-main-session` (subagent detection) and `.fellowship-session-history` (opener first-vs-returning gate) previously landed in the project root — untracked clutter in every non-Fellowship repo. Both now live in `${CLAUDE_CONFIG_DIR:-~/.claude}/fellowship/state/` as flat files keyed by project slug (`<slug>.main-session`, `<slug>.session-history`; slug = absolute project path with every non-alphanumeric character replaced by `-`, Claude Code's own convention). Path resolution is centralized in `hooks/lib/subagent-detection.mjs` (`stateMarkerPath`). Atomicity and failure posture unchanged: write-then-rename for the history marker, session-id guard on clear, fail-silent everywhere — an uncreatable state dir skips the write with no project-tree fallback. SessionStart runs a one-shot migration: legacy in-project markers are migrated (history content, only when the new location is empty) and deleted, including orphaned `.fellowship-session-history.*.tmp` files.

### Removed

- **Per-turn voice re-anchor (Layer 2).** The `fellowship-voice-prompt-submit` UserPromptSubmit hook injected ~90 tokens of Gandalf-voice anchor on every user message. The vp001 evals showed the anchor cannot push past the additive-prompting ceiling (2/3 regardless of formulation), so the per-turn cost bought nothing. Script, wrapper, `hooks.json` registration, and both `run-hook.cmd` allowlist entries removed; `fellowship-voice-session-start` (SessionStart injection) is now the sole voice layer. Drift on very long sessions is accepted.

### Fixed

- **Consistency sweep (2026-06-11).** `debug-log.md` admitted to the drift-check canonical set (three live contracts create it; first append would have drift-flagged every session); missing `commands/gimli.md` shim added (all nine companions now have one); `CHANGES_REQUESTED` added to the status enumerations in `dispatch-transport.md` and `using-fellowship/SKILL.md`; mid-session plugin updates no longer print a non-blocking hook error on every prompt (`run-hook.cmd` retires the removed voice hook silently for one release); codebase map regenerated against current disk.
- **Drift check flagged `docs/fellowship/research/` as drift.** The directory holds real work — model/landscape research briefs that inform routing decisions — but sat outside the canonical tree, so every SessionStart printed a drift notice. `research/` is now part of the canonical tree (drift-check `Set`, project-state-contract spec, directory guide). Optional like `ethos-overrides.md`: not scaffolded by `/fellowship:start`, exempt from the status lifecycle (`status: reference`, no auto-archive).
- **`visual-exploration` pointed mockup persistence at `.superpowers/brainstorm/`.** A fossil from the skill's Superpowers origin: `--project-dir` sessions wrote to `<project>/.superpowers/brainstorm/` and the skill advised gitignoring `.superpowers/`. Mockups now persist to `docs/fellowship/design/mockups/` — inside the canonical `design/` directory, kept in git as intentional project documentation. Updated `SKILL.md` plus `start-server.sh`/`stop-server.sh` so docs and behavior agree.

## [1.1.0] — 2026-05-31

### Added

- **Validation contract.** A quest carries a `## Validation Contract` of weighted, implementation-independent assertions authored at plan time, scored assertion-by-assertion (PASS / FAIL / UNTESTABLE with evidence) by fresh-context validators. The gate: all P0 PASS with evidence, zero P0 FAIL; an UNTESTABLE on a P0 is an unscored gate, not a pass. An owner-validator tag (`[Legolas]` / `[Pippin]` / `[Boromir]`) partitions one contract across validators without collision; `[Boromir]` is `security-flow` only. Authored in `skills/planning/SKILL.md`, scored per the validator agent files, composed in `skills/using-fellowship/references/workflows.md`. An enrichment of the plan — no new artifact, no DSL, no new status code. Spec + ADR: `docs/fellowship/specs/2026-05-30-{validation-contract-scope,adr-validation-contract}.md`.
- **Voice persistence (v1).** Two-layer mechanism that carries Gandalf's register from the first turn. Layer 1 is `fellowship-voice-session-start`, a SessionStart hook that injects `skills/using-fellowship/references/voice.md` into the main-agent context (and claims the main-session marker used by subagent detection). Layer 2 is `fellowship-voice-prompt-submit`, a UserPromptSubmit hook that emits a fixed ~270-char Gandalf-voice anchor as `additionalContext` on every user message. Both hooks are `async: false` and fail-silent.
- **Per-companion voice sections.** All nine companions (Aragorn, Merry, Gimli, Legolas, Boromir, Pippin, Sam, Arwen, Bilbo) carry a structured Voice section — character study, register, vocabulary cluster, anchor exemplars, never-list. Each voice is earned by restraint, not decoration.
- **Session opener.** `fellowship-opener-session-start` SessionStart hook orients the user on returning sessions: recent commits (`git log --oneline -5`), top three open quest-log items, in-flight `memory/project_*.md` descriptions, framed by an instruction to Gandalf to open in his register. Gated by a per-project `.fellowship-session-history` marker — silent on the first session in a project. Registered after the voice hook. `async: false`, fail-silent.
- **Workflow templates.** Named multi-step recipes in `skills/using-fellowship/references/workflows.md`: `feature-flow`, `bug-flow`, `security-flow`. Tier 3+ dispatches reach for a workflow by name instead of reassembling the same sequence each time.
- **Project-state contract (v1).** Canonical shape of `docs/fellowship/` plus the lifecycle rules that keep it from drifting. Defined in `docs/fellowship/specs/2026-05-15-project-state-contract.md`. Adds the `status: active → implemented → reviewed → archived` frontmatter lifecycle, the `quest-log-entry:` companion-report field, the canonical-tree definition, the `archive/<type>/` flat shape, and the standard `YYYY-MM-DD-<slug>.md` naming convention across all first-class artifact folders.
- **SessionEnd reconciliation + archival sweep.** `fellowship-session-end` extended from marker-cleanup-only to a five-step pass: subagent guard, marker cleanup, transcript reconciliation (DONE/APPROVED reports → missing frontmatter transitions), archival sweep (`status: reviewed` artifacts → `archive/<type>/`), quest-log size control (50-entry trigger, oldest 25 moved to `quest-log-archive.md`). One proportional summary line at session close; every action traced to `$HOME/.claude/fellowship-trace.log`. Fail-silent.
- **SessionStart drift check.** New `fellowship-drift-check-session-start` hook walks `docs/fellowship/` top level and surfaces one notice line when anything falls outside the contract's canonical tree. Notice only — no prompt. Registered after the opener hook. Fail-silent.
- **Project ethos overrides.** Optional `docs/fellowship/ethos-overrides.md` lets a project layer its own principles over the plugin ethos without forking it.
- **Codebase-map staleness signal.** SessionStart surfaces a one-line nudge when `codebase-map.md` is older than its tracked threshold, prompting a regeneration via `/fellowship:map`.

### Changed

- **Tier doctrine correction.** Resolved the longstanding contradiction between `tier-scoring.md` and `cycles.md`. Tier 2 = focused dispatch with cycles automatic (no workflow needed). Tier 3 = workflow-shaped (named recipe in `workflows.md`). Tier scoring and cycle doctrine now agree.
- **Plugin ethos relocated.** Moved from `docs/fellowship/templates/ethos.md` (project-owned by accident) to `skills/using-fellowship/references/ethos.md` (plugin-owned, loaded on demand for Tier 3+ dispatches). Plugin teaching no longer leaks into project trees.
- **`/fellowship:start` bootstrap updated to the contract.** No longer creates `templates/ethos.md` or `session-log.md`; creates `handoffs/`, `archive/`, and `archive/<type>/` placeholders as part of the initial scaffold.
- **Companion DONE/APPROVED protocols.** Gimli, Legolas, Aragorn, Merry, Arwen, Pippin each carry the status-frontmatter contract in their agent files. A DONE report without the matching `status:` transition is incomplete. The SessionEnd reconciliation pass is the backstop for missed transitions.
- **Companion report shape.** Every companion's structured report now carries an optional `quest-log-entry:` field. Gandalf appends non-empty entries to `quest-log.md` as scribe — dated and attributed, no user prompt.
- **`docs/fellowship/README.md` rewritten to match the canonical shape.** Removed references to retired content (`templates/`, `examples/`, `research.md`, `reference-implementations.md`, `session-log.md`, `debug-log.md`); documented `archive/legacy/` as the dogfood-only graveyard carrying this repo's plugin-development history.
- **Quest-log redesign.** Decisions-and-commitments format with date-and-companion attribution. Size control at 50 entries (oldest 25 to `quest-log-archive.md` on SessionEnd).
- **Slash-namespace consistency.** Slash command filenames dropped their redundant `fellowship-` prefix; they ship under the plugin's `/fellowship:` namespace already.

### Fixed

- **Voice mechanism — high-prior-token bound.** Additive prompting alone could not carry voice through long sessions; the two-layer hook mechanism (SessionStart injection + per-turn `additionalContext`) does. Earlier env-var-based subagent detection was a silent no-op in Claude Code 2.1.142 — replaced by the documented payload-field check with a marker-file fallback.
- **Status-frontmatter drift.** Specs and plans previously sat at `status: active` long after the work shipped because nothing forced updates. Companion DONE/APPROVED contracts plus the SessionEnd reconciliation pass close the loop.
- **Plugin-content leakage into project trees.** `templates/ethos.md`, `session-log.md`, and `examples/` no longer appear in fresh project bootstraps. Dogfood-only artifacts from this repo's early days now live under `archive/legacy/`.
- **Gandalf would not say his own name.** The hard rule *"Never refer to yourself by name"* — meant to bar third-person self-narration — was applied past its intent, so a direct *"who are you?"* drew a generic *"the hand that orchestrates"* rather than *"I am Gandalf."* The rule now distinguishes self-narration (still barred) from self-knowledge (own the name plainly when asked, and name companions over generic roles).

## [1.0.0] — 2026-04-27

Initial public release.

### Added

- Nine specialized companions covering the full product lifecycle (Aragorn, Merry, Gimli, Legolas, Boromir, Pippin, Sam, Arwen, Bilbo).
- Gandalf orchestrator, skill-injected via SessionStart hook — no agent override required.
- Persistent project memory via `docs/fellowship/` and per-agent memory.
- Tiered routing (Tier 1–4) with conservative escalation.
- Scoped tool permissions per agent.
- Cross-platform hooks (Unix + Windows via polyglot `run-hook.cmd`).
- Health check (`hooks/health-check.mjs`) validating manifests, hooks, agent frontmatter, and skill directories.
- AutoImprove loop for overnight agent improvement (Gimli, Gandalf, Legolas).
