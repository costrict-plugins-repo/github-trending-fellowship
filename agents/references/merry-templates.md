# Merry Authoring Templates

Load when starting an Architecture Decision Record, an interface contract, or a data model sketch. Save ADRs to `docs/fellowship/specs/merry-adr-{slug}.md` — they are design artifacts and live in `specs/` alongside PRDs. `plans/` is for step-by-step execution plans, not architecture decisions.

---

## Architecture Decision Record (ADR) Template

```markdown
# ADR-{N}: [Title]

**Status:** Proposed | Accepted
**Date:** YYYY-MM-DD
**Decider:** Merry (technical) + Frodo (final call if scope changes)

## Context
[What situation requires a decision? What problem are we solving?
Reference Aragorn's requirements doc if applicable.]

## Decision
[What was decided? State it plainly. One sentence if possible.]

## Options Considered

| Option | Pros | Cons | Why not chosen |
|--------|------|------|----------------|
| [Option A] | | | |
| [Option B] | | | [or: This is the chosen approach] |
| [Option C] | | | |

## Consequences

**Positive:**
- [What improves as a result of this decision]

**Negative / Constraints:**
- [What gets harder or more constrained]

**If wrong:**
- [What breaks or needs rebuilding if the key assumption behind this decision is incorrect]
- [How would we know it's wrong? What's the signal?]

## Interface Contracts
[The specific module boundaries, exports, and types that Gimli must honor.
See Interface Contract template below.]
```

---

## Interface Contract Template

After choosing an approach, define the boundary explicitly. This is what Gimli builds against. Include one interface contract per module boundary. If Gimli and Arwen are building in parallel, each needs their own contract so they can work without stepping on each other.

```markdown
## Interface: [Module Name]

**Purpose:** [What this module does — one sentence]
**Location:** `[path/to/module.ts]` (or where it should be created)

### Types

```typescript
export interface [TypeName] {
  [field]: [type];  // [why this field exists]
}
```

### Public API

```typescript
// What callers can use
export function [functionName]([params]: [ParamType]): [ReturnType];
export async function [asyncFunction]([params]): Promise<[ReturnType]>;
```

### What callers must NOT depend on

- [Internal implementation detail that may change]
- [Private field that is not part of the contract]

### Error contract

- [What errors can be thrown, and when]
```

---

## Data Model Sketch Template

For features that touch the database or persistent state, produce a sketch — not a migration script.

```markdown
## Data Model: [Feature Name]

### Entities

**[Entity]:**
- `id`: [type] — primary key
- `[field]`: [type] — [why it exists]
- `[relation]`: [type] — references [other entity]

### Key Relationships

- [Entity A] → [Entity B]: [one-to-many / many-to-many / etc.]

### What's deferred

- [Field or table that could exist but isn't needed in v1]
- Reason: [why it's deferred]
```
