/**
 * Tests for hooks/session-start
 *
 * Strategy: each test creates a temp fixture that mirrors the layout
 * hooks/session-start expects:
 *   <fixture-root>/hooks/session-start          (the script under test)
 *   <fixture-root>/hooks/fellowship-bootstrap.md
 *   <fixture-root>/skills/using-fellowship/SKILL.md
 *   <fixture-root>/<project>/docs/fellowship/...  (optional, per test)
 *   <fixture-root>/<project>/.claude/...           (optional, per test)
 *
 * The script resolves PLUGIN_ROOT from its own location, and PROJECT_CWD
 * from the CWD env var (fall back to pwd). We always set CWD to the
 * project subdir so plugin assets and project context are cleanly separated.
 *
 * One JSON object is parsed from stdout per run; we then walk the
 * additionalContext / additional_context strings to verify wrappers.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdirSync, writeFileSync, copyFileSync, chmodSync, rmSync, mkdtempSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);

const REPO_ROOT = join(import.meta.dirname, '..');
const SCRIPT_SOURCE = join(REPO_ROOT, 'hooks', 'session-start');
const BOOTSTRAP_SOURCE = join(REPO_ROOT, 'hooks', 'fellowship-bootstrap.md');
const SKILL_SOURCE = join(REPO_ROOT, 'skills', 'using-fellowship', 'SKILL.md');

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

/**
 * Build a fixture. Returns { root, projectDir, scriptPath }.
 *
 * opts:
 *   includeSkill   — default true; set false to omit skills/using-fellowship/SKILL.md
 *   includeBootstrap — default true; set false to omit hooks/fellowship-bootstrap.md
 *   fellowship     — object describing files under <project>/docs/fellowship/
 *                    keys: questLog, product, debugLog, codebaseMap (string content)
 *                    handoff (string content; written as a recent .md in handoffs/)
 *   projectLocal   — { skills: ['foo','bar'], agents: ['baz'] } — creates .claude/skills/<n>/, .claude/agents/<n>.md
 */
function createFixture(opts = {}) {
  const root = mkdtempSync(join(tmpdir(), 'session-start-test-'));

  // Plugin layout — hooks/ at root
  mkdirSync(join(root, 'hooks'));
  copyFileSync(SCRIPT_SOURCE, join(root, 'hooks', 'session-start'));
  chmodSync(join(root, 'hooks', 'session-start'), 0o755);

  if (opts.includeBootstrap !== false) {
    copyFileSync(BOOTSTRAP_SOURCE, join(root, 'hooks', 'fellowship-bootstrap.md'));
  }

  // skills/ at root
  mkdirSync(join(root, 'skills'));
  if (opts.includeSkill !== false) {
    mkdirSync(join(root, 'skills', 'using-fellowship'));
    copyFileSync(SKILL_SOURCE, join(root, 'skills', 'using-fellowship', 'SKILL.md'));
  }

  // Project subdir — distinct from plugin root
  const projectDir = join(root, 'project');
  mkdirSync(projectDir);

  // Optional docs/fellowship/
  if (opts.fellowship) {
    const fdir = join(projectDir, 'docs', 'fellowship');
    mkdirSync(fdir, { recursive: true });
    if (opts.fellowship.questLog !== undefined) {
      writeFileSync(join(fdir, 'quest-log.md'), opts.fellowship.questLog);
    }
    if (opts.fellowship.product !== undefined) {
      writeFileSync(join(fdir, 'product.md'), opts.fellowship.product);
    }
    if (opts.fellowship.debugLog !== undefined) {
      writeFileSync(join(fdir, 'debug-log.md'), opts.fellowship.debugLog);
    }
    if (opts.fellowship.codebaseMap !== undefined) {
      writeFileSync(join(fdir, 'codebase-map.md'), opts.fellowship.codebaseMap);
    }
    if (opts.fellowship.handoff !== undefined) {
      mkdirSync(join(fdir, 'handoffs'));
      writeFileSync(
        join(fdir, 'handoffs', '2026-04-26-recent.md'),
        opts.fellowship.handoff,
      );
    }
  }

  // Optional project-local .claude/
  if (opts.projectLocal) {
    const cdir = join(projectDir, '.claude');
    mkdirSync(cdir);
    if (opts.projectLocal.skills) {
      mkdirSync(join(cdir, 'skills'));
      for (const s of opts.projectLocal.skills) {
        mkdirSync(join(cdir, 'skills', s));
        writeFileSync(join(cdir, 'skills', s, 'SKILL.md'), '# Local skill');
      }
    }
    if (opts.projectLocal.agents) {
      mkdirSync(join(cdir, 'agents'));
      for (const a of opts.projectLocal.agents) {
        writeFileSync(join(cdir, 'agents', `${a}.md`), '---\nname: ' + a + '\n---\n');
      }
    }
  }

  return { root, projectDir, scriptPath: join(root, 'hooks', 'session-start') };
}

/**
 * Run the hook with the given fixture and env. Returns { exitCode, stdout, stderr, parsed }.
 * `parsed` is the JSON.parse(stdout) result, or null if parse failed.
 */
async function runHook(scriptPath, projectDir, env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('bash', [scriptPath], {
      timeout: 10_000,
      env: {
        // Start from a clean env — don't inherit CLAUDE_PLUGIN_ROOT from parent shell.
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        CWD: projectDir,
        ...env,
      },
    });
    let parsed = null;
    try { parsed = JSON.parse(stdout); } catch { /* noop */ }
    return { exitCode: 0, stdout, stderr, parsed };
  } catch (err) {
    let parsed = null;
    try { parsed = JSON.parse(err.stdout ?? ''); } catch { /* noop */ }
    return {
      exitCode: err.code ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      parsed,
    };
  }
}

/**
 * Pull the additionalContext payload regardless of which key shape the
 * platform produced. Returns the raw string (with literal \n sequences,
 * since the hook escapes for JSON embedding).
 */
function extractContext(parsed) {
  if (!parsed) return '';
  if (parsed.additional_context !== undefined) return parsed.additional_context;
  if (parsed.hookSpecificOutput?.additionalContext !== undefined) {
    return parsed.hookSpecificOutput.additionalContext;
  }
  return '';
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('session-start — cold-install path (no docs/fellowship)', () => {
  // S5: when docs/fellowship/ is absent, the hook emits a dormant notice
  // instead of full Gandalf identity. Tire-kicker projects don't get heavy priming.
  let fx;
  before(() => { fx = createFixture(); });
  after(() => cleanup(fx.root));

  it('exits 0 and produces valid JSON', async () => {
    const { exitCode, parsed, stderr } = await runHook(fx.scriptPath, fx.projectDir);
    assert.equal(exitCode, 0, `stderr: ${stderr}`);
    assert.ok(parsed, 'expected JSON output');
  });

  it('emits FELLOWSHIP_DORMANT notice, not the full Gandalf identity', async () => {
    const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
    const ctx = extractContext(parsed);
    assert.match(ctx, /<FELLOWSHIP_DORMANT>/);
    assert.doesNotMatch(ctx, /<EXTREMELY_IMPORTANT>/);
    assert.doesNotMatch(ctx, /You are Gandalf/);
  });

  it('the dormant notice names the bootstrap path', async () => {
    const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
    const ctx = extractContext(parsed);
    assert.match(ctx, /\/fellowship:start|set up Fellowship/);
  });

  it('does NOT include UNTRUSTED_QUEST_LOG, UNTRUSTED_PRODUCT, or FELLOWSHIP_CONTEXT', async () => {
    const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
    const ctx = extractContext(parsed);
    assert.doesNotMatch(ctx, /<UNTRUSTED_QUEST_LOG>/);
    assert.doesNotMatch(ctx, /<UNTRUSTED_PRODUCT>/);
    assert.doesNotMatch(ctx, /<FELLOWSHIP_CONTEXT>/);
  });
});

describe('session-start — bootstrap path (docs/fellowship exists, empty)', () => {
  // When docs/fellowship/ exists but has no contents yet (just bootstrapped),
  // the hook injects full Gandalf identity + bootstrap content.
  let fx;
  before(() => { fx = createFixture({ fellowship: {} }); });
  after(() => cleanup(fx.root));

  it('injects EXTREMELY_IMPORTANT wrapper (Gandalf identity)', async () => {
    const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
    const ctx = extractContext(parsed);
    assert.match(ctx, /<EXTREMELY_IMPORTANT>/);
    assert.match(ctx, /You are Gandalf/);
  });

  it('injects FELLOWSHIP_CONTEXT block (bootstrap)', async () => {
    const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
    const ctx = extractContext(parsed);
    assert.match(ctx, /<FELLOWSHIP_CONTEXT>/);
  });
});

describe('session-start — full Fellowship path', () => {
  let fx;
  before(() => {
    fx = createFixture({
      fellowship: {
        questLog: '# Quest Log\n\n- [ ] Build the auth middleware',
        product: '# Product\n\nFellowship is a Claude Code plugin for orchestrated dev work.',
        debugLog: '## 2026-04-26\n\nFixed the heredoc hang on bash 5.3+',
        codebaseMap: '# Codebase Map\n\n- agents/ — companion definitions\n- hooks/ — lifecycle hooks',
        handoff: '## Handoff\n\nv1.0 blocker on TodoWrite wiring; see quest log.',
      },
    });
  });
  after(() => cleanup(fx.root));

  it('injects UNTRUSTED_QUEST_LOG block', async () => {
    const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
    const ctx = extractContext(parsed);
    assert.match(ctx, /<UNTRUSTED_QUEST_LOG>/);
    assert.match(ctx, /auth middleware/);
  });

  it('injects UNTRUSTED_PRODUCT block with real content', async () => {
    const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
    const ctx = extractContext(parsed);
    assert.match(ctx, /<UNTRUSTED_PRODUCT>/);
    assert.match(ctx, /orchestrated dev work/);
  });

  it('injects UNTRUSTED_DEBUG_LOG block', async () => {
    const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
    const ctx = extractContext(parsed);
    assert.match(ctx, /<UNTRUSTED_DEBUG_LOG>/);
    assert.match(ctx, /heredoc hang/);
  });

  it('injects UNTRUSTED_HANDOFF block when a recent handoff exists', async () => {
    const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
    const ctx = extractContext(parsed);
    assert.match(ctx, /<UNTRUSTED_HANDOFF>/);
    assert.match(ctx, /TodoWrite wiring/);
  });

  it('injects UNTRUSTED_CODEBASE_MAP block', async () => {
    const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
    const ctx = extractContext(parsed);
    assert.match(ctx, /<UNTRUSTED_CODEBASE_MAP>/);
    assert.match(ctx, /companion definitions/);
  });
});

describe('session-start — empty product.md path', () => {
  it('emits the "ask the user to describe the project" notice when product.md has only headings/comments', async () => {
    const fx = createFixture({
      fellowship: {
        product: '# Product\n\n<!-- placeholder -->\n## Goals\n',
      },
    });
    try {
      const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
      const ctx = extractContext(parsed);
      assert.match(ctx, /<UNTRUSTED_PRODUCT>/);
      assert.match(ctx, /no content yet/i);
      assert.match(ctx, /describe the project/i);
    } finally {
      cleanup(fx.root);
    }
  });
});

describe('session-start — Cursor JSON output shape', () => {
  it('emits top-level additional_context when CURSOR_PLUGIN_ROOT is set', async () => {
    const fx = createFixture();
    try {
      const { parsed } = await runHook(fx.scriptPath, fx.projectDir, {
        CURSOR_PLUGIN_ROOT: fx.root,
      });
      assert.ok(parsed, 'expected valid JSON');
      assert.ok('additional_context' in parsed,
        'Cursor shape should have top-level additional_context');
      assert.ok(!('hookSpecificOutput' in parsed),
        'Cursor shape should NOT include hookSpecificOutput (would double-inject)');
    } finally {
      cleanup(fx.root);
    }
  });

  it('emits additional_context even when CLAUDE_PLUGIN_ROOT is also set (Cursor wins)', async () => {
    // Cursor sets both; the script branches on CURSOR_PLUGIN_ROOT first.
    const fx = createFixture();
    try {
      const { parsed } = await runHook(fx.scriptPath, fx.projectDir, {
        CURSOR_PLUGIN_ROOT: fx.root,
        CLAUDE_PLUGIN_ROOT: fx.root,
      });
      assert.ok('additional_context' in parsed);
      assert.ok(!('hookSpecificOutput' in parsed));
    } finally {
      cleanup(fx.root);
    }
  });
});

describe('session-start — Claude Code JSON output shape', () => {
  it('emits hookSpecificOutput.additionalContext when only CLAUDE_PLUGIN_ROOT is set', async () => {
    const fx = createFixture();
    try {
      const { parsed } = await runHook(fx.scriptPath, fx.projectDir, {
        CLAUDE_PLUGIN_ROOT: fx.root,
      });
      assert.ok(parsed, 'expected valid JSON');
      assert.ok(parsed.hookSpecificOutput,
        'Claude Code shape should have hookSpecificOutput');
      assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
      assert.ok(typeof parsed.hookSpecificOutput.additionalContext === 'string');
      assert.ok(!('additional_context' in parsed),
        'Claude Code shape should NOT include top-level additional_context');
    } finally {
      cleanup(fx.root);
    }
  });
});

describe('session-start — fail-silent on missing using-fellowship skill', () => {
  it('still emits valid JSON and surfaces the error message in-band', async () => {
    // Need docs/fellowship/ to trigger the identity-injection branch where the
    // skill read happens; otherwise we hit the dormant-notice branch.
    const fx = createFixture({ includeSkill: false, fellowship: {} });
    try {
      const { exitCode, parsed } = await runHook(fx.scriptPath, fx.projectDir);
      assert.equal(exitCode, 0, 'hook should not crash on missing skill');
      assert.ok(parsed, 'output should still be valid JSON');
      const ctx = extractContext(parsed);
      assert.match(ctx, /Error reading using-fellowship skill/,
        'expected the in-band error sentinel from the script');
      // Wrapper must still be intact — silent fallback, not crash
      assert.match(ctx, /<EXTREMELY_IMPORTANT>/);
    } finally {
      cleanup(fx.root);
    }
  });
});

describe('session-start — project-local skills/agents survey', () => {
  it('emits PROJECT_LOCAL block listing local skills and agents', async () => {
    const fx = createFixture({
      projectLocal: {
        skills: ['foo'],
        agents: ['bar'],
      },
    });
    try {
      const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
      const ctx = extractContext(parsed);
      assert.match(ctx, /<PROJECT_LOCAL>/);
      assert.match(ctx, /foo/);
      assert.match(ctx, /bar/);
      assert.match(ctx, /Project-local takes precedence/);
    } finally {
      cleanup(fx.root);
    }
  });

  it('omits PROJECT_LOCAL block when .claude/ has no skills or agents', async () => {
    const fx = createFixture();
    try {
      const { parsed } = await runHook(fx.scriptPath, fx.projectDir);
      const ctx = extractContext(parsed);
      assert.doesNotMatch(ctx, /<PROJECT_LOCAL>/);
    } finally {
      cleanup(fx.root);
    }
  });
});
