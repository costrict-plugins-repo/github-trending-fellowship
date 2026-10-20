---
name: accessibility
description: Use when auditing for accessibility violations, fixing WCAG issues, building accessible components, or running screen reader tests. Covers WCAG 2.2 patterns, screen reader testing (VoiceOver, NVDA, JAWS, TalkBack), ARIA remediation, and automated testing. Pair with `ux-audit` when its WCAG layer needs deeper reference.
user-invocable: false
---

# Accessibility

Methodology for WCAG 2.2 auditing, screen reader testing, ARIA remediation, and automated tooling. Long-form references live in `references/` and are loaded on demand.

---

## 1. Core Concepts

### POUR Principles

```
Perceivable:    Can users perceive the content? (alt text, captions, contrast)
Operable:       Can users operate the interface? (keyboard nav, timing, seizures)
Understandable: Can users understand it? (language, labels, errors)
Robust:         Does it work with assistive technology? (ARIA, semantic HTML)
```

### Conformance Levels

| Level | Description | Required For |
|-------|-------------|--------------|
| **A** | Minimum accessibility | Legal baseline |
| **AA** | Standard conformance | Most regulations — target this |
| **AAA** | Enhanced accessibility | Specialized contexts only |

### Common Violations by Impact

**Critical (blockers):** missing alt text on functional images, no keyboard access to interactive elements, missing form labels, auto-playing media without controls.

**Serious:** insufficient color contrast, missing skip links, inaccessible custom widgets, missing page titles.

**Moderate:** missing language attribute, unclear link text, missing landmarks, improper heading hierarchy.

---

## 2. Audit Workflow

For a remediation pass, work through these stages in order:

1. **Scope the conformance level** — usually AA. Note any AAA targets up front.
2. **Run automated tooling** — axe / pa11y / Lighthouse. Catches roughly 30–50% of issues. Full reference: see [`references/automated-testing.md`](references/automated-testing.md).
3. **Walk the WCAG 2.2 checklist** — Level A and AA criteria, criterion-by-criterion, against the implementation. Full checklist with examples: see [`references/wcag-2.2-checklist.md`](references/wcag-2.2-checklist.md). Load when scoping a remediation pass.
4. **Manual screen-reader pass** — at minimum NVDA + Firefox and VoiceOver + Safari. Commands and per-product test scripts: see [`references/screen-reader-commands.md`](references/screen-reader-commands.md).
5. **Remediate** — apply targeted fixes. Patterns for the common cases (form labels, contrast, keyboard nav, modal focus, live regions, tabs, debugging accessible name): see [`references/remediation-cookbook.md`](references/remediation-cookbook.md).
6. **Re-test** — automated tooling, then manual SR pass on changed surfaces.

---

## 3. Best Practices

### Do's

- **Start early** — accessibility from the design phase, not as a retrofit.
- **Use semantic HTML first** — native elements need less ARIA and are more robust.
- **Test with real screen readers** — not just simulators; disabled users provide the best feedback.
- **Test in browse and focus modes** — different screen-reader experiences.
- **Verify focus management** — especially critical for SPAs with dynamic content.
- **Test keyboard-only first** — solid keyboard experience is the foundation for screen-reader testing.
- **Document accessible patterns** — build a reusable accessible component library.

### Don'ts

- **Don't rely only on automated testing.** Tooling catches 30–50%; manual is required for the rest.
- **Don't use ARIA as the first solution** — native HTML always first.
- **Don't hide focus outlines** — keyboard users depend on them.
- **Don't disable zoom** — users need to resize text.
- **Don't use color alone** — multiple visual indicators required.
- **Don't assume one screen reader is enough** — test NVDA, VoiceOver, and JAWS.
- **Don't ignore mobile** — growing screen-reader user base.
- **Don't skip error states** — most common screen-reader issues occur in dynamic content.
