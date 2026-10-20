---
name: validation-contract
description: Validation-contract architecture — placement decision (in-plan, D-01 held) and the if-wrong reversal path
metadata:
  type: project
---

The validation contract is an enrichment of the plan, not a new artifact. ADR at `docs/fellowship/specs/2026-05-30-adr-validation-contract.md` (author: merry).

**Decision:** contract lives as a `## Validation Contract` section *inside* the plan (`docs/fellowship/plans/*.md`), scored by validators via an assertion-by-assertion protocol (PASS/FAIL/UNTESTABLE).

**Why in-plan, not standalone reference:** Gandalf's validator dispatch already passes the plan path in `<files_to_read>`. A standalone reference adds a path AND a sync seam for no dispatch-cleanliness gain. The crux question Aragorn raised (does scoring make in-plan awkward?) resolved *toward* D-01, not against it.

**If wrong:** assumption is the contract stays small enough to read inside the plan. If a quest produces a huge assertion set, promote the section to a sibling file — one dispatch path added, no protocol change. Cheap reversal, v2. Do not re-debate placement before that trigger fires.

**Held separate from Cluster E `contract.yaml`** — that is the state contract (machine-readable tree). Same noun, different concern. Never fold validation contract into it.

**Owner-validator routing key:** `[Legolas]`/`[Pippin]`/`[Boromir]` tag on each assertion partitions one contract across validators without collision. The gate: all P0 PASS, zero P0 FAIL; UNTESTABLE-on-P0 is an unscored gate, not a pass.
