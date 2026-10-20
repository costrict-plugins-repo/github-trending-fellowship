/**
 * Tests for hooks/health-check.mjs
 *
 * Strategy: Each test creates a temporary directory that mirrors the project
 * structure the health-check expects (hooks/, agents/, skills/, .claude-plugin/,
 * settings.json). The health-check script is copied into the fixture's hooks/
 * directory so that its import.meta.url-based ROOT resolution points at the
 * fixture root. We then run it with `node` and inspect stdout + exit code.
 */

import { describe, it, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdirSync, writeFileSync, copyFileSync, chmodSync, rmSync, mkdtempSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);

const SCRIPT_SOURCE = join(
  import.meta.dirname, '..', 'hooks', 'health-check.mjs',
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal valid fixture directory and returns its root path.
 * Override any part by passing options.
 */
function createFixture(opts = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hc-test-'));

  // hooks/ — copy the real script in
  mkdirSync(join(root, 'hooks'));
  copyFileSync(SCRIPT_SOURCE, join(root, 'hooks', 'health-check.mjs'));

  // hooks/hooks.json — default valid, referencing a dummy script
  const hooksJson = opts.hooksJson ?? {
    hooks: {
      SessionStart: [{
        matcher: 'startup',
        hooks: [{
          type: 'command',
          command: '"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" test-script',
        }],
      }],
    },
  };
  writeFileSync(join(root, 'hooks', 'hooks.json'), JSON.stringify(hooksJson));

  // Create the dummy hook script referenced above (unless caller overrides)
  if (!opts.skipHookScript) {
    writeFileSync(join(root, 'hooks', 'test-script'), '#!/bin/sh\necho ok');
    chmodSync(join(root, 'hooks', 'test-script'), 0o755);
  }
  // Also create run-hook.cmd (referenced by hooks.json pattern)
  writeFileSync(join(root, 'hooks', 'run-hook.cmd'), '#!/bin/sh\necho ok');
  chmodSync(join(root, 'hooks', 'run-hook.cmd'), 0o755);

  // .claude-plugin/plugin.json — version is required for cache-busting / update detection
  mkdirSync(join(root, '.claude-plugin'));
  const pluginJson = opts.pluginJson ?? {
    name: 'test-plugin',
    description: 'A test plugin',
    version: '0.0.1',
  };
  writeFileSync(
    join(root, '.claude-plugin', 'plugin.json'),
    typeof pluginJson === 'string' ? pluginJson : JSON.stringify(pluginJson),
  );

  // .claude-plugin/marketplace.json — version lives here for relative-path plugins
  const marketplaceJson = opts.marketplaceJson ?? {
    plugins: [{ name: 'test-plugin', version: '0.0.1' }],
  };
  writeFileSync(
    join(root, '.claude-plugin', 'marketplace.json'),
    typeof marketplaceJson === 'string' ? marketplaceJson : JSON.stringify(marketplaceJson),
  );

  // settings.json
  const settingsJson = opts.settingsJson ?? { agent: 'test:alpha' };
  writeFileSync(
    join(root, 'settings.json'),
    typeof settingsJson === 'string' ? settingsJson : JSON.stringify(settingsJson),
  );

  // agents/ — default: one valid agent
  mkdirSync(join(root, 'agents'));
  if (opts.agents !== undefined) {
    for (const [name, content] of Object.entries(opts.agents)) {
      writeFileSync(join(root, 'agents', name), content);
    }
  } else {
    writeFileSync(join(root, 'agents', 'alpha.md'), [
      '---',
      'name: alpha',
      'tools:',
      '  - Read',
      '  - Bash',
      'skills:',
      '  - core',
      '---',
      '',
      '# Alpha Agent',
    ].join('\n'));
  }

  // skills/ — default: one valid skill dir with SKILL.md
  mkdirSync(join(root, 'skills'));
  if (opts.skills !== undefined) {
    for (const [name, hasSkillMd] of Object.entries(opts.skills)) {
      mkdirSync(join(root, 'skills', name));
      if (hasSkillMd) {
        writeFileSync(join(root, 'skills', name, 'SKILL.md'), '# Skill');
      }
    }
  } else {
    mkdirSync(join(root, 'skills', 'core'));
    writeFileSync(join(root, 'skills', 'core', 'SKILL.md'), '# Core Skill');
  }

  return root;
}

/** Run the health-check script in the given fixture root. */
async function runHealthCheck(fixtureRoot) {
  const scriptPath = join(fixtureRoot, 'hooks', 'health-check.mjs');
  try {
    const { stdout, stderr } = await execFileAsync('node', [scriptPath], {
      timeout: 10_000,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (err) {
    // execFile rejects on non-zero exit code
    return {
      exitCode: err.code ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
    };
  }
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('health-check — happy path', () => {
  let root;

  before(() => {
    root = createFixture();
  });
  after(() => cleanup(root));

  it('exits 0 when all checks pass', async () => {
    const { exitCode, stdout } = await runHealthCheck(root);
    assert.equal(exitCode, 0, `Expected exit 0, got ${exitCode}.\nOutput:\n${stdout}`);
  });

  it('prints header line', async () => {
    const { stdout } = await runHealthCheck(root);
    assert.match(stdout, /Fellowship Health Check/);
    assert.match(stdout, /=+/);
  });

  it('prints summary with pass/fail counts', async () => {
    const { stdout } = await runHealthCheck(root);
    assert.match(stdout, /Summary: \d+ passed, 0 failed/);
  });

  it('shows pass marker for each check', async () => {
    const { stdout } = await runHealthCheck(root);
    // Every result line should have the check mark
    const resultLines = stdout.split('\n').filter(l => l.startsWith('\u2713') || l.startsWith('\u2717'));
    assert.ok(resultLines.length > 0, 'Expected at least one result line');
    for (const line of resultLines) {
      assert.ok(line.startsWith('\u2713'), `Expected pass but got: ${line}`);
    }
  });
});

describe('health-check — plugin.json failures', () => {
  it('fails on malformed JSON in plugin.json', async () => {
    const root = createFixture({ pluginJson: '{not valid json!!!' });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /plugin\.json.*not valid JSON/i);
    } finally {
      cleanup(root);
    }
  });

  it('fails when plugin.json is missing required fields', async () => {
    const root = createFixture({ pluginJson: { name: 'test' } });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /plugin\.json.*missing fields/i);
      // Should mention description (version is no longer required in plugin.json)
      assert.match(stdout, /description/);
    } finally {
      cleanup(root);
    }
  });

  it('fails when plugin.json is missing the version field', async () => {
    // plugin.json `version` is required: Claude Code uses it for update detection / cache-busting.
    // Omitting it means every commit triggers an update prompt for installed users.
    const root = createFixture({
      pluginJson: { name: 'test-plugin', description: 'no version here' },
    });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1, `Expected exit 1, got ${exitCode}.\nOutput:\n${stdout}`);
      assert.match(stdout, /plugin\.json.*version field missing/i);
    } finally {
      cleanup(root);
    }
  });
});

describe('health-check — marketplace.json version assertion', () => {
  it('fails when marketplace.json has malformed (non-semver) version', async () => {
    const root = createFixture({
      marketplaceJson: { plugins: [{ name: 'test-plugin', version: 'not-a-version' }] },
    });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /marketplace\.json.*not valid semver/i);
    } finally {
      cleanup(root);
    }
  });

  it('fails when marketplace.json is missing plugins[0].version', async () => {
    const root = createFixture({
      marketplaceJson: { plugins: [{ name: 'test-plugin' }] },
    });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /marketplace\.json.*version missing/i);
    } finally {
      cleanup(root);
    }
  });

  it('fails when marketplace.json has empty plugins array', async () => {
    const root = createFixture({
      marketplaceJson: { plugins: [] },
    });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /marketplace\.json.*plugins/i);
    } finally {
      cleanup(root);
    }
  });
});

describe('health-check — settings.json failures', () => {
  it('fails when agent field references nonexistent agent file', async () => {
    const root = createFixture({
      settingsJson: { agent: 'test:nonexistent' },
    });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /settings\.json.*does not resolve/i);
    } finally {
      cleanup(root);
    }
  });

  it('passes when settings.json has no agent field (Gandalf injected via hook)', async () => {
    // No default-agent override is correct architecture: Gandalf identity is injected
    // by the SessionStart hook (skills/using-fellowship/SKILL.md), not via agent override.
    const root = createFixture({ settingsJson: {} });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 0);
      assert.match(stdout, /settings\.json.*no default-agent override/i);
    } finally {
      cleanup(root);
    }
  });
});

describe('health-check — agent frontmatter failures', () => {
  it('fails when agent references nonexistent skill', async () => {
    const root = createFixture({
      agents: {
        'alpha.md': [
          '---',
          'name: alpha',
          'skills:',
          '  - nonexistent-skill',
          '---',
          '# Alpha',
        ].join('\n'),
      },
      skills: { core: true }, // exists but agent references nonexistent-skill
    });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /nonexistent-skill.*does not match a directory/i);
    } finally {
      cleanup(root);
    }
  });

  it('fails when agent has unknown tool name', async () => {
    const root = createFixture({
      agents: {
        'alpha.md': [
          '---',
          'name: alpha',
          'tools:',
          '  - Read',
          '  - FooTool',
          'skills:',
          '  - core',
          '---',
          '# Alpha',
        ].join('\n'),
      },
    });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /FooTool.*not in known tools/i);
    } finally {
      cleanup(root);
    }
  });
});

describe('health-check — skill directory failures', () => {
  it('fails when skill directory is missing SKILL.md', async () => {
    const root = createFixture({
      skills: { core: false }, // dir exists, no SKILL.md
    });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /skills\/core\/.*SKILL\.md missing/i);
    } finally {
      cleanup(root);
    }
  });
});

describe('health-check — cross-reference / orphan skill detection', () => {
  test('fails when a skill directory exists but no agent references it', { skip: 'orphan detection removed — see health-check.mjs:261' }, () => {});
});

describe('health-check — edge cases', () => {
  it('handles empty plugin.json file', async () => {
    const root = createFixture({ pluginJson: '' });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /plugin\.json.*not valid JSON/i);
    } finally {
      cleanup(root);
    }
  });

  it('handles agent .md with only --- delimiters (no frontmatter content)', async () => {
    const root = createFixture({
      agents: {
        'alpha.md': '---\n---\n# Empty frontmatter',
      },
    });
    try {
      // Script should handle this without crashing. The frontmatter is
      // technically valid (empty) — no skills, no tools to check.
      const { stdout } = await runHealthCheck(root);
      // Should not crash — stdout should contain summary line
      assert.match(stdout, /Summary:/);
    } finally {
      cleanup(root);
    }
  });

  it('handles agent .md with no skills field in frontmatter', async () => {
    const root = createFixture({
      agents: {
        'alpha.md': [
          '---',
          'name: alpha',
          'tools:',
          '  - Read',
          '---',
          '# Alpha',
        ].join('\n'),
      },
      skills: { core: true },
    });
    try {
      // Agent has no skills — should pass the agent check (0 skills resolve).
      // But skills/core is now orphaned.
      const { stdout } = await runHealthCheck(root);
      assert.match(stdout, /Summary:/);
      // The agent itself should show "0 skills resolve"
      assert.match(stdout, /0 skills? resolve/);
    } finally {
      cleanup(root);
    }
  });

  it('handles agent .md with completely empty content', async () => {
    const root = createFixture({
      agents: {
        'alpha.md': '',
      },
    });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /no valid YAML frontmatter/i);
    } finally {
      cleanup(root);
    }
  });

  it('handles Agent(...) style tool references as valid', async () => {
    const root = createFixture({
      agents: {
        'alpha.md': [
          '---',
          'name: alpha',
          'tools:',
          '  - Agent(test:beta)',
          'skills:',
          '  - core',
          '---',
          '# Alpha',
        ].join('\n'),
      },
    });
    try {
      const { stdout } = await runHealthCheck(root);
      // Agent(...) should be recognized as valid (base name "Agent" is known)
      const toolFailLines = stdout.split('\n').filter(l => l.includes('not in known tools'));
      assert.equal(toolFailLines.length, 0, `Unexpected tool failures: ${toolFailLines.join(', ')}`);
    } finally {
      cleanup(root);
    }
  });
});

describe('health-check — hooks.json failures', () => {
  it('fails when referenced hook script does not exist', async () => {
    const root = createFixture({ skipHookScript: true });
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /test-script.*not found/i);
    } finally {
      cleanup(root);
    }
  });

  it('fails when hook script exists but is not executable', async () => {
    const root = createFixture();
    // Remove execute permission from the hook script
    chmodSync(join(root, 'hooks', 'test-script'), 0o644);
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /test-script.*not executable/i);
    } finally {
      cleanup(root);
    }
  });

  it('fails on malformed hooks.json', async () => {
    const root = createFixture({ hooksJson: 'NOT JSON' });
    // Manually write the bad JSON since createFixture would stringify objects
    writeFileSync(join(root, 'hooks', 'hooks.json'), 'NOT JSON');
    try {
      const { exitCode, stdout } = await runHealthCheck(root);
      assert.equal(exitCode, 1);
      assert.match(stdout, /hooks\.json.*not valid JSON/i);
    } finally {
      cleanup(root);
    }
  });
});

describe('health-check — output format per spec', () => {
  it('uses check mark for passes and X mark for failures', async () => {
    const root = createFixture({
      agents: {
        'alpha.md': [
          '---',
          'name: alpha',
          'tools:',
          '  - BadTool',
          'skills:',
          '  - core',
          '---',
          '# Alpha',
        ].join('\n'),
      },
    });
    try {
      const { stdout } = await runHealthCheck(root);
      const lines = stdout.split('\n').filter(l => l.match(/^[^\s]/));
      const passLines = lines.filter(l => l.startsWith('\u2713'));
      const failLines = lines.filter(l => l.startsWith('\u2717'));
      assert.ok(passLines.length > 0, 'Expected at least one pass line');
      assert.ok(failLines.length > 0, 'Expected at least one fail line');
    } finally {
      cleanup(root);
    }
  });

  it('summary line format matches spec: "Summary: N passed, M failed"', async () => {
    const root = createFixture();
    try {
      const { stdout } = await runHealthCheck(root);
      assert.match(stdout, /^Summary: \d+ passed, \d+ failed$/m);
    } finally {
      cleanup(root);
    }
  });
});
