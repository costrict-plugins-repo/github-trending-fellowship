# Matt Pocock Skills Adoption — Implementation Plan

**Source:** Matt Pocock's skills repo cloned at `examples/mattpocock-skills/` (340K, MIT licensed, 22 skills total — three relevant to Fellowship after evaluation).

**Goal:** Adopt three skills from Matt Pocock's repo to close gaps in Fellowship's brainstorming-and-planning posture, Merry's architectural rigor, and Pippin's TDD methodology — without dilution of Fellowship's voice or principles.

**Key decisions from evaluation conversation:**

1. **`grill-me` adopted as standalone skill** — closes the gap where planning sometimes runs too hot. Not folded into brainstorming or planning because it's a *posture*, not a phase. Any companion or in-session work can invoke it.
2. **`design-an-interface` adopted as `design-it-twice` for Merry** — renamed because "interface" overloads with Arwen's UI domain. The Ousterhout chapter title is unambiguous and methodology-focused. Body rewritten to use *module/API design* explicitly.
3. **TDD principles surgically folded into Pippin** — not adopted as a separate skill, because Pippin already covers test-first. Lifted into two places: the mode-agnostic principle ("tests verify behavior through public interfaces, not implementation details") into Pippin's Philosophy section; the test-first-specific rules (vertical slicing, tracer bullets, never refactor while RED, anti-pattern: write all tests first) into Pippin's existing Mode 2 (Test-First) section.
4. **Default testing posture stays build-first.** Mode 2 / TDD activates only when (a) user signals it explicitly, or (b) Gandalf decides on complexity. Folded TDD rules sit dormant in Mode 2 — they "wake up" only on those triggers.
5. **Renames are part of adoption.** `design-an-interface` → `design-it-twice`. `grill-me` keeps its name (no overload).
6. **Adapt parallel-dispatch shape** — `design-it-twice` uses Matt's `Task`-based subagent shape; rewrite to use Fellowship's Tier 4 / parallel-Agent dispatch pattern.
7. **Attribution.** Each adopted file carries a one-line credit to the source (Ousterhout for design-it-twice; Matt Pocock's repo for skill structure).
8. **Skipped skills.** `caveman` (voice conflict — Fellowship's elevated register is product surface). `write-a-skill` (internal dev tool, low end-user value). `improve-codebase-architecture` deferred to post-1.0 (substantive — needs Aragorn scoping pass on whether to adopt the CONTEXT.md domain-glossary pattern alongside it).

**Tech stack:** Markdown files with YAML frontmatter. No compiler, no build step. Loaded directly by Claude Code.

---

## Quest Log

### Sequential tasks

1. ⬜ **Adopt `grill-me`** — Gimli — Create `skills/grill-me/SKILL.md` based on Matt's source at `examples/mattpocock-skills/grill-me/SKILL.md`. Keep the four-line core ("interview relentlessly, walk decision tree, one question at a time, codebase exploration when applicable, recommended answer per question"). Add a one-line attribution. Adapt the description triggers to Fellowship's voice.

2. ⬜ **Adopt `design-it-twice` (renamed)** — Gimli — Create `skills/design-it-twice/SKILL.md`. Source: `examples/mattpocock-skills/design-an-interface/SKILL.md`. Rename throughout. Body rewritten to use *module/API design* (never the bare word "interface" without qualifier). Adapt the parallel-dispatch mechanism: replace Matt's `Task tool with subagent_type=Task` shape with Fellowship's Tier 4 parallel-Agent pattern (multiple `fellowship:gimli` or in-session reasoning across designs). Bind to Merry — add note in description that Merry loads this when an architectural decision warrants exploring multiple module shapes. Attribute Ousterhout's *A Philosophy of Software Design* — *Design It Twice* chapter.

3. ⬜ **Fold TDD principles into Pippin** — Gimli — Edit `agents/pippin.md` only. Two surgical insertions:
   - **Philosophy section (existing or new):** Add the principle *"Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't."* Mode-agnostic — applies in test-after and test-first equally.
   - **Mode 2 (Test-First) section:** Add the rules: vertical slicing only (one test → one impl → repeat), tracer bullet on first test, never refactor while RED, anti-pattern explicitly named (do NOT write all tests first then all impl). Reference Matt's source as inspiration in a one-line credit.
   - Do NOT adopt the supporting files (mocking.md, refactoring.md, deep-modules.md, interface-design.md, tests.md). Those are Matt's bundle; Fellowship's Pippin already has its own opinions and adding more files dilutes Pippin's surface.

### Parallel tasks

None. Three tasks, sequential, single Gimli to keep rename decisions consistent and attribution style uniform across all three.

---

## Task Detail

### Task 1: Adopt `grill-me`

**Assigned to:** Gimli
**Depends on:** none

**Files:**
- Create: `skills/grill-me/SKILL.md`

**What to build:**

A standalone skill that lets any companion or in-session work drop into a relentless interview posture. Source is Matt Pocock's `examples/mattpocock-skills/grill-me/SKILL.md` — four lines of prose. Keep the core verbatim or near-verbatim; the value is in the brevity.

The frontmatter description must be Fellowship-specific:
- Triggers: "stress-test", "grill me", "walk me through every decision", "I'm not sure about this plan"
- Use case: scoping conversations, architecture decisions, plan review, anywhere the user wants to be challenged before committing
- Note: works alongside brainstorming (which already grills) and planning (which deliberately doesn't); grill-me is the user-invokable middle ground

Add a one-line attribution at the bottom: *"Adapted from [Matt Pocock's grill-me skill](https://github.com/mattpocock/skills/tree/main/grill-me)."*

**Acceptance criteria:**
- [ ] File exists at `skills/grill-me/SKILL.md`
- [ ] YAML frontmatter has `name: grill-me` and a description with explicit triggers
- [ ] Body retains the core four lines (or close paraphrase): interview relentlessly, walk decision tree, one question at a time, codebase exploration over speculation, provide recommended answer per question
- [ ] Attribution line present
- [ ] Health check passes — `node hooks/health-check.mjs`

**Verification:**
- Run: `node hooks/health-check.mjs` → Expected: all checks pass, including the new skill

**Notes:** Matt's file is so short (~4 lines body) that there's almost no adaptation to do. The work here is mostly framing — making sure the description triggers are right for Fellowship's audience, and that the file feels like a Fellowship skill (not a copy-paste).

---

### Task 2: Adopt `design-it-twice` (renamed from `design-an-interface`)

**Assigned to:** Gimli
**Depends on:** Task 1 complete (consistency in skill-structure decisions)

**Files:**
- Create: `skills/design-it-twice/SKILL.md`

**What to build:**

A Merry-bound skill that produces multiple radically different module/API designs in parallel and compares them on depth, simplicity, and leverage — based on Ousterhout's *Design It Twice* chapter from *A Philosophy of Software Design*.

Source: `examples/mattpocock-skills/design-an-interface/SKILL.md`. The methodology survives intact (gather requirements → spawn 3+ designs with different constraints → present sequentially → compare → synthesize). The adaptations:

1. **Rename throughout** — file path, frontmatter `name`, all internal references. The word "interface" alone is replaced with *module interface*, *API interface*, *module surface*, or *module shape* depending on context, to disambiguate from Arwen's UI domain.

2. **Bind to Merry** — frontmatter description should signal *"Merry's skill for architectural decisions where multiple module shapes are worth exploring."* Triggers: "design it twice," "explore multiple module shapes," "compare API options," any architecture call where the first instinct shouldn't be the only instinct.

3. **Replace the parallel-dispatch mechanism** — Matt's version uses *"Spawn 3+ sub-agents simultaneously using Task tool"*. Fellowship doesn't have a generic Task tool; it has Tier 4 parallel-Agent dispatch via `Agent(subagent_type="fellowship:gimli", ...)` and Agent Teams when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Rewrite that section to read: *"Spawn 3+ Gimli instances in parallel, each with a different design constraint. Or — for in-session brainstorming — generate three designs sequentially in your own response."* Keep both options open; Merry can pick based on the depth of the question.

4. **Attribution** — one-line credit: *"Methodology from John Ousterhout's *A Philosophy of Software Design*, chapter 'Design It Twice.' Adapted from [Matt Pocock's design-an-interface skill](https://github.com/mattpocock/skills/tree/main/design-an-interface)."*

5. **Anti-patterns section** — keep Matt's four bullets verbatim. They're sound.

**Acceptance criteria:**
- [ ] File exists at `skills/design-it-twice/SKILL.md`
- [ ] YAML frontmatter has `name: design-it-twice` and a description with explicit Merry-binding language and triggers
- [ ] No bare "interface" without qualifier in the body
- [ ] Parallel-dispatch section uses Fellowship's Agent pattern, not Matt's Task tool
- [ ] Attribution to Ousterhout AND Matt's source
- [ ] Body under 100 lines (Matt's was ~95 — Fellowship convention is similar)
- [ ] Health check passes

**Verification:**
- Run: `node hooks/health-check.mjs` → Expected: all checks pass
- Visual check: grep for bare "interface" in the body — should appear only with qualifier

**Notes:** The Anti-Patterns section of Matt's file is gold — keep it. The Workflow section needs the most adaptation (the parallel-dispatch mechanism). The Evaluation Criteria section translates directly — Ousterhout's terms (depth, leverage, simplicity, generality) work as-is and align with Fellowship's product principles.

---

### Task 3: Fold TDD principles into Pippin

**Assigned to:** Gimli
**Depends on:** Tasks 1–2 complete

**Files:**
- Modify: `agents/pippin.md`

**What to build:**

Two surgical insertions into Pippin's existing agent file. Do NOT create new skill files. Do NOT touch any other agent.

**Insertion 1 — Philosophy (mode-agnostic):**

Locate Pippin's existing Philosophy or "Core Principles" section (if absent, add one near the top, after the role description). Add the principle:

> *Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification — "user can checkout with valid cart" tells you exactly what capability exists. Tests coupled to implementation break when refactors happen but behavior hasn't changed; that's the warning sign.*

This applies in both test-after and test-first modes. It's how Pippin reads the spec and shapes assertions in either mode.

**Insertion 2 — Mode 2 (Test-First) — TDD methodology:**

Locate the existing **Mode 2: Test-First (TDD)** section (around line 102 of `agents/pippin.md`). Add the following rules into that section:

- **Vertical slicing only.** One test → one implementation → repeat. Each test responds to what was learned from the previous cycle. Do not write all tests first then all implementations — that's "horizontal slicing" and produces tests of imagined rather than actual behavior.
- **Tracer bullet on the first test.** The first cycle proves the path works end-to-end before any other test is written.
- **Never refactor while RED.** Get to GREEN first. Refactoring with failing tests means losing the signal of which change broke things.
- **Anti-pattern explicit:** *Do NOT write all failing tests first, then all implementation.* This produces tests of imagined behavior, tests of shape rather than substance, and tests that pass when behavior breaks.

**Attribution:** Add a one-line credit at the bottom of Mode 2's TDD subsection: *"TDD methodology distilled from [Matt Pocock's tdd skill](https://github.com/mattpocock/skills/tree/main/tdd) and Kent Beck's *Test-Driven Development: By Example*."*

**Scope boundaries:**
- Do NOT add Matt's supporting files (mocking.md, refactoring.md, deep-modules.md, interface-design.md, tests.md) to Pippin's directory or anywhere else. Pippin is a single-file agent.
- Do NOT change Mode 1 (Test-After). Default behavior stays as it is.
- Do NOT add new modes. Pippin's four modes (test-after, test-first, browser-verify, infrastructure) remain.

**Acceptance criteria:**
- [ ] Pippin's Philosophy section contains the "tests verify behavior through public interfaces" principle
- [ ] Pippin's Mode 2 section contains the four TDD rules (vertical slicing, tracer bullet, never refactor while RED, anti-pattern named)
- [ ] Attribution line present in Mode 2
- [ ] No new files created in `agents/pippin/` (Pippin stays single-file)
- [ ] No changes to Mode 1, Mode 3 (browser-verify), or Mode 4 (infrastructure)
- [ ] Health check passes

**Verification:**
- Run: `node hooks/health-check.mjs` → Expected: all checks pass
- Run: `node --test tests/health-check.test.mjs` → Expected: all pass
- Visual diff of `agents/pippin.md` — should be additive, not destructive; no existing content removed

**Notes:** This is the most surgical of the three. The temptation will be to "improve" other parts of Pippin while editing — resist. The fold is targeted; everything else stays.

---

## Plan Review

No external review needed — three small file operations, scope is locked, attribution and renames already specified. Legolas will review at the end of the cycle.

---

## Recommended tier

**Tier 2** — single Gimli, sequential tasks, foreground dispatch so the user can watch progress live. Total estimated work: ~45 minutes. Three small files, minimal risk, no test-writing or infrastructure changes. Legolas pass at the end on the diff.

---

## Principles in tension

- **The Ring must not grow heavier.** Three skills was the cut from six. Resist any urge to also adopt Matt's supporting files for TDD or `improve-codebase-architecture` — those wait for post-1.0.
- **Character is craft.** The renames and attribution discipline are about Fellowship-as-product, not just plumbing. A copied skill that doesn't sound like Fellowship is worse than no skill.
- **Latency is the enemy.** One Gimli, sequential. Worktree parallelism is overkill for three Markdown files.
