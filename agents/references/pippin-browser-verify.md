# Pippin Browser Verification Procedure

Load when running Mode 4 (Browser Verification) — walking a UI feature after code review approves it. Browser verification requires the Playwright MCP. For tool reference (every `browser_*` tool with purpose), token-budget guidance, and the exact registration command and BLOCKED format for missing MCP: see `playwright-tools.md`.

---

## Workflow

```
1. Check for a running dev server
   - Probe: localhost:3000, :5173, :4321, :8080, :8000
   - If already running → use it (don't start a second one)
   - If none found → read package.json scripts and start it
     (npm run dev / bun dev / pnpm dev — whichever the project uses)
   - Wait up to 10 seconds for the server to be reachable
   - If still unreachable → report BLOCKED with what you tried

2. Open and confirm the entry point
   - browser_navigate to localhost:<port>/<starting-route>
   - browser_take_screenshot — confirm the page loaded (not blank, not error)
   - browser_snapshot — read the accessibility tree; orient yourself

3. Walk the specified flow step by step
   - browser_snapshot → identify the next element → interact → browser_snapshot
   - browser_console_messages after each navigation or form submission
     (filter to errors and warnings — ignore info/debug noise)
   - browser_network_requests after each API call
     (filter to 4xx/5xx — ignore successful requests)
   - browser_verify_text_visible / browser_verify_element_visible
     to assert expected states from the spec

4. Capture evidence at key moments
   - browser_take_screenshot: at initial state, after key interactions, at final state
   - Save screenshots to docs/fellowship/verifications/
     Naming: verification-[feature]-[step]-[YYYY-MM-DD].png
   - Minimum 2 screenshots, focus on the moments that tell the story

5. Write the verification report to docs/fellowship/verifications/
   verification-[feature]-[YYYY-MM-DD].md
```

---

## Verification Report Format

```
Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED

What was verified:
  [the flows and routes walked — trace back to the dispatch spec]

Steps taken:
  1. [action] → [result] ✓ | ✗
  2. [action] → [result] ✓ | ✗
  ...

Console errors:
  [errors/warnings captured, or "None"]

Failed network requests:
  [4xx/5xx requests with URL and status, or "None"]

Screenshots:
  - docs/fellowship/verifications/[filename] — [what it shows]
  ...

Issues found:
  1. [issue title]
     - Severity: blocker | major | minor | cosmetic
     - Step: [which step]
     - Expected: [what the spec says should happen]
     - Actual: [what the browser showed]
     - Evidence: [screenshot path or console error]

Concerns: (DONE_WITH_CONCERNS only)
  [things that work but feel wrong]

Blocker: (BLOCKED only)
  [what's blocking — MCP not available, dev server unreachable, page won't load]
```

---

## Out of Scope for This Mode

- Writing test code (that is test-after or test-first mode)
- Fixing anything (findings go to Gimli)
- Running the automated test suite (separate)
- Navigating outside the specified flows (scope discipline)
- Guessing what to verify (the dispatch must be specific; if not, ask)
