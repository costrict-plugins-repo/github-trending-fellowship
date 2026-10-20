---
name: Plugin cache invalidation requires version bump
description: Local plugin changes are invisible to Claude Code until plugin.json version is bumped — even for private plugins
type: feedback
---

The version field in `.claude-plugin/plugin.json` is the only signal Claude Code has that a plugin's contents changed. Without a bump, `claude plugin update` will check the source version against the cache and do nothing. Even for local-directory marketplaces. Even for plugins only Karolus uses.

**Why:** Claude Code copies plugins to `~/.claude/plugins/cache/<marketplace>/<name>/<version>/` for verification. Each version is a separate directory. The cache only refreshes when the source claims a higher version. Direct file edits in the source dir do not propagate.

**How to apply:** When Karolus has made local changes to the Fellowship source and reports that other projects are not seeing them — check `~/.claude/plugins/cache/fellowship/fellowship/` for the cached version, compare to source `plugin.json`, and bump the source version if it is not strictly higher. Then run `claude plugin update fellowship@fellowship` and verify the new version directory appears in the cache.

The bump is not a release decision. Treat it as a cache-bust. Public release versioning is a separate concern.
