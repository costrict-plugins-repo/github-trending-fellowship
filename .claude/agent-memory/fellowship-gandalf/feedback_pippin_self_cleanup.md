---
name: Pippin must self-check diagnostics
description: Pippin should check for and fix lint/diagnostic warnings in test code before reporting done, since no one reviews Pippin's output
type: feedback
---

Pippin should check for diagnostics (unused imports, unused variables, lint warnings) in test files and fix them before reporting done.

**Why:** No companion reviews Pippin's work — tests are the last stop. If Pippin leaves warnings behind, they stay. Gimli has Legolas, but Pippin has no reviewer.

**How to apply:** When dispatching Pippin, include in the prompt that Pippin must check for and fix any diagnostic warnings in the test files before reporting done. This is part of the "done" criteria.
