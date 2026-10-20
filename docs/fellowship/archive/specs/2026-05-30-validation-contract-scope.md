---
name: validation-contract-scope
status: archived
created: 2026-05-30
author: aragorn
type: prd
---

# Validation Contract — Scope

A scope read and requirements document for the **validation contract** capability. This document defines the WHAT. The HOW — file format, block syntax, where it physically lives — is Merry's to design after this locks.

## Scope Read

**The request.** Steal Factory's insight: a definition-of-done authored at plan time, as assertions independent of implementation, that fresh-context validators (Legolas, Boromir, Pippin) score against adversarially. Close the gap where "the companion who builds a thing also tests it" — the weaker pattern.

**What product.md says.** Solo product developers shipping real products. Two principles bind this hardest:
- *The Ring must not grow heavier.* Every addition is a burden. Scope is sacred.
- *Use the platform.* Build on what Claude Code and Fellowship already provide; do not reimplement.

**The honest read — we have 80% already.** This is the central finding and it shapes everything below.

| Capability the contract needs | Where it already lives | Gap |
|---|---|---|
| Per-task acceptance criteria | `skills/planning/SKILL.md` L110–113 (`- [ ]` criteria) | Authored as confirmation, not adversarially. No P0/P1/P2 weight. |
| Exact verify-commands | `skills/planning/SKILL.md` L115–117 (`Run: X → Expected: Y`) | Exists per-task. Not consolidated into a single scoreable contract. |
| Fresh-context validators | Legolas (reviews vs. spec + judgment), Boromir (security audit), Pippin (tests from spec, not code) | They check against *the spec and their own judgment*, not against a pre-written assertion set authored to be adversarial. |
| State/status layer | `2026-05-15-project-state-contract.md` — status frontmatter, quest log | Tracks artifact lifecycle. Says nothing about whether the *contract passed*. |

The 20% that is genuinely missing:
1. **Adversarial authoring discipline** — assertions written to *catch* the build, not confirm it. The planning skill's criteria lean confirmatory ("tests pass").
2. **A single consolidated assertion set per quest** — today criteria are scattered per-task; no quest-level definition-of-done that a validator scores in one pass.
3. **An explicit consumption protocol** — validators are told "check against the spec." They are not told "score against these N assertions and report each PASS/FAIL/UNTESTABLE." The contract becomes the checklist, not prose they re-derive.

**Verdict: this is an *enrichment*, not a new artifact and not a rename.** It enriches the planning skill's output (better assertions) and enriches the validator dispatch (score-against-contract protocol). It is not a `contract.yaml`. See the Cluster E note below — that is a different "contract" entirely.

### Scope smells caught

| Smell | Where it wants to creep in | Held line |
|---|---|---|
| New-artifact creep | "validation contract" sounds like it wants its own `contract.yaml` + DSL + enforcement engine | It does not. The MVP is a structured *block inside the plan*, scored by a *protocol in the dispatch*. No new file type. |
| Speculative future | "We'll want scoring rubrics, weighted pass thresholds, machine-parsed PASS gates" | Out. v1 is prose assertions scored by a fresh-context companion reporting PASS/FAIL/UNTESTABLE. No machine parsing. |
| Premature generalization | "Make it work for every workflow recipe and every artifact type" | v1 targets `feature-flow` and `bug-flow`. `security-flow` reuses it with Boromir; no special-casing in v1. |
| Want-as-need | "Validators should auto-loop until the contract passes" | The loop already exists (Legolas↔Gimli cycle). The contract feeds it; it does not replace it. |

## Locked Decisions

These cascade downstream. Merry designs within them; she does not relitigate them.

- **D-01: The validation contract is an enrichment of the existing plan artifact, not a new file.** It is a named section inside the quest log / plan (`docs/fellowship/plans/`), authored at plan time. No `contract.yaml`, no DSL, no separate file in v1.
- **D-02: Granularity is per-quest, with assertions traceable to features.** One consolidated assertion set per plan — the quest's definition-of-done. Each assertion may cite the task/feature it covers, but the validator scores the *set*, not per-task fragments.
- **D-03: Assertions are prose, scored by a fresh-context companion.** No machine-parsed gate in v1. The validator reads the assertion set and reports each as PASS / FAIL / UNTESTABLE with evidence. "The contract passes" = every P0 assertion PASS, no P0 FAIL.
- **D-04: Authored by the planning skill, with Aragorn's acceptance criteria as the seed.** Aragorn produces P0/P1/P2 acceptance criteria during scope (already his job). The planning skill consolidates them into the contract block and sharpens them into adversarial assertions. Where no Aragorn pass ran (Tier 2 direct), the planning step authors them from the spec.
- **D-05: Consumed by the existing validators against an explicit scoring protocol.** Legolas (correctness/spec), Pippin (test-expressible assertions), Boromir (security assertions) each receive the contract in their dispatch and report assertion-by-assertion. The dispatch tells them to score the contract — not to re-derive done-ness from prose.
- **D-06: P0 is the gate. P1/P2 are tracked, not blocking.** A quest closes when all P0 assertions are PASS. P1/P2 FAILs become quest-log entries, not blockers — consistent with "the Ring must not grow heavier."

## What a Validation Contract IS

> A validation contract is the quest's definition-of-done, authored at plan time as a set of weighted, implementation-independent assertions, that fresh-context validators score one-by-one — PASS, FAIL, or UNTESTABLE — to decide whether the quest is actually complete.

One more sentence for the builder: it lives as a named section in the plan, its assertions are written to *catch* a wrong build rather than confirm a right one, and "the contract passes" means every P0 assertion is PASS with cited evidence.

## Anatomy — What It Contains

A contract is a list of **assertions**. Each assertion has:

- **Statement** — a single observable claim about the finished system, phrased as something that is true or false. *"An unauthenticated request to `/api/orders` returns 401."* Not *"auth works."*
- **Weight** — P0 (gate — quest does not close if this fails), P1 (important — tracked, not blocking), P2 (nice-to-have).
- **Verification handle** — how a fresh-context validator would check it: an exact command, a test to write, or a manual walk-through step. Reuses the planning skill's existing `Run: X → Expected: Y` shape where a command exists.
- **Owner-validator** — which validator is best placed to score it: Legolas (correctness/spec/structure), Pippin (test-expressible behavior), Boromir (security property). Assigned at author time; the dispatch routes accordingly.

**What makes an assertion good vs. checkbox theater:**

| Good assertion | Checkbox theater |
|---|---|
| Observable and binary — a fresh reader can score it without asking | *"Code is clean and maintainable"* — unscoreable |
| Implementation-independent — survives a rewrite of the code | *"The `validateOrder` function returns early on null"* — couples to internals |
| Adversarial — phrased to expose the failure mode, names the unhappy path | *"Tests pass"* — confirms, never catches |
| Traceable — cites the feature/requirement it defends | floating assertion with no source decision |
| Negative cases present — *what must NOT happen* alongside *what must* | only happy-path claims |

The discriminator: **could a validator who never saw the code mark this PASS or FAIL from evidence alone?** If not, it is theater — rewrite or drop it.

## When and By Whom It Is Authored

Placement in the existing flow:

```
brainstorm → [Aragorn scope: P0/P1/P2 acceptance criteria]
           → [planning skill: consolidate criteria into the contract block, sharpen to adversarial assertions]
           → quest log / plan (contract lives here as a named section)
           → build → validators score the contract → close
```

- **Aragorn** (scope step) seeds it — he already produces P0/P1/P2 acceptance criteria. No new step for him; his criteria become the contract's raw material.
- **The planning skill** authors the contract block — consolidates Aragorn's criteria into one per-quest set, adds verification handles and owner-validators, and applies the adversarial test ("could this catch a wrong build?").
- **Lands in the plan** (`docs/fellowship/plans/YYYY-MM-DD-<feature>.md`) as a `## Validation Contract` section, before any code exists. This is the load-bearing constraint stolen from Factory: authored *before* the build.

## Who Reads It and When

After the build, during validation:

- **Legolas** receives the contract in his dispatch. In addition to his existing spec-compliance and structural review, he scores each correctness/spec assertion he owns: PASS / FAIL / UNTESTABLE, with file:line evidence. A FAIL on a P0 assertion is a Critical finding by definition.
- **Pippin** receives the test-expressible assertions as his contract — he already writes tests from the spec, not the code. The contract gives him the exact assertion set instead of re-deriving it. Each becomes a test; the result maps to PASS/FAIL.
- **Boromir** (security-flow) scores the security-property assertions against his audit.
- **UNTESTABLE** is a first-class outcome: a validator who cannot score an assertion without breaking an abstraction barrier says so, with the reason. An assertion that is repeatedly UNTESTABLE is a bad assertion — feeds back to authoring.

**"The contract passes"** = every P0 assertion is PASS, zero P0 FAIL. P1/P2 FAILs are logged as quest-log entries, not gates.

## Relationship to What Exists

- **Planning skill (`skills/planning/SKILL.md`):** enriched. Per-task acceptance criteria + verify-commands remain; the contract consolidates them into a quest-level adversarial set. The skill gains an authoring step, not a rewrite.
- **Status frontmatter / state contract (`2026-05-15-project-state-contract.md`):** orthogonal. State contract tracks *artifact lifecycle* (active→implemented→reviewed→archived). Validation contract tracks *whether the work is correct*. A plan can be `status: implemented` and still have FAILing P0 assertions — that is exactly the signal we want to surface.
- **Validators (Legolas/Pippin/Boromir):** their dispatch gains a "score this contract" instruction and their report gains an assertion-by-assertion block. No change to their character or core methodology — Pippin already tests from spec; this hands him the spec as assertions.

### Cluster E note — no substantive overlap

The deferred Cluster E item (`/fellowship:reconcile` + `contract.yaml`, quest-log 2026-05-24) is the **state contract** made machine-readable — canonical tree, retired paths, naming pattern. It is a different "contract." The word collides; the substance does not. Recommendation: name this artifact a **validation contract** consistently to avoid confusion, and Merry should NOT fold it into `contract.yaml`. They are separate concerns that happen to share a noun.

### Dependency on open quest-log items

- **end-to-end orchestration fixture** (v1.1) and **eval scenarios for workflow routing** (v1.1): the validation contract *feeds* these. A fixture quest with a known-good contract is the natural way to test that validators score it correctly. This capability gives those fixtures their assertion sets — a healthy dependency, not a blocker. Note it; do not gate on it.

## MVP — Smallest Version That Delivers The Core Value

The core value is exactly one thing: **adversarial validators check against pre-written assertions.** The least that delivers it:

1. A `## Validation Contract` section in the plan template — a list of assertions, each with statement, weight (P0/P1/P2), verification handle, owner-validator.
2. The planning skill authors it from Aragorn's acceptance criteria, applying the adversarial test.
3. Validator dispatch instruction: "score each assertion you own — PASS / FAIL / UNTESTABLE with evidence."
4. Validator report gains an assertion-scoring block.
5. Pass rule: all P0 PASS → contract passes.

That is the whole MVP. No file format, no DSL, no machine parsing, no auto-loop, no new command, no `contract.yaml`. Prose assertions, authored at plan time, scored by fresh context. Everything past that is v2.

## In Scope vs. Out of Scope

| In scope (v1) | Out of scope |
|---|---|
| `## Validation Contract` section inside the plan artifact | Standalone `contract.yaml` or any new file type → v2 if ever |
| Prose assertions with P0/P1/P2 weight | Machine-parsed PASS gates / scoring rubrics → v2 |
| Authoring by planning skill from Aragorn's criteria | A dedicated authoring command or skill → not needed |
| Per-assertion PASS/FAIL/UNTESTABLE scoring in validator reports | Automated loop "until contract passes" — existing cycle already loops |
| `feature-flow` and `bug-flow` coverage | Per-workflow special-casing; `security-flow` reuses the same block with Boromir |
| Owner-validator routing (Legolas/Pippin/Boromir) | A scoring DSL or enforcement engine |
| Negative-case assertions (what must NOT happen) | Computer-control / live-environment QA beyond Pippin's existing browser-verify |

## Acceptance Criteria — For The Feature Itself

How we will know we built the right thing.

**P0:**
- [ ] The plan template contains a `## Validation Contract` section with the four-field assertion anatomy (statement, weight, verification handle, owner-validator).
- [ ] `skills/planning/SKILL.md` instructs the skill to author the contract from Aragorn's P0/P1/P2 acceptance criteria, applying the adversarial test.
- [ ] At least Legolas's and Pippin's dispatch + report protocols are updated to score the contract assertion-by-assertion (PASS/FAIL/UNTESTABLE with evidence).
- [ ] "The contract passes" is defined unambiguously: all P0 assertions PASS, zero P0 FAIL.
- [ ] A sample contract on one real quest demonstrates an assertion that would catch a plausible wrong build — proving it is adversarial, not confirmatory.

**P1:**
- [ ] UNTESTABLE is documented as a first-class outcome with a required reason.
- [ ] Boromir's protocol scores security-property assertions in `security-flow`.
- [ ] P1/P2 FAILs route to quest-log entries rather than blocking.

**P2:**
- [ ] The end-to-end orchestration fixture (v1.1) uses a validation contract as its assertion set.

## Open Questions For Merry

- **Where exactly does the contract block live, and does it stay in the plan or get promoted to its own artifact under `plans/`?** D-01 locks it as a plan section for v1. If Merry's design shows the validator dispatch is cleaner with a standalone reference, that is a v2 conversation — but flag it now if the per-quest scoring protocol makes the in-plan placement awkward to consume.
