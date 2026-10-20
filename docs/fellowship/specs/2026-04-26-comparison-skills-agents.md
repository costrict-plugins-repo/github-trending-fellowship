# Deep File-by-File Comparison — Fellowship vs Superpowers

**Date:** 2026-04-26
**Reviewer:** Legolas
**Scope:** Read-only structural comparison. Each Fellowship agent and skill read end-to-end against Superpowers' fourteen skills and the `code-reviewer` agent. The lens: what does Superpowers *not* do here that we do?

---

## 1. Headline Finding

**Methodology content lives inline in agent files where Superpowers would route it to a `references/*.md` or to a workflow skill.** Aragorn carries the full PRD template (lines 84–137). Bilbo carries four discrete templates: README structure, changelog format, TSDoc/Python docstring blocks, API-route block, architecture overview (lines 92–296 — half the file). Merry carries the ADR template, the interface-contract template, and a data-model sketch template (lines 78–177). Sam carries the full `.env.example` example, two GitHub Actions workflows, three platform-specific deploy snippets (lines 92–181). Pippin carries a 30-line table-format browser-verification report (lines 148–184) inside the agent file alongside three already-distinct mode procedures.

Superpowers' single agent (`code-reviewer.md`) is 48 lines of role-and-craft with **zero** templates. Templates and procedures live in dedicated skills (`writing-plans` for the plan template, `finishing-a-development-branch` for the four-option menu, `using-superpowers` referencing `references/codex-tools.md`). The Fellowship agent files load entire authoring kits into every dispatch — an Aragorn dispatch about "is this scope creep" pulls in the full PRD frame whether it's needed or not. This is the Bilbo-class pattern the prior audit missed: not a single voice block, but a systemic preference for inline templates over reference extraction.

The voice-anchor / applied-to-X structure that was extracted from `using-fellowship/SKILL.md` still lives on inside `references/voice.md` (lines 42–72) — moved, not deleted. That extraction is correct. The remaining structural debt is the inline templates, not voice.

---

## 2. By-File Findings

### `agents/aragorn.md` (205 lines)

What it does well: tier positions are explicit; "Frodo Counsel" structure (line 141) is a tight four-beat formulation.

1. **Inline PRD template (lines 84–137).** A 53-line markdown-fenced template — Problem Statement, v1, AC, v2, Out of Scope, Open Questions. Superpowers' analog is `writing-plans/SKILL.md`, which puts the plan-document header in the skill body but reserves long output structure for the file the user ultimately writes. The Fellowship pattern force-loads the entire Aragorn PRD shape on every dispatch where Aragorn might *not* be writing a PRD (the Tier 2 "scope read only" path explicitly exists, line 35–36, and yet the template still loads).
2. **Scope smell table (lines 56–66) duplicates content in `references/voice.md` lines 64–69 ("ship without tests" cadence example).** Both teach "name the smell, surface, stop." Two surfaces, one rule.
3. **Pre-DONE checklist (lines 196–206) duplicates the universal checklist in `_shared/companion-protocol.md`.** The doc explicitly says "(Beyond the universal checklist...)" but four of six bullets are restatements of the universal frame in Aragorn-flavored language ("Status line declared" → "Requirements document saved" — same structural assertion).

### `agents/arwen.md` (268 lines)

What it does well: tier-3 "Direct mode" extension (line 195) is a real differentiation Superpowers lacks — a designer truly does talk directly with the user.

1. **Design Contract template inline (lines 60–107).** 47 lines of markdown-fenced template covering Spacing, Color, Typography, Copywriting, Components, Accessibility, Open Questions. Same anti-pattern as Aragorn — the artifact's authoring shape lives in the agent file, not a `references/design-contract-template.md`. Compare Superpowers `requesting-code-review/SKILL.md`: it points to `code-reviewer.md` for the placeholder list (line 34) rather than embedding the prompt template.
2. **Visual Exploration block (lines 146–178) duplicates `skills/visual-exploration/SKILL.md`.** The agent file has 32 lines on server setup, the loop, the CSS class inventory. The skill exists at 291 lines. Either the agent calls the skill (as the audit/accessibility sections do at lines 116, 128) or the skill is redundant. Currently both exist and they overlap.
3. **Six-deliverable table (lines 44–51) is excellent — keep it.** This is the kind of routing aid Superpowers does well in `using-superpowers/SKILL.md` "Skill Priority" (line 95).

### `agents/bilbo.md` (353 lines — largest agent)

What it does well: opening character paragraph (line 22) is the cleanest in the set — concrete tells (catches docs that lie, plain immediate prose) without performative voice.

1. **Four full templates inline (lines 92–296, ~205 lines / 58% of the file).** README structure, Keep-a-Changelog format, TSDoc + Python docstring blocks, API route block, architecture overview. Superpowers' equivalent — `writing-plans` — is 145 lines total *including* the plan template (which is the canonical artifact for that skill). Bilbo's templates are the artifacts Bilbo writes; they should sit in `agents/references/bilbo-templates.md` or be split: `references/readme-template.md`, `references/changelog-template.md`, etc., with the agent file calling them the way Boromir calls `references/owasp-checklist.md` (line 56).
2. **`grep` recipe inline (lines 60–86).** Five separate grep commands for project structure, public functions, API routes. Boromir's OWASP grep recipe was already extracted to a reference. Bilbo's wasn't — same pattern, same severity.
3. **Anti-pattern: "What every docstring must include" prose (lines 215–216) plus a TSDoc example plus a Python example.** Three explanations of the same idea. Superpowers `writing-skills/SKILL.md` "One excellent example beats many mediocre ones" (line 326) is the rule we're violating here.

### `agents/boromir.md` (144 lines — among the leanest)

What it does well: this is the model. OWASP recipe (180 lines) lives in `references/owasp-checklist.md`; agent file references it (line 56) and stays focused on role, scope-of-dispatch, and findings format. **Boromir is what every Fellowship agent file should look like.**

1. **Pre-DONE checklist (lines 134–144) is the right size** — six bullets, all genuinely Boromir-specific. Compare Aragorn's checklist (six bullets, four duplicated from universal). This is what agent-specific bullets should look like.

No structural issues. Use this file as the template for refactoring Bilbo, Aragorn, Merry, Sam, Pippin.

### `agents/gimli.md` (140 lines — leanest)

What it does well: principles section (lines 41–54) is six clean statements with no examples or bullets-of-examples. Plan Gate (line 70) and Deviation Rules (line 130) are tight. This is the second exemplar.

1. **Self-Review (lines 56–67) duplicates the universal pre-DONE checklist.** "Tests pass," "no dead code," "scope" — these are in the shared protocol. Gimli's domain-specific check is "matches existing patterns" — but that's already in Principles. The Self-Review block could be deleted; the Principles + universal checklist cover it.
2. **Debug Log block (lines 113–127)** is well-sized and well-placed. No issue. Pippin's `references/playwright-tools.md` is the right sibling pattern — Gimli could point to a `references/debug-log-format.md` if the format ever grew.

### `agents/legolas.md` (262 lines)

What it does well: First Principle (line 45), `Status:` rule (line 173). The "what makes a good finding" four-bullet test (lines 147–152) is sharp.

1. **Structural Review section (lines 95–123) is methodology.** It belongs in a `references/structural-review.md` or — better — in the existing `skills/codebase-map/SKILL.md` since it consumes that map. Three sub-checks (prefilter, responsibility sentence, severity routing) plus duplication check plus boundary check = 28 lines of decision logic that loads on every code review whether or not the diff merits structural analysis.
2. **Code-quality categories (lines 79–93) duplicate the Issues report-format fields (lines 184–203).** "Correctness, Structure, Patterns, Simplicity, Security, Testing, Cleanup" appear once as review pillars and again — implicitly — in the report format. Superpowers `code-reviewer.md` keeps the pillars and lets the report format be brief; we list both at length.
3. **Severity table (lines 137–143) duplicates "What makes a good finding" (lines 147–152).** Severity classification is one paragraph, then "Critical/Important/Minor matches actual impact" repeats as the third bullet of the next section.

### `agents/merry.md` (244 lines)

What it does well: "if wrong" test (line 72) is genuinely Fellowship — Superpowers has nothing like it.

1. **Three templates inline (lines 78–177, ~100 lines).** ADR template, interface contract template, data-model sketch template. Same anti-pattern as Aragorn and Bilbo. Extract to `references/merry-templates.md` or three files.
2. **Approach Evaluation table format (lines 64–69) duplicates ADR Options Considered table (lines 92–98).** Same four-column shape; one feeds the other. The first should be removed — the ADR template is the canonical structure.
3. **Codebase Read steps (lines 47–60)** are good content but read like a checklist that should be embedded in `skills/codebase-map/SKILL.md` and called by Merry. Merry-on-greenfield doesn't always need to read the codebase first — but the agent file makes it look like a fixed step.

### `agents/pippin.md` (330 lines)

What it does well: Mode 4 (browser-verify) is a real Fellowship contribution. Superpowers has no analog.

1. **Mode 4 Operating Procedure block (lines 113–144) is 32 lines describing a workflow.** It's a numbered procedure with sub-bullets. This is exactly what Superpowers `test-driven-development/SKILL.md` handles in the Red-Green-Refactor flowchart at the skill level (lines 49–69, dot-graph) — methodology in the *skill*, role-fit in the *agent*. Pippin's agent file should call `skills/browser-verify/SKILL.md` (which doesn't exist — a real gap, see §4) the way Boromir's calls `references/owasp-checklist.md`.
2. **TDD methodology (lines 77–95) including the WRONG/RIGHT vertical-vs-horizontal example** is in-agent. Superpowers' `test-driven-development/SKILL.md` (371 lines) is the right home for this. We could either drop in a Pippin-flavored `skills/tdd/SKILL.md` or — likely better — adopt Superpowers' TDD skill outright (we already cite Pocock and Beck on line 95).
3. **Three-mode list (lines 53–146)** has the structure that *would* work as three skills (`test-after`, `test-first`, `browser-verify`) called from a single Pippin agent file. Currently all three modes plus their report formats live in one 330-line file.

### `agents/sam.md` (296 lines)

What it does well: "Infra Constraint Surface" (line 211) — the teammate-mode SendMessage format is concrete and short.

1. **Template fest (lines 92–181, 90 lines).** `.env.example` block, full GitHub Actions CI YAML, Vercel deploy step, Fly.io step, Railway step, Dockerfile prose, docker-compose prose. Same anti-pattern. Extract to `references/sam-templates.md` or split per-platform.
2. **`grep` recipe (lines 71–80) inline.** Three multi-line grep commands. Boromir's were extracted; Sam's weren't.
3. **"What to flag" bullets (lines 205–208) duplicate the constraint-surface format (lines 220–233).** Same content, two phrasings.

### `agents/_shared/companion-protocol.md` (77 lines)

What it does well: this file is *correct* — it's the de-duplication target. Communication mode, report common rules, anti-paralysis guard, universal pre-DONE checklist, cross-domain frame, escalation. Each agent should defer to it; many don't fully. The companion files restate what's here in Aragorn (lines 196–206), Merry (lines 234–244), Sam (lines 287–296), Pippin (lines 321–331) checklist sections.

No issues with the protocol itself. The issue is partial adoption.

### `skills/using-fellowship/SKILL.md` (207 lines)

What it does well: the prior refactor extracted voice, companions, cycles, tier-scoring, and four other concerns to `references/`. That extraction matches the Superpowers `using-superpowers/SKILL.md` + `references/codex-tools.md` pattern (line 38 of that file).

1. **Description (line 3) summarizes workflow:** *"establishes Gandalf as orchestrator, defines voice, routing tiers, memory rules, and dispatch decisions"*. Superpowers `writing-skills/SKILL.md` lines 150–172 is explicit: descriptions that summarize the skill's process cause Claude to skip the skill body and follow the description. The fix in Superpowers' own skill (line 168) is "Use when starting any conversation in a Fellowship project — establishes how to find and use skills" — note the difference: triggering condition only.
2. **Memory section (lines 152–179) is 27 lines.** Quest-log format already extracted; consolidation rule lives in two places (line 153 of SKILL.md and `references/quest-log-format.md`). Drop the duplicate from SKILL.md.
3. **Multi-track execution (lines 60–67)** is operational detail that belongs in `references/cycles.md` — currently lives twice (here and in cycles.md indirectly).

### `skills/using-fellowship/references/voice.md` (104 lines)

1. **"Voice anchors — study these for structure" (lines 42–58)** — seven LotR quotes with "this is how you handle X" interpretations. Then "What this register looks like applied to software" (lines 60–72) — ten "applied to X" bullets. **This is the same Bilbo-class pattern Gimli extracted from `using-fellowship/SKILL.md`. It moved one level down. The quote-then-applied-bullet structure that Superpowers' agent files do not use anywhere is now living in references/voice.md.** Either accept it (voice is an exception worth carrying) or extract further — collapse the quotes to three and the applied bullets to four.

### `skills/brainstorming/SKILL.md` (182 lines)

What it does well: scope-decomposition guidance (line 32) is genuinely sharper than Superpowers' brainstorming.

1. **Description (line 3) summarizes process:** *"Collaborative dialogue to explore ideas, make decisions, and produce a design spec. Captures decisions throughout."* — same anti-pattern as using-fellowship. Superpowers' brainstorming description (line 3 of theirs) is similarly imperfect — but theirs is shorter and front-loads the trigger ("You MUST use this before any creative work").
2. **No HARD-GATE block.** Superpowers `brainstorming/SKILL.md` lines 12–14 is `<HARD-GATE>` — explicit content saying do-not-implement-without-design. Ours has the principle in prose (lines 96–97) but no shouting-tag the model can't ignore. Consider this a near-miss adoption.
3. **No flowchart.** Superpowers' brainstorming has a dot-graph (lines 36–67) that names the terminal state ("Invoke writing-plans skill"). Ours uses prose. For a process with a hard gate before implementation, a flowchart prevents skipping.

### `skills/planning/SKILL.md` (199 lines)

1. **Description (line 3) summarizes:** *"Creates a quest log with task breakdown, companion assignments, and execution order."*
2. **Task Detail template (lines 95–120, 26 lines)** mirrors Superpowers `writing-plans/SKILL.md` task structure (lines 65–104). Both are right to keep this in-skill — this is the canonical artifact. No issue.
3. **No "Plan Document Header" with the REQUIRED SUB-SKILL banner.** Superpowers `writing-plans/SKILL.md` lines 49–61 forces a banner pointing executors to `subagent-driven-development` or `executing-plans`. Our planning skill doesn't tell its consumer what to load next. The cycles reference partly fills this, but the plan file itself doesn't link forward.

### `skills/autoimprove/SKILL.md` (405 lines)

What it does well: this is a real Fellowship contribution with no Superpowers analog. The 8-step loop, Step 1 READ → Step 8 REPORT structure, holdout-validation gate are unique.

1. **No structural issues.** This file is a workflow specification, not a reference, and 405 lines is appropriate for what it does.
2. **Description matches the pattern** — first sentence triggers, second describes scope. Closer to Superpowers form than most.

### `skills/codebase-map/SKILL.md` (130 lines)

Clean. Output template (lines 48–122) is the canonical artifact — same correct shape as planning. No issue.

### `skills/design-it-twice/SKILL.md` (96 lines)

Clean. Cites source on line 96 (Pocock + Ousterhout). The two-path "parallel dispatch vs in-session sequential" choice (line 28) is genuine Fellowship craft.

### `skills/grill-me/SKILL.md` (16 lines)

Clean. Sharpest skill in the set. Three sentences plus attribution. This and Boromir are the leanness benchmarks.

### `skills/investigate/SKILL.md` (100 lines)

What it does well: 4-phase structure mirrors Superpowers `systematic-debugging/SKILL.md` but at one-third the length. Excellent compression.

1. **Description summarizes process** ("Systematic root-cause methodology: investigate → hypothesize → fix → verify").
2. **3-fix ceiling (line 60–67)** is genuine Fellowship — Superpowers has a similar gate at "≥ 3 fixes" but ours states the rule more crisply.

### `skills/learn/SKILL.md` (125 lines)

Clean. The "prune vs export vs review" routing (line 32) is its own skill. No structural issues.

### `skills/accessibility/SKILL.md` (906 lines), `skills/ux-audit/SKILL.md` (308 lines), `skills/visual-exploration/SKILL.md` (291 lines)

All three are reference skills loaded by Arwen. **The 906-line accessibility skill is appropriate for what it is** — a WCAG 2.2 reference. The structure (POUR principles, level table, by-pillar checklists, code examples) is the kind of heavy reference Superpowers `writing-skills/SKILL.md` line 365 explicitly endorses ("File Organization > Skill with Heavy Reference"). Description fields match the pattern.

The only finding: **`visual-exploration/SKILL.md` overlaps with `agents/arwen.md` lines 146–178** (Arwen's inline visual-exploration block). One of the two should be the source of truth. The skill should be — Arwen should call it.

---

## 3. Structural Patterns

These patterns repeat across multiple Fellowship files. Each is named with the Superpowers analog and the Fellowship file count affected.

**P1 — Inline templates instead of `references/`.**
Files affected: aragorn, arwen, bilbo, merry, sam, pippin (6 of 9 agent files).
Superpowers analog: `using-superpowers/references/codex-tools.md`, `requesting-code-review/code-reviewer.md` (template referenced, not inlined).
Effect: every dispatch loads the full template even when the dispatch won't produce that artifact. Token cost compounds.

**P2 — Pre-DONE checklist duplicates universal checklist.**
Files affected: aragorn, merry, sam, pippin, legolas (5 of 9). Boromir and Gimli are clean.
Superpowers analog: Superpowers' code-reviewer doesn't have agent-specific checklist sections. The skill body itself is the checklist.
Effect: shared protocol file exists and is correct, but most agents partially re-state it.

**P3 — Description summarizes workflow rather than naming triggers.**
Files affected: brainstorming, planning, learn, investigate, autoimprove, using-fellowship, accessibility, ux-audit, visual-exploration, codebase-map (10 of 12 skill files; design-it-twice and grill-me are closer to right).
Superpowers analog: `writing-skills/SKILL.md` lines 150–172 — extensively documented anti-pattern with empirical evidence (Claude follows description over body when description summarizes workflow).
Effect: model may follow description instead of reading skill body; subtle drift in compliance.

**P4 — Methodology blocks inside agent files.**
Files affected: pippin (Mode 4), legolas (Structural Review), arwen (Visual Exploration prose block).
Superpowers analog: methodology lives in skills (`test-driven-development`, `systematic-debugging`); agent files describe role and dispatch rules.
Effect: methodology can't be loaded selectively; can't evolve independently of the agent.

**P5 — Voice anchor + applied-to-X structure.**
Files affected: `references/voice.md` (lines 42–72). The pattern is *gone* from `using-fellowship/SKILL.md` per the recent refactor.
Superpowers analog: Superpowers has no voice content at all — it's domain-neutral. So strictly Fellowship's call. But the same compression that helped using-fellowship would help voice.md: cut quotes from seven to three, applied-bullets from ten to four.

**P6 — In-agent grep recipe.**
Files affected: bilbo (lines 60–86), sam (lines 71–80). Boromir extracted his — these two didn't.
Superpowers analog: Boromir's `references/owasp-checklist.md`.
Effect: inconsistency. If Boromir's grep is reference-extracted, Bilbo's and Sam's should be too.

---

## 4. Gaps — Superpowers Skills Without a Fellowship Analog

**G1 — No `verification-before-completion` skill.** Closest analog: the universal pre-DONE checklist line *"Existing tests still pass (or explained why not)"*. Superpowers' skill is 139 lines on the discipline — Iron Law, gate function, common failures table, rationalization prevention, key patterns. We have one bullet. Gimli's report format says "BAD: 'it should work', 'seems to work'" (gimli.md lines 96–97) — that's the kernel. Worth lifting to a skill the way Superpowers did.

**G2 — No `requesting-code-review` skill.** We have the cycle in `references/cycles.md`, but Superpowers separates the *requesting* discipline (how to dispatch a reviewer with precisely-crafted context, never session history) from the *receiving* discipline. The "never session history" rule is Fellowship-relevant — Gandalf already does this in the orchestration skill (using-fellowship line 116, "paste it, don't make them hunt") but it's not enforced as its own loadable discipline.

**G3 — No `receiving-code-review` skill.** Superpowers' skill (213 lines) addresses performative agreement, blind implementation, technical pushback — directly relevant for Gimli receiving Legolas findings. Gimli's agent file has nothing on how to receive a review. The Fellowship cycle says "fix and re-dispatch" — but how Gimli engages with the findings is not codified.

**G4 — No `using-git-worktrees` skill.** Mentioned in Gandalf's multi-track execution (using-fellowship line 60: `isolation: "worktree"`) but the actual mechanics — directory selection, gitignore verification, baseline test verification — are not codified. Fellowship users on multi-track work today rely on Gandalf's tribal knowledge.

**G5 — No `subagent-driven-development` or `dispatching-parallel-agents` skill.** Tiered routing (using-fellowship lines 49–76) covers when to use parallel; Superpowers' skill covers *how*. Specifically the "answer questions before letting them proceed" pattern (Superpowers line 251) and the model-selection guidance (Superpowers lines 87–101) — both relevant for Gandalf as orchestrator.

**G6 — No browser-verify skill.** Pippin's Mode 4 in-agent block (pippin.md lines 113–144) plays the role. But this should be a `skills/browser-verify/SKILL.md` called by the Pippin agent, not 32 lines of operating procedure embedded in the agent.

**G7 — Conscious decisions not to adopt.** `writing-skills` (we don't write skills frequently enough to need TDD-for-docs), `caveman` (per quest log). These are correct passes.

---

## 5. Genuine Fellowship Differentiation (Not Bloat)

These are things Fellowship does that Superpowers doesn't, and they justify the surface area:

- **Tiered routing with scoring** (using-fellowship line 49, `tier-scoring.md`). Superpowers has skill priority but no tier model.
- **Nine specialized companions with character voices.** Superpowers has one agent. The character system is not bloat — it's the product.
- **Tier 4 Agent Teams compositions** (`companions.md` lines 53–63). Specific team compositions for cross-domain work.
- **`autoimprove` skill** (405 lines). RED-GREEN-REFACTOR for *agent files*, with eval scenarios, holdout validation, assertion-health tracking. Superpowers has nothing comparable.
- **`design-it-twice` skill.** Ousterhout adaptation; constraint-template forcing radical difference. Genuinely useful, well-bounded.
- **`grill-me` skill** at 16 lines.
- **Pippin's Mode 4 (browser-verify)** as a concept — though the methodology should be extracted.
- **Visual Companion** in brainstorming (skills/brainstorming line 148 in their version vs ours; the offer-as-its-own-message rule).
- **`product.md` discipline** (using-fellowship lines 155–164). Stale-product-means-every-dispatch-rests-on-a-lie. No Superpowers equivalent.
- **Feedback log + autoimprove pipeline** (feedback-log-schema.md → autoimprove §"Growing the Eval Suite"). Closes the loop between real failures and improved agents. No Superpowers equivalent.
- **Memory curation via `learn` skill.** Superpowers doesn't address this.

---

## 6. Where the Bilbo Audit Failed

The prior bloat audit and consistency audit counted lines and named categories. What they missed:

1. The voice-anchor / applied-to-X pattern in `references/voice.md` lines 42–72 — the same shape that was extracted from using-fellowship.
2. The systematic preference for inline templates over reference extraction (six of nine agent files).
3. The pre-DONE checklist duplication of the universal checklist (five of nine).
4. The description-summarizes-workflow anti-pattern across ten of twelve skills.

A line-count audit would have approved Boromir at 144 lines and Bilbo at 353 lines without ever asking "is the *structure* right?" The structural questions — *do templates belong in agents, do checklists belong in companion-specific sections, do descriptions name triggers or summarize bodies* — were not asked.

The fix for future audits: read a Superpowers file and a Fellowship file side-by-side. Don't tally lines. Ask "what is in my file that isn't in the reference, and why?" That single question would have caught all four patterns above.

---

*~1,940 words. Read-only review. No changes proposed in this document — synthesis to follow.*
