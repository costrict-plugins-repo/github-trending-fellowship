---
name: adr-validation-contract
status: archived
implemented_by: gimli
reviewed_by: legolas
created: 2026-05-30
author: merry
type: adr
decision: Validation contract lives as a `## Validation Contract` section inside the plan; validators score it via an explicit assertion-by-assertion protocol carried in the dispatch.
---

# ADR — Validation Contract: Placement, Assertion Shape, Consumption Protocol

**Input:** `docs/fellowship/specs/2026-05-30-validation-contract-scope.md` (Aragorn's locked scope).
**Status of decisions D-01 through D-06:** locked by Aragorn, honored here, not relitigated.

This ADR resolves the three HOW questions Aragorn left open: where the contract physically lives, the exact shape of one assertion, and the contract between Gandalf's validator dispatch and the validator.

---

## Context

The validation contract is an **enrichment**, not a new artifact. ~80% already exists: planning emits acceptance criteria + verify-commands; status frontmatter is the state layer; Legolas/Pippin/Boromir are already fresh-context validators reading the spec. The missing 20% is three seams:

1. Adversarial authoring — assertions written to *catch*, not confirm.
2. A consolidated per-quest assertion set — one place that says "done when all of these hold."
3. An explicit consumption protocol — validators score assertion-by-assertion (PASS/FAIL/UNTESTABLE with evidence) rather than re-deriving done-ness from prose.

The architecture must add these three seams and nothing more. The binding constraint from `product.md`: the Ring must not grow heavier. Every shape below is chosen for the load that has arrived, not a load that might.

---

## Decision 1 — Placement: in-plan section. D-01 holds, and the evidence strengthens it.

**The sharpest question Aragorn left:** does the per-quest scoring protocol make in-plan placement (D-01) awkward to consume? If a standalone reference under `plans/` makes the dispatch materially cleaner, that is the one place file-placement could bend.

**I traced the dispatch.** Resolved against evidence, not preference.

### What a validator dispatch actually carries today

From `cycles.md` (Review Cycle, step 1): Legolas is dispatched with *"Gimli's report + original spec + git SHAs + content of `docs/fellowship/codebase-map.md`."* From the shared protocol: the `<files_to_read>` block is the deterministic loading contract — Gandalf lists every path the validator must read.

The plan path is **already** in that block — the quest log is where tasks and assignments live; the validator already needs it to know what was built. The spec path is **already** in that block.

### The two routes, traced

| | In-plan `## Validation Contract` section (D-01) | Standalone reference under `plans/` |
|---|---|---|
| Paths Gandalf passes in `<files_to_read>` | The plan path — **already present**. Zero new paths. | The plan path **plus** a new contract path. One new path. |
| Validator read cost | Read one section of a file already being read. | Read one additional file. |
| Sync seams | One — the contract sits beside the tasks it scores. | **Two** — the contract and the plan it was extracted from must be kept consistent (assertions cite tasks; tasks move). |
| Author cost (planning skill) | Append a section to the file it is already writing. | Write a second file, cross-link it, keep the link live. |
| Drift risk | Low — assertions and the tasks they defend cannot drift apart; they share a file. | Higher — the classic two-artifact divergence the *if-wrong* test exists to catch. |

**The dispatch-cleanliness argument for a standalone reference does not hold.** The validator receives a path either way. Reading a named section of a file Gandalf already passes is not materially harder than reading a separate file — and the standalone route costs *one more path to pass* and *one more seam to keep in sync*. The cleaner consumption is the in-plan section, not the reference.

**Decision: the validation contract is a `## Validation Contract` section inside the plan (`docs/fellowship/plans/YYYY-MM-DD-<feature>.md`).** D-01 holds. The evidence strengthens it; it does not bend it.

**If wrong:** the assumption is *the contract stays small enough that a section inside the plan is readable.* If a future quest produces an assertion set so large the plan becomes unwieldy to navigate, the section gets promoted to a sibling file — a mechanical extraction, one path added to the dispatch, no protocol change. That is a v2 conversation, marked here so no one re-debates it. The cost of being wrong is one file split, not a rebuild. Cheap to reverse — which is exactly why the simpler shape wins now.

---

## Decision 2 — Assertion shape: four fields, prose, scored by judgment. D-02/D-03 honored.

One assertion is the atomic unit. Aragorn's anatomy (statement / weight / verification handle / owner-validator) is the right four fields. I lock their *exact in-plan form* so Gimli has no ambiguity and the planning skill has a template to emit.

### The shape

Each assertion is a list item with four labeled parts. The format reuses the planning skill's existing `Run: X → Expected: Y` shape for the verification handle where a command exists — no new syntax invented.

```markdown
## Validation Contract

> The quest is done when every P0 assertion below is PASS, with cited evidence, and zero P0 assertions are FAIL. P1/P2 FAILs are logged to the quest log, not gates.

- **[P0] [Legolas]** An unauthenticated request to `POST /api/orders` returns 401, never reaching the order handler.
  - Verify: `curl -i -X POST localhost:3000/api/orders` → Expected: `HTTP/1.1 401`, no row written to `orders`.
  - Defends: requirement R-2 (auth gate on mutations).

- **[P0] [Pippin]** A login with a valid email and wrong password returns 401 and does NOT issue a session cookie.
  - Verify: test — `POST /api/login` with bad password → assert 401 AND `Set-Cookie` absent.
  - Defends: requirement R-1 (credential check).

- **[P0] [Boromir]** A JWT presented with `alg: none` is rejected at parse time; no token with an unsigned algorithm is ever accepted.
  - Verify: test — forge `{alg:none}` token, present to `/api/orders` → assert 401.
  - Defends: requirement R-3 (token integrity).

- **[P1] [Pippin]** A session expires after 24h; a request with a 25h-old token returns 401.
  - Verify: test — mint token with `iat` 25h in past → assert 401.
  - Defends: requirement R-4 (session lifetime).

- **[P2] [Legolas]** Failed-login responses do not leak whether the email exists (same body and timing class for unknown-email vs. wrong-password).
  - Verify: manual — compare both responses; bodies identical.
  - Defends: requirement R-5 (enumeration resistance).
```

### Field rules

- **Weight** — `[P0]` / `[P1]` / `[P2]`, leading the line. P0 is the gate (D-06). Visible at a glance so a validator scoring the set sees the gate set first.
- **Owner-validator** — `[Legolas]` / `[Pippin]` / `[Boromir]`, second. This is the *routing key* the dispatch reads (Decision 3). Assigned at author time per Aragorn's anatomy:
  - **Legolas** — correctness, spec-compliance, structural, observable-from-code.
  - **Pippin** — anything expressible as a test assertion (the bulk).
  - **Boromir** — security-property assertions (in `security-flow`; in `feature-flow` these route to Legolas or are absent).
- **Statement** — one observable, binary claim. Implementation-independent (survives a rewrite). **At least one P0 must name an unhappy path** — the adversarial discriminator. The worked example carries three negatives (401 on no-auth, no cookie on bad password, reject `alg:none`) — that is what makes it catch rather than confirm.
- **Verification handle** — `Verify:` line. A command (reuse `Run: X → Expected: Y`), a test to write, or a manual step. This is what makes the assertion scoreable by someone who never saw the code.
- **Defends** — `Defends:` line citing the requirement/task. Traceability (D-02): the validator can trace the assertion to its source; an assertion that defends nothing is a candidate to drop.

**The discriminator, restated for the authoring skill:** could a validator who never saw the code mark this PASS or FAIL from the `Verify:` line alone? If not, it is theater — rewrite or drop.

---

## Decision 3 — Consumption protocol: routing key + scoring block + composition rule. D-05/D-06 honored.

The protocol is the contract between Gandalf's dispatch and the validator. Three parts.

### 3a. What Gandalf passes (dispatch → validator)

No new dispatch *channel* — the plan path is already in the `<files_to_read>` block (Decision 1). The dispatch gains **one instruction**:

> *Score the `## Validation Contract` assertions marked `[<your-name>]`. For each, report PASS / FAIL / UNTESTABLE with evidence. A FAIL on a P0 assertion is a Critical finding by definition.*

The owner-validator tag is the routing key: Legolas scores `[Legolas]` assertions, Pippin scores `[Pippin]`, Boromir scores `[Boromir]`. A validator ignores assertions not tagged to them. This is how multiple validators partition one contract without collision — the partition is authored into the assertions, not negotiated at dispatch.

### 3b. What the validator returns (validator → Gandalf)

Each validator's existing report gains one block, the **Contract Scoring** block:

```
Contract scoring:
  [P0] An unauthenticated POST /api/orders returns 401 — PASS
       Evidence: middleware/auth.ts:22 rejects pre-handler; curl returns 401, no orders row.
  [P0] Valid email + wrong password returns 401, no cookie — FAIL
       Evidence: login.ts:40 sets Set-Cookie before password check. Critical (P0 FAIL).
  [P1] Session expires after 24h — PASS
       Evidence: token.test.ts:18 — 25h-old token rejected.
```

Three outcomes, all first-class:
- **PASS** — evidence cited (file:line, test name, or command output).
- **FAIL** — evidence of the failure. A P0 FAIL is a Critical finding and routes into the existing review cycle (Gimli fixes, re-review).
- **UNTESTABLE** — the validator cannot score it without breaking an abstraction barrier; **a reason is required** (D-03, P1 acceptance criterion). An assertion repeatedly scored UNTESTABLE is a bad assertion — that signal feeds back to authoring, it does not silently pass.

This block maps onto the **existing status vocabulary** — no new status code. A P0 FAIL produces `CHANGES_REQUESTED` (Legolas/Boromir) or surfaces as a finding (Pippin) exactly as today. The contract sharpens *what* gets reported; it does not change the report's verdict codes.

### 3c. How partial scores compose into a quest verdict (Gandalf-side)

Gandalf already consolidates validator reports. The composition rule is one line he applies:

> **The contract passes when every P0 assertion has a PASS from its owner-validator, and zero P0 assertions are FAIL.** P1/P2 FAILs and any UNTESTABLE-on-P0 become quest-log entries; P1/P2 do not gate.

A P0 scored UNTESTABLE is **not a pass** — it is an unscored gate. Gandalf treats it as a hole: either the assertion is rewritten so it can be scored, or Frodo accepts the gap explicitly. This closes the loophole where "I couldn't test it" silently clears the gate.

This is thin determinism: the *rule* is mechanical (all P0 PASS), the *scoring* is judgment (prose read by fresh context). No parser, no DSL, no machine gate — consistent with D-03 and the "intelligence in prose" constraint.

---

## Approaches considered and rejected

| Approach | Why rejected |
|---|---|
| Standalone `plans/contract-<feature>.md` reference | Decision 1 — adds a path and a sync seam for no dispatch-cleanliness gain. |
| New status code for contract verdicts (e.g. `CONTRACT_FAILED`) | The existing vocabulary carries it: P0 FAIL → Critical finding → `CHANGES_REQUESTED`. A new code would be ceremony. |
| Machine-parsed assertion IDs for composition | Out of scope (Aragorn) and unearned — Gandalf composes by reading three short reports, not parsing N artifacts. |
| Folding into Cluster E `contract.yaml` | Different concern (state contract, machine-readable tree). Explicitly held separate by Aragorn. The noun collides; the substance does not. |
| A `validation-contract.md` reference doc explaining the format | See "Does the reference doc earn its place" below. |

### Does a `references/validation-contract.md` doc earn its place?

**No — for v1.** The authoring rules live where they are used: the assertion template and the adversarial discriminator go into `skills/planning/SKILL.md` (the authoring site); the scoring protocol goes into the three validator files (the consumption site). A separate reference doc would be a third place to keep in sync with two sites that already must carry the rules. If a fourth consumer appears, extract then. One assertion template, duplicated into the planning skill and pointed-to from validators, is the lighter shape. Marked so it is not re-debated.

---

## Interface Contract — what Gimli builds against

This is the boundary. Gimli honors these; he does not redesign them.

### Artifact 1 — `skills/planning/SKILL.md`

Add a **"Author the Validation Contract"** subsection after "Task Detail" (the per-task acceptance criteria already there feed it). It must instruct:
- Consolidate Aragorn's P0/P1/P2 acceptance criteria into one per-quest `## Validation Contract` section in the plan.
- Emit each assertion in the four-field form of Decision 2 (the worked example is the canonical template — copy its shape).
- Apply the adversarial discriminator: *could a fresh validator score this from the `Verify:` line alone?* and *does at least one P0 name an unhappy path?*
- Assign each assertion an owner-validator tag per the routing rules in 3a.
- Where no Aragorn pass ran (Tier 2 direct), author assertions from the spec.

Add the `## Validation Contract` section (header + gate sentence + four-field assertion template) to the quest-log markdown template in the "Create the Quest Log" section.

### Artifact 2 — `agents/legolas.md`, `agents/pippin.md`, `agents/boromir.md`

Each gains a **"Validation Contract Scoring"** subsection and a **Contract scoring** block in its Report Format:
- **Instruction (all three):** *If the dispatch references a `## Validation Contract`, score every assertion tagged with your name — PASS / FAIL / UNTESTABLE, each with cited evidence. A P0 FAIL is a Critical finding. UNTESTABLE requires a reason.*
- **Report block (all three):** the `Contract scoring:` block shape from 3b, inserted into the existing report template.
- **Legolas/Boromir:** a P0 FAIL produces `CHANGES_REQUESTED`. **Pippin:** a P0 FAIL is a Finding (spec violation) per his existing format.
- Pippin's tie-in: his "Tests are a specification" first principle already does this — the contract *is* the spec handed to him as assertions. Frame it as that, not a new methodology.

### Artifact 3 — `skills/using-fellowship/references/workflows.md`

In `feature-flow` and `bug-flow`, add a line to the validator step noting the validators score the `## Validation Contract`. In `security-flow`, note Boromir scores security-property assertions. This is a *reference to the scoring step*, not a new step — the validators already run; they now run against the contract. No change to the recipe sequence.

### Composition rule (Gandalf-side, documented in workflows.md)

One line where the validator step closes: *"The contract passes when every P0 assertion is PASS with evidence and zero P0 FAIL. UNTESTABLE on a P0 is an unscored gate, not a pass. P1/P2 FAILs → quest log."*

---

## Wiring order (Gimli's build sequence)

Dependency-ordered. Each step is independently verifiable.

1. **`skills/planning/SKILL.md`** — add the authoring subsection + the `## Validation Contract` template in the quest-log block. *First: it defines the artifact everything else consumes. Verify: the template contains all four fields and the gate sentence.*
2. **`agents/legolas.md`** + **`agents/pippin.md`** — add the scoring subsection + Contract scoring report block. *Second: the two validators named in the P0 acceptance criteria. Verify: each report format carries the block; the routing-key instruction is present.*
3. **`skills/using-fellowship/references/workflows.md`** — reference the scoring step in feature-flow / bug-flow / security-flow + the composition rule. *Third: ties dispatch to consumption. Verify: each flow's validator step names the contract.*
4. **`agents/boromir.md`** — add scoring subsection for security-property assertions. *Fourth (P1 scope): security-flow only. Verify: Boromir's report carries the block.*

Steps 1–3 satisfy the P0 acceptance criteria. Step 4 satisfies a P1.

---

## Consequences

- **Positive:** zero new artifacts, zero new files, zero new status codes, zero new commands. The enrichment lands as edits to four existing files. The Ring does not grow heavier.
- **Positive:** the contract and the tasks it defends share a file — they cannot drift apart.
- **Positive:** the partition of one contract across three validators is authored into the assertion tags, not negotiated at dispatch — no collision, no coordination overhead.
- **Cost:** the planning skill carries more authoring burden (consolidate + sharpen + tag). Mitigated by the worked example as a copy-able template.
- **Cost:** the assertion template is duplicated into the planning skill and referenced from validators. Accepted over a third reference doc — see "earns its place."
- **If the in-plan assumption is wrong** (contract too large for a plan section): mechanical extraction to a sibling file, one dispatch path added, no protocol change. Cheap to reverse. v2.

---

## Open dependency (note, do not gate)

The v1.1 end-to-end orchestration fixture and workflow-routing evals *feed on* this — a fixture quest with a known-good contract is the natural way to test that validators score correctly. Healthy dependency, not a blocker. The fixture consumes the assertion shape locked here.
