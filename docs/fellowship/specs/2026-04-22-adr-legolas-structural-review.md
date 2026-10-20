# ADR: Legolas Structural Review — Thresholds, Duplication, Format, Dispatch

**Status:** Proposed
**Date:** 2026-04-22
**Decider:** Merry (technical) — Frodo locks on acceptance
**PRD:** `docs/fellowship/specs/2026-04-22-fellowship-real-usage-improvements.md` (Problem 2)

## Context

Karolus uses Fellowship across 3–4 real projects. When he tells Legolas *"make sure the code is scalable, correctly structured and split,"* Legolas audits line-by-line but does not see the repo as a system. Three recurring misses:

- Files that grew too large and now mix multiple mechanics.
- New functions that duplicate logic already living elsewhere.
- Files placed in the wrong directory for what they do.

Aragorn's PRD locks the direction: always feed Legolas the codebase map on dispatch, and add a structural checklist inside `agents/legolas.md`. This ADR is the HOW — the four design calls Gimli will build against.

Karolus's explicit guidance: **structural and logical, not line count.** Line count is a soft hint only.

---

## Question 1 — Thresholds: when does a file need splitting?

### Options considered

| Option | Pros | Cons | Fit |
|---|---|---|---|
| A. Hard line-count threshold (e.g. >800 lines → flag) | Deterministic, cheap, easy for Legolas to apply | Exactly what Karolus ruled out. False positives on long configs, false negatives on tight 300-line spaghetti | No |
| B. Semantic-only check (responsibilities per file) | Matches Karolus's intent | No cheap trigger — Legolas can't cost-effectively inspect every file | No |
| C. Layered signal: line count as cheap prefilter, responsibility check as the decision | Line count narrows attention; the decision is semantic | Needs a clear decision tree to avoid drift | **Yes** |

### Recommendation — Option C, layered decision tree

Legolas walks the structural checks **only on files touched by the diff** (never every file in the repo). For each touched file:

**Step 1 — Prefilter (cheap):**
- File exceeds ~600 lines, OR
- File grew by ≥30% in this change, OR
- This change added a third distinct concern (e.g. two exports about auth, a new one about billing).

If none trigger, skip structural split-analysis for that file. No finding.

**Step 2 — Responsibility count (the real test):**
If prefilter triggered, ask: *"Name this file's job in one sentence without using 'and'."* If it takes two sentences, or the sentence contains "and" joining distinct domains, the file has lost single responsibility.

**Step 3 — Severity routing:**
- Cannot name the job in one clause → **Important** (split recommended)
- Can name it, but file is large and adding more would cross the line → **Minor** (watch marker; note for next change)
- Can name it cleanly → no finding regardless of line count

**Thresholds codified for Gimli to implement:**
- Prefilter line count: 600 (soft hint), not a hard rule
- Prefilter growth: +30% in the diff
- The responsibility-sentence test is the decision; line count never is

**Why this shape:** It honors Karolus's instruction (structural, not line count) while giving Legolas a cheap attention filter so he doesn't run the semantic test on every file.

---

## Question 2 — Duplication detection without reading every file

### Options considered

| Option | Pros | Cons | Fit |
|---|---|---|---|
| A. Grep new function names / signatures against repo | Cheap, deterministic, uses tools Legolas already has | Misses renamed duplicates; catches only surface echoes | Partial |
| B. Use codebase map's module summaries to spot overlapping responsibilities | Catches conceptual duplication, not just name collision | Depends on map quality; useless if map absent | Partial |
| C. Ask Gimli / user for "known similar code" | High signal when it returns | Adds a round trip; usually returns nothing new | No (as default) |
| D. Full semantic scan of repo | Catches everything | Exactly the failure mode we're avoiding | No |
| E. Layered: grep + map-summary, raise on any confirmed signal | Cheap, no round-trips, works with imperfect map | Will miss deep renames. Acceptable — we don't need perfect | **Yes** |

### Recommendation — Option E, layered signal

For each new function, class, or module added in the diff, Legolas runs two cheap checks:

**Check 1 — Name/signature grep.**
`grep -rn "function <name>\|const <name>\|def <name>\|class <name>" --include=<ext>` across the repo, excluding the changed file. Any hit outside the diff is a candidate.

**Check 2 — Map responsibility overlap.**
Read the codebase map's module summaries. If a new module's stated purpose ("handles X for Y") echoes a listed module's purpose within 1–2 keywords, that is a candidate.

**Smallest signal that justifies raising a duplication concern:**
Either check returns a candidate AND a 30-second read of the candidate file confirms overlapping behavior (same inputs, same effect, different name or location). If Legolas sees that, it is **Important** severity with both file paths named.

**When to stay silent:**
- Grep hits a same-named utility that is clearly different (e.g. two `format()` functions in unrelated domains).
- Map overlap is thematic only (both touch "users") without behavioral overlap.

False positives that waste a round trip are worse than missed duplicates — better to name high-confidence cases plainly than raise every echo.

**Escalation:** If Legolas suspects duplication but cannot confirm in two file reads, he reports it as a **Minor** observation, not an Important finding. Naming the suspicion gives Karolus the signal without blocking merge.

**Why this shape:** It leans on the map when it exists, falls back to grep when it doesn't, and caps Legolas's investigation at two file reads. No combinatorial reading of the repo.

---

## Question 3 — Structural findings format in the report

### Options considered

| Option | Pros | Cons | Fit |
|---|---|---|---|
| A. New `[structural]` tag inside Critical/Important/Minor | Zero format churn | Easy to miss in a dense report; no guarantee Legolas looks for structural at all | No |
| B. New top-level `Structural:` section parallel to current Issues | Forces Legolas to consider structural explicitly every review — check runs even when empty | Adds one section to the format | **Yes** |
| C. Crosscutting severity tag (`Structural-Critical`, etc.) | Preserves severity triage | Severity model becomes two-dimensional — complexity Karolus did not ask for | No |

### Recommendation — Option B, top-level `Structural:` section with internal severity

Structural findings sit in their own section, but each entry still carries Critical / Important / Minor so triage and dispatch routing stay intact.

### Example report excerpt

```
Status: APPROVED_WITH_CONCERNS

Reviewed:
  3 files changed in src/auth/. Diff HEAD~1..HEAD.

Issues:

  Critical:
    [none]

  Important:
    1. Token validated after DB lookup
       - File: src/auth/session.ts:47
       - Problem: User record fetched before token signature check.
       - Impact: Wasted query on forged tokens; potential timing oracle.
       - Fix: Verify signature before the lookup.

  Minor:
    [none]

Structural:

  Important:
    1. Duplicate session logic
       - File: src/auth/session.ts:12 duplicates src/lib/session-store.ts:34
       - Problem: New getSession() repeats the flow already in session-store.
       - Impact: Two sources of truth for session shape; they will drift.
       - Fix: Import from src/lib/session-store or justify the split.

  Minor:
    1. File approaching responsibility limit
       - File: src/auth/session.ts (612 lines, +41% this change)
       - Note: Still single-purpose, but next addition should split. Watch marker.

  [If nothing found: "No structural issues found."]

Assessment:
  One logic issue (token order) and one duplication. Fix both; re-review.
```

**Why this shape:** Structural is visible and required every review. Severity vocabulary is preserved — Gandalf's existing routing rule (Critical + Important → Gimli, Minor → noted) keeps working without change.

---

## Question 4 — Codebase map dispatch rule

### Options considered

| Option | Pros | Cons | Fit |
|---|---|---|---|
| A. Always include the map; block dispatch if absent | Strongest guarantee | Heavy-handed — blocks review on small projects where the map is overkill | No |
| B. Always include the map when it exists; warn (don't block) when absent and repo is non-trivial | Works whether map exists or not; gentle push to run `/fellowship:map` | Same as current policy for Tier 3; needs promotion for Legolas specifically | **Yes** |
| C. Only include for multi-file diffs | Economical | Exactly the cases Legolas currently handles fine — the structural miss also happens on single-file additions that duplicate existing logic | No |

### Recommendation — Option B, always-on for Legolas, warn when absent

**The rule (Gimli to codify in `agents/gandalf.md`, Review Cycle section):**

> When dispatching Legolas, always include the content of `docs/fellowship/codebase-map.md` in the dispatch prompt if the file exists — regardless of diff size or tier. If the file is absent and the project has ≥20 source files, do not block dispatch. Instead, append a one-line notice: *"No codebase map — structural duplication checks will be grep-only. Run `/fellowship:map` when time allows."* If the project has <20 source files, include nothing; Legolas grep-only is sufficient at that scale.

**Anti-Paralysis interaction:**
The codebase map is a reference artifact, not exploration. Reading it is counted the same as reading the task description — **map reads do not count** toward the 5-consecutive-Read limit in Legolas's Anti-Paralysis Guard. Gimli implements this as a carve-out line in that guard: *"Reading `docs/fellowship/codebase-map.md` does not count toward the 5-Read limit. It is dispatch context."*

**Why this shape:** Always-on matches the PRD's acceptance criterion. The 20-file threshold prevents noisy warnings on tiny repos. The Anti-Paralysis carve-out is narrow and named — no loophole for general exploration.

---

## Proposed edits (Gimli's work)

**`agents/legolas.md`**
1. Under `How to Review`, insert a new subsection **"Structural Review"** between existing §4 (`Check code quality`) and §5 (`Run verification`). Contains:
   - The five explicit checks from the PRD (size-prefilter, single-responsibility sentence test, duplication via grep + map, placement vs. map, boundary crossings).
   - The decision tree from Q1 (line-count prefilter → responsibility sentence → severity).
   - The duplication procedure from Q2 (grep + map + confirm in ≤2 reads).
2. In `Report Format`, add a top-level `Structural:` section mirroring `Issues:` with Critical/Important/Minor sub-levels. Include the "No structural issues found." empty-state line.
3. In `Anti-Paralysis Guard`, add the map carve-out line from Q4.
4. In `Before You Report`, add: *"Structural section present (even if empty)."*

**`agents/gandalf.md`**
1. In `Review Cycle (Gimli → Legolas)`, step 1, amend: *"Dispatch Legolas with Gimli's report + original spec + git SHAs + content of `docs/fellowship/codebase-map.md` if it exists."*
2. In the `Codebase map` memory section (currently `gandalf.md:493`), add a Legolas-specific clause: *"For Legolas dispatches, map inclusion is always-on (if file exists), not conditional on tier. If the file is absent and the project has ≥20 source files, append a one-line notice to the prompt rather than blocking."*

### Mapping to PRD acceptance criteria

| PRD criterion | Satisfied by |
|---|---|
| Gandalf always includes map content when dispatching Legolas (if exists) | `agents/gandalf.md` edit #1 + #2 |
| Prompts user to run `/fellowship:map` if absent and ≥20 source files | `agents/gandalf.md` edit #2 |
| Legolas has five explicit structural checks | `agents/legolas.md` edit #1 |
| Structural findings visible in report format | `agents/legolas.md` edit #2 |
| Anti-Paralysis Guard does not penalize map reads | `agents/legolas.md` edit #3 |
| Manual verification: duplication case flagged | Pippin adds one eval scenario (PRD dependency, separate work) |

---

## If wrong

**Assumption 1: The 600-line prefilter catches most needing-split cases.**
If wrong — files that mix concerns at 300 lines slip through, or clean 900-line files get flagged noisily.
Signal: Karolus comments that Legolas flagged a file that was fine, or missed one that was clearly bloated.
Fix cost: low. Tune the prefilter number or drop the line-count prefilter entirely and rely on growth-% plus added-concern detection.

**Assumption 2: Grep + map summaries is enough to catch duplication in practice.**
If wrong — renamed or refactored duplicates slip through repeatedly.
Signal: Legolas approves a change, then a week later Karolus finds the duplicate by hand.
Fix cost: medium. We would need to admit that semantic duplication detection needs something beyond grep — possibly a dedicated pre-review pass, possibly AST-level tooling. Flag it and escalate rather than expand Legolas's reading budget.

**Assumption 3: A parallel `Structural:` section improves visibility without overwhelming the report.**
If wrong — reports feel bloated; Karolus stops reading structural entries.
Signal: Karolus asks for shorter reviews, or ignores structural findings.
Fix cost: low. Fold structural back into Critical/Important/Minor with a `[structural]` tag (Option A from Q3).

**Assumption 4: Always-on map inclusion does not bloat Legolas's context to the point of degrading other review quality.**
If wrong — large codebase maps push out diff context; review quality on correctness drops.
Signal: Legolas begins missing line-level findings after the map is introduced.
Fix cost: medium. Move to conditional inclusion (multi-file diffs only), or summarize the map to just module list + directory structure before injection.

All four failure modes are observable from Karolus's normal usage — no special instrumentation needed. Each has a cheap-to-moderate revert path. The design is reversible in the directions that matter.
