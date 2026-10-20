# Spec: `skills/investigate/` — Systematic Debugging Methodology

**Defined:** 2026-04-20
**Author:** Aragorn (product)
**Implements:** Gap surfaced in `docs/fellowship/reference-implementations.md` lines 319–323
**Builder:** Gimli (next)

---

## Goal

Give any companion a shared, lean methodology for diagnosing bugs, test failures, and unexpected behavior — rooted in finding the root cause *before* proposing fixes. One skill, loaded on demand, usable by Gimli (code bugs), Pippin (test failures), and Sam (deploy/infra issues).

This is not a new process. It is the discipline the Fellowship already aspires to, distilled into a file that can be loaded into an agent's context at the moment it is needed.

## Why this skill exists

- **Validated gap.** Our reference-implementations audit identified systematic debugging as the single largest methodology gap for Gimli. Superpowers has it (`systematic-debugging`, 297 lines). gstack has it (`investigate`, 971 lines). We have none — only an implicit "verify your work" note in engineering guidance.
- **Cross-cutting by nature.** Bugs show up in code (Gimli), in tests (Pippin), and in deployments (Sam). A skill is the right shape — not agent-specific craft.
- **Pairs with existing gates.** Gimli already writes a plan file before coding and appends to `docs/fellowship/debug-log.md` after a non-obvious debug session. This skill fits between those two — it governs *how* the investigation happens, and feeds the debug-log entry at the end.

## Scope

### In scope

- A prescriptive 4-phase methodology: investigate → hypothesize → fix → verify.
- An Iron Law: no fix without root-cause investigation.
- A 3-failed-fix escalation ceiling — stop guessing, return to the user.
- A short "red flags" list of rationalizations that mean *return to phase 1*.
- Integration with the existing `docs/fellowship/debug-log.md` format (already defined in `agents/gimli.md` lines 154–167). The skill references the format; it does not redefine it.
- Integration with the existing plan-before-build gate. If investigation reveals implementation work >5 min, Gimli's existing plan-file requirement still applies.

### Out of scope

| Excluded | Reason |
|---|---|
| Deep diagnostic subtechniques (backward-tracing call stacks, defense-in-depth, condition-based waiting) | Superpowers ships these as supplementary files. We are not shipping three extra files. If a technique proves load-bearing in practice, add it later — do not pre-build. |
| Character voice | Skills are loaded into agents whose voice we already preserve. No Aragorn/Gimli phrasing in the skill file. |
| Telemetry, session preambles, config gates, routing injection | gstack's `/investigate` carries 800+ lines of this. None of it is ours. Skip. |
| A separate slash-command (`/fellowship:investigate`) | This is methodology, not a user-invocable workflow. Loaded by an agent mid-task. No frontmatter trigger. |
| Redefining the debug-log format | Already lives in `agents/gimli.md`. The skill links to it. |

### Deferred (v2 candidates)

- Multi-component boundary-instrumentation examples (log what enters each layer). Useful for Sam's deploy work but adds ~30 lines. Revisit if a real Sam investigation session needs it.
- A "re-investigate the architecture" guide for 3+ failed fixes (currently: "stop, escalate to user" — plain). Revisit if the 3-fix ceiling proves insufficient in practice.

## Skill frontmatter

```yaml
---
name: investigate
description: "Use when diagnosing a bug, test failure, deploy issue, or any unexpected behavior. Systematic root-cause methodology: investigate → hypothesize → fix → verify. No fix without root cause. Load before proposing any fix."
---
```

Notes for Gimli building this:
- No `user-invocable: true` — this is a methodology skill, not a slash command.
- No `trigger:` — agents load it themselves when the task smells like debugging.
- The `description` is how companions decide to load it. Lead with the trigger condition. Keep it one sentence plus the iron-law reminder. This is the only field the loader sees before deciding to pull the skill in.

## Section outline

The skill should land in the **120–180 line** range. Target ≤200. If Gimli finds himself writing past 180, cut.

### 1. Iron Law (3–5 lines)

One explicit statement: **no fixes without root-cause investigation first.** Symptom fixes are failure. Violate the letter of the process = violate the spirit.

Draw on: Superpowers `systematic-debugging` lines 17–22. Shorter.

### 2. When to load this skill (5–10 lines)

Bullet list of triggers: bug reports, test failures, unexpected output, deploy failures, build errors, performance regressions. Plus a "load it especially when" note — time pressure, previous fix didn't stick, you've already tried 2+ things.

### 3. The four phases (bulk of the skill — ~80–110 lines)

Each phase ~20–25 lines. Prescriptive, not descriptive.

**Phase 1 — Investigate (find the root cause)**
- Read the error message fully. Stack trace, line numbers, error codes. Do not skim.
- Reproduce consistently. If you cannot trigger it reliably, gather more data — do not guess.
- Check recent changes. `git diff`, recent commits, new dependencies, config changes. What changed that could have caused this?
- For multi-layer systems (request → service → DB, workflow → build → sign): add logging at each boundary, run once, read the evidence. Do not propose fixes before the evidence is in.
- Trace backward. If the bad value is deep in the stack, walk up. Where did it originate? Fix at source, not at symptom.

**Phase 2 — Hypothesize (one theory at a time)**
- State it explicitly: *"I think X is the root cause because Y."* Write it down.
- One hypothesis → one test. Minimal change. One variable.
- If the test confirms → move to phase 3. If not → form a new hypothesis. Do **not** stack more fixes.
- If you do not understand something, say so. Ask. Research. Do not pretend.

**Phase 3 — Fix (single change, single root cause)**
- Write a failing test case first if the environment supports it. Automated if possible; a one-off script otherwise. This locks in what "fixed" means.
- Implement one fix. One change. No "while I'm here" cleanup. No bundled refactoring.
- Verify: test passes, no other tests broken, original issue gone.

**Phase 4 — Escalation gate (the 3-fix ceiling)**
- If fix #1 failed → return to phase 1 with the new evidence.
- If fix #2 failed → return to phase 1 again.
- **If fix #3 failed → stop. Do not attempt fix #4. Escalate to the user.**
- Three failed fixes usually means the architecture is wrong, the reproduction is wrong, or the hypothesis frame is wrong. None of those are fixed by a fourth guess.
- Escalation format: state what was tried, what was ruled out, what you still do not understand. Let the user decide whether to keep digging or change approach.

### 4. Red flags — STOP and return to phase 1 (10–15 lines)

Short bullet list of the rationalizations that mean *you are skipping the process*:

- "Quick fix for now, investigate later."
- "Just try changing X and see if it works."
- "It's probably X, let me fix that."
- "I don't fully understand but this might work."
- Proposing solutions before reading the full error.
- "One more fix attempt" after 2+ failures.

Draw on: Superpowers lines 217–233. Prune to the ~6 most common.

### 5. On resolution — log to the debug log (8–12 lines)

Point to the existing format in `agents/gimli.md` lines 154–167. Do not redefine it. Reiterate the filter: **only non-obvious root causes.** Missing imports and typos do not belong. Frame the test: *would the next session benefit from this entry, or is it noise?*

Append, never overwrite. Create `docs/fellowship/debug-log.md` if it does not exist.

### 6. Pair with the plan-before-build gate (5 lines)

Once the root cause is known, if the fix is non-trivial (>5 min of work, touches multiple files, or introduces new logic), Gimli's existing plan-file requirement still applies. Investigation does not bypass the plan gate — it *feeds* it. The plan file now has a confirmed root cause to reference.

### 7. Related skills / where to go next (3–5 lines)

One short list:
- `brainstorming` — if investigation reveals the bug is a symptom of a missing design decision, escalate to brainstorming.
- `planning` — if the fix is large enough to warrant a plan.
- The agent's own debug-log entry (Gimli, Pippin, Sam each already have guidance).

Do not cross-reference skills we have not built.

## Prescriptive style notes for the builder

- **No character voice.** Imperative mood. "Read the error message fully." Not "Aragorn reads errors fully."
- **No AI filler.** No "it's crucial to", "comprehensive", "robust", "delve". The project's writing discipline applies.
- **Concrete verbs.** "Reproduce," "check," "add logging," "verify." Not "assess," "consider," "explore."
- **Short sentences.** One idea per line where possible.
- **No tables unless they earn their keep.** Prose is usually shorter.
- **No emojis.**

## Open questions for Frodo

1. **Debug-log location.** Currently `docs/fellowship/debug-log.md`, owned by Gimli. Pippin and Sam will both start appending here when this skill ships. Confirm: single shared file, or per-agent files? *Counsel: single file. One place to read "has anyone seen this before" beats three.*
2. **Skill name.** `investigate` is shorter and matches gstack. `systematic-debugging` is more explicit and matches Superpowers. The skill file lives at `skills/investigate/SKILL.md` either way — only the `name:` frontmatter field differs. *Counsel: `investigate`. Shorter. Consistent with how companions will refer to it in prose.*
3. **The 3-fix ceiling — hard rule or guideline?** gstack has no such ceiling. Superpowers makes it a rule but allows a phase-4.5 architectural re-examination. *Counsel: hard rule for v1. If it bites, loosen in v2. Easier to relax a rule than to retrofit one.*

## Acceptance criteria (for Legolas to verify after Gimli builds)

- [ ] File exists at `skills/investigate/SKILL.md`.
- [ ] Line count ≤200.
- [ ] Frontmatter has `name` and `description` only — no `user-invocable`, no `trigger`.
- [ ] Iron Law stated explicitly in the first section.
- [ ] All four phases present with the prescriptions listed above.
- [ ] 3-failed-fix escalation rule present and unambiguous.
- [ ] Red-flags section lists at least 5 rationalizations.
- [ ] Debug-log integration references `agents/gimli.md` format — does not redefine it.
- [ ] No character voice, no AI vocabulary, no emojis.
- [ ] Does not reference skills that do not exist in `skills/`.
