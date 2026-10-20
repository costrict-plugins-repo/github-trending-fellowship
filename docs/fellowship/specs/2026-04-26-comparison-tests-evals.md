# Tests & Evals Freshness Audit — v1.0 readiness

**Auditor:** Pippin
**Date:** 2026-04-26
**Scope:** `tests/` and `evals/` after the v1.0 Gandalf-skill migration
**Mode:** read-only

---

## 1. Verdict

Tests are fit-for-ship. Evals are **not** — the AutoImprove infrastructure has a hard breakage for Gandalf that no test caught: `evals/_runner/run_eval.py:131` and `evals/_runner/improve.sh:183,201,214,229,243,251,317` all read `agents/${agent}.md`, but `agents/gandalf.md` was deleted in this migration (Gandalf identity now lives in `skills/using-fellowship/SKILL.md`, injected via SessionStart). Three Python helpers in `evals/gandalf/` (`holdout.py`, `holdout_validation.py`, `test_holdout.py` — all line 10) hit the same dead path. Anyone running `./improve.sh gandalf` after tag will get `agent file not found: …/agents/gandalf.md` and exit 1. This is the ship-block. Everything else — scenario coverage, hard-grader scope, scenario freshness — is in much better shape than I expected. The version-field test inversion at `tests/health-check.test.mjs:217-230` is clean and exemplary; the protected-evaluator chain (`improve.sh:88-92` → `chmod 444`) is real and works as `research.md` describes.

---

## 2. Test findings

### `tests/health-check.test.mjs` — 25 pass, 1 skipped, 0 fail

Ran `node --test tests/health-check.test.mjs`: 26 tests, 25 pass, 1 skipped, 2.3s.

**Coverage of `hooks/health-check.mjs`** — solid. The eight check functions are all exercised:

| Function (line) | Test coverage |
|---|---|
| `checkPluginManifest` (87) | malformed JSON, missing fields, missing version, valid path — covered |
| `checkMarketplaceManifest` (113) | non-semver version, missing version, empty plugins array — covered |
| `checkSettings` (141) | nonexistent agent, no agent field, absent settings.json — first two covered, **absent settings.json branch (line 143-149) is not exercised by any test**. The `passes when settings.json has no agent field` test (288) covers `data.agent` falsy but settings.json *exists*. The actual file-absent green-path is uncovered. |
| `checkHooks` (179) | missing script, non-executable script, malformed JSON — covered |
| `checkAgents` (233) | nonexistent skill, unknown tool, no frontmatter, empty file, no skills field, `Agent(...)` style — covered |
| `checkSkillDirs` (288) | missing SKILL.md — covered |
| `checkCrossRefs` (315) | no-op — explicitly skipped, see below |

**Stale assertions:** none found. The `version` test at line 217 was correctly inverted this session: it now asserts the script *fails* without a version field, with reasoning baked into the test docstring (218-219). Tests at 274-300 explicitly cover the new "absent settings.json or no agent field is correct" semantics. The `Agent(...)` extraction test at 441 matches the implementation at health-check.mjs:271. Tools like `BadTool` and `FooTool` follow the new lenient frontmatter contract. No test asserts orphan-skill detection — that was removed and the skip is current.

**Skipped test (line 368):** `fails when a skill directory exists but no agent references it` — skip reason `'orphan detection removed — see health-check.mjs:261'`. Skip is **current and legitimate**: `checkCrossRefs` at health-check.mjs:315 is intentionally a no-op because skills are loaded contextually by Gandalf, not declared in agent frontmatter. The skip should stay; the comment pointer to `:261` is slightly off — the actual no-op explanation lives at `checkCrossRefs` (315-318), not 261. Minor polish item.

**Coverage gaps (not stale, but missing):**

1. `checkSettings` settings.json-absent branch (health-check.mjs:143-149) — the new green path introduced this session has no test. A regression here would silently re-flip the architecture without anyone noticing.
2. `checkHooks` non-`run-hook.cmd` command branches (health-check.mjs:201) — the regex skips commands that do not match the `run-hook.cmd` pattern. No test verifies the script tolerates unrelated commands.
3. `parseFrontmatter` (health-check.mjs:51-81) — only tested through `checkAgents`. The parser has its own logic (multiline `|`, key-value vs array-item) that is invisible from the outside. A unit test on the parser directly would catch frontmatter parser regressions cheaply.

### Other plugin code with no tests

The plugin ships several hook scripts that have **zero test surface**:

- `hooks/fellowship-quest-log-consolidate.mjs` (9645 bytes) — non-trivial logic, runs on every session
- `hooks/fellowship-context-monitor.mjs` (4167 bytes) — context-window thresholds, statusline integration
- `hooks/fellowship-session-end.mjs` (2974 bytes) — session-end persistence
- `hooks/fellowship-statusline.mjs` (1599 bytes) — small, low risk
- `hooks/session-start` (10029 bytes) — the **most critical untested code in the repo** — this is the SessionStart hook that injects `using-fellowship` skill content. If it breaks at v1.0 release, every user session boots without Gandalf identity.

Ranked for v1.0 priority:

| Hook | Risk if broken | Test priority |
|---|---|---|
| `session-start` | Catastrophic — Gandalf identity disappears | **Should-fix before v1.0** — at minimum a smoke test that exit code is 0 and stdout contains the skill content |
| `fellowship-quest-log-consolidate.mjs` | Quest log corruption, double-consolidation | Should-fix — pure data transform, easy to test |
| `fellowship-session-end.mjs` | Session log gaps | Polish — v1.1 |
| `fellowship-context-monitor.mjs` | Statusline shows wrong percentage | Polish — v1.1 |
| `fellowship-statusline.mjs` | Statusline blank | Polish — v1.1 |

### Test infrastructure quality

The fixture pattern at `tests/health-check.test.mjs:35-129` is good: per-test temp dirs via `mkdtempSync`, copies the real script in (so `import.meta.url`-relative ROOT resolution works correctly), uses `try/finally` for cleanup. Each test is independent, no shared mutable state. The default-overridable `createFixture(opts)` is exactly the kind of factory I would write. Adding tests for the other hooks could reuse this pattern without modification — no infrastructure debt blocking the gap-fill work.

---

## 3. Eval findings

### Per-companion scenario coverage

| Companion | scenarios.jsonl | hard.py | soft.md | Status |
|---|---|---|---|---|
| Gandalf | 25 scenarios | 10 assertions | 3 assertions | Present |
| Gimli | 21 scenarios | hard.py present | 3 assertions | Present |
| Legolas | 16 scenarios | hard.py present | 3 assertions | Present |
| Pippin | 11 scenarios | 11 assertions | **missing** | hard-only |
| Aragorn | — | — | — | **No coverage** |
| Arwen | — | — | — | **No coverage** |
| Bilbo | — | — | — | **No coverage** |
| Boromir | — | — | — | **No coverage** |
| Merry | — | — | — | **No coverage** |
| Sam | — | — | — | **No coverage** |

The quest-log claim "Eval coverage for Boromir/Merry/Aragorn/Arwen/Sam/Bilbo (deferred)" is **still accurate** — none of these have moved off deferred since the note was written. Pippin's missing `soft.md` is new news: every other companion has soft assertions for an LLM-as-judge layer, Pippin has only hard string checks. Soft coverage for Pippin's report-quality dimensions (depth of findings, calibration of severity, voice) is absent.

### Stale scenarios

I scanned all four scenario files for the framings the migration removed: `Gandalf will dispatch`, `Gandalf sends you`, `agents/gandalf.md` references, strict `tools:` lists. **No matches in any scenario file.** Scenarios speak in user-voice or DONE-report-voice; they do not reach into the dispatcher framing the migration stripped. This is luckier than it deserved to be.

`evals/gimli/scenarios.jsonl:13,16` and `evals/legolas/scenarios.jsonl:1-16` use `[Legolas review findings]` and DONE-report inputs that read the same in v1.0 as they did before. Spot-checks pass.

### Stale eval *infrastructure*

This is the ship-blocker. The migration deleted `agents/gandalf.md` but did not update the eval runner:

- `evals/_runner/run_eval.py:131` — `agent_path = Path(worktree) / "agents" / f"{agent}.md"` — hardcoded for every companion. For `--agent gandalf`, it tries to read a file that no longer exists. Line 136-138 then exits with `agent file not found`.
- `evals/_runner/improve.sh:183` — the cycle-loop prompt instructs Claude `Read agents/${agent}.md, then output the complete modified agent file with ONE targeted fix.` For Gandalf, this is meaningless: the source of Gandalf's behavior is `skills/using-fellowship/SKILL.md`, not an agent file.
- `evals/_runner/improve.sh:201,214,229,243,251,317` — every git operation, hypothesis extraction, and diff target hits `agents/${agent}.md`. None will work for Gandalf.
- `evals/gandalf/holdout.py:10`, `evals/gandalf/holdout_validation.py:10`, `evals/gandalf/test_holdout.py:10` — `with open("agents/gandalf.md") as f:` — three separate scripts that will all `FileNotFoundError` on first run.

**This is a v1.0 ship-block.** The plugin advertises AutoImprove as a feature; running it for Gandalf will crash. Either:

(a) Update the runner to accept a `--source-path` argument and point Gandalf at `skills/using-fellowship/SKILL.md`, or
(b) Document that AutoImprove for Gandalf is disabled at v1.0, with a follow-up issue.

Out of scope for me to fix; this goes back to Gimli or Merry.

### AutoImprove loop — *scenario* angle

`research.md` describes:

1. Real subprocess invocation, not simulation — confirmed at `run_eval.py:48-52` (`subprocess.run(["claude", "--dangerously-skip-permissions", ...])`).
2. Protected evaluator — confirmed at `improve.sh:88-92`: copy `evals/${agent}/hard.py` to `/tmp/fellowship_eval_${agent}_hard.py`, `chmod 444`. The repo copy is `0644` (writable, expected — agents need to be able to *propose* assertion changes; the protection is about preventing the *running* loop from editing the evaluator mid-cycle). Verified.
3. Balanced problem sets — partial. Gandalf's 25 scenarios include positive cases (proper Tier-1 handling, proper Tier-3 planning) and negative cases (`concern_pushback`, `survey_trap`, `escalation_pushback`, `architect_done` permission-seeking trap). Pippin's 11 scenarios include `spec_violation`, `weak_assertions`, `blocked_no_infra`, `browser_verify_blocked_mcp` — all balanced (a behavior that should occur and a temptation that should not). Gimli scenarios are mostly positive — only `gi011` (urgency), `gi012` (vague_scope), `gi017` (scope-creep trap) are negative. Could be better.
4. Hard graders — `hard.py` files exist for all four covered companions, all exit-code-honest, all gated by `scenario.get("type")` so unrelated scenarios don't false-fail.

### Missing scenarios for post-migration behaviors

These regressions are not protected by any current scenario:

1. **Tier-3 dispatch over build** — Gandalf has `ga005` ("add Google OAuth login", routing_tier3) and `ga014` ("build a full authentication system", routing_tier3) which the `plan_before_dispatch_on_tier3` assertion (`hard.py:87-95`) catches. This is covered.
2. **Role-first opener compliance** — the dispatcher-framing fix this session removed agent file lines like "Gandalf sends you when…". There is no scenario asserting that an agent's response opens with role-first content. **Missing.** A `voice_register` scenario at `holdout.jsonl:gah003` exists for Gandalf only.
3. **TodoWrite-blocker honesty** — the quest-log notes a v1.0 blocker on Gandalf using TodoWrite when checkboxes in the quest log are the actual contract. **No scenario asserts this.** Gandalf could quietly start using TodoWrite in real sessions and no eval would catch it.
4. **Skill auto-loading on session start** — the new architecture depends on `skills/using-fellowship/SKILL.md` being injected at boot. No scenario tests that Gandalf-the-prompt-state behaves correctly when this is *missing* (negative case) or *present* (positive case). This is more an integration test than an eval, but it deserves to exist somewhere.

### Pippin's own assertions — self-audit

Pippin's `hard.py:25` `has_test_files_section` asserts the response references test files written. The autoimprove `# hypothesis:` injection in my dispatch context noted this assertion was failing — that's a known weakness in *my own behavior*, not in the assertion. The assertion itself reads correctly: `"files:" in lower or "test files:" in lower or "tests written:" in lower`. The fix belongs in `agents/pippin.md`, not in `hard.py`. Out of scope here.

---

## 4. Bucketing

### Ship-block (must land before v1.0 tag)

1. **AutoImprove for Gandalf is broken.** Either fix the runner to handle skill-sourced agents or disable Gandalf in `improve.sh` with a clear error message. Files: `evals/_runner/run_eval.py:131`, `evals/_runner/improve.sh:183-317`, `evals/gandalf/holdout.py:10`, `evals/gandalf/holdout_validation.py:10`, `evals/gandalf/test_holdout.py:10`.

### Should-fix soon (post-tag, v1.0.x)

2. **`hooks/session-start` has no tests.** Smoke test minimum: exits 0, stdout contains expected SKILL.md content. If this hook breaks silently, every user session boots without Gandalf.
3. **`hooks/fellowship-quest-log-consolidate.mjs` has no tests.** Pure data transform on quest log. Easy unit-test surface; high blast radius if it corrupts state.
4. **Pippin missing `soft.md`.** Every other companion has LLM-judge soft assertions. Pippin has only string checks. Add 2-3 soft assertions on report quality.
5. **`checkSettings` absent-file branch uncovered** (`hooks/health-check.mjs:143-149`). Add one test.

### Polish (v1.1)

6. Tests for the smaller hooks: `fellowship-context-monitor.mjs`, `fellowship-session-end.mjs`, `fellowship-statusline.mjs`.
7. Direct unit tests for `parseFrontmatter` (`hooks/health-check.mjs:51-81`).
8. Eval scenario coverage for Aragorn, Arwen, Bilbo, Boromir, Merry, Sam — the deferred six.
9. Missing scenarios: TodoWrite-blocker honesty, role-first opener regression, skill-injection success/failure.
10. Skip-comment line pointer at `tests/health-check.test.mjs:368` references `health-check.mjs:261`; the actual relevant code is at 315-318.
11. Gimli scenarios skew positive — add 2-3 negative-case scenarios for balance.

---

## 5. What's clean

- The version-field test inversion (`tests/health-check.test.mjs:217-230`) is exemplary: explanatory docstring, asserts both exit code and stdout pattern, uses the existing fixture pattern. This is what test-after-a-fix should look like.
- The `settings.json` absent-state pass case (`hooks/health-check.mjs:143-149`) has its rationale baked into the code comment — future readers will understand why absence is correct, not just that it is.
- Protected-evaluator chain (`improve.sh:88-92`) does what `research.md` claims. The `chmod 444` on the `/tmp` copy is defensive against the agent under improvement modifying its own grader mid-cycle. Real architectural integrity.
- Scenario files are remarkably free of stale framings. The "Gandalf sends you" stripping was thorough enough that no scenario file caught the phrase.
- Pippin's `hard.py:104-175` browser-verify assertions are well-scoped: each one keys on `scenario.get("type")` so unrelated scenarios pass through trivially. The `browser_verify_blocked_mcp` exemption (`hard.py:111`) is the kind of careful conditional that keeps assertions honest.

Word count: ~1750.
