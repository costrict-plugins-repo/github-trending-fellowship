# Caveman — Reference Analysis

**Source:** https://github.com/juliusbrussee/caveman  
**Author:** Julius Brussee  
**Type:** Claude Code skill / multi-agent plugin  
**License:** MIT

---

## What It Is

Caveman is a token-compression skill for Claude Code and 40+ other AI agents. Core premise: remove articles, filler words, pleasantries, and hedging while preserving technical substance. Claims ~75% output token reduction (benchmarked 22–87% depending on task).

```
"why use many token when few token do trick"
```

## Architecture

**Single-purpose skill** — no orchestration, no agents, no lifecycle management. One skill that does one thing well. Contrast to Fellowship's multi-companion model.

**Activation:** Keyword triggers ("caveman mode", `/caveman`) or hook-based auto-activation. Persists across responses until explicitly disabled ("stop caveman").

**Five intensity levels:**

| Level | Behavior |
|-------|----------|
| Lite | Removes filler; retains articles and full sentences |
| Full (default) | Fragments permitted; drops articles; short synonyms |
| Ultra | Abbreviates (DB/auth/config); arrows for causality (X → Y) |
| Wenyan-lite/full/ultra | Classical Chinese variants with increasing compression |

**Sub-skills:**
- `caveman-commit` — terse conventional commits (≤50 chars)
- `caveman-review` — one-line PR comments with locations
- `caveman-compress` — compresses markdown/text files; ~46% input token reduction; Python runner with retry logic; never touches code files

**Hard constraints preserved regardless of mode:**
- Code blocks unchanged
- Security warnings revert to normal clarity
- Irreversible action confirmations revert to normal clarity

---

## What It Does Well

**Single-responsibility done cleanly.** Caveman doesn't try to be a full agent system. It has one job and a clear on/off switch. The multi-level design (Lite → Full → Ultra → Wenyan) lets users tune compression without abandoning the skill.

**Compression as a command, not a mode.** `caveman-compress` separates input compression (files, memory) from output compression (responses). That distinction is sharp — compressing your context before loading it is different from compressing what you say.

**Cross-platform breadth.** Supporting 40+ agents with the same skill definition is an interesting distribution story. Fellowship doesn't attempt this — Claude Code only — but the portability design is worth understanding.

**Hooks for auto-activation.** The pre-tool-use hook pattern for auto-activation mirrors Fellowship's SessionStart/PostToolUse hooks. Same mechanism, different purpose.

---

## What Fellowship Can Learn

**1. caveman-compress is directly applicable.**  
Fellowship's quest log, product.md, and debug-log grow over sessions. A `/fellowship:compress` command following Caveman's pattern (Python runner, backup .original.md, preserve structure, retry on failure) would reduce hook injection cost significantly. Quest log consolidation is manual today — compression could make it automatic.

**2. Intensity as a design axis.**  
Fellowship doesn't offer verbosity tuning. Gandalf's voice is fixed. A "terse mode" flag (something like `/fellowship:terse`) that tells all companions to compress their reports would reduce token cost on long Tier 3+ cycles. Not a priority — but the design is clean.

**3. Security/irreversible-action clarity invariants.**  
Caveman's rule: safety-critical content always reverts to full clarity, regardless of compression level. Fellowship has an analogue in Boromir (never compresses security findings) but it's not stated as an explicit invariant across all companions. Worth codifying.

---

## What Fellowship Does That Caveman Doesn't

- Lifecycle management (planning → building → review → test → deploy)
- Specialist routing (the right companion for the task)
- Memory and quest state across sessions
- Character-driven behavioral consistency
- Review cycles, test cycles, security audits

Caveman is a utility. Fellowship is an operating model. They don't compete — they could compose.

---

## Potential Composability

Caveman-compress + Fellowship memory injection: run `/caveman:compress docs/fellowship/quest-log.md` before a long session to reduce hook injection cost. Non-destructive (original backup), reversible, no Fellowship changes needed.

Worth trying on a real session before building a native equivalent.
