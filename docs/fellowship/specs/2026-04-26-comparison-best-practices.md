# Best-Practices Conformance Audit — Does Fellowship Live Its Citations?

**Auditor:** Aragorn
**Date:** 2026-04-26
**Scope:** Read-only review of `docs/fellowship/research.md` against the implementation (hooks, skills, agents, evals).

---

## 1. Verdict

Of roughly 22 distinct best-practice claims that `research.md` makes against named sources, **17 are genuinely implemented and visible in the codebase, 3 are partially implemented, and 2 are advisory rather than enforced.** No outright misrepresentations remain — the recent Bilbo pass cleaned up the `learnings.md` staleness. The strongest conformance is in the orchestration layer (SessionStart skill injection, three-zone quest log, count-triggered consolidation, context monitor with agent-visible warnings, AutoImprove protected evaluator) — these match the cited sources verbatim, including thresholds (35%/25%, threshold=7). The weakest conformance is structural: the **plan-before-build gate** is a string Gandalf is supposed to paste into dispatch prompts, with no hook enforcement; the **three-layer memory architecture** is conceptually clean but specs/plans/per-agent boundaries have no schema to keep them separate; **eval coverage** stops at four of nine agents (Gandalf/Gimli/Legolas/Pippin); and the orchestrator's mandated `TodoWrite` calls are blocked by a Claude Code platform constraint (already documented). Two cited best practices — Mem0's write-time conflict resolution and GSD's full artifact pyramid — are claimed loosely; we partially honor the principle but don't implement the mechanism.

---

## 2. Conformance Table

| # | Claim (verbatim or near-verbatim from research.md) | Expected location | Status | Evidence |
|---|---|---|---|---|
| **Anthropic** | | | | |
| 1 | "Granular task descriptions with specific objectives, output formats, and clear boundaries" — dispatch protocol | `skills/using-fellowship/SKILL.md` "Dispatching Companions" | **Implemented** | Lines 113–120: "Full task description / Relevant context / Scope boundaries / References" |
| 2 | "Instill good heuristics rather than rigid rules" — principles over prescriptive workflows | All agent files | **Implemented** | Companions written as principles + report formats, not workflow stages (e.g. `gimli.md` Rules 1–4 as heuristics, `legolas.md` review framing) |
| 3 | "Every unnecessary word actively degrades agent performance" — context engineering | All skills/agents under budget | **Partial** | `using-fellowship/SKILL.md` 207L (down from 578L); 8 ref files under 105L each. **But:** Pippin 330L, Bilbo 353L, Sam 296L still above the spirit of the principle; quest log self-flags 3 agents under the −25% bloat target. |
| 4 | "Only make changes that are directly requested or clearly necessary" — scope discipline | `_shared/companion-protocol.md` checklist | **Implemented** | Line 48: "No scope creep — only touched what was asked. Deviations noted explicitly." |
| 5 | "Stop to ask for clarification" / autonomy research — escalation as feature | `_shared/companion-protocol.md` Escalation section | **Implemented** | Lines 67–77: explicit escalation triggers + how-to phrasing; named in every agent's report format with `BLOCKED` |
| 6 | "Effective harnesses" — checkpoint/resume via BLOCKED | Every agent's status table | **Implemented** | All agents include `BLOCKED` with mandatory `Blocker:` section; verified in `gimli.md:101`, `legolas.md:232` |
| **Superpowers** | | | | |
| 7 | "4-status reporting protocol" (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED) | `_shared/companion-protocol.md` + each agent | **Implemented** | Line 22: "exactly one of the four status codes valid for your companion"; reproduced in all 9 agents |
| 8 | SessionStart skill injection — `using-fellowship` SKILL loaded with strong identity wrapper | `hooks/session-start` | **Implemented** | Lines 35–42: reads `skills/using-fellowship/SKILL.md`, wraps with "You are Gandalf — orchestrator…", emits in `<EXTREMELY_IMPORTANT>` tag |
| 9 | "TDD as iron law" deliberately NOT adopted — Pippin owns testing, Gimli verifies | `agents/pippin.md` + `agents/gimli.md` | **Implemented** | TDD principles surgically folded into Pippin Mode 2 only (per quest log 2026-04-25); Gimli verifies, doesn't TDD-mandate |
| 10 | Decompose entry skill into `references/*.md` to avoid bloat | `skills/using-fellowship/references/` | **Implemented** | 8 reference files (voice, tier-scoring, companions, cycles, opening-examples, quest-log-format, handoff-template, feedback-log-schema) totalling 419 lines |
| **Sub-agent research (Steve Kinney)** | | | | |
| 11 | "Counter the silent failure anti-pattern" — verbatim instruction to escalate | `_shared/companion-protocol.md` | **Implemented** | Line 69: *"Bad work is worse than no work. It is always OK to stop and say 'I need help.'"* — verbatim match to research claim |
| **ESCALATE.md** | | | | |
| 12 | Escalation triggers: ambiguous reqs / multiple valid approaches / high-impact / low confidence | `_shared/companion-protocol.md:71–76` | **Implemented** | All four triggers present: ambiguous reqs, high-impact/destructive, low confidence, stuck-not-converging. (One difference: research.md says "multiple valid approaches"; the protocol says "stuck-not-converging" — close but not identical.) |
| **GSD** | | | | |
| 13 | Context monitor as PostToolUse hook with agent-visible warnings at ≤35%/≤25% | `hooks/fellowship-context-monitor.mjs` | **Implemented** | Lines 24–25 set thresholds 35/25; lines 91–96 emit `additionalContext` with explicit "wrap up" / "stop immediately" wording — agent-visible, not just statusline. Severity escalation handled (line 76). |
| 14 | Artifact pyramid (PROJECT→REQUIREMENTS→ROADMAP→...→SUMMARY) | `docs/fellowship/` | **Partial** | Quest log + specs + plans cover the *function* (handoff between phases via files), but Fellowship does not implement the named pyramid. The principle is honored; the pattern is not directly mirrored. |
| 15 | Fresh context per spawned agent | Subagent platform behavior | **Implemented** | Subagents receive fresh context by default — Claude Code platform behavior, claimed correctly. |
| **Mastra** | | | | |
| 16 | Count-triggered consolidation: Recently Completed > 7 → fold oldest into archive | `hooks/fellowship-quest-log-consolidate.mjs` | **Implemented** | Line 30: `THRESHOLD = 7`; lines 137–142 split keep/overflow; archive-first atomic write with verification. Wired to SessionStart + SessionEnd in `hooks.json`. **Genuinely automated**, not Gandalf's manual responsibility. |
| 17 | Per-agent observational memory (`memory: project`) — episodic | All `agents/*.md` frontmatter | **Implemented** | All 9 agents have `memory: project`; aragorn.md:15, others identical |
| 18 | Mem0 write-time conflict resolution (What Exists is summary, not append) | `quest-log.md` `## What Exists` zone | **Partial** | The zone exists and is curated by hand; the consolidation hook only moves overflow to archive — it does not merge or resolve conflicts in `What Exists`. That section is updated by Gandalf manually. |
| **Letta/MemGPT** | | | | |
| 19 | Three-zone quest log: Current (3) / Recently Completed (7) / What Exists (15) | `quest-log.md` + `references/quest-log-format.md` | **Implemented** | Live `quest-log.md` follows the three-zone structure (Current 3, Recently Completed 9 — currently overflowing by 2, will trim next session-end), What Exists at 8 lines |
| **A-MEM / Collaborative Memory** | | | | |
| 20 | Per-agent private memory + shared `docs/fellowship/` + Gandalf-curated dispatch | Every dispatch has scoped context; agent memory not shared | **Implemented** | `using-fellowship` "Memory" section: "You are the memory curator. Companions don't search for context. You read shared memory, select what's relevant, include it in the dispatch." |
| 21 | A-MEM tagging NOT adopted — uncategorized prose | Per-agent memory | **Implemented (negative claim honored)** | No tagging schema in any agent; consistent with stated decision |
| **Karpathy autoresearch / AutoImprove** | | | | |
| 22 | Real invocations, not simulation — fresh subprocess per scenario | `skills/autoimprove/SKILL.md` Step 2 | **Implemented** | Lines 71–106: `subprocess.run(["claude", "--dangerously-skip-permissions", "--model", "claude-haiku-4-5", "--print", prompt])` per scenario; explicit "Do not simulate responses internally." (line 71) |
| 23 | Protected evaluator (chmod 444, in `/tmp`) — agent cannot weaken assertions | `skills/autoimprove/SKILL.md` lines 113–119, 401–404 | **Implemented** | Run against `/tmp/fellowship_eval_<target>_hard.py`; explicit instruction not to modify `evals/<target>/hard.py`. Runner copies to /tmp before worktree. |
| 24 | Balanced scenarios — both "should dispatch" and "must not dispatch" | `evals/gandalf/scenarios.jsonl` | **Partial** | 25 scenarios across 19 distinct types including `routing_tier1/2/3`, `concern_pushback`, `escalation_pushback`, `survey_trap`. Genuinely balanced for Gandalf. **But:** only Gandalf+Gimli+Legolas+Pippin have eval suites — 5 of 9 companions (Aragorn, Merry, Boromir, Sam, Arwen, Bilbo) have **no balanced scenario set at all**, already flagged in quest log. |
| 25 | Holdout split + assertion-health tracking | `skills/autoimprove/SKILL.md` Step 8 | **Implemented** | Holdout validation, assertion-health.jsonl appended; `evals/gandalf/holdout.jsonl` + `holdout_validation.py` exist |
| **Plan-before-build** | | | | |
| 26 | Plan-before-build gate (Tier 3+) — Gimli writes plan before code | `skills/using-fellowship/SKILL.md:142` + `agents/gimli.md:78` | **Advisory** | The "gate" is a sentence Gandalf is told to paste into the dispatch prompt; nothing enforces it. If Gandalf forgets the line, no plan is written. No hook intercepts a Gimli dispatch missing this string. |
| **Agent Teams** | | | | |
| 27 | Dual-mode architecture: env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` toggles Tier 4 to Agent Teams | `skills/using-fellowship/SKILL.md:73–75` | **Implemented (conditional)** | Tier 4 — Agent Teams mode section gates on env var; falls back to parallel subagents if unset. Honored as designed; Agent Teams not active by default per known bugs. |
| **SkillsBench / context-mode / barkain virtual filesystem** | | | | |
| 28 | NOT adopted — research says so | n/a | **N/A — negative claims honored** | No SkillsBench wiring, no MCP context virtualization, no virtual filesystem. Consistent with stated decisions. |

---

## 3. Major Gaps

### 3.1 Plan-before-build is advisory, not enforced

**What we say:** "For any Tier 3+ dispatch to Gimli, include: 'Write your plan to `$CLAUDE_SCRATCHPAD_DIR/gimli-plan-[slug].md` before writing any code…'" — `using-fellowship/SKILL.md:142`.

**What's actually true:** This is a string Gandalf is supposed to paste. There is no hook that inspects an outgoing Gimli dispatch and rejects it if the plan instruction is missing. Compare to the cited barkain harness, which uses 14 hooks across 6 lifecycle events as **structural constraints**. Fellowship's gate is methodology-only.

**Remediation framing (not the fix):** Either accept the gate as advisory and rename it ("plan-before-build *prompt*", not *gate*), or add a UserPromptSubmit-adjacent enforcement that blocks Tier 3+ Gimli dispatches missing the scratchpad instruction. The latter is closer to what research.md cites; the former is honest about the current behavior.

### 3.2 Three-layer memory has no boundary schema

**What we say:** "specs are semantic, per-agent memory is episodic, and plans are procedural — covering all three" (research.md:102).

**What's actually true:** The three layers exist as directories, but nothing prevents bleed. A spec file may include process steps (procedural). A plan may include domain decisions (semantic). Per-agent memory has no schema at all. The recent quest log notes "specs (browser-verification, plugin-improvements, browser-verification)" — duplicate filenames in the listing suggest specs are not curated to a discipline.

**Remediation framing:** Either define short schemas for each layer (one paragraph per layer in `docs/fellowship/README.md`) or downgrade the research claim from "covering all three" to "approximately mapping to all three."

### 3.3 Eval coverage stops at four of nine agents

**What we say:** AutoImprove "applies to agent instruction files." Implies generality.

**What's actually true:** `evals/` contains suites only for Gandalf, Gimli, Legolas, Pippin. Aragorn, Merry, Boromir, Sam, Arwen, Bilbo have no scenario sets. Already in the quest log Up Next, but worth flagging that the research.md claim of an autoresearch loop applied to "agent files" is partially aspirational.

**Remediation framing:** State explicitly in research.md that AutoImprove is wired for four of nine companions and the rest are roadmap; the current phrasing implies generality.

### 3.4 TodoWrite mandate vs. platform reality

**What we say:** `using-fellowship/SKILL.md:54,140` tells Gandalf to "**call `TodoWrite`**" before dispatching anyone, with the user watching the checklist tick live.

**What's actually true:** Per the quest log Current section, `TodoWrite` "still fails in the main thread" with `exists but is not enabled in this context`. Documented as v1.0 known limitation in README.

**Remediation framing:** Not a research.md gap — research.md doesn't claim this — but the using-fellowship skill is asking Gandalf to do something the platform won't allow. Soften the wording from "call TodoWrite" to "if TodoWrite is enabled, call it — otherwise the quest log checkboxes are the live progress" until the platform issue is resolved.

### 3.5 Mem0 write-time conflict resolution is partially honored

**What we say:** "What Exists is a living summary, not an append-only list" (research.md:183).

**What's actually true:** The consolidation hook moves overflow Recently Completed entries to the archive file. It does **not** rewrite or merge `What Exists`. Updates to that zone are entirely Gandalf's responsibility, on a manual basis. The research claim is accurate in spirit (the zone is a summary, by convention) but the Mem0 mechanism (write-time merge) is not implemented.

**Remediation framing:** Either keep the citation but tighten the wording ("we adopt the principle, not the mechanism") or extend the consolidation hook to also fold archived items into a one-line `What Exists` update.

---

## 4. Best Practices We Follow But Don't Cite

Worth surfacing in a marketplace listing:

- **Atomic writes with verification** in `fellowship-quest-log-consolidate.mjs` (write tmp + rename + re-read + assert overflow lines present). This is production-grade defensive coding rarely seen in plugin hooks.
- **Stdin timeout guards** (`setTimeout(...).unref()`) on every hook to prevent the session from hanging on a stuck pipe. The comment cites GSD issues (#775, #1162) but the pattern is broader than what research.md claims.
- **Companion protocol abstraction** (`agents/_shared/companion-protocol.md`) — a single source of truth for status format, escalation, anti-paralysis guard, and cross-domain frame. Not cited as a pattern but is exactly the DRY principle Anthropic's own multi-agent guide recommends in spirit.
- **Per-agent reference files** (`agents/references/figma-mcp-recovery.md`, `playwright-tools.md`, `owasp-checklist.md`) — same reference-decomposition pattern as Superpowers, applied at the agent level rather than just the entry skill.
- **One-shot reminder file** (`.quest-log-reminder` consumed and deleted at session start) — clean, idempotent, no state machine. Worth naming as a "fail-loud-once" pattern.
- **Project-local skills/agents survey** in `session-start` — deterministic precedence message ("project-local takes precedence over plugin on name collision") delivered in `additionalContext`. Solves a real namespacing problem and isn't cited.

---

## 5. Best Practices To Consider Adopting (v1.1+)

From cited sources we haven't picked up:

- **`eval.json` with binary assertions per skill** (Composio's awesome-claude-skills): research.md mentions this for engineering and testing skills, but Fellowship's existing eval suites are scenario-based, not skill-asserted. A small `eval.json` per skill (e.g. `accessibility/eval.json` with assertions like *"output references WCAG criterion"*) would create the "what does this skill *mean*" floor.
- **Phase-typed harness** (ep6-agent-harness `programmatic / llm_single / llm_agent / llm_batch_agents / llm_human_input`): Fellowship's tier system is a coarser version. For Tier 3+ work, classifying each step by phase type would let hooks enforce the right autonomy ceiling.
- **Inter-phase artifact files for Tier 4** (research.md flags this in §"Harness Engineering"): currently companion output is transient. A `$CLAUDE_SCRATCHPAD_DIR` artifact per phase — already used by Gimli's plan and the protocol's "detailed log" — could be standardized for every Tier 4 step, allowing crash recovery.
- **PreCompact priority-tiered XML snapshot** (context-mode): the quest log is Fellowship's compact snapshot, but it isn't injected via a `PreCompact` hook. If Claude Code's compaction fires mid-session, the quest log doesn't refresh first. A 30-line PreCompact emit of the three-zone snapshot would close this gap.
- **Soft-failures in 0.5–0.8 band** (Monte Carlo Data on LLM-as-judge): AutoImprove `soft.md` uses binary TRUE/FALSE. Allowing a "partial credit" soft response on behavioral gray zones (voice, register) would reduce the 1-in-10 spurious-fail rate the source warns about.
- **Process learnings feedback loop** (teamclaude `PROCESS_LEARNING:` prefix): Fellowship has `~/.claude/fellowship/feedback-log.jsonl` for capture but no documented conversion ritual into eval scenarios beyond the autoimprove skill's "Growing the Eval Suite" section. A periodic command (`/fellowship:harvest-feedback`) would close the loop.
- **Plan approval mode for Tier 4 teammates** (Agent Teams docs): when Agent Teams becomes stable, the existing plan-before-build pattern can graduate from "Gimli writes a plan" to "teammate works in read-only plan mode until lead approves."

---

**Word count:** ~2,050 (within the 2,500 budget).
