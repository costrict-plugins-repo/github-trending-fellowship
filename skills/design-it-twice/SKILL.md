---
name: design-it-twice
description: "Generate multiple radically different module/API designs in parallel and compare them on depth, simplicity, and leverage. Merry's skill for architectural decisions where multiple module shapes are worth exploring before committing. Use when designing a new module, exploring API options, comparing module shapes, or when the user mentions \"design it twice,\" \"explore multiple module shapes,\" or \"compare API options.\" The first instinct is rarely the best — this skill forces a second."
user-invocable: false
---

# Design It Twice

Based on the *Design It Twice* chapter of John Ousterhout's *A Philosophy of Software Design*: your first idea is unlikely to be the best. Generate multiple radically different module/API designs, then compare.

## Workflow

### 1. Gather Requirements

Before designing, understand:

- [ ] What problem does this module solve?
- [ ] Who are the callers? (other modules, external users, tests)
- [ ] What are the key operations?
- [ ] Any constraints? (performance, compatibility, existing patterns)
- [ ] What should be hidden inside vs. exposed on the module surface?

Ask: "What does this module need to do? Who will use it?"

### 2. Generate Designs

Produce 3+ **radically different** module/API designs. Two paths, pick by depth:

**Parallel dispatch (Tier 4) — for substantive architectural calls.** Spawn 3+ Gimli instances in parallel, each carrying a different design constraint. Each instance returns a self-contained design. This is the heavier path; use it when the question is load-bearing and the cost of a thin first answer is high.

**In-session sequential — for in-flight brainstorming.** Generate three designs sequentially in your own response, one after the other. Cheaper, faster, suitable when the design space is small or the conversation is already exploratory. Merry picks based on the depth of the question.

**Constraint template** — assign a different one to each design (whether dispatched or in-session):

- Design A: "Minimize method count — aim for 1–3 operations on the module surface"
- Design B: "Maximize flexibility — support many use cases at the cost of a wider API"
- Design C: "Optimize for the most common case — fast path simple, edge cases pay extra"
- Design D (optional): "Take inspiration from [a specific paradigm or library]"

**Output format per design:**

1. API signature (types, methods, key params)
2. Usage example — how a caller actually uses it in practice
3. What the module hides internally
4. Trade-offs of this approach

### 3. Present Designs

Show each design with:

1. **API signature** — types, methods, params
2. **Usage examples** — how callers use it in practice, not in theory
3. **What it hides** — complexity kept inside the module

Present designs sequentially so the reader can absorb each approach before comparison.

### 4. Compare Designs

After all designs are on the table, compare them on:

- **Surface simplicity:** fewer methods, simpler params
- **General-purpose vs. specialized:** flexibility vs. focus
- **Implementation efficiency:** does the module shape allow efficient internals?
- **Depth:** small surface hiding significant complexity (good) vs. large surface with thin implementation (bad)
- **Ease of correct use** vs. **ease of misuse**

Discuss trade-offs in prose, not tables. Highlight where designs diverge most.

### 5. Synthesize

Often the best result combines insights from multiple options. Ask:

- "Which design best fits your primary use case?"
- "Any elements from other designs worth incorporating?"

## Evaluation Criteria

From *A Philosophy of Software Design*:

**Surface simplicity.** Fewer methods, simpler params = easier to learn and use correctly.

**General-purpose.** Can the module handle future use cases without changes? Beware over-generalization — a module shape designed for everything serves nothing well.

**Implementation efficiency.** Does the API shape allow efficient internals, or force awkward ones?

**Depth.** Small module surface hiding significant complexity = deep module (good). Large surface with thin implementation = shallow module (avoid).

## Anti-Patterns

- Don't let parallel designs converge — enforce radical difference. If three designs look alike, the constraints weren't strong enough.
- Don't skip comparison — the value is in contrast, not in any single design.
- Don't implement — this is purely about module shape. Code comes after the choice.
- Don't evaluate based on implementation effort — that biases toward the shallow option.

---

*Methodology from John Ousterhout's* A Philosophy of Software Design, *chapter "Design It Twice." Adapted from [Matt Pocock's design-an-interface skill](https://github.com/mattpocock/skills/tree/main/design-an-interface).*
