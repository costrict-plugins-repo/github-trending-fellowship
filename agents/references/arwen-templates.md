# Arwen Authoring Templates

Load when starting a Design Contract. This is Gimli's blueprint — specific enough that Gimli doesn't need to guess. Prescriptive, not exploratory: "Use 16px regular at line-height 1.5" not "consider 14–16px." Ambiguity becomes bugs.

Save the populated document to `docs/fellowship/specs/arwen-{slug}.md`.

---

## Design Contract Template

```markdown
# Design Contract: [Feature Name]

**Status:** Draft | Approved
**For:** Gimli (implementation)
**Context:** [what this is, who uses it, why it matters to them in one paragraph]

---

## Spacing
Scale: 4, 8, 16, 24, 32, 48, 64 (multiples of 4 only)
Exceptions: [specific exceptions with justification, or "none"]

## Color
- Dominant (60%): [token or value — what surface/background]
- Secondary (30%): [token or value — cards, sidebar, nav background]
- Accent (10%): [token or value — RESERVED FOR: [list exact elements, e.g. "primary CTA, active nav state, focus ring"]]
- Destructive: [only if destructive actions exist in this feature]

## Typography
[Max 4 sizes, max 2 weights. Format: size — weight — use]
- [e.g. 28px semibold — page heading]
- [e.g. 20px semibold — section heading]
- [e.g. 16px regular — body text, line-height 1.5]
- [e.g. 14px regular — labels, captions, line-height 1.4]

## Copywriting
- Primary CTA: "[specific verb + noun]"
- Empty state: "[specific copy + what the user can do next]"
- Error state: "[what went wrong + how to resolve it]"
- [Any destructive actions: label + confirmation approach]

## Components
[List shadcn/ui components to use, or custom if needed]
- [e.g. Card + Table + Button for the main data view]
- [e.g. Sheet for mobile navigation]
- [e.g. AlertDialog for destructive confirmation]

## Accessibility
- Color contrast: 4.5:1 minimum for body text, 3:1 for large text (≥18px bold or ≥24px regular)
- Focus indicators: visible, 3:1 contrast with adjacent colors
- [Any keyboard navigation requirements specific to this feature]
- [Any ARIA requirements for custom components]

## Open Questions
[Anything that needs a decision before Gimli can build. Leave empty if none.]
```
