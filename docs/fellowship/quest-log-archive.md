# Quest Log Archive

Full history of completed work. Not loaded at session start — read only on request.

---

## Archived 2026-03-24

- [x] Gandalf voice rewrite — character-first prompt with calibration examples (2026-03-23)
- [x] Build Legolas agent + code-review skill (2026-03-23)
- [x] Fix agent dispatch — fully-qualified names in gandalf.md tools, cleaned up settings.json (2026-03-23)
- [x] Build Pippin agent + testing skill — three modes, spec-driven methodology, reporting format (2026-03-23)
- [x] E2E validation cycle — health-check.mjs built by Gimli → Legolas reviewed → Gimli fixed 2 issues → Pippin wrote 22 tests (2026-03-23)
- [x] Reference implementation analysis — barkain, wshobson, superpowers → docs/fellowship/reference-implementations.md (2026-03-23)
- [x] Dual-mode + Tier scoring design spec — Parts 1-4 (scoring, dual-mode, model routing, color coding) (2026-03-23)
- [x] Research + README updated — harness engineering, SkillsBench, roster decisions (2026-03-23)
- [x] Deep research round 2 — GSD architecture, context-mode MCP, awesome-claude-skills, AutoResearch pattern (2026-03-23)

## Folded into "What Exists" 2026-04-22

- Plugin improvement batch landed — ethos template, investigate skill (100 lines), learn skill (125 lines), Gandalf compression (720→555, Legolas-reviewed, Memory section tightened post-review) (2026-04-20)
- All 4 plugin audit spec improvements — debug knowledge base, plan-before-build gate, context handoff, codebase map (2026-04-12)
- Browser verification — Pippin Mode 4 + Playwright MCP + Gandalf dispatch + spec (2026-04-12)
- Arwen HTML/CSS wireframe fix — "What You Don't Do" scoped to application code only (2026-04-12)
- Optimize context-monitor hook — removed filesystem I/O from hot path, switched to env-var debounce (2026-03-28)
- Archive consolidation — 7 design docs (March 19–23) → Phase Foundation summary; old archive cleaned (2026-03-28)
- AutoImprove eval hardening — judge prompt reasoning step, holdout.jsonl per agent, scenario expansion; SKILL.md updated (2026-03-28)
- AutoImprove — Gimli: 0.925→1.0 across 4 cycles; eval suite hardened (2026-03-28)
- Plugin audit + spec — health-check fixed (18/0), improvement spec written (2026-03-27)

## Archived 2026-04-22

- [2026-04-22] AutoImprove Pippin — 1.000 on 8 core scenarios; Mode 4 assertions committed, real validation deferred to live usage

## Archived 2026-04-23

- [2026-04-22] P1 + P3 shipped — TodoWrite visibility, docs/fellowship structure rule with README, specs/plans/design separation, 6 specs archived (v1.3.0)
- [2026-04-22] Aragorn PRD — Fellowship real-usage improvements scoped, 6 problems prioritized

## Archived 2026-04-26

- [2026-04-22] P2 shipped — Legolas structural review (Merry ADR → Gimli implementation; prefilter + responsibility test + duplication grep + map + Structural: section + anti-paralysis carve-out)
- [2026-04-22] P4+P5+P6 shipped — ethos absence notice, project-local skills survey, quest-log consolidation reminder, /fellowship:add-ethos command, Gandalf product.md triggers + Project-Local section (v1.5.0)
- [2026-04-22] Quest-log auto-consolidation v1.6.1 — Merry ADR (parse contract + edit safety + archive schema) → Gimli hook (`fellowship-quest-log-consolidate.mjs` + Bash shim + slash command, archive-first/atomi...
- [2026-04-22] Codebase cleanup v1.5.1 — Critical (TodoWrite in KNOWN_TOOLS) + 5 Important (SessionEnd shim, Gandalf color, model: inherit ×9, autoimprove frontmatter, stale test) + 1 Minor (pipefail guard); Lego...
- [2026-04-22] Codebase map generated — `/fellowship:map`


## Archived 2026-04-27

- [2026-04-23] Agent tool allowlists corrected v1.7.0 — Sam round-3 research nailed the mechanism (`tools:` is strict allowlist; omit → inherit all; built-ins like TodoWrite governed same as everything else); fix...

## Archived 2026-05-04

- [2026-04-23] Full-codebase Legolas health-check pass — Legolas APPROVED_WITH_CONCERNS (1 Important, 5 Minor); Gimli fixed all six (dead context-monitor debounce → tmpfile; marketplace.json 1.0.0→1.7.0; dead sta...

## Archived 2026-05-12

Quest-log restructure: `## Recently Completed` and `## What Exists` retired; everything below moved here in one pass. Going forward, only decisions and commitments live in `quest-log.md`; the work-completed history lives in `git log` and the structural snapshot lives in `codebase-map.md`.

### Completed (from former "Recently Completed")

- [x] v1.0.0 hot-patch — agent name double-prefix bug. Reverted 9 agents to bare `name: <n>`; updated health-check regex; corrected codebase-map; updated test fixtures. Health 36/0, tests 69/0/1. Tag `v1.0.0` force-moved to `50df304`; main at `7e37e32`. (2026-04-27)
- [x] v1.0.0 tagged + pushed + submitted to official Anthropic plugin directory. Tag at `ec2e65f`; README simplified 329→189 lines and corrected. Submitted via `platform.claude.com/plugins/submit` — license MIT, status: pending review. (2026-04-27)
- [x] v1.0-readiness triple audit + two-wave fix pass. Three parallel audits (Legolas consistency, Boromir security, Merry vs Superpowers) surfaced 3 ship-blockers + 6 should-fixes + ~12 minors. All blockers + should-fixes landed across two waves. Three items deferred to v1.1 (now tracked in Open). Health 36/0, tests 70/69-pass/1-skip/0-fail. (2026-04-27)
- [x] v0.9 polish pass — Cursor full lifecycle parity (`hooks-cursor.json` + `.cursor-plugin/plugin.json`); `grill-me` skill deleted (folded into `brainstorming` pressure-test mode); `using-fellowship/SKILL.md` strengthened on 4 sections; skill bloat refactor across 4 skills; 9-scenario crucial-baseline eval validated post-restructure. Health 27/0; 69 tests pass. (2026-04-26/27)
- [x] v1.0 deep-improvement pass — six parallel audits → 4 blockers + 6 should-fix + 9 v1.1 candidates against Superpowers and other multi-agent plugins. Eleven follow-up dispatches landed all of it. Spec: `docs/fellowship/specs/2026-04-26-fellowship-v1-improvements.md`. (2026-04-26)
- [x] v1.0 ship-readiness pass — Sam cleared marketplace blockers; Gimli bloat refactor; Bilbo documentation pass; Legolas behavioral consistency audit. Version held at 0.9.0-dev. Health 26/0. (2026-04-26)
- [x] Gandalf-as-skill restructure shipped — `skills/using-fellowship/SKILL.md` is the orchestrator entry point; SessionStart hook injects it as `additionalContext`; `agents/gandalf.md` deleted; default-agent override removed from `settings.json`; eight companion agents stripped of Tolkien register. (2026-04-26)
- [x] Three skills adopted from mattpocock/skills (v0.7.x) — `grill-me` standalone; `design-it-twice` for Merry; TDD principles folded into Pippin. Legolas APPROVED clean. (2026-04-25)
- [x] v0.7.0 pre-publication prep — Aragorn readiness review + Sam publishing-mechanics research; version reset (1.7.0 → 0.7.0); README "On First Run" + status honesty note. (2026-04-25)

### Snapshot (from former "What Exists" — superseded by docs/fellowship/codebase-map.md)

Orchestrator and nine companions, twelve skills, full hook lifecycle, eleven slash commands, eval suites for all companions, marketplace-ready manifests, MIT license. For the current structural reference see `docs/fellowship/codebase-map.md`. For the current open work see `quest-log.md`.
