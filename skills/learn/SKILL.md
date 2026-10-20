---
name: learn
description: "Use when Frodo asks 'what do you remember?', when memory references feel stale, or on explicit /fellowship:learn invocation. Reviews, prunes, or exports per-agent memory across the Fellowship. Curator only — never modifies memory without Frodo's approval."
user-invocable: false
---

# Learn

Curator for per-agent memory living under `.claude/agent-memory/fellowship-*/`. Reads, surfaces, and proposes changes. Frodo approves every write.

**The hard rule:** this skill never modifies a companion's memory without explicit Frodo approval. Not once. Not for "small" edits. Not for batch cleanups. Every delete, every edit — one question at a time, one confirmation at a time.

## Memory layout — what you are reading

```
.claude/agent-memory/
  fellowship-gandalf/
    MEMORY.md              # index — one-line pointers
    user_karolus.md        # individual memory file with frontmatter
    feedback_xyz.md
    ...
  fellowship-gimli/
    MEMORY.md
    ...
```

Each individual file has frontmatter fields `name`, `description`, `type`. `MEMORY.md` is a flat index of one-line pointers, no frontmatter of its own. Memory types are `user`, `feedback`, `project`, `reference`.

The canonical format is defined inside each agent's system prompt (see `agents/gandalf.md` "Persistent Agent Memory" section, and equivalent sections in other companions). Do not redefine the format here; read from it.

## Detect the command

Parse the user's invocation:

- `/fellowship:learn` → **Review** (default)
- `/fellowship:learn prune` → **Prune**
- `/fellowship:learn export` → **Export**

If loaded by Gandalf without a slash invocation, default to **Review** unless the loading context names a different mode.

A fourth mode — `summarize` — is deferred to v2. If the user asks to summarize or collapse memories, tell them the mode is not yet available and offer prune + export as alternatives.

## Review (default mode)

Walk each directory under `.claude/agent-memory/fellowship-*/`. For each agent:

- Name of the agent.
- Total number of memory files (excluding `MEMORY.md`).
- The five most recently modified entries — show each file's `name` and `description` fields.
- Flag obvious concerns inline. Examples: *"3 of Gimli's 12 memories reference files that no longer exist"*, *"Two Legolas feedback memories on the same topic look contradictory."*

Group by agent. Do not merge across agents — each companion's voice is preserved. The output is conversational, not a file. Frodo reads it and decides what to do next.

## Prune

Two automatic checks, then a decision loop.

**Check 1 — File-existence.** If a memory file mentions a path in its content, confirm the path exists. Missing file → flag `STALE`.

**Check 2 — Contradiction.** Scan for memories on the same topic with contradicting guidance. Example: two `feedback` entries where one says "always X" and a later one says "never X". Flag `CONFLICT`.

For each flagged entry, present the content and ask Frodo via `AskUserQuestion`:

- **A) Remove** — delete the file, remove its pointer from `MEMORY.md`.
- **B) Keep** — do nothing.
- **C) Edit** — Frodo tells what to change. Propose the diff. Ask again before writing.

After Frodo answers for one entry, move to the next. **Do not batch-apply.** One entry, one decision, one write. This is deliberately slow. Speed is not the goal; the goal is that Frodo owns every change to companion memory.

**When removing a file:** delete the memory file, then open `MEMORY.md` and drop the corresponding pointer line. If `MEMORY.md` ends up empty after the deletion — leave the index header in place, but clear the pointer lines. Do not delete `MEMORY.md` itself. An empty index is a valid state; a missing index signals "this agent has never remembered anything," which is false.

## Export

Write a consolidated, human-readable snapshot of all memory to `docs/fellowship/memory-snapshot-YYYY-MM-DD.md` (use today's date). This file does not modify live memory — it is a read-only dump.

**Format:**

```markdown
# Fellowship Memory Snapshot — YYYY-MM-DD

## Gandalf

### User
- [name] — [description]
  [body]

### Feedback
- ...

### Project
- ...

### Reference
- ...

## Gimli

### User
...
```

Group by agent, then by memory type in the order `user`, `feedback`, `project`, `reference`. Within each type, list entries in the order they appear in the agent's `MEMORY.md` index.

The snapshot is for reading, sharing, or diffing against a future snapshot. It is additive — it never replaces or modifies the per-agent memory files.

If a snapshot for today's date already exists, ask Frodo whether to overwrite or append a suffix like `-v2`.

## Gandalf auto-load signals

Gandalf loads this skill in session when:

- Frodo asks *"what do you remember?"* / *"what have we learned?"* / *"have we done this before?"*.
- Gandalf notices a memory reference is stale mid-orchestration (e.g., a companion cites a file that no longer exists).
- Frodo explicitly invokes `/fellowship:learn`.

Do **not** load proactively on every session. That is noise. Let the trigger be a real signal.

## Principles

- Memory is the companion's journal. The curator proposes; Frodo decides.
- One change at a time. Never batch deletes.
- Preserve voice — each agent's memory stays with that agent. Exports group by agent; they never merge.
- Additive over destructive. Export and review before prune.
- Absence of memory is itself information. Empty indexes stay.
