# AutoImprove — Self-Improving Agents via Eval Loop

**Date:** 2026-03-28
**Status:** Planned
**Author:** Gandalf

---

## What This Is

An overnight improvement loop that autonomously improves Fellowship agent files using the autoresearch pattern. Runs headlessly on a git worktree, reviews in the morning. No human intervention during the loop.

Three ingredients (from Karpathy's autoresearch, applied to agent prompts):

| Ingredient | What it is | Fellowship equivalent |
|---|---|---|
| **Objective Metric** | A number you can measure | Eval pass rate % per agent |
| **Measurement Tool** | Automated, no human needed | Binary assertions (`hard.py` + `soft.md`) |
| **Lever to Pull** | Something the agent can change | `agents/*.md` instruction files |

The agent (`skills/autoimprove/SKILL.md`) handles the loop. The human reviews the diff in the morning.

---

## Design Principles

**Individual agents, not whole workflows.** The loop requires clear attribution — change one file, measure one agent's output. Testing Gandalf → Gimli → Legolas in sequence breaks attribution. When a workflow scenario fails, you can't tell which file to improve. Individual agent evals are the right unit.

**One change per cycle.** Each iteration proposes and tests exactly one change to the target agent file. Multiple simultaneous changes make score improvements unattributable. The hypothesis comment is mandatory.

**Git as memory.** Every cycle commits to a worktree branch. Failed experiments are reverted but remain in history. The human reads `git log` in the morning to see what held.

**Hard assertions first, soft second.** Deterministic string-matching assertions produce clean signals. Qualitative voice assertions (LLM-as-judge) are slower and costlier — run them, but weight them lower in the pass rate calculation.

---

## Scope — Phase 1

Three agents: **Gandalf**, **Gimli**, **Legolas**. These are the critical path: every session goes through Gandalf, every build goes through Gimli, every critical-path build gets Legolas. High value, high testability.

Other agents (Pippin, Boromir, Merry, Arwen, Sam, Bilbo) added incrementally once the loop proves out.

---

## Directory Structure

```
evals/
  _runner/
    improve.sh              ← entry point: ./improve.sh <agent>
    README.md               ← how to run
  gandalf/
    scenarios.jsonl         ← 12-15 test inputs
    hard.py                 ← deterministic assertions
    soft.md                 ← qualitative assertions (LLM-as-judge)
    history.jsonl           ← pass rate log per run
  gimli/
    scenarios.jsonl         ← 10-12 task dispatch inputs
    hard.py                 ← format + behavior assertions
    history.jsonl           ← no soft.md — Gimli's output is fully deterministic
  legolas/
    scenarios.jsonl         ← 8-10 review inputs (Gimli DONE reports)
    hard.py                 ← structure + severity classification assertions
    history.jsonl

skills/autoimprove/
  SKILL.md                  ← the loop: read → eval → propose → test → keep/discard
```

---

## Assertions

### Gimli — `hard.py`

Gimli's output is highly structured. All assertions are deterministic.

**Format compliance:**
- `has_status_field` — "Status:" present in report
- `has_files_changed` — "Files changed:" present
- `has_verification` — "Verification:" present with actual content
- `no_vague_verification` — must not contain "it should work", "should be working", "seems to work", "appears to work"

**Behavior:**
- `no_mid_build_stop` — must not contain "shall I continue", "should I proceed", "let me know what you think" mid-report
- `no_unsolicited_scope_creep` — must not contain "I also went ahead", "while I was in there I also", "I also updated"
- `status_is_valid` — Status field value must be one of: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED

**Voice:**
- `no_corporate_narration` — must not contain "I'll go ahead and", "I went ahead and", "I've gone ahead"

### Gandalf — `hard.py` + `soft.md`

**Hard — forbidden phrases:**
- `no_survey_question` — must not contain "where do you want to start", "what would you like to work on", "how can i help you today", "what should we tackle"
- `no_preamble_announcement` — must not contain "i've reviewed the", "i have reviewed the", "based on the quest log", "i'll go ahead and", "let me go ahead"
- `no_corporate_phrases` — must not contain "sounds like", "makes sense", "that's fair", "totally", "on deck", "circle back", "loop you in", "move the needle"

**Hard — required elements:**
- `response_is_brief` — opening responses under 80 words (Gandalf is not verbose)
- `no_trailing_summary` — must not end with a sentence starting "In summary", "To summarize", "So to recap"

**Soft — LLM-as-judge (each returns TRUE/FALSE):**
- Does the response name a specific next step rather than offering a list of options?
- If this is a session opening, does it reference something specific from the provided context rather than being generic?
- Does the response avoid announcing what it is about to do before doing it?
- Is at least one sentence structured as: clause of context → short landing point?

### Legolas — `hard.py`

**Structure:**
- `has_status` — Status field is one of: APPROVED, APPROVED_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED
- `has_findings_section` — "Findings:" or "Issues:" section present
- `findings_have_severity` — each finding includes Critical/Important/Minor/Suggestion label
- `findings_reference_specifics` — at least one finding references a file name or line concept (not just abstract)

**Behavior:**
- `no_code_edits_proposed` — Legolas never proposes edits inline; must not contain "change line X to", "replace with", "here is the corrected"
- `no_vague_approval` — APPROVED status must not be accompanied by zero findings/observations

---

## Scenarios

### Gimli scenarios (`scenarios.jsonl`)

```jsonl
{"id":"gi001","input":"Add a null check to the parseConfig function in src/config.ts"}
{"id":"gi002","input":"Fix the failing test in tests/auth.test.ts — it errors on undefined user"}
{"id":"gi003","input":"Add email validation to the user registration form"}
{"id":"gi004","input":"Refactor the database connection to use a connection pool"}
{"id":"gi005","input":"Add request logging middleware to all API routes"}
{"id":"gi006","input":"The signup button is missing a loading state — add one"}
{"id":"gi007","input":"Extract the payment calculation logic into a separate utility function"}
{"id":"gi008","input":"Add rate limiting to the /api/auth/login endpoint"}
{"id":"gi009","input":"Fix the TypeScript error on line 42 of src/handlers/user.ts"}
{"id":"gi010","input":"Update the README installation steps — step 3 is outdated"}
```

### Gandalf scenarios (`scenarios.jsonl`)

```jsonl
{"id":"ga001","type":"session_start","context":"quest log: auth middleware 60% complete, Legolas review pending","input":"hey"}
{"id":"ga002","type":"session_start","context":"quest log: nothing active, recently completed user profile feature","input":"morning"}
{"id":"ga003","type":"routing_tier1","input":"fix the typo on the login button — it says 'Sigin' instead of 'Sign in'"}
{"id":"ga004","type":"routing_tier2","input":"add a loading spinner to the submit button on the checkout form"}
{"id":"ga005","type":"routing_tier3","input":"add Google OAuth login"}
{"id":"ga006","type":"routing_ambiguous","input":"can you clean up the codebase a bit"}
{"id":"ga007","type":"routing_ambiguous","input":"make the app faster"}
{"id":"ga008","type":"concern","input":"I think we should rewrite the whole auth layer from scratch"}
{"id":"ga009","type":"gimli_done","context":"Gimli just reported DONE — built auth middleware, all tests pass","input":"[DONE report received]"}
{"id":"ga010","type":"escalation","context":"Gimli reported BLOCKED — found that the change requires a new database table","input":"[BLOCKED report received]"}
{"id":"ga011","type":"planning","input":"I want to add a full subscription billing system"}
{"id":"ga012","type":"direct_question","input":"what's the difference between Tier 2 and Tier 3?"}
```

### Legolas scenarios (`scenarios.jsonl`)

Each scenario provides a simulated Gimli DONE report for Legolas to review.

```jsonl
{"id":"le001","task":"Add null check to parseConfig","report":"Status: DONE\n\nWhat was built:\n  Added null guard at top of parseConfig function.\n\nFiles changed:\n  src/config.ts\n\nVerification:\n  npm test — 14 passed, 0 failed"}
{"id":"le002","task":"Add rate limiting to /api/auth/login","report":"Status: DONE\n\nWhat was built:\n  Added express-rate-limit middleware to the login route, 5 requests per minute per IP.\n\nFiles changed:\n  src/routes/auth.ts\n  package.json\n\nVerification:\n  npm test — all tests pass"}
{"id":"le003","task":"Add email validation to registration form","report":"Status: DONE\n\nWhat was built:\n  Added email regex validation on the frontend form and server-side check in the API handler.\n\nFiles changed:\n  src/components/RegisterForm.tsx\n  src/api/users.ts\n\nVerification:\n  it should work correctly for valid and invalid emails"}
{"id":"le004","task":"Extract payment calculation into utility","report":"Status: DONE\n\nWhat was built:\n  Moved calculateTotal, applyDiscount, and computeTax into src/utils/pricing.ts. Updated all callers.\n\nFiles changed:\n  src/utils/pricing.ts (created)\n  src/components/Checkout.tsx\n  src/api/orders.ts\n\nVerification:\n  npm test — 22 passed, 0 failed. Ran existing tests only."}
{"id":"le005","task":"Add loading state to submit button","report":"Status: DONE\n\nWhat was built:\n  Added isLoading state to the checkout form submit button using existing Button component's loading prop.\n\nFiles changed:\n  src/components/CheckoutForm.tsx\n\nVerification:\n  Verified visually in browser — spinner appears on click."}
```

---

## The Loop — `skills/autoimprove/SKILL.md`

The skill the headless Claude agent reads and follows. One file encodes the full loop.

**Loop protocol:**

```
Given: target agent name (e.g. "gimli")

1. READ
   → agents/<target>.md          — the file being improved
   → evals/<target>/scenarios.jsonl  — test inputs
   → evals/<target>/hard.py          — deterministic assertions
   → evals/<target>/soft.md          — qualitative assertions (if present)
   → evals/<target>/history.jsonl    — previous pass rates (if exists)

2. BASELINE
   For each scenario:
     → Simulate: given this input and context, what would <target> respond?
     → Apply hard.py assertions → TRUE/FALSE per assertion
     → Apply soft.md assertions → judge each TRUE/FALSE (if present)
     → Record: {scenario_id, assertion_name, passed, response_preview}
   Calculate:
     → hard_score: % hard assertions passing
     → soft_score: % soft assertions passing (if present)
     → overall: (hard_score * 0.7) + (soft_score * 0.3)
   Log baseline to evals/<target>/history.jsonl

3. FIND TARGET
   → Which assertion is failing most often across scenarios?
   → That is the target for this cycle.

4. PROPOSE
   → Write ONE change to agents/<target>.md that addresses the failing assertion
   → Add comment above the change:
     "# hypothesis: [specific claim about what this change should fix]"
   → Change only ONE thing: one sentence, one example, one anti-pattern, one rule

5. EVALUATE
   → Re-run all scenarios against the changed version
   → Calculate new scores

6. DECIDE
   → If overall improved: git commit "exp: +N% [assertion_name] — [hypothesis summary]"
   → If worse or unchanged: git revert HEAD, log "discarded: [hypothesis] — no improvement"
   → Either way: append result to evals/<target>/history.jsonl

7. REPEAT
   → Go to step 3
   → Stop when: overall_score ≥ 85% OR 25 cycles completed OR no failing assertions remain

8. REPORT
   → Write summary to evals/<target>/session-summary.md:
     - Cycles run
     - Starting score → ending score
     - Changes that held (with commit hashes)
     - Changes that were discarded (with hypotheses)
```

---

## Runner — `evals/_runner/improve.sh`

```bash
#!/bin/bash
# Usage: ./evals/_runner/improve.sh <agent> [--cycles N]
# Example: ./evals/_runner/improve.sh gimli
#          ./evals/_runner/improve.sh gandalf --cycles 15

TARGET=${1:-gimli}
CYCLES=${3:-25}
BRANCH="autoimprove/${TARGET}-$(date +%Y%m%d-%H%M)"

echo "Starting autoimprove loop for: $TARGET"
echo "Branch: $BRANCH"
echo "Max cycles: $CYCLES"

# Create isolated worktree
git worktree add /tmp/fellowship-improve-${TARGET} -b ${BRANCH}

# Run the loop
claude --dangerously-skip-permissions --print \
  "Read skills/autoimprove/SKILL.md.
   Target agent: ${TARGET}.
   Max cycles: ${CYCLES}.
   Run the full improvement loop.
   Stop when done and write the session summary." \
  --cwd /tmp/fellowship-improve-${TARGET}

echo ""
echo "=== Morning review ==="
echo "Commits:"
git -C /tmp/fellowship-improve-${TARGET} log --oneline | grep "^exp:"
echo ""
echo "Diff:"
git -C /tmp/fellowship-improve-${TARGET} diff main -- agents/${TARGET}.md
echo ""
echo "To merge: git merge autoimprove/${TARGET}-* --no-ff"
echo "To discard: git worktree remove /tmp/fellowship-improve-${TARGET} --force"
```

---

## Pass Rate Scoring

Scores are disaggregated — format and voice tracked separately so regressions are visible:

```jsonl
// history.jsonl entry
{
  "run_id": "2026-03-29T02:14:00Z",
  "cycle": 7,
  "hard_score": 0.82,
  "soft_score": 0.61,
  "overall": 0.76,
  "top_failing_assertion": "no_survey_question",
  "change_applied": "Added survey question example to You Do Not Sound Like This section",
  "hypothesis": "Explicit named example of survey question failure will reduce frequency",
  "outcome": "kept",
  "commit": "a3f2c1d"
}
```

---

## Safety Boundary

- Loop runs entirely in a git worktree — live `agents/` files are never touched
- Every cycle commits or reverts — nothing is lost, nothing is hidden
- Human reviews and merges in the morning — loop proposes, human approves
- `--dangerously-skip-permissions` only in the worktree context, never in the live project

---

## Success Criteria — Phase 1

| Agent | Starting estimate | Target | Key assertions |
|---|---|---|---|
| Gimli | ~60% | ≥ 85% | Format compliance, no vague verification, no mid-build stop |
| Gandalf | ~45% | ≥ 75% | No survey questions, no preamble, named next step |
| Legolas | ~65% | ≥ 85% | Structure compliance, severity present, no inline code edits |

Gandalf's target is lower — voice register is genuinely harder to improve with synthetic scenarios. Phase 2 (real-usage feedback) will push him further.

---

## What Phase 2 Adds

Once Phase 1 is running:

A lightweight hook (`PostToolUse` + `UserPromptSubmit`) watches real sessions across any project and logs friction signals to `~/.claude/fellowship/feedback-log.jsonl`. Three signal tiers:

- **Explicit**: user says "no", "wrong", "not what I asked" after a companion response
- **Behavioral**: companion returns NEEDS_CONTEXT or BLOCKED; user edits a file right after companion wrote it
- **Routing**: user corrects a routing decision mid-session

The improvement loop then reads real failures as primary scenarios — synthetic scenarios remain as regression guards. The loop targets exact pain points from actual work, not imagined ones.

---

## Decisions

**Soft assertions use a fast model (Haiku) for LLM-as-judge calls.**
1,200+ judge calls per overnight run at Sonnet prices is unnecessary cost. Haiku handles simple binary voice assertions reliably. Constraint: keep soft assertions simple enough for Haiku — one plain sentence, no aesthetic judgment required. If an assertion can't be evaluated by a junior developer reading the response, simplify it or drop it.

**Runner supports `--all` for sequential overnight runs — but not on first use.**
`./improve.sh --all` runs Gimli → Gandalf → Legolas sequentially on separate worktrees, producing three independent branches and three clean diffs in the morning. Not parallel — no speed benefit, three simultaneous runs triple the cost unnecessarily. First two or three runs: individual agents only. Once the loop is proven, `--all` is the default.

**Both changes kept — the sequential loop design handles this correctly.**
Each cycle tests its change against the current running baseline. Change in cycle 5 was tested against the pre-cycle-5 state; change in cycle 8 was tested against the post-cycle-5 state. Each earned its place independently. The risk of semantic conflicts across many cycles is real — the session-summary.md per-cycle scores make this visible. If the score plateaus or dips after a run of improvements, read the full diff before merging rather than accepting blindly.
