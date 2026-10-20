---
name: Direct mode for companions
description: Companions should support being run directly (not via Gandalf) for parallel work — especially Arwen, Bilbo, Sam, Merry, Aragorn
type: project
---

Companions need a dual-mode design: subagent mode (dispatched by Gandalf) and direct mode (user runs them standalone via `claude --agent fellowship:arwen`).

**Why:** Gandalf's Tier 3-4 work (full Gimli → Legolas → Pippin cycles) takes significant time. User wants to do parallel work — iterating on design with Arwen, polishing copy with Bilbo, exploring architecture with Merry — while Gandalf orchestrates heavy implementation in another terminal.

**How to apply:** When building new companions, add a direct-mode section to each agent definition: "When working directly with the user (not dispatched by Gandalf), converse naturally. Skip structured reporting format. You own the full conversation." The skills and expertise stay identical; only the communication protocol changes. High-value direct-mode companions: Arwen, Bilbo, Sam, Merry, Aragorn.
