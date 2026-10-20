---
name: investigate
description: "Use when diagnosing a bug, test failure, deploy issue, or any unexpected behavior. Systematic root-cause methodology: investigate → hypothesize → fix → verify. No fix without root cause. Load before proposing any fix."
user-invocable: false
---

# Investigate

Systematic root-cause methodology for bugs, test failures, deploy issues, and unexpected behavior. Load before proposing any fix.

## The Iron Law

**No fix without a root cause.** A symptom fix is a failure, even when it appears to work. If you cannot state the root cause in one sentence, you are not ready to fix.

Violating the letter of this process violates its spirit. Shortcuts produce code that breaks again, in a worse place, at a worse time.

## When to load this skill

Load when the task smells like any of these:

- A bug report, error trace, or crash.
- A failing test — unit, integration, browser, or CI.
- Unexpected output, wrong data, or silent misbehavior.
- A deploy failing, a build erroring, an environment misbehaving.
- A performance regression.

Load it **especially** when:

- Time pressure is pushing toward a guess.
- A previous fix did not stick.
- You have already tried two or more things without understanding why.

## The four phases

Work through the phases in order. Do not skip. Do not parallelize.

### Phase 1 — Investigate (find the root cause)

- Read the error message fully. Full stack trace, line numbers, error codes. Do not skim.
- Reproduce consistently. If you cannot trigger the failure reliably, gather more data before guessing. An unreliable repro is a signal the model is wrong.
- Check recent changes. `git diff`, recent commits, new dependencies, config changes. What changed that could have caused this?
- For multi-layer systems (request → service → DB, workflow → build → sign): add logging at each boundary, run once, read the evidence. Do not propose fixes before the evidence is in.
- Trace backward. If the bad value shows up deep in the stack, walk up. Where did it originate? Fix at source, not at symptom.

The phase ends when you can name the root cause in one sentence.

### Phase 2 — Hypothesize (one theory at a time)

- State the theory explicitly: *"I think X is the root cause because Y."* Write it down.
- One hypothesis, one test. Minimal change. One variable.
- If the test confirms → phase 3. If not → form a new hypothesis. Do **not** stack more fixes on top of the old one.
- If you do not understand something, say so. Ask. Research. Do not pretend — pretending compounds the original problem.

### Phase 3 — Fix (single change, single root cause)

- Write a failing test case first if the environment supports it. Automated if possible; a one-off script otherwise. The test locks in what "fixed" means.
- Implement one fix. One change. No "while I'm here" cleanup. No bundled refactoring.
- Verify: new test passes, no other tests broken, original symptom gone.

### Phase 4 — Escalation gate (the 3-fix ceiling)

- If fix #1 failed → return to phase 1 with the new evidence.
- If fix #2 failed → return to phase 1 again.
- **If fix #3 failed → stop. Do not attempt fix #4. Escalate to the user.**

Three failed fixes usually mean the architecture is wrong, the reproduction is wrong, or the hypothesis frame is wrong. None of those are fixed by a fourth guess.

**Escalation format:** state what was tried, what was ruled out, what you still do not understand. Let the user decide whether to keep digging or change approach.

## Red flags — stop and return to phase 1

If you catch yourself saying any of these, you are skipping the process:

- "Quick fix for now, investigate later."
- "Just try changing X and see if it works."
- "It's probably X, let me fix that."
- "I don't fully understand, but this might work."
- Proposing a solution before reading the full error.
- "One more fix attempt" after two or more failures.

These are not strategies. They are rationalizations for guessing. When one shows up, return to phase 1.

## On resolution — log to the debug log

After resolving a non-obvious debugging session, append one entry to `docs/fellowship/debug-log.md`. The format lives in `agents/gimli.md` (see the "Debug Log" section) — do not redefine it here.

**Filter before writing.** Only log non-obvious root causes. Missing imports, typos, and anything the error message told you plainly do not belong.

The test: *would the next session benefit from this entry, or is it noise?* If you're not sure, it's noise. Leave it out.

Append, never overwrite. Create `docs/fellowship/debug-log.md` if it does not exist.

## Pair with the plan-before-build gate

Once the root cause is known, if the fix is non-trivial — more than five minutes of work, multiple files, or new logic — the existing plan-file requirement still applies. Investigation does not bypass the plan gate. It feeds it. The plan now has a confirmed root cause to reference.

## Related skills

- `brainstorming` — if investigation reveals the bug is a symptom of a missing design decision, escalate there instead of fixing.
- `planning` — if the fix is large enough to warrant a written plan.
- Agent debug-log entries (Gimli, Pippin, Sam each own guidance for their own domain).
