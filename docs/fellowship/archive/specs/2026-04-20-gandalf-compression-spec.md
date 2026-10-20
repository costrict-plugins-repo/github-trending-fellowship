# Gandalf In-Place Compression Spec

**Date:** 2026-04-20
**Status:** Proposed — ready for Gimli
**Owner:** Merry (spec) → Gimli (execution) → AutoImprove (validation)

---

## Context

Gandalf (`agents/gandalf.md`, 720 lines) is the primary agent. His file becomes the system prompt and stays resident every turn of every session. Every token is a permanent context cost. The other nine companions range 212–484 lines but only load when dispatched.

The work is to compress Gandalf **in place**. No extraction to a new skill — orchestration IS Gandalf's craft, and the plugin principle stands: *"Agent craft lives in the agent."* The voice sections — hard-won across four AutoImprove cycles to 1.0 on 2026-03-28 — are untouched.

**Target:** 720 → 500–550 lines without behavior regression.
**Technique:** caveman-style tightening (see `examples/caveman/skills/caveman/SKILL.md`) applied **only to procedural sections**.

## Principles to honor

- Agent craft lives in agent. No extraction.
- The Ring must not grow heavier. Only compress; no new architecture beyond the two small hooks below.
- Character is craft. Voice sections untouched — not a word.
- Latency is the enemy. This work exists to serve it.

## Non-negotiables

- **Voice sections untouched.** Not shortened, not re-ordered, not re-punctuated. Lines 22–133 are out of bounds. Lines 672–696 (Opening a Session examples) are out of bounds — they are voice disguised as procedure.
- **Behavior preserved.** Every assertion in `evals/gandalf/hard.py` must still pass. Every soft criterion in `evals/gandalf/soft.md` must still hold.
- **Artifacts stay clean.** The voice colors conversation, never artifacts. The compressed procedural sections must still read as reference material, not as caveman prose. Caveman style is the compression *technique*, not the output voice.

## Compression technique (the caveman move, constrained)

Reference: `examples/caveman/skills/caveman/SKILL.md`. Apply **lite-to-full intensity** on procedural reference prose — not ultra. We need the file to remain readable to a human later auditing it.

**Moves that are safe:**
- Drop articles (a/an/the) where meaning is preserved
- Drop filler (just, really, basically, actually, simply)
- Collapse multi-sentence explanations to tables where structure is parallel
- Fuse paired examples ("Not X / Yes Y") into one line
- Remove preamble framing ("The cycle is strict — once review starts, it runs to completion." → keep the rule, drop the frame)
- Convert prose lists into bulleted clauses
- Replace long connectives ("before moving to the next" → "before next")

**Moves that are forbidden:**
- Any edit in a voice section (see Section Audit below)
- Removing an entire rule — every hard-rule bullet stays, even if tightened
- Collapsing the model routing table, companion table, or status tables — these are scannable references
- Removing examples that encode behavioral judgment (e.g., the worked example in Tier Scoring is load-bearing for `plan_before_dispatch_on_tier3`)

---

## Section Audit

Every block of `agents/gandalf.md` is classified as **Voice (V)**, **Procedural (P)**, or **Structural (S)**.

| Lines | Section | Class | Current | Target | Notes |
|---|---|---|---|---|---|
| 1–18 | Frontmatter | S | 18 | 18 | Untouched |
| 20–34 | Opening voice preamble | **V** | 15 | 15 | Untouched |
| 36–133 | Personality & Voice (all subsections, all anchors, hard rules at 128–132) | **V** | 98 | 98 | **Untouched. Not a word.** |
| 134–140 | Role | P | 7 | 5 | Tighten prose |
| 142–147 | What You Don't Do | P | 6 | 5 | Tighten bullets |
| 150–177 | First Things First → Bootstrap | P | 28 | 17 | Collapse numbered steps, keep the "open in voice" rule intact |
| 178–180 | First Things First → Resume | P | 3 | 3 | Already tight |
| 182–184 | Tiered Routing intro | P | 3 | 2 | Merge |
| 186–189 | Tier 1 | P | 4 | 3 | |
| 191–202 | Tier 2 (skill-or-agent + background/foreground rules) | P | 12 | 8 | Collapse foreground exceptions to bullets |
| 204–209 | Tier 3 | P | 6 | 5 | |
| 211–214 | Tier 4 | P | 4 | 3 | |
| 216–225 | Multi-track execution | P | 10 | 7 | Rules → bullets, drop prose connectives |
| 227–265 | Tier Scoring (two tables + thresholds + worked example) | P-mixed | 39 | 30 | **Tables preserved**; tighten prose framing; **keep worked example verbatim** |
| 267–290 | Tier 4 Agent Teams | P | 24 | 16 | Collapse "as team lead" list; keep compositions table |
| 292–308 | Companions + skills-enhance-agents note | P | 17 | 17 | **Table preserved as-is**; one-line framing |
| 310–329 | Handling Companion Reports | P | 20 | 14 | Table preserved; tighten the DONE-means-verified prose and the memory paragraph |
| 331–375 | Review Cycle (Legolas) | P | 45 | 27 | Collapse numbered cycle to tighter bullets; keep "Never skip re-review" and "Legolas never edits code" intact; keep statuses table |
| 377–449 | Testing Cycle (Pippin) | P | 73 | 45 | Three workflows (test-after, test-first, browser-verify) → tighten numbered steps; preserve MCP-registration line verbatim (operational) |
| 451–489 | Design Review (Arwen) | P | 39 | 24 | Tighten "when to dispatch" prose; preserve Figma-MCP line verbatim; keep numbered compliance flow but terser |
| 491–500 | Dispatching Companions (what-to-pack list) | P | 10 | 7 | |
| 502–525 | Model Routing | P | 24 | 22 | **Table preserved**; drop the example block since the table is self-explanatory — but keep the "No frontmatter changes needed" note |
| 527–561 | Planning (flow + when-simple + when-matters + plan-gate + not-architecture) | P | 35 | 24 | Collapse "The flow" numbering; keep plan-before-build-gate prompt **verbatim** (it is copied into dispatches); tighten rest |
| 563–670 | Memory (quest log rules, consolidation, format, product.md rules, companion memory, specs, debug log, codebase map, handoffs, feedback capture) | P | 108 | 68 | Biggest single win; see breakdown below |
| 672–696 | Opening a Session (examples + anti-examples + rule) | **V** | 25 | 25 | **Untouched.** Voice calibration for session start — touching this regresses `response_is_brief` + soft #1 |
| 700–706 | Communication Mode | P | 7 | 5 | |
| 708–712 | Anti-Paralysis Guard | P | 5 | 4 | Already tight |
| 714–721 | Before You Dispatch | P | 8 | 7 | |
| — | **NEW: Ethos injection hook** | P | 0 | 4 | See Addition 1 |
| — | **NEW: Skill routing hooks** | P | 0 | 6 | See Addition 2 |

**Rough total:** 720 → ~535 lines. Meets the 500–550 window.

### Memory section breakdown (108 → 68)

The Memory section is the biggest single win and the highest risk — compress carefully.

| Block | Current | Target | Treatment |
|---|---|---|---|
| Quest log read/write rules + silent update | 565–573 | 9 | 5 | Fuse "Read at session start" + "Update silently — no announcement" |
| Consolidation check | 574–581 | 8 | 6 | Keep 1/2/3 numbered — load-bearing mechanics |
| Quest log format block | 583–606 | 24 | 24 | **Code block preserved verbatim** — it is a template |
| product.md rules + update triggers | 608–616 | 9 | 7 | Collapse bullet list; keep "ask one question" rule verbatim |
| Companion memory | 618 | 1 | 1 | Already one line |
| Specs and plans | 620 | 1 | 1 | Already one line |
| Debug log | 622 | 1 | 1 | Already one line |
| Codebase map | 624 | 1 | 1 | Already one line, keep the quoted user-facing line verbatim |
| Handoffs (trigger + template + user-facing line) | 626–645 | 20 | 14 | Keep template block; tighten surrounding prose |
| "You are the memory curator" | 647 | 1 | 1 | Keep |
| Feedback capture (full) | 649–670 | 22 | 18 | Keep JSONL format verbatim; tighten the inferred-confirmation paragraph; keep `no_scenario` rule intact — load-bearing |

---

## Risk Matrix

For each procedural section, how likely is compression to affect behavior tested by `evals/gandalf/`?

| Section | Risk | Reason | Mitigation |
|---|---|---|---|
| Role, What You Don't Do | **Low** | No eval assertion hits this | Tighten freely |
| First Things First / Bootstrap | Low | No assertion; "open in voice" line is the only load-bearing bit | Keep that line verbatim |
| Tier 1–4 definitions | **Medium** | `no_dispatch_on_tier1`, `plan_before_dispatch_on_tier3` depend on clarity here | Tighten prose but preserve every rule keyword: "plan", "break", "before", "first" — these are literal matches in the assertion |
| Tier Scoring tables + worked example | **High** | Worked example is load-bearing: "spec exists (+1) … err down to Tier 3" wires the plan-before-dispatch instinct | **Tables + worked example preserved verbatim**; only tighten surrounding prose |
| Multi-track, Teams | Low | No assertion | Tighten freely |
| Companion table | None | Reference | Preserved |
| Handling Reports | Medium | "DONE means verified" prose informs how Gandalf responds to `architect_done` scenario | Keep the rule sentence; tighten the paragraph around it |
| Review Cycle | **High** | The `architect_done` scenario (`no_permission_seeking_before_dispatch`) and step-complete scenario depend on the "don't ask permission, just dispatch" framing being present elsewhere too; also "Never skip re-review" and "Legolas never edits code" are behavioral rails | Preserve both rails verbatim; tighten the numbered cycle |
| Testing Cycle | Medium | Workflows are reference, but the browser-verify MCP-registration line is user-facing (Gandalf quotes it verbatim to the user) | Preserve the quoted command line verbatim |
| Design Review | Medium | Figma-MCP quoted line is user-facing | Preserve verbatim |
| Dispatching, Model Routing | Low | Tables are reference | Preserved |
| Planning | **High** | The plan-before-build-gate prompt is copied verbatim into Gimli dispatches at Tier 3+ | Preserve that prompt verbatim; tighten surrounding prose |
| Memory — consolidation check, product.md one-question rule, handoff template, feedback JSONL | **High** | Multiple behavioral rails: product context handling (soft #5), quest log silent update (`no_quest_log_permission_seeking`), feedback capture (captured verbatim by companions) | Preserve all templates and quoted lines verbatim; compress only surrounding prose |
| Opening a Session examples | **Maximum** | Directly shapes session-start responses; scenarios ga001, ga002 live here; the `<!-- hypothesis -->` comment marks a past AutoImprove intervention | **Untouched.** Do not compress. |
| Communication Mode, Anti-Paralysis, Before You Dispatch | Low | Small reference blocks | Tighten freely |

**Rule of thumb:** If a line is quoted verbatim elsewhere (dispatches, user-facing messages, templates) — preserve it. If it is prose explaining *why* a rule exists — candidate for tightening. If it is a rule itself — shorten the sentence, never remove it.

---

## Addition 1 — Ethos injection hook

A four-line "Fellowship Principles" ethos block lives at `templates/ethos.md` (created separately — not Gimli's concern in this work). Gandalf reads it and includes it in the prompt for every Tier 3+ companion dispatch.

**Where to add the hook:** inside the **Dispatching Companions** section (around line 491–500), append a new subsection.

**Exact text to add:**

```markdown
### Ethos injection (Tier 3+)

For every Tier 3+ dispatch, read `templates/ethos.md` once and prepend the four lines to the companion prompt under a heading `## Fellowship Principles`. Do not paraphrase, do not comment. The four lines go in as-is, then your task prompt follows.

If `templates/ethos.md` is absent, dispatch without it — do not block, do not ask.
```

**Why these exact instructions:**
- *"read … once"* — avoids re-reading on every dispatch in a Tier 4 parallel spawn
- *"prepend … under a heading"* — gives the companion a predictable anchor to scan past or honor
- *"do not paraphrase"* — the ethos file's voice matters; Gandalf must not translate it
- *"If absent, dispatch without it"* — follows the plugin rule that nothing blocks core workflow on optional artifacts

**Line budget:** 4 lines of prose + 2 lines of header/blank = 6 lines. Falls inside the 4-line target on the audit table once the one-line subsection header and blank line are counted separately.

## Addition 2 — Skill routing hooks

Two new skills are landing in this batch: `fellowship:investigate` and `fellowship:learn`. Gandalf needs two tight routing hooks — no more.

**Where to add:** at the end of the **Companions** section (after line 308, before Handling Companion Reports at line 310). Add a new subsection.

**Exact text to add:**

```markdown
### Skill hooks

- **User describes a bug** ("X is broken", "Y isn't working", "this keeps failing") → dispatch Gimli with `fellowship:investigate` loaded. Investigation precedes fix.
- **User asks what you remember, or memory feels stale** ("what do you know about X", "have we done this before", "what did we decide about Y") → load `fellowship:learn` in session before responding.
```

**Why this shape:**
- Two bullets, not a table — only two hooks, a table would be ceremony
- Each hook names the *user signal* (quoted phrasing) and the *action* (dispatch or load). No prose explanation.
- Placed after the Companions table because skills enhance agents — the context is already established there

**Line budget:** 1 header + 1 blank + 2 bullets = 4 lines. Allowing for blank separators: 6 lines.

---

## Before / After sample — the Review Cycle

This shows the compression style Gimli should apply across all procedural sections. The Review Cycle is a good template because it has numbered steps, a statuses table, and "key rules" — the three patterns that repeat throughout Gandalf.

### Before (current lines 331–375, 45 lines)

```markdown
## The Review Cycle (Gimli → Legolas)

After Gimli reports DONE on critical paths, dispatch Legolas to review. The cycle is strict — once review starts, it runs to completion.

### When to dispatch Legolas

- **Always review:** auth, payments, data mutations, public APIs, security-sensitive code
- **Usually review:** new features with meaningful logic, multi-file changes
- **Skip review:** config changes, copy updates, simple one-line fixes, non-code artifacts

### The cycle

```
1. Gimli reports DONE
2. Dispatch Legolas with:
   - What Gimli built (from his report)
   - The original task description / spec
   - Git SHAs if available (Gimli's report should include these)
3. Legolas reviews, reports back:
   - APPROVED → task complete
   - APPROVED_WITH_CONCERNS → read concerns, decide if action needed
   - NEEDS_CONTEXT → provide missing info, Legolas re-reviews
   - BLOCKED → assess and resolve
4. If Legolas found Critical or Important issues:
   - SendMessage to Gimli with the findings
   - Gimli fixes, reports DONE
   - Dispatch Legolas to re-review
   - Repeat until APPROVED
```

### Key rules

- **Never skip re-review after fixes.** If the issue was worth fixing, it's worth verifying.
- **Gimli stays alive via SendMessage.** He preserves context of what he built, so fixes are fast and accurate. Don't dispatch a fresh Gimli — continue the existing one.
- **Legolas never edits code.** Findings flow back through you to Gimli. This separation keeps the reviewer honest.
- **You filter findings for Gimli.** If Legolas reports a mix of Critical, Important, and Minor issues, send Gimli the Critical and Important ones. Note Minor items but don't burn a round trip on them.

### Handling Legolas's statuses

| Status | Your action |
|---|---|
| **APPROVED** | Mark task complete. Proceed. |
| **APPROVED_WITH_CONCERNS** | Read the concerns. If they're about correctness → send to Gimli. If they're observations → note and proceed. |
| **NEEDS_CONTEXT** | Provide missing info (original task, specs, context) and re-dispatch Legolas. |
| **BLOCKED** | Change too large? Ask Gimli to commit incrementally. Domain too unfamiliar? Dispatch Boromir or Pippin instead for specialized review. |
```

### After (target ~27 lines)

```markdown
## Review Cycle (Gimli → Legolas)

After Gimli DONE on critical paths, dispatch Legolas. Cycle runs to completion once started.

**When to dispatch:**
- Always: auth, payments, data mutations, public APIs, security-sensitive code
- Usually: new features with meaningful logic, multi-file changes
- Skip: config, copy, one-line fixes, non-code artifacts

**Cycle:**
1. Dispatch Legolas with Gimli's report + original spec + git SHAs.
2. Legolas reports: APPROVED / APPROVED_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED.
3. On Critical or Important findings: SendMessage to Gimli with filtered list, Gimli fixes, re-dispatch Legolas.
4. Repeat until APPROVED.

**Rails:**
- Never skip re-review after fixes. Worth fixing = worth verifying.
- Gimli stays alive via SendMessage — preserves build context. Never spawn fresh Gimli mid-cycle.
- Legolas never edits code. Findings flow through you.
- Filter findings: send Gimli Critical + Important. Note Minor, don't burn a round trip.

**Statuses:**

| Status | Action |
|---|---|
| APPROVED | Mark complete. Proceed. |
| APPROVED_WITH_CONCERNS | Correctness → Gimli. Observation → note and proceed. |
| NEEDS_CONTEXT | Add missing info, re-dispatch. |
| BLOCKED | Too large → incremental commits. Unfamiliar domain → Boromir or Pippin. |
```

**What changed:**
- Articles dropped ("After Gimli reports DONE" → "After Gimli DONE")
- Numbered step 2 + 3 collapsed (dispatch inputs fused to one sentence)
- Prose explanations in Key Rules shortened (each rule is one sentence, not one-sentence-plus-justification)
- Statuses table: cell text tightened, header row shortened
- Section renamed to drop "The" (matches caveman lite)

**What did NOT change:**
- Every rule present in the original is present in the output
- The four-status taxonomy is preserved
- Behavioral rails ("Never skip re-review", "Legolas never edits code", "stays alive via SendMessage") remain intact — just shorter

**Apply this same style across every P-classified section.** Do not go further (ultra mode, abbreviations like "req/res", arrows for every dependency). Gandalf's file is still human-read reference material.

---

## Execution Plan for Gimli

Do this in one pass. Do not commit partial compressions — AutoImprove validates the whole delta.

1. **Read** `agents/gandalf.md` fully. Confirm line ranges match this spec's audit table — if the file has shifted since 2026-04-20, re-check the V/P/S boundaries before touching anything.
2. **Section by section, top to bottom:**
   - Skip any section marked **V** (Voice). Do not edit. Do not re-punctuate. Do not move.
   - For each **P** section, apply the compression style shown in the Before/After sample.
   - Preserve verbatim every item marked "preserve verbatim" in the audit table and risk matrix (templates, quoted user-facing lines, the plan-before-build-gate prompt, JSONL format, worked example).
3. **Insert Addition 1** (Ethos hook) at the end of Dispatching Companions.
4. **Insert Addition 2** (Skill routing hooks) at the end of Companions.
5. **Count lines.** Target: 500–550. If under 500, something was cut that shouldn't have been — check the audit table. If over 560, identify the fattest P section and tighten further.
6. **Read the whole file once, aloud-ish.** Does the voice still sound like Gandalf in the first 133 lines? (It must — those lines are untouched.) Does the procedural prose read as reference? Good.
7. **Commit.** One commit. Message: `refactor(gandalf): in-place compression of procedural sections`.

**Do not:**
- Edit voice sections even by a word
- Remove a rule, even if it feels redundant
- Introduce new headings not specified here
- Change the frontmatter
- Touch `evals/gandalf/`, `templates/ethos.md`, or any other file in this commit

---

## Validation Plan

After Gimli commits, run AutoImprove against the refactored Gandalf.

1. **Baseline run first.** Run `evals/gandalf/` hard + soft against the new file before AutoImprove iterates. Compare to the 2026-03-28 quest-log entry (Gandalf hit 1.0 across 4 cycles).
2. **Gap assessment:**
   - **Gap ≤ 0.05** (i.e. score ≥ 0.95) → ship. The compression did not regress. Merge.
   - **Gap > 0.05** → open `evals/gandalf/history.jsonl`. Identify which assertion regressed. Cross-reference the assertion to the section compressed (risk matrix above names the coupling). Restore that specific section from the pre-compression version of `agents/gandalf.md`. Re-run. Iterate — not a full revert.
3. **AutoImprove cycles (up to 4)** may still refine the compressed file. This is expected and welcome. The spec only requires baseline ≥ 0.95 before AutoImprove runs.
4. **If any hard assertion flips from pass to fail**, treat as blocker. The test suite is the rails — a regression there is not acceptable even if soft score is high.

**Rollback criterion.** If after two restoration attempts the gap remains > 0.05, revert the compression commit entirely. The spec's premise — that in-place compression is safe at this scale — is disproved, and we reconsider the approach. Do not patch a failing compression into passing through test-specific tuning; that is goodharting the evals.

---

## Open Questions

None blocking. Two notes for Frodo's awareness:

- **Opening a Session is classified Voice.** That section (lines 672–696) contains inline HTML comments marking past AutoImprove hypotheses — it is actively a voice-calibration artifact, not reference prose. I've scoped it out of compression. If Frodo disagrees, the spec allows for that block to be tightened in a follow-up after ethos and skill hooks land clean.
- **`templates/ethos.md` does not yet exist.** The ethos injection hook is written to fail-safe ("dispatch without it, do not block") — so this spec can ship before that file lands. But both should land in the same batch for the hook to mean anything on the next dispatch.
