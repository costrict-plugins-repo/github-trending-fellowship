---
name: planning
description: "Use after brainstorming to turn a design spec into an implementation plan. Creates a quest log with task breakdown, companion assignments, and execution order."
user-invocable: false
---

# Planning

Turn a design spec into an actionable implementation plan. The input is the design spec from brainstorming. The output is a quest log that companions can execute.

## Before You Start

**Read the design spec.** The brainstorming phase produced a design spec in `docs/fellowship/specs/`. Read it fully. Understand not just what to build, but the decisions that were made and why. If anything is unclear, ask before planning.

**Check project context.** Read the codebase to understand:
- Existing file structure and conventions
- Patterns already in use (how similar features were built)
- Test framework and testing conventions
- Dependencies and tech stack

Don't plan in a vacuum. The plan must work with what exists.

**Scope check.** If the spec covers multiple independent subsystems, each should get its own plan. Each plan should produce working, testable software on its own. If the spec wasn't decomposed during brainstorming, suggest breaking it up now.

## Map the File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Each file should have one clear responsibility
- Follow existing codebase patterns — if the project uses a certain structure, match it
- Prefer smaller, focused files over large ones
- Files that change together should live together
- If an existing file has grown unwieldy, including a split in the plan is reasonable

This map informs the task breakdown. Each task should produce self-contained changes that make sense independently.

## Create the Quest Log

The quest log is the plan's structure. It assigns tasks to companions and defines the execution order.

```markdown
# [Feature Name] Implementation Plan

**Design spec:** `docs/fellowship/specs/YYYY-MM-DD-topic-design.md`

**Goal:** [One sentence — what this builds and why]

**Key decisions from brainstorming:**
- [Decision 1] — [why, from the spec]
- [Decision 2] — [why]

**Tech stack:** [Key technologies/libraries]

---

## Quest Log

### Sequential tasks
1. ⬜ **[Task name]** — [companion] — [what they'll do]
2. ⬜ **[Task name]** — [companion] — [what they'll do]

### Parallel tasks (independent, can run simultaneously)
- ⬜ **[Task name]** — [companion] — [what they'll do]
- ⬜ **[Task name]** — [companion] — [what they'll do]

---

## Validation Contract

> The quest is done when every P0 assertion below is PASS, with cited evidence, and zero P0 assertions are FAIL. P1/P2 FAILs are logged to the quest log, not gates.

- **[P0] [Legolas]** [One observable, binary claim about the finished system — true or false, implementation-independent.]
  - Verify: [command, test to write, or manual step — reuse `Run: X → Expected: Y` where a command exists.]
  - Defends: [requirement/task this assertion traces to.]

- **[P0] [Pippin]** [A claim naming an unhappy path — what must NOT happen. At least one P0 must be a negative case.]
  - Verify: [how a fresh validator scores it from this line alone.]
  - Defends: [requirement it covers.]

- **[P1] [Pippin]** [An important-but-non-gating claim.]
  - Verify: [verification handle.]
  - Defends: [requirement.]

---
```

### Assign companions by expertise

Match tasks to the right companion:
- Building new code, creating files → engineer
- Reviewing, refactoring existing code → QA engineer
- Writing tests for existing code → test engineer
- Deep system design within a task → technical architect
- Security-sensitive work → security engineer

Not every task needs a companion. Simple config changes or one-line fixes can be noted as direct tasks.

### Identify parallel vs sequential

Explicitly mark which tasks can run in parallel and which must be sequential. Tasks are parallel when they:
- Touch different files
- Don't depend on each other's output
- Can be verified independently

Tasks are sequential when:
- One builds on another's output
- They modify the same files
- Later tasks need earlier ones to be working

## Task Detail

Each task should include enough context for the assigned companion to execute independently:

```markdown
### Task N: [Component/Feature Name]

**Assigned to:** [companion role]
**Depends on:** [Task X, or "none"]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts`
- Test: `tests/exact/path/to/test.ts`

**What to build:**
[Clear description of what this task produces. Reference design decisions where relevant — "We chose server actions over API routes (see spec decision #2), so mutations go in actions.ts"]

**Acceptance criteria:**
- [ ] [Specific, verifiable outcome]
- [ ] [Specific, verifiable outcome]
- [ ] Tests pass

**Verification:**
[Exact commands to verify the task is done, with expected output]
- Run: `[exact command]` → Expected: [what success looks like]

**Notes:**
[Anything the companion needs to know — gotchas, edge cases, relevant existing patterns]
```

Include exact verification commands wherever possible. "Tests pass" is vague. `npm test -- --filter=user-profile` with "Expected: 4 tests passed" is actionable.

### Task granularity

Each task should be a meaningful unit of work — something that produces a visible, testable result. Not individual keystrokes.

**Good granularity:**
- "Build the user profile component with edit functionality"
- "Add authentication middleware with role-based access"
- "Create the data migration for the new schema"

**Too granular:**
- "Write the failing test for profile name validation"
- "Run the test to verify it fails"
- "Write the minimal code to make it pass"

The companion decides how to implement within a task. The plan decides what tasks exist and in what order.

### Testing approach

Testing should be part of each task's acceptance criteria, not a separate step. The companion building a feature is responsible for testing it. Mention the project's testing conventions and what level of testing is expected (unit, integration, e2e).

TDD is recommended when it fits — especially for logic-heavy or data-transformation code. But it's not mandated for every task. Styling, configuration, and integration wiring often don't benefit from test-first.

## Author the Validation Contract

The per-task acceptance criteria above confirm each task is done. The validation contract is the quest-level definition-of-done: one consolidated set of weighted, implementation-independent assertions, authored before any code exists, that fresh-context validators score one-by-one to decide whether the quest actually holds. It goes in the `## Validation Contract` section of the quest log.

Author it like this:

1. **Consolidate the seed.** Aragorn's scope produces P0/P1/P2 acceptance criteria. Pull them into one per-quest set. Where no Aragorn pass ran (Tier 2 direct), author the assertions from the spec.
2. **Sharpen each into an adversarial assertion.** Use the four-field form (the template in the quest-log section is canonical — copy its shape):
   - **Weight** — `[P0]` / `[P1]` / `[P2]`, leading the line. P0 is the gate.
   - **Owner-validator** — `[Legolas]` / `[Pippin]` / `[Boromir]`, second. This is the routing key the validator dispatch reads. Assign by who is best placed to score it: Legolas for correctness/spec/structure; Pippin for anything expressible as a test — the bulk of a contract, and the default home for any testable assertion; Boromir for security properties. In `feature-flow`/`bug-flow`, security-property assertions route to Legolas or are absent — `[Boromir]` is used only in `security-flow`. Tagging `[Boromir]` in a flow where Boromir is never dispatched drops the assertion silently from the verdict — an unscored gate, the exact hole the composition rule exists to prevent.
   - **Statement** — one observable, binary claim. Implementation-independent — it must survive a rewrite of the code.
   - **Verify** — the handle a validator who never saw the code uses to score it: a command, a test to write, or a manual step.
   - **Defends** — the requirement or task the assertion traces to. An assertion that defends nothing is a candidate to drop.
3. **Apply the adversarial discriminator.** For every assertion: *could a fresh validator mark this PASS or FAIL from the `Verify:` line alone?* If not, it is theater — rewrite or drop it. And: *does at least one P0 name an unhappy path* — what must NOT happen? An all-happy-path contract confirms; it does not catch.

The contract lives beside the tasks it scores so the two cannot drift apart. The owner-validator tags partition one contract across Legolas/Pippin/Boromir — each scores only the assertions tagged with their name.

## Save the Plan

Save to `docs/fellowship/plans/YYYY-MM-DD-<feature-name>.md`.

The plan should reference the design spec so anyone reading it can trace decisions back to their reasoning.

## Plan Review

If the plan is complex, a technical architecture review can catch:
- Tasks that conflict with design decisions
- Missing dependencies between tasks
- Incorrect companion assignments
- Gaps where the spec requires something the plan doesn't cover

If available, dispatch a reviewer. Fix issues and iterate until clean.

## Recommend the Execution Tier

Not every plan needs multi-agent orchestration. Recommend the lightest tier that serves the plan:

**Tier 1 — Direct.** The plan is simple enough to execute inline. A few edits, a config change, a small feature. No agents needed. Just do it.

**Tier 2 — One companion.** The plan is focused work for one companion. Dispatch one agent, review their output. Most plans land here.

**Tier 3 — Sequential chain.** Multiple tasks that depend on each other. Dispatch companions in sequence — each one builds on the previous output. Review between each step.

**Tier 4 — Parallel dispatch.** Multiple independent tasks. Dispatch companions simultaneously. Only when tasks genuinely don't depend on each other.

**Default to the lowest tier that works.** Agent dispatch has overhead — context setup, isolation, result review. A 10-line change doesn't need an agent. A complex feature with multiple components does.

### When to use skills vs agents

Within a plan, not every need requires dispatching an agent:
- **Quick question about approach?** → Load a skill in-session (no dispatch overhead)
- **Focused implementation work?** → Dispatch an agent (isolated context, scoped tools)
- **Simple edit or config change?** → Handle directly (no skill, no agent)

Include the recommended tier in the plan output:

```markdown
**Recommended tier:** Tier 2 — dispatch engineer for implementation, review inline.
```

## After Planning

Present the quest log to the user. Walk through the task order, companion assignments, tier recommendation, and any judgment calls you made. Get approval before execution begins.

## Principles

- **The spec is the source of truth.** Every task should trace back to a design decision. If it doesn't, question whether it belongs.
- **Companions need context, not scripts.** Give them the what and why, not step-by-step instructions. They're skilled — trust them to figure out the how.
- **Parallel when possible.** Independent tasks running simultaneously saves time. But don't force parallelism — correctness first.
- **DRY, YAGNI.** Don't plan duplicate work. Don't plan features that aren't in the spec. If a task doesn't trace back to a design decision, question it.
- **Plans are living documents.** If execution reveals the plan is wrong, update it. Don't follow a broken plan.
