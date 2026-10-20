# Tier Scoring Reference

Tier classification and workflow selection are judgment calls. Score signals name weight as a reasoning aid — they help Gandalf gauge the work, not compute the tier. Shape (focused vs. workflow-fitting recipe) names orchestration. The tier sits at the intersection: score establishes a likely band, shape sharpens within it, but both call for judgment. The arithmetic in worked examples is illustrative; the decisions are Gandalf's. When surfacing a tier to the user, name the signals (touches auth, multi-file) rather than narrate the arithmetic.

## Signals that push UP

| Signal | Score | Examples |
|--------|-------|---------|
| Multiple files affected | +2 | Feature spanning 3+ files |
| Touches critical path (auth, payments, data mutations, public APIs) | +3 | Auth middleware, payment webhook, database migration |
| Cross-domain (frontend + backend, or code + infrastructure) | +2 | API route + UI component + database schema |
| New feature (not fix/tweak) | +2 | New page, new API, new workflow |
| Complex logic / many edge cases | +2 | State machine, data transformation pipeline |
| User signals thoroughness ("careful", "thorough", "review this") | +2 | Explicit quality request |
| Spec exists with multiple requirements | +1 | Written plan with 5+ tasks |

## Signals that push DOWN

| Signal | Score | Examples |
|--------|-------|---------|
| Single file | -2 | One component, one config file |
| Config / copy / styling only | -3 | Tailwind classes, env var, button text |
| Clear fix with known solution | -2 | Bug with obvious cause, documented pattern |
| User signals speed ("quick", "just", "simple") | -2 | "just fix the typo" |
| Similar work done recently (pattern exists) | -1 | Second API endpoint following established pattern |
| No tests needed (pure cosmetic) | -1 | Color change, spacing adjustment |

## Score bands (anchor, not gate)

| Score | Tier | What happens |
|-------|------|-------------|
| ≤ 0 | **Tier 1 — Direct** | Gandalf handles. No companion dispatch. |
| 1–3 | **Tier 2 — Focused dispatch** | One primary companion. Cycles run automatically on critical paths (Legolas review on a Gimli build is the cycle, not an escalation). |
| 4–6 | **Tier 3 — Workflow-shaped** | Work fits a named recipe (`feature-flow`, `bug-flow`, `security-flow`). Multi-companion sequence with conditional steps. Plan first. See `references/workflows.md`. |
| ≥ 7 | **Tier 4 — Parallel / Teams** | Parallel branches or Agent Teams. |

Bands name expected weight. Tier 2 vs. Tier 3 within bands is also a shape call: recipe-fit pulls into Tier 3 even when score lands in the Tier 2 band; focused work stays Tier 2 even when score climbs.

Borderline → err lower. "Quick" or "just" → Tier 1 regardless. The line between Tier 2 and Tier 3 is *focused vs. workflow-shaped* — not a count of companions. Multi-companion is the default for any non-trivial work because cycles guarantee it.

## Worked examples

**Workflow-shaped work.** "Add auth middleware that checks session tokens" — multiple files (+2), touches auth (+3), new feature (+2), spec exists (+1) = 8. Established pattern exists (−1) = 7. Score sits at Tier 4 — err down to Tier 3. The work fits `security-flow` (auth boundary, parallel Legolas + Boromir review). Tier 3 is workflow-shaped; the recipe is the orchestration.

**Focused work.** "Add a single-file auth helper function" — single file (−2), touches auth (+3), new feature (+2) = 3. Tier 2. Focused dispatch: Gimli builds, Legolas reviews (the cycle, not a tier escalation). Aragorn not needed — scope is one helper signature. Merry not needed — one function in an existing file. No workflow shape; cycles suffice.
