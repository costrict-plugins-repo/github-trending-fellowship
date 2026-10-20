---
name: CLI agent flag works
description: claude --agent fellowship:arwen is valid CLI syntax for starting a direct session with a named agent
type: feedback
---

`claude --agent fellowship:<name>` is valid Claude Code CLI syntax. Starts a direct session with the named agent in the current project directory.

**Why:** Confirmed by user — I incorrectly said the flag didn't exist.

**How to apply:** When users ask how to run a companion directly, offer `claude --agent fellowship:<name>` as the primary method alongside the `/agents` dialog. Also: `color: magenta` and `color: pink` are not valid agent colors — they fall back to gray. Valid colors: red, orange, yellow, green, blue, purple, cyan.
