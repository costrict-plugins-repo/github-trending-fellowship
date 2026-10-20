---
name: ux-audit
description: Use when running a design-quality audit of implemented frontend code or producing a scored UX report. 6-pillar methodology (copywriting, visuals, color, typography, spacing, experience) with 1–4 scoring and BLOCK/FLAG/PASS verdicts. Pair with `accessibility` when the WCAG layer needs deeper reference.
user-invocable: false
---

# UX Audit

Retroactive audit of implemented frontend code against 6 design quality pillars. Produces a scored audit report with BLOCK/FLAG/PASS verdicts and actionable fixes.

## When to Use

- Reviewing an existing product's design quality
- Before a redesign to understand what's broken
- As part of a PR review when visual components changed
- Periodic design health check

## Score Definitions

Used across all pillars:

| Score | Label | Meaning |
|-------|-------|---------|
| 4 | Excellent | No issues found, exceeds standard |
| 3 | Good | Minor issues, standard substantially met |
| 2 | Needs work | Notable gaps, standard partially met |
| 1 | Poor | Significant problems, standard not met |

---

## The 6 Pillars

### Pillar 1 — Copywriting

**What it checks:** CTAs, empty states, error states, destructive action labels. Flags generic or placeholder copy that leaves users without direction.

**Audit method:**

```bash
# Generic labels
grep -rn "Submit\|Click Here\|OK\|Cancel\|Save" src --include="*.tsx" --include="*.jsx" 2>/dev/null
# Empty state patterns
grep -rn "No data\|No results\|Nothing\|Empty" src --include="*.tsx" --include="*.jsx" 2>/dev/null
# Error patterns
grep -rn "went wrong\|try again\|error occurred" src --include="*.tsx" --include="*.jsx" 2>/dev/null
```

**Scoring guidance:**
- 4 — All CTAs are verb + noun, all states have copy with resolution paths
- 3 — One or two minor generic labels, all states present
- 2 — Several generic labels, some states missing
- 1 — Widespread generic copy, missing empty or error states

**BLOCK if:**
- Any CTA is "Submit", "OK", "Click Here", "Cancel", "Save" (no context)
- Empty state copy is missing or says "No data found" / "No results" / "Nothing here"
- Error state copy is missing or has no solution path (just "Something went wrong")

**FLAG if:**
- Destructive action has no confirmation approach
- CTA is a single word without a noun (e.g. "Create" instead of "Create Project")

---

### Pillar 2 — Visuals

**What it checks:** Focal point clarity, visual hierarchy through size/weight/color, icon-only actions labeled for accessibility.

**Audit method:** Inspect component structure and visual hierarchy indicators — no grep for this one. Look at: which element dominates the primary view, whether icon-only buttons have `aria-label` or tooltip, whether size/weight/color differentiation creates clear reading order.

**Scoring guidance:**
- 4 — Clear focal point, strong hierarchy, all icons labeled
- 3 — Hierarchy present, minor issues (e.g. one unlabeled icon)
- 2 — Weak hierarchy, multiple unlabeled icons
- 1 — No discernible focal point, flat visual weight throughout

**FLAG if:**
- No focal point declared for primary screen (executor will guess visual priority)
- Icon-only actions without accessible labels (aria-label or tooltip)
- No visual hierarchy indicated through size, weight, or color differentiation

---

### Pillar 3 — Color

**What it checks:** 60/30/10 split maintained, accent not overused, no hardcoded colors outside tokens.

**Audit method:**

```bash
# Count accent color usage (high count = overuse risk)
grep -rn "text-primary\|bg-primary\|border-primary" src --include="*.tsx" --include="*.jsx" 2>/dev/null | wc -l
# Check for hardcoded hex colors
grep -rn "#[0-9a-fA-F]\{3,8\}\|rgb(" src --include="*.tsx" --include="*.jsx" 2>/dev/null
```

**Scoring guidance:**
- 4 — Clear 60/30/10 split, accent reserved for specific elements, no hardcoded colors
- 3 — Split mostly maintained, minor accent overuse or a few hardcoded values
- 2 — Accent used broadly, several hardcoded colors
- 1 — No discernible system, accent everywhere, extensive hardcoded colors

**BLOCK if:**
- Accent reserved for "all interactive elements" (defeats color hierarchy)
- More than one accent color without semantic justification

**FLAG if:**
- 60/30/10 split not declared or verifiable
- Hardcoded colors found in component files

---

### Pillar 4 — Typography

**What it checks:** Font size count (max 4), weight count (max 2), line height consistency.

**Audit method:**

```bash
# Distinct font sizes in use
grep -rohn "text-\(xs\|sm\|base\|lg\|xl\|2xl\|3xl\|4xl\|5xl\)" src --include="*.tsx" --include="*.jsx" 2>/dev/null | sort -u
# Distinct font weights in use
grep -rohn "font-\(thin\|light\|normal\|medium\|semibold\|bold\|extrabold\)" src --include="*.tsx" --include="*.jsx" 2>/dev/null | sort -u
```

**Scoring guidance:**
- 4 — 3–4 sizes, 1–2 weights, line heights declared for body and caption text
- 3 — 4 sizes, 2 weights, one missing line height declaration
- 2 — 5 sizes or 3 weights, inconsistent scale
- 1 — 6+ sizes or 3+ weights, no discernible type system

**BLOCK if:**
- More than 4 font sizes declared or in use
- More than 2 font weights declared or in use

**FLAG if:**
- No line height declared for body text
- Font sizes are not in a clear hierarchical scale (e.g. 14, 15, 16 — too close)

---

### Pillar 5 — Spacing

**What it checks:** All spacing values are multiples of 4, no arbitrary tokens, consistent scale usage.

**Audit method:**

```bash
# Spacing class distribution
grep -rohn "p-\|px-\|py-\|m-\|mx-\|my-\|gap-\|space-" src --include="*.tsx" --include="*.jsx" 2>/dev/null | sort | uniq -c | sort -rn | head -20
# Arbitrary values (non-4-multiple risk)
grep -rn "\[.*px\]\|\[.*rem\]" src --include="*.tsx" --include="*.jsx" 2>/dev/null
```

**Scoring guidance:**
- 4 — All values from standard scale (4, 8, 16, 24, 32, 48, 64), no arbitrary values
- 3 — Standard scale mostly used, one or two justified exceptions
- 2 — Several arbitrary values, some non-4-multiples
- 1 — No consistent scale, arbitrary spacing throughout

**BLOCK if:**
- Any spacing value not a multiple of 4 (breaks grid alignment)
- Spacing scale contains values not in the standard set (4, 8, 16, 24, 32, 48, 64) without justification

**FLAG if:**
- Arbitrary values found without documented justification
- Spacing scale not explicitly confirmed (section empty or says "default")

---

### Pillar 6 — Experience Design

**What it checks:** Loading states, error states, empty states, disabled states, destructive confirmation — are all 5 covered?

**Audit method:**

```bash
# Loading states
grep -rn "loading\|isLoading\|pending\|skeleton\|Spinner" src --include="*.tsx" --include="*.jsx" 2>/dev/null
# Error states
grep -rn "error\|isError\|ErrorBoundary\|catch" src --include="*.tsx" --include="*.jsx" 2>/dev/null
# Empty states
grep -rn "empty\|isEmpty\|no.*found\|length === 0" src --include="*.tsx" --include="*.jsx" 2>/dev/null
# Disabled states
grep -rn "disabled\|isDisabled" src --include="*.tsx" --include="*.jsx" 2>/dev/null
# Destructive confirmation
grep -rn "AlertDialog\|confirm\|destructive\|irreversible" src --include="*.tsx" --include="*.jsx" 2>/dev/null
```

**Scoring guidance:** Based on how many of the 5 state types are handled:
- 5 covered → 4
- 4 covered → 3
- 3 covered → 2
- Fewer than 3 → 1

---

## Screenshots

If dev server is running, capture visual state before code-only review:

```bash
DEV_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")

if [ "$DEV_STATUS" = "200" ]; then
  SCREENSHOT_DIR=".planning/ui-reviews/$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$SCREENSHOT_DIR"

  # Desktop
  npx playwright screenshot http://localhost:3000 \
    "$SCREENSHOT_DIR/desktop.png" --viewport-size=1440,900 2>/dev/null

  # Mobile
  npx playwright screenshot http://localhost:3000 \
    "$SCREENSHOT_DIR/mobile.png" --viewport-size=375,812 2>/dev/null

  # Tablet
  npx playwright screenshot http://localhost:3000 \
    "$SCREENSHOT_DIR/tablet.png" --viewport-size=768,1024 2>/dev/null

  echo "Screenshots captured to $SCREENSHOT_DIR"
else
  echo "No dev server at port 3000 — trying 5173..."
  # Repeat for 5173, then 8080
fi
```

Note in the audit report whether screenshots were captured or the audit ran code-only.

---

## Verdict Format

**Overall verdict:**
- **APPROVED** — No BLOCKs. Any FLAGs are recommendations, not blockers.
- **BLOCKED** — Any pillar is BLOCK. List each blocking issue with exact fix required.

---

## Audit Report Template

Write audit output to `ux-audit-[product].md`. Full template (pillar scores table, WCAG layer, priority fixes, detailed findings, files audited): see [`references/audit-report-template.md`](references/audit-report-template.md). Load when writing the report.

The WCAG layer in the template is a six-row gesture — for criterion-by-criterion remediation depth, point readers to [`skills/accessibility/references/wcag-2.2-checklist.md`](../accessibility/references/wcag-2.2-checklist.md) rather than restating criteria here.
