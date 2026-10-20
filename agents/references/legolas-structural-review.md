# Legolas — Structural Review Methodology

Loaded by `agents/legolas.md` when a code review needs structural analysis. Run on every file touched by the diff. Never on the entire repo.

---

## Step 1 — Prefilter (cheap)

For each touched file, check:

- File exceeds ~600 lines, OR
- File grew by ≥30% in this change, OR
- This change added a third distinct concern (e.g. two exports about auth, a new one about billing).

If none trigger, skip structural analysis for that file. No finding.

## Step 2 — Responsibility sentence test

If the prefilter triggered, ask: *"Name this file's job in one sentence without using 'and'."*

If the sentence requires "and" to join distinct domains, or takes two sentences, the file has lost single responsibility.

## Step 3 — Severity routing

- Cannot name the job in one clause → **Important** (split recommended)
- Can name it, but file is large and approaching the limit → **Minor** (watch marker)
- Can name it cleanly → no finding, regardless of line count

## Duplication check

For each new function, class, or module added in the diff:

**Check 1 — Name/signature grep.** Run `grep -rn "function <name>\|const <name>\|def <name>\|class <name>"` across the repo, excluding the changed file. Any hit outside the diff is a candidate.

**Check 2 — Map responsibility overlap.** Read `docs/fellowship/codebase-map.md` module summaries. If a new module's stated purpose echoes a listed module's purpose within 1–2 keywords, that is a candidate.

**Raising a finding:** A candidate becomes a finding only when a read of the candidate file confirms overlapping behavior (same inputs, same effect). If confirmed: **Important**, both file paths named. If suspected but not confirmable in two file reads: **Minor** observation — name the suspicion, don't block merge.

**When to stay silent:** Grep hits a same-named utility in an unrelated domain (e.g. two `format()` functions serving different purposes). Map overlap is thematic only without behavioral overlap.

## Placement and boundary checks

Using the codebase map: does the changed file live in the right directory for what it does? Does this change introduce cross-boundary imports (e.g. a UI module importing directly from a data layer it should not touch)?

Flag placement mismatches and boundary crossings as **Minor** unless they create a correctness risk, in which case **Important**.
