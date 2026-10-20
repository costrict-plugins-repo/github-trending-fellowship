# Fellowship vs Superpowers — Infrastructure Deep Comparison

**Author:** Merry · **Date:** 2026-04-26 · **Scope:** Plugin plumbing only (manifests, hooks, commands, settings, install behaviour, namespacing). Skill and agent file content is Legolas's parallel pass.
**Reference:** `examples/superpowers/` v5.0.5

---

## Headline Architectural Finding

Fellowship has roughly **3× the hook surface area** of Superpowers (one SessionStart hook → seven inputs across three event types) but **one-fourth the documented user-invocation surface** (two slash commands vs. three plus a deprecation pattern, atop a much larger skills tree). The hooks are doing a great deal of work that the user has no map for, while the slash-command surface promises namespaces (`/fellowship:brainstorming`, `/fellowship:planning`, `/fellowship:map`) that don't exist as files. The infrastructure is heavier and quieter than Superpowers's; that asymmetry — heavy machinery + thin discovery — is the central architectural risk for a v1.0 release.

---

## 1. Plugin Manifests

**Superpowers** (`examples/superpowers/.claude-plugin/plugin.json:1-13`, `marketplace.json:1-20`): minimal. `plugin.json` carries name, description, version, author, homepage, repository, license, keywords. Marketplace stub names a separate `superpowers-dev` marketplace and only repeats `name`, `description`, `version`, `source`, `author` — fields not duplicated from `plugin.json`.

**Fellowship** (`.claude-plugin/plugin.json:1-19`, `marketplace.json:1-30`): same structural shape, but the marketplace entry **duplicates every plugin-level field** (homepage, repository, license, keywords) inside `plugins[0]`. The two files now have to be edited together for any metadata change.

**Divergence:** Stylistic verging on Minor. Field duplication in the marketplace.json is a maintenance trap — `health-check.mjs:113-135` already encodes the rule that "version lives in marketplace.json for relative-path plugins"; if any other field drifts between the two files, the failure is silent.

**Question for Frodo:** Do we want marketplace.json to be a thin pointer (Superpowers pattern) or a full-fat redeclaration? If the latter, the health check should diff them and fail on drift.

---

## 2. Hook Architecture

**Superpowers** (`hooks/hooks.json:1-16`): one event (`SessionStart`), one matcher (`startup|clear|compact`), one script (`session-start`). 16 lines. The session-start script (`hooks/session-start:1-58`) does exactly one thing — read `using-superpowers/SKILL.md`, escape, inject under `<EXTREMELY_IMPORTANT>`. There is also a legacy-skills-dir warning. That is the entire hook surface.

**Fellowship** (`hooks/hooks.json:1-48`):
- `SessionStart` (matcher `startup|resume|clear|compact` — note the extra `resume`): two scripts in sequence, `session-start` and `fellowship-quest-log-consolidate`.
- `PostToolUse` (no matcher — runs on every tool call): `fellowship-context-monitor`.
- `SessionEnd`: two scripts, `fellowship-session-end` and `fellowship-quest-log-consolidate`.

`hooks/session-start:1-196` reads and conditionally injects **eight** XML-tagged blocks: using-fellowship skill, fellowship-bootstrap.md, quest-log.md, product.md (with empty-content notice), debug-log.md (last 60 lines), most recent handoff (7-day window), codebase-map.md (first 30 lines), ethos absence notice, project-local skills/agents survey, and a one-shot quest-log consolidation reminder. `fellowship-context-monitor.mjs:1-110` is on the hot path of every tool call, with its own tmpfile state and a 10-second stdin timeout. `fellowship-quest-log-consolidate.mjs` is 266 lines and runs twice per session (start and end).

**Divergence:** Important. The asymmetry is real and partly justified — Fellowship is a stateful multi-agent system, Superpowers is a skills library — but the *scale* of the asymmetry isn't questioned anywhere. The PostToolUse hook fires on every tool call; even at ~10ms per invocation it accumulates. The matcher `resume` on SessionStart means we re-inject all eight context blocks every time the user wakes a paused conversation, which can grow stale (handoff from yesterday, debug-log from last week) and may double-prime the model.

**Question for Frodo:** Is the eight-block injection at startup the v1.0 contract, or is it grown-by-accretion? If grown, which blocks have *demonstrated* user value (signal observed in logs/feedback) vs. which are "felt right when added"? Specifically: debug-log tail, handoff replay on `resume`, and codebase-map head — these three together make the SessionStart payload non-trivially large.

---

## 3. Commands Surface

**Superpowers** (`examples/superpowers/commands/`, three files): `brainstorm.md`, `execute-plan.md`, `write-plan.md`. Each is **5 lines** and is a deprecation stub: "this command is deprecated — ask me to use the corresponding skill instead." (`commands/brainstorm.md:1-5`.) The architectural intent: skills are the primary surface; slash commands exist only to redirect users with stale muscle memory.

**Fellowship** (`commands/`, two files): `fellowship-add-ethos.md` (29 lines) and `fellowship-consolidate.md` (30 lines). Both are real, working commands with imperative bodies.

**The discoverability gap.** `skills/using-fellowship/SKILL.md:171,173` and `README.md:30` reference `/fellowship:brainstorming`, `/fellowship:planning`, `/fellowship:map` — none of these exist as command files. They are skill names that will only autoload via the Skill tool, not via slash invocation. A user reading the README and typing `/fellowship:brainstorming` will get "command not found." This is a **broken contract in user-facing docs**, not a stylistic divergence.

**Divergence:** Important–Critical (because it ships docs the plugin contradicts).

**Question for Frodo:** Do we want skill names to also be slash commands (Superpowers's deprecation-stub pattern, redirecting to the skill), or do we want the README and using-fellowship skill rewritten to stop promising slash invocations that don't exist? Either fix is fine; the current state is a doc contract Fellowship can't honour.

---

## 4. Settings.json Convention

**Superpowers:** ships none.
**Fellowship:** ships none (the project-root `.claude/settings.json` was just removed; per-plugin no `settings.json` at root either). `health-check.mjs:141-173` documents this as the correct state — Gandalf identity is injected via the SessionStart hook, not via `agent` field override.

**Divergence:** None. Both projects have converged on "no settings.json." The codified rationale in the health check (`settings.json:148`: "absent (correct — Gandalf injected via hook, no plugin-level overrides needed)") is good architectural hygiene that Superpowers leaves implicit.

**Severity:** Stylistic. We do this slightly better — the absence is explained.

---

## 5. Health Check / Quality Gates

**Superpowers:** no equivalent. The `tests/` directory contains behavioural test harnesses (`brainstorm-server`, `claude-code`, `explicit-skill-requests`, `skill-triggering`, etc.) — runtime tests, not structural.

**Fellowship** (`hooks/health-check.mjs:1-346`): structural validator covering plugin manifest fields, marketplace.json semver, settings.json convention, hook script existence + executability, agent frontmatter (skills resolve, tools in known list), skill SKILL.md presence. Notably missing:
- No check that every SKILL.md has a non-empty `description` frontmatter (the file already flags this as a TODO at line 318).
- No check that slash commands referenced in skill/README content actually exist as files (would have caught the §3 issue).
- No check that the `agents/*.md` skills frontmatter actually appears in the corresponding skill directory's name list — it checks the *directory exists*, not that the skill YAML name matches the directory name.
- No drift check between `plugin.json` and `marketplace.json` duplicated fields (see §1).
- Tools allowlist is hardcoded (`KNOWN_TOOLS:19`) — easy to drift if Claude Code adds a tool.

**Divergence:** This is genuine differentiation. Superpowers has nothing here. The check we have is the right *shape* but its coverage is narrower than the bugs in this audit have already revealed.

**Question for Frodo:** Should health-check.mjs be the v1.0 ship-blocking gate? If yes, the four gaps above (especially "slash commands referenced exist") need to land before publishing.

---

## 6. Worktree Integration / Parallel-Agent Affordances

**Superpowers:** ships `skills/dispatching-parallel-agents/SKILL.md` and `skills/using-git-worktrees/SKILL.md` (40+ lines on directory selection, safety verification). The patterns assume concurrent agents may run in isolated worktrees and tell the orchestrator how to set them up.

**Fellowship:** `grep -c worktree` across all agent files (`agents/*.md`) returns **0**. `using-fellowship/SKILL.md:75` describes Agent Teams via `Agent(team_name=..., subagent_type="fellowship:gimli", ...)` and says "no two teammates touch the same file" — but the file-ownership constraint is the only isolation primitive named. There is no skill teaching when to spawn a worktree, no agent file that says "I run in a worktree if X," no hook that prepares one.

**Divergence:** Important. Fellowship's parallel-dispatch story stops at "give each agent different files." Real concurrent work — e.g. Gimli + Arwen on the same feature, or two Boromir security audits — needs branch isolation. Superpowers has the skill ready; we don't reuse it and don't have our own.

**Question for Frodo:** Are Tier 4 Agent Teams expected to share the working tree, or branch into worktrees? If shared, "no two teammates touch the same file" is the only safety primitive and should be enforced (Legolas? a hook?). If isolated, we owe the user a worktree skill — adopting Superpowers's `using-git-worktrees` is a candidate.

---

## 7. Cross-Platform Support

**Superpowers** (`hooks/run-hook.cmd:1-47` and `hooks/hooks-cursor.json:1-11`): `run-hook.cmd` is a polyglot bash/cmd wrapper, identical in spirit to ours. Crucially, the Windows fallback **exits silently** (line 38: "exit silently rather than error"). They also ship `hooks-cursor.json`, naming Cursor as a supported host with its own hook event vocabulary (`sessionStart` lower-camel).

**Fellowship** (`hooks/run-hook.cmd:1-47`): same polyglot pattern, with one substantive difference at line 38: *"Fellowship: bash not found. SessionStart context skipped — install Git for Windows for full functionality."* — this prints to stderr. We chose loud failure; Superpowers chose silent. We do **not** ship a `hooks-cursor.json` equivalent. `hooks/session-start:184-193` does check for `CURSOR_PLUGIN_ROOT` and emits the Cursor-shaped JSON, so the *script* is Cursor-ready, but no `hooks-cursor.json` registers it for Cursor.

**Divergence:** Minor on the loud-vs-silent fail (defensible — we want Windows users to know context is missing). Important on the missing `hooks-cursor.json`: our session-start has Cursor support code that no Cursor host is wired to invoke.

**Question for Frodo:** Do we support Cursor as a v1.0 target? If yes, `hooks-cursor.json` is a missing file and the Cursor branch in session-start is dead code. If no, the Cursor branch should be removed (or commented as "future").

---

## 8. Top-Level Repo Files

**Superpowers ships at root:** `LICENSE`, `README.md`, `CHANGELOG.md`, `RELEASE-NOTES.md`, `CODE_OF_CONDUCT.md`, `package.json` (minimal — `examples/superpowers/package.json:1-7`, just name/version/type/main pointing at `.opencode/plugins/superpowers.js`), `gemini-extension.json` (Gemini host manifest), `GEMINI.md` (Gemini CLAUDE.md equivalent).

**Fellowship ships at root:** `LICENSE`, `README.md`, `CHANGELOG.md`. No `RELEASE-NOTES.md`, no `CODE_OF_CONDUCT.md`, no `package.json`, no Gemini extension.

**Divergence:** Mostly stylistic, with one tangible item:
- `RELEASE-NOTES.md` vs `CHANGELOG.md` — Superpowers maintains both. Their CHANGELOG (`examples/superpowers/CHANGELOG.md:1-5`) is structured per-version with sections; RELEASE-NOTES is the human-readable ship announcement. This is a maturity signal worth picking up only if we plan to ship publicly.
- `CODE_OF_CONDUCT.md` — community signal, free to add.
- No `package.json` for us is fine; we have nothing to publish to npm. Superpowers's package.json is for OpenCode (`main: .opencode/plugins/...`) — not relevant unless we target OpenCode.
- No Gemini extension — same.

**Severity:** Stylistic. Ship these if (and only if) v1.0 is going public; otherwise they are lifecycle ceremony.

---

## 9. Install Behaviour & Dependency Footprint

**Superpowers `/plugin install`:** copies the directory, registers `hooks.json` (one event), wires `commands/*.md` (three deprecation stubs), exposes `skills/*` for the Skill tool. No file-system writes outside the plugin dir on first run. No required env vars.

**Fellowship `/plugin install`:** same wiring, but at first SessionStart the hook starts probing the *project's* CWD for `docs/fellowship/quest-log.md`, `product.md`, `debug-log.md`, `handoffs/`, `codebase-map.md`, `templates/ethos.md`, `.claude/skills/`, `.claude/agents/`, and writes/deletes `.quest-log-reminder` (`hooks/session-start:166-174`). These are graceful no-ops when missing — but a user who installs Fellowship in a non-Fellowship project gets the bootstrap injection (line 41-50: "You are Gandalf — orchestrator..."), which is heavy identity priming for someone who may have wanted to evaluate the plugin without committing.

**Divergence:** Important. Superpowers respects the cold-install user — they get a skills library on demand. Fellowship's cold-install user gets Gandalf injected on every session start whether they wanted it or not, plus a notice if `templates/ethos.md` is missing.

**Question for Frodo:** Should there be a "dormant until invoked" mode for fresh installs — e.g. don't inject the Gandalf identity wrapper unless `docs/fellowship/` exists or the user has explicitly initialized? Or is unconditional Gandalf the v1.0 product promise? Either is valid; the current behaviour should be a *choice*.

---

## 10. Plugin Namespacing

**Superpowers:** skills are invoked via the Skill tool with names like `superpowers:brainstorming`. Slash commands at install resolve as plain `/brainstorm`, `/write-plan`, `/execute-plan` (no `superpowers:` prefix observed in the command frontmatter — `commands/brainstorm.md:1-3` has only `description`).

**Fellowship:** slash commands declare `name: fellowship:add-ethos` and `name: fellowship:consolidate` in frontmatter. Skills are referenced in agent frontmatter as bare names (`merry`'s skills field, etc. — see `health-check.mjs:251-260` resolving them as directory names without prefix). The `using-fellowship` skill and README mix three forms:
- `/fellowship:brainstorming` (slash form, but no command file exists)
- `subagent_type="fellowship:gimli"` (agent invocation form)
- `/fellowship:map`, `/fellowship:planning` (slash forms — broken)
- `templates/ethos.md` (project-relative path)

**Divergence:** Important. The user has at least three mental models presented (slash, subagent, project path), the slash form is broken in three out of three references in the using-fellowship skill, and there's no documented rule for which prefix means what.

**Question for Frodo:** What is the canonical invocation grammar?
1. `/fellowship:<command>` for slash commands → must be a real file in `commands/`
2. `fellowship:<agent>` for `subagent_type` → resolves to `agents/<name>.md`
3. `<skill-name>` for autoloaded skills → directory name in `skills/`

Once locked, the using-fellowship skill and README need a single sweep to honour it; the health check should enforce that referenced slash commands exist (see §5).

---

## Cross-Cutting Patterns

**Pattern A — "Heavy machinery, thin discovery."** Sections 2 (hooks), 3 (commands), 9 (install), and 10 (namespacing) all share the same shape: Fellowship does *more* under the hood than Superpowers, but exposes *less* of it cleanly to the user. The eight-block SessionStart injection, the PostToolUse context monitor, the dual SessionEnd hooks, the consolidation reminders — none of these are visible at `/help`. Two slash commands, neither of which is the one the README most prominently advertises.

**Pattern B — "Promised but missing."** The using-fellowship skill is the Fellowship onboarding text. It promises `/fellowship:brainstorming`, `/fellowship:planning`, `/fellowship:map`. None exist. The health check doesn't catch this. The README repeats one of these promises. This is a single root cause (no validator) producing user-facing breakage in three documented places.

**Pattern C — "Convergence on the right defaults, undocumented."** Both plugins independently arrived at: no `settings.json`, polyglot bash/cmd wrapper, `${CLAUDE_PLUGIN_ROOT}` over hardcoded paths, escape-then-print-then-no-heredoc for the JSON output. We codify the rationale (health check comments, settings.json absence justification); Superpowers leaves it implicit. Worth keeping our codification.

**Pattern D — "Skill content vs. infra wiring drift."** The using-fellowship skill describes the user's experience of the system. The hooks deliver that experience. They are written and updated independently. There is no test that says "if the using-fellowship skill says X is invokable, X is invokable." That gap is what allowed Pattern B to ship.

---

## What Fellowship Does Better Than Superpowers

1. **Health-check.mjs.** Superpowers has zero structural validation. Even with the gaps in §5, ours catches manifest, hook, agent-frontmatter, and skill-directory drift. This is genuine v1.0 maturity infrastructure.
2. **Codified rationale at decision points.** The settings.json absence (`hooks/health-check.mjs:142-150`), the bash 5.3 heredoc workaround comment, the dual-platform JSON branch comment in session-start — these explain *why* a non-obvious choice was made. Superpowers leaves the same choices implicit. Future-us will thank present-us.
3. **Loud Windows failure.** `run-hook.cmd:38` prints when bash isn't found instead of silently dropping context. Right call: a Windows user without context injection should know. (Documented per-decision; consider whether stderr noise is acceptable.)
4. **Multi-event hook orchestration.** Superpowers uses one event; we use three. The *idea* is right — quest-log consolidation belongs at session boundaries, context monitoring belongs on tool-use. Whether each individual hook earns its complexity is the §2 question — but the architectural pattern of "different lifecycle events for different state" is more advanced than Superpowers's single-event model.
5. **Project-local override survey.** `hooks/session-start:126-163` enumerates project-local skills and agents and announces precedence. Superpowers has nothing equivalent; users with custom local skills get no signal whether their override took. We make precedence explicit at session start.

---

*End of comparison. ~2,000 words. No remediation proposed; questions for Frodo flagged in each section.*
