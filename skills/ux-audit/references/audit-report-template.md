# Audit Report Template

Write audit output to `ux-audit-[product].md` using this template.

```markdown
# UX Audit: [Product/Feature]

**Date:** [date]
**Method:** Code review [+ screenshots if server running]

## Summary

[2–3 sentences: overall impression and most critical finding]

## Pillar Scores

| Pillar | Score | Finding |
|--------|-------|---------|
| 1. Copywriting | X/4 | [one line] |
| 2. Visuals | X/4 | [one line] |
| 3. Color | X/4 | [one line] |
| 4. Typography | X/4 | [one line] |
| 5. Spacing | X/4 | [one line] |
| 6. Experience Design | X/4 | [one line] |

**Overall: X/24**

**Verdict: APPROVED / BLOCKED**

## WCAG Layer

| Criterion | Level | Status | Finding |
|-----------|-------|--------|---------|
| Color contrast | AA | PASS/FAIL/WARN | [detail] |
| Keyboard navigation | AA | PASS/FAIL/WARN | [detail] |
| Focus indicators | AA | PASS/FAIL/WARN | [detail] |
| Alt text | A | PASS/FAIL/WARN | [detail] |
| Form labels | A | PASS/FAIL/WARN | [detail] |
| Screen reader structure | A | PASS/FAIL/WARN | [detail] |

For deeper WCAG criterion-by-criterion coverage when remediation is needed, point readers to `skills/accessibility/references/wcag-2.2-checklist.md`.

## Top 3 Priority Fixes

1. **[Issue]** — [user impact] — [specific fix]
2. **[Issue]** — [user impact] — [specific fix]
3. **[Issue]** — [user impact] — [specific fix]

## Detailed Findings

### Pillar 1: Copywriting (X/4)
[findings with file:line references]

### Pillar 2: Visuals (X/4)
[findings]

### Pillar 3: Color (X/4)
[findings with class usage counts]

### Pillar 4: Typography (X/4)
[findings with size/weight distribution]

### Pillar 5: Spacing (X/4)
[findings with spacing class analysis]

### Pillar 6: Experience Design (X/4)
[findings with state coverage analysis]

## Files Audited

[list of files examined]
```
