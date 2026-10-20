# Cleanliness Audit — what shouldn't ship in v1.0

**Auditor:** Sam
**Date:** 2026-04-26
**Scope:** Read-only review of dead/unclean material — orthogonal to Legolas (content), Merry (infrastructure), Aragorn (best-practices). This audit looks for residue: empty scaffolding, orphan files, dead code, stale references, leftover backups.

---

## 1. Verdict

The repo is **clean enough to ship v1.0** with two embarrassments to fix first. Most of the housekeeping has been done well — the post-restructure `agents/_shared/` and `agents/references/` directories are populated and load-bearing; `.claude/settings.json.bak` is gone; the gitignore properly excludes worktrees, `examples/`, `src/`, and the orphan `tests/auth-login.test.mjs` fixture. The hook manifest is consistent with the scripts on disk. Manifests have full metadata, no placeholder values.

What does need to be fixed before tagging v1.0:

- **`docs/fellowship/codebase-map.md` lies twice about `agents/gandalf.md`** — the file no longer exists (deleted in the skill restructure on 2026-04-26 per the quest log) but the map still describes it as a "legacy orchestrator file (retained)" on line 32 and instructs editors to "study it before editing any other companion" on line 109. A new contributor running `/fellowship:map` against the repo's own map will be misled on first read. **Block.**
- **`hooks/fellowship-statusline.mjs` is an orphan dead-code file.** It's a complete Node script implementing a `statusLine` hook for the user's status bar — but Claude Code does not honor plugin-level `statusLine`, a fact `hooks/health-check.mjs:146` explicitly comments on while validating the absence of `settings.json`. The file is not referenced from `hooks/hooks.json`, not invoked by any `run-hook.cmd` call, and not exercised by any test. It is residue from an attempt that was abandoned. **Should-fix** before v1.0 — the marketplace user will grep `hooks/` and ask what it does.

Everything else surfaced below is polish or v1.1 backlog.

---

## 2. By-category findings

### 2.1 Empty directories

| Path | State | Severity | Why |
|---|---|---|---|
| `docs/fellowship/design/` | Empty | **Clean** — intentional | Bootstrap creates it; `docs/fellowship/README.md:30` documents it as the home for wireframes/Figma exports. Empty because no design work has landed yet. Leave it. |
| `agents/_shared/` | Populated (`companion-protocol.md`) | Clean | Referenced by 9 of 9 dispatchable agents. Legolas's prior "empty scaffolding" flag is stale. |
| `agents/references/` | Populated (`figma-mcp-recovery.md`, `owasp-checklist.md`, `playwright-tools.md`) | Clean | Referenced by Arwen, Boromir, Pippin respectively. |

Found via `find . -type d -empty -not -path './.git/*' -not -path './node_modules/*' -not -path './examples/*'`.

### 2.2 Orphan files

| Path | Severity | Why |
|---|---|---|
| `hooks/fellowship-statusline.mjs` | **Should-fix** | Implements an unsupported feature (plugin-level statusLine not honored by Claude Code, per `hooks/health-check.mjs:146`). Not in `hooks/hooks.json`, not in any test, not referenced by `run-hook.cmd`. Pure deadwood. Either delete or move to a `dead/` folder with a comment. |
| `evals/pippin/__pycache__/` & `evals/_runner/__pycache__/` | Polish | Both are gitignored (`*.pyc`, `__pycache__/` rules in `.gitignore`), so they are not tracked — confirmed via `git ls-files`. No action needed; noting only because they appear in `ls`. |
| `tests/auth-login.test.mjs` | Clean — gitignored | Listed in `.gitignore`. Was an orphan, properly fenced. |
| `src/__tests__/email.test.ts` | Clean — gitignored | `src/` is gitignored entirely. |
| `docs/fellowship/examples/bmad/` & `caveman/` | Clean — gitignored | `bmad/` is in `.gitignore`; both directories are reference clones not shipped to marketplace. |
| `evals/pippin/` missing `holdout_validation.py` and `test_holdout.py` (which gandalf evals has) | Polish | Inconsistent eval coverage — Pippin has `holdout.jsonl` but no validation script. Quest log already tracks this under "Eval coverage for Boromir/Merry/Aragorn/Arwen/Sam/Bilbo." |
| `commands/fellowship-add-ethos.md`, `commands/fellowship-consolidate.md` | Clean | Both reachable; `add-ethos` referenced from `hooks/session-start:121`, `consolidate` referenced from quest log workflow. |

Every `agents/*.md` (Aragorn, Arwen, Bilbo, Boromir, Gimli, Legolas, Merry, Pippin, Sam) is in the companion roster at `skills/using-fellowship/references/companions.md`. Every `skills/*/SKILL.md` is real and either in the roster or routed via `using-fellowship/SKILL.md` (planning, brainstorming, codebase-map, autoimprove, investigate, learn, grill-me, design-it-twice, accessibility, ux-audit, visual-exploration). No skill orphans.

### 2.3 Dead code in scripts

| Path | Finding | Severity |
|---|---|---|
| `hooks/fellowship-statusline.mjs` (entire file) | See 2.2 — script's purpose is unsupported by the runtime. | Should-fix |
| `hooks/health-check.mjs` (orphan-detection) | Lines 313–316 leave the no-op stub `// orphan detection removed — skills are Gandalf-loaded, not agent-declared` after removing the actual logic. The matching `tests/health-check.test.mjs:368` test is `skip:` with the same explanation. The skip is **not stale** — it documents intentional dead functionality that was deliberately removed. Leave both as-is or delete the empty test stub and the corresponding empty function in one polish commit. | Polish |
| `hooks/fellowship-context-monitor.mjs`, `fellowship-quest-log-consolidate.mjs`, `fellowship-session-end.mjs`, `session-start` | Grepped for `TODO`/`FIXME`/`XXX`/`HACK` — none found. Functions defined are all called. | Clean |
| `agents/*.md` and `skills/*/SKILL.md` | One mention of `XXX` (Arwen line 157, in a JSON schema example for port placeholders) and one of `TODO` (Legolas line 93, listing things he flags). Both legitimate textual usage, not graveyards. | Clean |

### 2.4 Stale references in docs

| File | Line | Issue | Severity |
|---|---|---|---|
| `docs/fellowship/codebase-map.md` | 32 | Lists `agents/gandalf.md` as "legacy orchestrator file (retained; superceded by using-fellowship skill)" — the file was deleted on 2026-04-26 per the quest log. | **Block** |
| `docs/fellowship/codebase-map.md` | 109 | "Gandalf's register is documented in `agents/gandalf.md` — study it before editing any other companion." Voice now lives in `skills/using-fellowship/references/voice.md`. | **Block** |
| `docs/fellowship/codebase-map.md` | 11 | Says plugin manifest is at `v1.5.0`. Real version per `.claude-plugin/plugin.json` is `1.0.0` (reset for public release per the quest log entry on 2026-04-25). | Should-fix |
| `docs/fellowship/specs/merry-adr-legolas-structural-review.md` | 170, 192–201 | References `agents/gandalf.md:493` and `agents/gandalf.md` edits. Historical spec — content is intact, only the file path is stale. | Polish — move to `specs/archive/` post-1.0 since the work is done. |
| `docs/fellowship/specs/2026-04-22-fellowship-real-usage-improvements.md` | 79, 87, 98, 116, 128, 139, 150, 167–168, 188, 236, 267 | Same — historical references to `agents/gandalf.md`. Spec body is still useful as a record. | Polish — archive. |
| `docs/fellowship/research.md` | 334 | Mentions `agents/gandalf.md` in passing. Research doc; rephrase or leave since it's discussing format compatibility. | Polish |
| `docs/fellowship/archive/2026-03-23-dual-mode-tier-scoring.md` | 155, 178 | References `agents/gandalf.md`. Already archived; no action. | Clean |
| `docs/fellowship/quest-log-archive.md` | 11 | Historical entry — "Fix agent dispatch — fully-qualified names in gandalf.md tools" (2026-03-23). Historical record, accurate at the time. | Clean — archives are immutable. |
| `docs/fellowship/plans/2026-04-22-p4-p5-p6-plan.md` | 206, 222 | References `agents/gandalf.md` for edit locations. Plan should already be in `plans/archive/` — sister file `2026-04-26-gandalf-skill-restructure.md` is properly archived but this earlier plan is still at `plans/` top level. | Polish — move to `plans/archive/`. |
| `agents/references/*.md`, `skills/using-fellowship/references/*.md` | All checked | All upstream files referenced (`figma-mcp-recovery` ↔ `arwen.md:137`; `owasp-checklist` ↔ `boromir.md:56`; `playwright-tools` ↔ `pippin.md:109`; `companions.md`, `voice.md`, etc. ↔ `using-fellowship/SKILL.md`). | Clean |

Found via `grep -rn 'gandalf\.md\|agents/gandalf' docs/ skills/ agents/` and `grep -rn 'design/\|fellowship/design' skills/ agents/`.

### 2.5 Stale frontmatter declarations

Spot-checked `agents/sam.md`, `pippin.md`, `merry.md`, `arwen.md`. All declare `model: inherit` (correct per `references/companions.md:50` — routing is dispatch-time, frontmatter is default). Tool allowlists were corrected in v1.7.0 per the 2026-04-23 quest log entry. No skills declared in frontmatter that aren't directories under `skills/`. Health-check at 26/0 validates this on every run. **Clean.**

### 2.6 Manifest hygiene

- `.claude-plugin/plugin.json` — name, description, version `1.0.0`, author with email, homepage, repository, license, keywords. No empty strings, no `"TBD"`. **Clean.**
- `.claude-plugin/marketplace.json` — same pattern, `version 1.0.0`, fully populated. **Clean.**
- `hooks/hooks.json` — every command points at a real script in `hooks/` (verified all four targets exist: `session-start`, `fellowship-quest-log-consolidate`, `fellowship-context-monitor`, `fellowship-session-end`). **Clean.**

### 2.7 Backup / scratch files

- `find . \( -name '*.bak' -o -name '*.tmp' -o -name '*.swp' -o -name '*~' \)` — no matches outside `.git/`, `node_modules/`, `examples/`. The previously-flagged `.claude/settings.json.bak` is **gone** — properly cleaned up. **Clean.**

### 2.8 Examples directory

`examples/` is gitignored at the root; `docs/fellowship/examples/bmad/` is also gitignored; `docs/fellowship/examples/caveman/` is sibling and similarly an external clone. Greppable references *to* `examples/` from skills/agents/docs all point at gitignored content for local-dev reference only — they are not links a marketplace user would follow on a fresh install. **Clean.**

### 2.9 Tests and fixtures

- `tests/health-check.test.mjs` — 1 skipped test on line 368 (`'fails when a skill directory exists but no agent references it'`). The skip is **not stale** — the orphan-detection feature was deliberately removed (`hooks/health-check.mjs:313–316` documents the rationale: skills are Gandalf-loaded, not agent-declared, so a skill without an agent reference is not an orphan). The skip stub is intentional documentation. Either keep as-is for the audit trail or delete in a polish commit. **Polish.**
- No other tests reference removed code paths.

### 2.10 Environment variables

| Var | Read at | Set by | Status |
|---|---|---|---|
| `CWD` | `hooks/session-start:19` | Cursor (per session-start comment on line 18) | **Clean** — fallback to `pwd` if absent. |
| `CLAUDE_PLUGIN_ROOT` | `hooks/hooks.json` (×4), `hooks/session-start:187`, `tests/health-check.test.mjs:49` | Claude Code at runtime | Clean |
| `CURSOR_PLUGIN_ROOT` | `hooks/session-start:184` | Cursor at runtime | Clean — branched correctly. |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `skills/using-fellowship/SKILL.md:75`, `references/companions.md:54` | User opt-in | Clean — documented as conditional. |
| `CLAUDE_SCRATCHPAD_DIR` | `agents/gimli.md:78`, `agents/_shared/companion-protocol.md:28`, `skills/using-fellowship/SKILL.md:142` | Claude Code at dispatch | Clean — used as path interpolation in agent prompts. |

No env vars read but never set, none set but never read. **Clean.**

### 2.11 Memory files

- `.claude/agent-memory/fellowship-gandalf/` — 13 files, MEMORY.md as index, mix of `feedback_*`, `project_*`, `reference_*`. Not auditing content (Legolas's domain), but directory structure follows Anthropic's per-agent memory convention. **Clean.**
- Empty memory directories: `fellowship-aragorn/`, `fellowship-arwen/`, `fellowship-bilbo/`, `fellowship-pippin/`, `fellowship-sam/`. These exist as bootstrapped scaffolding for agents that have not yet written memories in this repo. **Clean** — empty memory is the correct starting state.
- `.claude/worktrees/` — gitignored, two ephemeral agent worktrees from prior parallel dispatches. Not shipped. **Clean.**

---

## 3. Recommended cleanup batch

Frodo decides bucketing; this is a recommendation.

**Bucket A — fix in one commit before tagging v1.0** (block-level)

1. `docs/fellowship/codebase-map.md:32` — remove the `agents/gandalf.md — legacy orchestrator file` bullet entirely.
2. `docs/fellowship/codebase-map.md:109` — change "documented in `agents/gandalf.md`" to "documented in `skills/using-fellowship/references/voice.md`".
3. `docs/fellowship/codebase-map.md:11` — bump documented version `v1.5.0` → `v1.0.0`.
4. Either delete `hooks/fellowship-statusline.mjs` or add a header comment explaining why it's retained (e.g., "kept for reference; not active — plugin-level statusLine not honored by Claude Code as of 2026-04").

**Bucket B — delete in one commit** (polish)

5. Move `docs/fellowship/plans/2026-04-22-p4-p5-p6-plan.md` to `plans/archive/` — the quest is done.
6. Move `docs/fellowship/specs/merry-adr-legolas-structural-review.md` and `docs/fellowship/specs/2026-04-22-fellowship-real-usage-improvements.md` to `specs/archive/` — historical, work landed.
7. Delete the skipped-test stub at `tests/health-check.test.mjs:367–369` along with the empty function in `hooks/health-check.mjs:313–316` (one removal, two files). The skip already documents itself in the comment.

**Bucket C — v1.1 backlog**

8. Eval coverage for Pippin (`holdout_validation.py`, `test_holdout.py`) and the six other companions without eval scenarios. Already tracked in quest log.
9. `docs/fellowship/research.md:334` — minor wording update to remove the `gandalf.md` reference. Not user-facing; can wait.

---

## 4. What's clean — credit where due

- **No backup files anywhere.** The earlier `.claude/settings.json.bak` flag has been actioned.
- **Manifests are fully populated.** Both `plugin.json` and `marketplace.json` carry author, email, homepage, repository, license, keywords. No `"TBD"`, no empty strings.
- **Hook manifest matches disk.** Every command in `hooks/hooks.json` resolves to a real script; every shim under `hooks/` either is referenced from the manifest or is a worker `.mjs` invoked by its sibling shim. The one exception (`fellowship-statusline.mjs`) is the only orphan.
- **Agent allowlists are correct and validated by health-check at 26/0.** The v1.7.0 corrections held.
- **Cross-platform polyglot wrapper** (`hooks/run-hook.cmd`) is correctly written — bash-and-batch dual-script with explicit fallback messaging when Bash is missing on Windows.
- **Gitignore is doing real work.** `examples/`, `docs/fellowship/examples/bmad/`, `src/`, `.claude/worktrees/`, `tests/auth-login.test.mjs`, `__pycache__/`, `*.pyc`, `.DS_Store`, `docs/fellowship/.quest-log-reminder` — all properly fenced.
- **Reference files load-bear properly.** Every entry in `agents/references/` and `skills/using-fellowship/references/` is reachable from the upstream agent or skill that needs it.
- **No env var ghosts.** Every variable read by a hook is set by either Claude Code, Cursor, or the user; every variable referenced in agent prompts is set at dispatch time.
- **Empty `docs/fellowship/design/` is intentional**, documented in `docs/fellowship/README.md:30`. It is scaffolding awaiting Arwen's first artifact, not a forgotten relic.

---

**Summary headline:** 1 orphan script (`fellowship-statusline.mjs`), 3 stale references in `codebase-map.md`, 2 historical specs to archive, 1 empty-stub test pair. Two block items, the rest polish.
