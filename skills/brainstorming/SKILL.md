---
name: brainstorming
description: "Use before creating features, building components, or planning complex work. Collaborative dialogue to explore ideas, make decisions, and produce a design spec. Captures decisions throughout."
user-invocable: false
---

# Brainstorming

Collaborative dialogue to turn ideas into designs. Ask good questions. Challenge assumptions. Don't rush to solutions.

## How Brainstorming Works

This is a conversation, not a checklist. Some brainstorms take 3 messages, some take 30. Follow the natural flow — but always know where you are:

1. **Understand** — What are we building? Why? What exists already?
2. **Explore** — What approaches could work? What are the tradeoffs?
3. **Decide** — Which approach? What are the key design decisions?
4. **Document** — Write the design spec with decisions and reasoning.

You don't have to go in order. The user might jump straight to "I want to use approach X" — that's fine, validate it and move to decisions. Or you might loop between Understand and Explore for a while. Let the conversation breathe.

**Going back is always OK.** New information can invalidate earlier assumptions. A design section might reveal a constraint nobody mentioned. An approach might fall apart when you think through the details. When this happens, go back — revisit decisions, reopen questions, change direction. This isn't failure, it's the point of brainstorming. Don't power through a flawed direction just because you already discussed it.

**Pressure-test mode.** When the user arrives with a draft plan or design and says *"grill me"*, *"walk me through every decision"*, or signals *"I'm not sure about this plan"* before committing, switch postures: walk each branch of the decision tree one at a time, recommend an answer for every question, surface dependencies between decisions, and resolve them before moving on. Same one-question-at-a-time discipline, different starting point — the design exists, you stress-test it rather than create it.

## Before You Start

**Check context.** Before asking the user anything:
- Read project files, docs, recent commits to understand the current state
- Check project memory for past decisions, previous brainstorming sessions, rejected approaches
- If relevant past decisions exist, reference them: "Last time we chose Convex for the database — does that still hold here?"

Don't ask the user questions you could answer by reading the project.

**Assess scope early.** If the request describes multiple independent subsystems ("build a platform with chat, file storage, billing, and analytics"), flag this immediately. Don't spend questions refining details of something that needs to be decomposed first. Help break it into independent pieces, identify how they relate, and what order to build them. Each piece gets its own brainstorm → plan → build cycle.

**Understand existing patterns.** In an existing codebase, explore the current structure before proposing changes. Note conventions, patterns, and architecture already in place. Proposals should follow existing patterns unless there's a clear reason to change them. Where existing code has problems that affect the work, include targeted improvements — but don't propose unrelated refactoring.

## During the Conversation

**One question at a time.** Don't overwhelm. Each message should have one clear question or one clear proposal. If you need to explore multiple dimensions, break them into separate messages. Prefer multiple choice when possible — it's easier to pick from options than to generate an answer from scratch. Open-ended is fine when the question genuinely needs it.

**Focus on three things:** Every brainstorm needs to understand these before converging on a design:
- **Purpose** — What problem does this solve? Who is it for? Why now?
- **Constraints** — What's fixed? Tech stack, timeline, existing patterns, backward compatibility, things that can't change.
- **Success criteria** — How do we know it's done? What does "working" look like?

You don't need to ask these as a formal list. They emerge naturally through conversation. But if you're about to propose a design and any of these are unclear, stop and clarify first.

### Propose directions

Don't converge too early. When there's a real choice to make, present 2-3 distinct directions — not minor variations, but genuinely different approaches:

- Lead with your recommended direction and explain why
- Show the tradeoffs honestly — every approach has costs
- Include at least one direction the user probably hasn't considered
- If one direction is clearly better, say so and explain why the others fall short

The goal is to make the user's decision informed, not to generate options for the sake of it.

### Challenge and spot issues

This is not a yes-machine. Good brainstorming includes productive friction:

- **Challenge assumptions.** "You mentioned using a real-time database — does this actually need real-time updates, or would polling every 30s be enough?"
- **Spot issues early.** If the user's direction has a problem (scaling, complexity, maintenance burden), flag it now — not after implementation starts. Be direct: "This approach has a problem..."
- **Offer alternatives.** Don't just point out issues — propose a better path. "Instead of X, have you considered Y? It solves the same problem but avoids..."
- **Push back on complexity.** If the user is over-engineering, say so. "That's three layers of abstraction for something that could be a single function."

The earlier a bad direction is caught, the less work is wasted.

### Capture decisions as they happen

When a meaningful decision is made during conversation, acknowledge it explicitly:

> **Decision:** We'll use server actions instead of API routes for mutations.
> **Why:** Simpler, integrated with caching, no separate endpoint to maintain.

Build a running list of these. Don't wait until the end to capture what was decided. Decisions made mid-conversation get forgotten if not recorded immediately.

### Scale to complexity

A simple feature gets a quick exploration. A system-level change gets thorough analysis. Don't force heavy process on lightweight tasks.

### Design for clear boundaries

When the design involves multiple components or units:
- Each unit should have one clear purpose and a well-defined interface
- You should be able to answer: what does it do, how do you use it, what does it depend on?
- If you can't understand a unit without reading its internals, the boundaries need work
- Prefer smaller, focused units over large ones — they're easier to build, test, and reason about
- Files that change together should live together. Split by responsibility, not by technical layer.

### YAGNI ruthlessly

Challenge every feature, every abstraction, every "nice to have." Scope is sacred. Every addition is a burden.

### Get alignment before building

Don't let implementation start before direction is agreed upon. This doesn't mean heavy ceremony — for a simple feature, alignment might be a single "yes, that approach makes sense." For a complex system, it means the user has reviewed and approved the design summary. The point is: no one should be surprised by what gets built.

## Presenting the Design

For complex designs, present incrementally — section by section. Don't dump the full design and ask "does this work?" Instead:

- Present one section (e.g., data model, API layer, UI flow)
- Ask if it looks right before moving to the next
- Each section builds on the ones already approved
- If a section reveals a problem with an earlier one, go back and fix it

For simple designs, a single summary is enough. Scale the presentation to the complexity.

## When You Have Enough

You'll know. The key decisions are made, the approach is clear, the scope is defined. Don't keep asking questions to fill a checklist.

Present a summary of what was decided:

```
## Design Summary

**What we're building:** [one sentence]

**Approach:** [the chosen approach and why]

**Key decisions:**
- [Decision 1] — [why]
- [Decision 2] — [why]
- [Decision 3] — [why]

**Scope:** [what's in, what's explicitly out]

**Open questions:** [anything unresolved, if any]
```

Ask the user if this captures it correctly. Iterate if needed.

## After the Design Summary

Once the user approves the summary, the next step depends on complexity. Do the right thing automatically — don't ask the user which path to take.

### Tier 1 (Direct) — Simple, focused work

Single-file changes, clear tasks, focused deliverables where the brainstorm conversation captured all the decisions needed. The design summary in the conversation is sufficient.

**Skip the written spec and plan.** Transition directly to building. The decisions live in the conversation and in the code.

### Tier 2+ (One companion or more) — Multi-file or complex work

Features spanning multiple files, new systems, work that will be referenced later, or anything where the reasoning behind decisions matters for future sessions.

**Write the full design spec:**

- Save to `docs/fellowship/specs/YYYY-MM-DD-<topic>-design.md`
- Include: the decisions and reasoning, not just the what but the why
- Include: approaches that were considered and rejected (future-you will want to know)
- Scale the doc to the complexity — a few paragraphs for a simple feature, detailed sections for a complex system

Ask the user to review the written spec before moving on.

**Spec review.** If the design is complex, a technical architecture review can catch structural issues, missing edge cases, and unclear boundaries before implementation starts. If available, dispatch a reviewer to assess the spec — then fix issues and iterate until clean.

**Visual exploration.** If the brainstorm involves visual choices (layouts, mockups, design directions), a product designer can create explorations that inform the decision better than text descriptions. If available, dispatch a designer to explore visual options.

**Then invoke the planning skill** to create an implementation plan.

### The user can always override

"Write a spec for this" forces spec creation even for Tier 1 work. "Just build it" skips artifacts even for complex work. Respect the override.

## Other Next Steps

Not every brainstorm leads to implementation:

- **Need deeper architecture?** → Dispatch Merry for system design
- **Need research first?** → Search the web directly, or dispatch Sam if the question is infrastructure or deployment-related

Don't force a single path. The quest determines the next step.

## Principles

- **Conversation, not ceremony.** The structure serves the dialogue, not the other way around.
- **Decisions are the output.** A brainstorm without captured decisions is just a chat.
- **Context is power.** Check what exists before asking. Reference past decisions. Build on accumulated knowledge.
- **The user makes the final call.** Guide, challenge, illuminate — but don't decide for them.
