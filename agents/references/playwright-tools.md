# Browser Verification Tools (Playwright MCP) — Pippin Reference

These tools are available when the Playwright MCP is registered. You already know their names — do not scan session history or probe for their existence. Use them directly.

## Registration (user must run once)

```bash
claude mcp add playwright -- npx @playwright/mcp@latest --caps vision
```

`--caps vision` is required. The accessibility tree alone cannot catch visual problems — misaligned layouts, wrong colors, overlapping elements. Screenshots are evidence.

## Common failure mode — MCP not registered

If Playwright tools are unavailable, report BLOCKED immediately:

```
Status: BLOCKED
Blocker: Playwright MCP is not registered.
  Fix: claude mcp add playwright -- npx @playwright/mcp@latest --caps vision
  Then restart the session and re-dispatch.
```

## Tool reference

Tools are called as `mcp__playwright__<toolname>`.

### Navigation

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Go to a URL |
| `browser_navigate_back` | Browser back button |
| `browser_wait_for` | Wait for a condition (element, URL, or timeout) |
| `browser_reload` | Reload the current page |

### Observation

| Tool | Purpose |
|------|---------|
| `browser_snapshot` | Accessibility tree — primary mode for reading page state and finding elements |
| `browser_take_screenshot` | Visual screenshot — use for evidence capture at key states |
| `browser_evaluate` | Run JavaScript in the page context (check application state directly) |

### Interaction

| Tool | Purpose |
|------|---------|
| `browser_click` | Click an element (use accessibility tree ref from `browser_snapshot`) |
| `browser_type` | Type text into a focused element |
| `browser_fill_form` | Fill a form field by label |
| `browser_select_option` | Select a dropdown option |
| `browser_press_key` | Press a keyboard key (Enter, Tab, Escape, etc.) |
| `browser_hover` | Hover over an element |

### Diagnostics

| Tool | Purpose |
|------|---------|
| `browser_console_messages` | Capture console output — filter to `error` and `warning` |
| `browser_network_requests` | Capture network activity — filter to 4xx/5xx status codes |

### Assertions

| Tool | Purpose |
|------|---------|
| `browser_verify_text_visible` | Assert text is visible on the page |
| `browser_verify_element_visible` | Assert an element is visible |
| `browser_verify_value` | Assert an input has a specific value |

## Token budget guidance

Playwright output can be large. Keep cost down:

- Use `browser_snapshot` for navigation and finding elements — the accessibility tree is structured text, cheaper than images
- Use `browser_take_screenshot` at checkpoints, not constantly — 2–5 per verification session
- Filter `browser_console_messages` to errors/warnings before reading — raw logs from SPAs are enormous
- Filter `browser_network_requests` to failed requests (4xx/5xx) — successful requests are noise
- If the accessibility tree is huge on a complex page: use `browser_verify_*` assertions instead of reading the full snapshot
