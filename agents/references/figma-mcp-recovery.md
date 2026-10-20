# Figma MCP — Tools and Recovery (Arwen Reference)

You know your tools. Their names, exact call format, and failure modes are documented here. You do not need to discover them, scan session history, grep transcripts, or probe for their existence. Use them directly.

**Never** run `claude mcp list`, search `~/.claude/projects/` for tool names, or grep session transcripts for MCP patterns. You already know the tool names.

## Exact tool name format

Tools are called as `mcp__<server>__<toolname>`. The servers and their prefixes:

| Server | Prefix | Example call |
|--------|--------|--------------|
| figma-console | `mcp__figma-console__` | `mcp__figma-console__figma_execute` |
| figma-official | `mcp__figma-official__` | `mcp__figma-official__get_file_nodes` |
| claude-talk-to-figma | `mcp__claude-talk-to-figma__` | `mcp__claude-talk-to-figma__get_selection` |
| pencil | `mcp__pencil__` | `mcp__pencil__batch_get` |

## Common failure mode — plugin bridge not active

figma-console runs as a local MCP server (port 9225 by default). The MCP server can be **connected** (visible in `claude mcp list`) but still **expose no tools**. This happens when the Figma Console plugin inside the Figma desktop app is not open. The MCP server needs the plugin bridge running inside Figma to register its tools.

When this occurs: do not investigate, do not search session history. Report BLOCKED immediately:

```
Status: BLOCKED
Blocker: figma-console MCP is connected but not exposing tools.
  Fix: Open the Figma Console plugin inside your Figma desktop app (Plugins → Figma Console).
  The MCP server is running but needs the plugin bridge active inside Figma to register its tools.
```

For the plugin-based servers (figma-console, claude-talk-to-figma): if tools don't respond, the plugin is not open in Figma. That is always the cause. Name it directly and stop.

## Tools

### `figma-console` — Primary workhorse

84+ tools via the Figma Console plugin bridge. Design system extraction, variable management, node manipulation.

- **Reading:** `figma_get_file_data`, `figma_get_design_system_kit`, `figma_get_variables`, `figma_get_styles`, `figma_get_local_components`
- **Variables/tokens:** `figma_batch_create_variables`, `figma_setup_design_tokens`, `figma_update_variable`, `figma_get_variable_collections`
- **Nodes:** `figma_set_text`, `figma_move_node`, `figma_resize_node`, `figma_clone_node`, `figma_delete_node`, `figma_set_fills`, `figma_set_strokes`, `figma_set_corner_radius`, `figma_set_opacity`
- **Components:** `figma_search_components`, `figma_instantiate_component`, `figma_get_component`, `figma_detach_instance`
- **Layout:** `figma_set_auto_layout`, `figma_set_padding`, `figma_set_gap`, `figma_create_frame`, `figma_create_rectangle`, `figma_create_text`
- **Debug/verify:** `figma_take_screenshot`, `figma_get_console_logs`, `figma_execute` (arbitrary JS in Figma context)
- **Quality:** `figma_lint_design`, `figma_check_design_parity`
- **FigJam:** `figjam_create_sticky`, `figjam_create_connector`, `figjam_create_table`

Use when: reading the design system, managing variables/tokens, bulk node manipulation, creating complex structures, verifying output.

### `figma-official` — Read/inspect API

Official Figma REST API. Read access to file structure, component metadata, styles.

- `get_file_nodes` — get specific nodes by ID
- `get_file` — full file structure
- `get_component` — component metadata
- `get_style` — style details
- `get_team_components` — team component library

Use when: inspecting file structure before modifying, reading component metadata from the Figma API directly. Does not require the plugin to be open — uses the Figma API token.

### `claude-talk-to-figma` — Real-time manipulation

Requires the Claude Talk to Figma plugin running inside Figma. Direct socket connection for real-time manipulation.

- `get_selection` — current selection in Figma
- `set_text_content` — update text
- `export_node_as_image` — export a node
- `create_rectangle`, `create_frame`, `create_text` — create elements

Use when: interactive sessions requiring immediate feedback, precise element adjustment, when you want to see changes in real time.

### `pencil` — Wireframes

Pencil app for wireframing and ideation.

- `batch_get` — read .pen file contents
- `batch_design` — write design changes to .pen files

Use when: initial concept exploration before committing to high-fidelity Figma work. Layout concepts, user flow sketches.

## Typical Figma workflows

*Transferring document content to Figma template:*
1. `figma_get_file_data` or `figma_get_design_system_kit` — understand the template structure
2. Read source document to extract content sections
3. Map sections to Figma frames
4. `figma_set_text` for text content
5. `figma_take_screenshot` to verify result

*Building a design system:*
1. `figma_get_variables` — inspect existing tokens
2. `figma_setup_design_tokens` or `figma_batch_create_variables` — create/update tokens
3. `figma_get_component` — inspect components
4. `figma_check_design_parity` — verify code/design alignment

*Parallel Figma work (teammate mode):*
Multiple Arwen instances can work on different frames/pages simultaneously. Each instance claims its scope explicitly: "Instance A: pages 1–3. Instance B: pages 4–6." Write a brief log to `.arwen/[scope]-log.md` as work progresses.
