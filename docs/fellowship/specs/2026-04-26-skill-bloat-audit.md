---
name: skill-bloat-audit
status: implemented
implemented_by: gimli
created: 2026-04-26
author: legolas
type: audit
---

# Skill Bloat Audit — Four Skills Outside the Prior Pass

**Date:** 2026-04-26
**Auditor:** Legolas
**Scope:** `skills/accessibility/`, `skills/autoimprove/`, `skills/ux-audit/`, `skills/visual-exploration/`
**Method:** Read-only review against the Bilbo lens. Comparison against Superpowers' skill structure where an analogue exists.

---

## Headline

Of the four skills, **`accessibility/SKILL.md` (906 lines) carries by far the most bloat — and the bloat is structural, not substantive.** The WCAG, screen-reader, and remediation domains it covers are real and worth documenting; the problem is that nearly all of it is loaded on every invocation when most of it is consulted situationally. A WCAG checklist, four screen-reader command tables, an ARIA remediation cookbook, and an automated-testing snippet sit inline in the same file. Superpowers' equivalent move (see `subagent-driven-development/SKILL.md`, 277 lines, with three sibling `*-prompt.md` files) is to keep `SKILL.md` as a thin orchestrator and put the long reference content in siblings. Fellowship's accessibility skill never made that move.

The other three skills are healthier. `autoimprove` has earned most of its 405 lines (the loop is the methodology), but carries one large extractable block. `ux-audit` (308 lines) and `visual-exploration` (291 lines) are close to their natural size — minor trims at most. None of the four contains agent-style voice anchors or "what this sounds like" example clusters, so the *agent-bloat* anti-pattern that drove the prior refactor does not transfer. The bloat here is **inline reference content**, not voice decoration.

---

## Per-skill findings

### 1. `accessibility/SKILL.md` — 906 lines — **Block: structural bloat**

**Structure (six sections):**
1. Core Concepts — POUR, conformance levels, common-violations tree (lines 12–53)
2. WCAG 2.2 Audit Checklist — every Level A/AA criterion as a checkbox list with inline HTML/CSS examples (55–363)
3. Screen Reader Testing — coverage tables, then full command references for VoiceOver, NVDA, JAWS, TalkBack (366–637)
4. Automated Testing — axe-core/Playwright snippet plus CLI list (640–680)
5. Remediation Patterns — seven full code recipes: form labels, contrast, keyboard nav, modal focus, live regions, tabs, debugging (684–880)
6. Best Practices — Do/Don't pair (884–906)

**Inline content that should be `references/*.md`:**
- The full WCAG 2.2 checklist (sections 1.1–4.1, ~310 lines) is reference material — consulted when running an audit, not on every skill load. → `references/wcag-2.2-checklist.md`.
- Screen-reader command tables for four products (~270 lines). Each is a cheat sheet, not methodology. → `references/screen-readers/{voiceover,nvda,jaws,talkback}.md` or one combined `references/screen-reader-commands.md`.
- Remediation pattern cookbook (~200 lines of HTML/JS recipes). → `references/remediation-patterns.md`.
- Automated testing snippet — keep an inline pointer, move the code. → `references/automated-testing.md`.

After extraction, `SKILL.md` should be ~80–120 lines: the POUR principles, when to use, audit workflow (read → axe → manual SR pass → remediate), conformance targeting, and links into the references. That matches the size of every other Fellowship skill and matches Superpowers' shape.

**Anti-patterns spotted:**
- No voice anchors. No "what this sounds like" clusters. The agent-bloat patterns are **absent** here. (Credit: this skill was written as documentation, not as performance.)
- Mild redundancy: "Don't rely only on automated testing" appears as a bullet in the Don'ts list (line 899), is implied by the 30–50% statistic (line 680), and is implied by the entire screen-reader section. One mention is enough; pick the strongest.
- Tables-vs-paragraphs: the screen-reader-coverage table (370–376) is good. The "Common Violations by Impact" ASCII tree (lines 33–51) is a list pretending to be a diagram — convert to a table or three short bullet groups.

**Superpowers comparison:** Superpowers has no accessibility skill — note the absence as data. The structural benchmark is `writing-skills/` (655 lines but split: SKILL.md plus `anthropic-best-practices.md`, `persuasion-principles.md`, `testing-skills-with-subagents.md`, `examples/`). Same shape as the recommended split here.

**Severity: Block.** This is the canonical bloat case in the plugin.

---

### 2. `autoimprove/SKILL.md` — 405 lines — **Important: one extractable block, otherwise earned**

**Structure:**
1. Invocation modes (14–25)
2. Critical-tool-use note (28–33)
3. Setup / file inventory (37–48)
4. The 8-step loop (52–342) — reads, baseline, find target, propose, evaluate, decide, repeat, report
5. Soft-assertion judging guidance (346–364)
6. Growing the eval suite from real usage (368–382)
7. Scoring reference + Safety (386–406)

**Inline content that should be `references/*.md`:**
- The bash/Python `subprocess` invocation blocks in Step 2 (lines 77–146) and the matching soft-assertion judging block in section 5 (lines 350–364) are mechanical — they're the "how to invoke a fresh claude process" recipe. They duplicate orientation across two locations. Pull both into `references/invocation-recipes.md` (or use the existing `propose.md`/`report.md` siblings — those already exist and the SKILL.md doesn't reference them, which is its own finding).
- The session-summary markdown template (Step 8, lines 275–333) is a template, not methodology. → `references/session-summary-template.md`.

**Existing siblings ignored.** `skills/autoimprove/propose.md` and `report.md` already exist on disk. SKILL.md mentions neither. Either they are dead, or SKILL.md should delegate to them. Flag this — the audit can't tell which without reading those files, but the inconsistency is a finding regardless.

**Anti-patterns spotted:**
- Mode dispatch (lines 14–25) is restated in slimmer form at Step 3 ("In `cycle` mode, run Steps 3–6 once and exit", line 180) and Step 7 ("In `cycle` mode, skip this step entirely", line 262). Three statements of one rule. Once at the top is enough; the per-step reminders can be a single line.
- "CRITICAL: Every action step requires actual tool use" (line 28) and "Do not simulate responses internally" (line 71) say the same thing twice in different registers.
- No voice anchors. No example clusters.

**Superpowers comparison:** `subagent-driven-development/SKILL.md` is 277 lines with three sibling prompt files (`implementer-prompt.md`, `code-quality-reviewer-prompt.md`, `spec-reviewer-prompt.md`). It is the closest analogue to autoimprove and demonstrates the exact extraction pattern that autoimprove should be using (and almost is, given `propose.md`/`report.md` exist).

**Severity: Important.** Not blocking; the methodology is real, but ~80 lines of recipe and template are extractable, and the orphaned siblings need either wiring up or deleting.

---

### 3. `ux-audit/SKILL.md` — 308 lines — **Minor: trim, don't restructure**

**Structure:**
1. When to use (12–16)
2. Score definitions (18–27)
3. Six pillars — each with audit method (often a grep block), scoring guidance, BLOCK/FLAG conditions (32–195)
4. Screenshots procedure (199–227)
5. Verdict format (231–236)
6. Audit report template (240–308)

**Inline content that should be `references/*.md`:**
- The audit report template (lines 244–308, ~65 lines) is a template. Consulted once at write-time. → `references/audit-report-template.md`. Keep a one-line pointer.
- The screenshots bash procedure (lines 200–225) is a recipe. → `references/screenshot-capture.sh` or inline keep, defensible either way.

**Anti-patterns spotted:**
- The six-pillar structure is parallel and tight — each pillar takes ~25 lines, no pillar is doing more than its share. This is the cleanest part of the four skills.
- One mild duplication: scoring guidance and BLOCK/FLAG conditions sometimes restate each other (Pillar 1: BLOCK conditions essentially repeat what "1" on the scoring scale means). Tighten by letting the scoring scale carry the rubric and BLOCK/FLAG carry only the verdict triggers.
- No voice anchors. No "what this sounds like" clusters.

**Cross-skill note (see overlap section):** The WCAG layer in the audit report template (lines 270–278) gestures at content that lives in full in `accessibility/`. That is the right design — gesture, don't duplicate — and the description field of the frontmatter calls this out explicitly. Good.

**Superpowers comparison:** No equivalent. Note the absence.

**Severity: Minor.** Pull the template; otherwise leave alone.

---

### 4. `visual-exploration/SKILL.md` — 291 lines — **Minor: cleanest of the four**

**Structure:**
1. When to use (10–31)
2. How it works (33–37)
3. Starting a session — including per-platform launch instructions (39–96)
4. The loop (98–130)
5. Writing content fragments (132–160)
6. CSS classes available — five sub-sections (162–249)
7. Browser events format (251–262)
8. Design tips, file naming, cleaning up (264–286)
9. Reference (288–291)

**Inline content that should be `references/*.md`:**
- The CSS class catalog (lines 162–249, ~88 lines) is a reference card. Consulted at write-time, not load-time. → `references/css-classes.md`. Save ~30% of the skill's bytes on every load.
- Per-platform launch instructions (lines 54–96) are useful context, but the four-environment matrix (Claude Code mac/Linux, Claude Code Windows, Codex, Gemini CLI) reads like a compatibility table. Keep the default invocation inline; move platform variants to `references/platform-launch.md`.

**Anti-patterns spotted:**
- The when-to-use section (10–31) is exemplary — clear test, clear browser-vs-terminal split, named edge case ("a question *about* a UI topic is not automatically a visual question"). This is the section other skills should copy.
- No voice anchors. No example clusters. No redundant restatements.
- Final "Reference" section already points to two sibling files in `scripts/` — the precedent for sibling references is already set in this skill.

**Superpowers comparison:** No equivalent. Note the absence.

**Severity: Minor.** This is the model citizen of the four. The CSS catalog is the only meaningful extraction.

---

## Cross-skill overlap

Looked specifically at `accessibility/` × `ux-audit/` since the prior audit flagged these as adjacent.

**Real overlap:**
- WCAG criteria. `ux-audit/` has a six-row WCAG layer table in its report template (lines 270–278). `accessibility/` has the full WCAG 2.2 checklist. Today the overlap is a *gesture* — `ux-audit` names six high-level criteria (contrast, keyboard, focus, alt text, labels, screen-reader structure) and points users to deeper coverage in `accessibility`. The two frontmatter `description` fields explicitly cross-reference each other. This is correctly handled — not duplicated.
- Color contrast. `accessibility/` line 134–139 covers contrast ratios. `ux-audit/` Pillar 3 covers color systematically (60/30/10) but does **not** restate contrast ratios. Clean.
- Form labels. Both touch this — `accessibility/` in the WCAG checklist (line 97) and remediation cookbook (688–702); `ux-audit/` only in the WCAG table cell. Not a duplication finding.

**No other meaningful cross-skill overlap.** `autoimprove` and `visual-exploration` share no surface with the other two.

**Recommendation:** When the accessibility skill is split into references, `ux-audit/`'s WCAG table should link directly into `skills/accessibility/references/wcag-2.2-checklist.md` rather than re-listing criteria. That tightens the cross-reference further.

---

## What's clean

Worth naming so the refactor doesn't accidentally damage it:

- **`visual-exploration/`'s when-to-use section** — the browser-vs-terminal decision rule is the clearest "when to use" of any Fellowship skill. Don't touch.
- **`ux-audit/`'s six-pillar structure** — parallel sections, consistent shape, each pillar earns its lines. The grep recipes give the audit a runnable spine.
- **`autoimprove/`'s 8-step loop** — the methodology itself is not bloat. Naming each step, naming the mode at the top, ending with safety — this is reference-grade procedural writing. Trim the recipes, keep the bones.
- **`accessibility/`'s POUR section and conformance-level table** — short, dense, load-bearing. These belong inline.
- **All four skills are free of agent-style voice anchors and "what this sounds like" example clusters.** The bloat in `accessibility/` is one kind (inline reference content); the agent-file bloat that drove the prior refactor is a different kind, and it does not appear here. The two refactors should not be merged.

---

## Summary of recommended severity

| Skill | Lines | Severity | Primary action |
|---|---|---|---|
| `accessibility` | 906 | **Block** | Extract WCAG checklist, screen-reader commands, remediation cookbook to `references/*.md`. Target ~100 line SKILL.md. |
| `autoimprove` | 405 | **Important** | Extract invocation recipes and session-summary template. Resolve orphan `propose.md`/`report.md`. |
| `ux-audit` | 308 | **Minor** | Extract audit report template. Tighten BLOCK/FLAG vs scoring rubric overlap. |
| `visual-exploration` | 291 | **Minor** | Extract CSS class catalog. Optionally move platform-launch matrix. |

The `accessibility` extraction is by itself worth ~700 lines of off-load and would bring the skill into structural alignment with how Superpowers organises `writing-skills/` and `subagent-driven-development/`. That is the single highest-leverage move available in this audit's scope.
