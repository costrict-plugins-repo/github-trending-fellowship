#!/usr/bin/env node

/**
 * Fellowship Health Check
 *
 * Validates plugin wiring: manifests, settings, hooks, agent frontmatter,
 * skill directories, and cross-references. Structural validation only —
 * no runtime execution, no network calls, no file modification.
 */

import { readFileSync, existsSync, readdirSync, statSync, accessSync, constants } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const KNOWN_TOOLS = new Set(['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebFetch', 'WebSearch', 'Agent', 'TodoWrite', 'Task']);
// MCP tools follow the pattern mcp__<server>__<tool> or mcp__<server>__* — always valid
const isMcpTool = (tool) => tool.startsWith('mcp__');

const results = [];

function pass(msg) {
  results.push({ ok: true, msg });
}

function fail(msg) {
  results.push({ ok: false, msg });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJSON(relPath) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) return { error: `${relPath} not found` };
  try {
    return { data: JSON.parse(readFileSync(abs, 'utf8')) };
  } catch (e) {
    return { error: `${relPath} is not valid JSON: ${e.message}` };
  }
}

/**
 * Simple YAML frontmatter parser — splits on `---` delimiters and extracts
 * flat fields and arrays. No external deps.
 */
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const raw = match[1];
  const result = {};
  let currentKey = null;

  for (const line of raw.split('\n')) {
    // Array item (indented "- value")
    const arrayItem = line.match(/^\s+-\s+(.+)/);
    if (arrayItem && currentKey) {
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      result[currentKey].push(arrayItem[1].trim());
      continue;
    }

    // Key: value pair
    const kv = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kv) {
      currentKey = kv[1];
      const val = kv[2].trim();
      if (val && val !== '|') {
        result[currentKey] = val;
      }
      continue;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 1. Plugin manifest
// ---------------------------------------------------------------------------

function checkPluginManifest() {
  const { data, error } = readJSON('.claude-plugin/plugin.json');
  if (error) { fail(`plugin.json \u2014 ${error}`); return; }

  const required = ['name', 'description'];
  const missing = required.filter(f => !data[f]);
  if (missing.length) {
    fail(`plugin.json \u2014 missing fields: ${missing.join(', ')}`);
  } else {
    pass('plugin.json \u2014 valid, all required fields present');
  }

  const version = data.version;
  if (!version) {
    fail('plugin.json \u2014 version field missing');
  } else if (!/^\d+\.\d+\.\d+/.test(version)) {
    fail(`plugin.json \u2014 version "${version}" is not valid semver`);
  } else {
    pass(`plugin.json \u2014 version "${version}" is valid semver`);
  }
}

function checkCursorManifest() {
  // Optional: Cursor support. Validated only when the file exists.
  // Absence is fine \u2014 Cursor support is not required.
  if (!existsSync(resolve(ROOT, '.cursor-plugin/plugin.json'))) return;
  const { data, error } = readJSON('.cursor-plugin/plugin.json');
  if (error) { fail(`.cursor-plugin/plugin.json \u2014 ${error}`); return; }

  const required = ['name', 'version', 'hooks'];
  const missing = required.filter(f => !data[f]);
  if (missing.length) {
    fail(`.cursor-plugin/plugin.json \u2014 missing fields: ${missing.join(', ')}`);
    return;
  }
  if (!/^\d+\.\d+\.\d+/.test(data.version)) {
    fail(`.cursor-plugin/plugin.json \u2014 version "${data.version}" is not valid semver`);
    return;
  }
  // Hooks pointer must resolve.
  const hookPath = data.hooks.replace(/^\.\//, '');
  if (!existsSync(resolve(ROOT, hookPath))) {
    fail(`.cursor-plugin/plugin.json \u2014 hooks "${data.hooks}" does not resolve to a file`);
    return;
  }
  pass(`.cursor-plugin/plugin.json \u2014 valid, version "${data.version}", hooks resolve`);
}

// ---------------------------------------------------------------------------
// 1b. Marketplace manifest \u2014 version lives here for relative-path plugins
// ---------------------------------------------------------------------------

function checkMarketplaceManifest() {
  const { data, error } = readJSON('.claude-plugin/marketplace.json');
  if (error) { fail(`marketplace.json \u2014 ${error}`); return; }

  const plugins = data.plugins;
  if (!Array.isArray(plugins) || plugins.length === 0) {
    fail('marketplace.json \u2014 missing or empty "plugins" array');
    return;
  }

  const version = plugins[0].version;
  if (!version) {
    fail('marketplace.json \u2014 plugins[0].version missing');
    return;
  }

  if (!/^\d+\.\d+\.\d+/.test(version)) {
    fail(`marketplace.json \u2014 plugins[0].version "${version}" is not valid semver`);
    return;
  }

  pass(`marketplace.json \u2014 plugins[0].version "${version}" is valid semver`);
}

// ---------------------------------------------------------------------------
// 2. Settings
// ---------------------------------------------------------------------------

function checkSettings() {
  const settingsPath = resolve(ROOT, 'settings.json');
  if (!existsSync(settingsPath)) {
    // Absence is the correct state: Gandalf identity is injected via the
    // SessionStart hook (skills/using-fellowship/SKILL.md), not via agent override.
    // Plugin-level statusLine is not honored by Claude Code, so a settings.json
    // declaring only that key would be silent dead code.
    pass('settings.json \u2014 absent (correct \u2014 Gandalf injected via hook, no plugin-level overrides needed)');
    return;
  }

  const { data, error } = readJSON('settings.json');
  if (error) { fail(`settings.json \u2014 ${error}`); return; }

  const agent = data.agent;
  if (!agent) {
    // No default-agent override is correct: Gandalf identity is injected via
    // the SessionStart hook (skills/using-fellowship/SKILL.md), not via agent override.
    // The vanilla default agent inherits all native tools including TodoWrite.
    pass('settings.json \u2014 no default-agent override (correct \u2014 Gandalf injected via hook)');
    return;
  }

  // If an agent field is present, verify it resolves
  // Resolve agent ref like "fellowship:gandalf" -> agents/gandalf.md
  const agentName = agent.includes(':') ? agent.split(':').pop() : agent;
  const agentFile = `agents/${agentName}.md`;
  if (existsSync(resolve(ROOT, agentFile))) {
    pass(`settings.json \u2014 agent "${agent}" resolves to ${agentFile}`);
  } else {
    fail(`settings.json \u2014 agent "${agent}" does not resolve to a file (expected ${agentFile})`);
  }
}

// ---------------------------------------------------------------------------
// 3. Hook scripts
// ---------------------------------------------------------------------------

function checkHooks() {
  const { data, error } = readJSON('hooks/hooks.json');
  if (error) { fail(`hooks/hooks.json \u2014 ${error}`); return; }

  const hookGroups = data.hooks;
  if (!hookGroups || typeof hookGroups !== 'object') {
    fail('hooks/hooks.json \u2014 missing or invalid "hooks" object');
    return;
  }

  const eventCount = Object.keys(hookGroups).length;
  let allFound = true;

  for (const matchers of Object.values(hookGroups)) {
    for (const matcher of matchers) {
      for (const hook of (matcher.hooks || [])) {
        if (hook.type !== 'command') continue;
        const cmd = hook.command;

        // Extract script name from command string.
        // Pattern: "...run-hook.cmd" <script-name>
        // We check that the referenced script exists in hooks/.
        const scriptMatch = cmd.match(/hooks\/run-hook\.cmd['"]*\s+(\S+)/);
        if (scriptMatch) {
          const scriptName = scriptMatch[1].replace(/["']/g, '');
          const scriptPath = resolve(ROOT, 'hooks', scriptName);
          if (!existsSync(scriptPath)) {
            fail(`hooks/hooks.json \u2014 script "hooks/${scriptName}" not found`);
            allFound = false;
          } else {
            // Check executable
            try {
              accessSync(scriptPath, constants.X_OK);
            } catch {
              fail(`hooks/hooks.json \u2014 script "hooks/${scriptName}" exists but is not executable`);
              allFound = false;
            }
          }
        }
      }
    }
  }

  if (allFound) {
    pass(`hooks/hooks.json \u2014 ${eventCount} hook event${eventCount !== 1 ? 's' : ''}, all scripts found`);
  }
}

// ---------------------------------------------------------------------------
// 4 & 5. Agent frontmatter — skills and tools
// ---------------------------------------------------------------------------

const referencedSkills = new Set();

function checkAgents() {
  const agentsDir = resolve(ROOT, 'agents');
  if (!existsSync(agentsDir)) { fail('agents/ directory not found'); return; }

  const files = readdirSync(agentsDir).filter(f => f.endsWith('.md'));
  if (files.length === 0) { fail('agents/ \u2014 no .md files found'); return; }

  for (const file of files) {
    const filePath = join(agentsDir, file);
    const text = readFileSync(filePath, 'utf8');
    const fm = parseFrontmatter(text);

    if (!fm) {
      fail(`agents/${file} \u2014 no valid YAML frontmatter found`);
      continue;
    }

    // Check `name:` field is the bare filename (no `fellowship:` prefix).
    // Claude Code adds the plugin namespace at runtime \u2014 declaring it in the
    // frontmatter causes double-prefixing (e.g. `fellowship:fellowship:merry`)
    // in dispatched-agent labels. The invocation token is `fellowship:<name>`,
    // but the declared name is bare.
    const expectedName = file.replace(/\.md$/, '');
    if (fm.name !== expectedName) {
      fail(`agents/${file} \u2014 name "${fm.name || '(missing)'}" does not match expected "${expectedName}" (bare; no fellowship: prefix)`);
    } else {
      pass(`agents/${file} \u2014 name "${fm.name}" matches filename`);
    }

    // Check skills resolve
    const skills = Array.isArray(fm.skills) ? fm.skills : fm.skills ? [fm.skills] : [];
    let skillsOk = true;
    for (const skill of skills) {
      referencedSkills.add(skill);
      const skillDir = resolve(ROOT, 'skills', skill);
      if (!existsSync(skillDir) || !statSync(skillDir).isDirectory()) {
        fail(`agents/${file} \u2014 skill "${skill}" does not match a directory in skills/`);
        skillsOk = false;
      }
    }
    if (skillsOk) {
      pass(`agents/${file} \u2014 frontmatter valid, ${skills.length} skill${skills.length !== 1 ? 's' : ''} resolve${skills.length === 1 ? 's' : ''}`);
    }

    // Check tools
    const tools = Array.isArray(fm.tools) ? fm.tools : fm.tools ? [fm.tools] : [];
    const unknownTools = [];
    for (const tool of tools) {
      if (isMcpTool(tool)) continue; // MCP wildcard patterns are always valid
      // Handle Agent(...) style tool refs — extract base name
      const baseName = tool.match(/^(\w+)/)?.[1] || tool;
      if (!KNOWN_TOOLS.has(baseName)) {
        unknownTools.push(tool);
      }
    }
    if (unknownTools.length > 0) {
      for (const t of unknownTools) {
        fail(`agents/${file} \u2014 tool "${t}" not in known tools list`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Skill directories
// ---------------------------------------------------------------------------

function checkSkillDirs() {
  const skillsDir = resolve(ROOT, 'skills');
  if (!existsSync(skillsDir)) { fail('skills/ directory not found'); return; }

  const dirs = readdirSync(skillsDir).filter(d => {
    const p = join(skillsDir, d);
    return statSync(p).isDirectory();
  });

  for (const dir of dirs) {
    const skillMd = join(skillsDir, dir, 'SKILL.md');
    if (existsSync(skillMd)) {
      pass(`skills/${dir}/ \u2014 SKILL.md present`);
    } else {
      fail(`skills/${dir}/ \u2014 SKILL.md missing`);
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Cross-references — skill integrity
// ---------------------------------------------------------------------------
// Note: skills are loaded contextually by Gandalf, not declared in agent frontmatter.
// We only verify that any skill explicitly referenced in agent frontmatter resolves
// to a real directory — that check already happens in checkAgents().
// We do NOT flag skills without agent references as orphans; they are valid.

function checkCrossRefs() {
  // No-op: orphan detection removed — skills are Gandalf-loaded, not agent-declared.
  // Future: add a check that every SKILL.md has a non-empty `description` frontmatter field.
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

console.log('Fellowship Health Check');
console.log('=======================');

checkPluginManifest();
checkCursorManifest();
checkMarketplaceManifest();
checkSettings();
checkHooks();
checkAgents();
checkSkillDirs();
checkCrossRefs();

const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;

for (const r of results) {
  console.log(`${r.ok ? '\u2713' : '\u2717'} ${r.msg}`);
}

console.log();
console.log(`Summary: ${passed} passed, ${failed} failed`);

process.exit(failed > 0 ? 1 : 0);
