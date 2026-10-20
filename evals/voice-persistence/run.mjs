#!/usr/bin/env node
// Voice-persistence eval runner.
//
// Drives multi-turn `claude --print` conversations and runs the assertion
// library against each captured response. Writes a baseline on first run;
// subsequent runs diff against that baseline and flag regressions.
//
// Why `claude --print --continue`:
//   Empirically verified on Claude Code 2.1.142 (see Pippin's investigation
//   notes in evals/voice-persistence/README.md): each `--continue`
//   invocation fires SessionStart + UserPromptSubmit + SessionEnd as a
//   single-turn cycle. This is NOT identical to a real interactive session
//   (where SessionStart fires once and UserPromptSubmit fires per turn) —
//   in particular, the full voice.md re-injects every turn under --continue,
//   which is MORE reinforcement than a real session. The drift-rate
//   assertion therefore measures a lower bound on real-session drift; if
//   drift appears under --continue's heavier injection, it would only be
//   worse in practice.
//
// Usage:
//   node evals/voice-persistence/run.mjs                 # run all scenarios
//   node evals/voice-persistence/run.mjs --scenario vp001
//   node evals/voice-persistence/run.mjs --baseline       # write baseline.json
//   node evals/voice-persistence/run.mjs --model claude-haiku-4-5
//
// Output:
//   evals/voice-persistence/.last-run.jsonl   incremental log, one record per turn
//   evals/voice-persistence/baseline.json     pass/fail counts per scenario
//   evals/voice-persistence/last-report.json  current run snapshot
//
// Exit codes:
//   0 — all assertions passed, no regressions
//   1 — at least one assertion failed
//   2 — regression vs. baseline (more failures than baseline)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  assertVocabularyPresent,
  assertNoForbiddenPhrases,
  assertExemplarRhythm,
  assertNoDrift,
  assertArtifactCleanProseHasVoice,
} from './assertions.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_PATH = resolve(__dirname, 'scenarios.jsonl');
const BASELINE_PATH = resolve(__dirname, 'baseline.json');
const REPORT_PATH = resolve(__dirname, 'last-report.json');
const PROGRESS_PATH = resolve(__dirname, '.last-run.jsonl');

// CLI args. parseArgs is built into node; no extra deps.
const { values: args } = parseArgs({
  options: {
    scenario: { type: 'string' },
    baseline: { type: 'boolean', default: false },
    model: { type: 'string', default: 'claude-haiku-4-5' },
    cwd: { type: 'string' },
    'turn-timeout': { type: 'string', default: '180' },
  },
  allowPositionals: false,
});

const MODEL = args.model;
const RUN_CWD = args.cwd || resolve(__dirname, '../..');
const TURN_TIMEOUT_S = parseInt(args['turn-timeout'], 10) || 180;

function log(msg) {
  process.stderr.write(`[voice-eval] ${msg}\n`);
}

// ── Scenario loader ────────────────────────────────────────────────────────

function loadScenarios() {
  const raw = readFileSync(SCENARIOS_PATH, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch (err) {
      log(`SKIP malformed scenario line: ${err.message}`);
    }
  }
  return out;
}

// ── Claude driver ─────────────────────────────────────────────────────────
//
// First turn: claude --print "<input>"
// Subsequent turns: claude --print --continue "<input>"
//
// We pipe /dev/null to stdin to avoid the "no stdin data received in 3s"
// warning that Claude emits when stdin is a TTY but unused.
//
// Returns the stdout of each turn, trimmed.

function driveTurn(input, { isFirst }) {
  const cmdArgs = [
    '--print',
    '--model', MODEL,
    '--dangerously-skip-permissions',
  ];
  if (!isFirst) cmdArgs.push('--continue');
  cmdArgs.push(input);

  const proc = spawnSync('claude', cmdArgs, {
    input: '',
    timeout: TURN_TIMEOUT_S * 1000,
    encoding: 'utf8',
    cwd: RUN_CWD,
    // Keychain auth — strip API key so we don't double-bill.
    env: { ...process.env, ANTHROPIC_API_KEY: undefined },
  });
  if (proc.error) {
    return { ok: false, output: '', reason: `spawn error: ${proc.error.message}` };
  }
  if (proc.status !== 0) {
    return {
      ok: false,
      output: (proc.stdout || '').trim(),
      reason: `non-zero exit ${proc.status}: ${(proc.stderr || '').toString().slice(0, 200)}`,
    };
  }
  return { ok: true, output: (proc.stdout || '').trim() };
}

function driveConversation(turns) {
  const responses = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    log(`  turn ${i + 1}/${turns.length} ...`);
    const res = driveTurn(t.input, { isFirst: i === 0 });
    if (!res.ok) {
      log(`  turn ${i + 1} FAILED to drive: ${res.reason}`);
      // Continue collecting partial run — assertions on empty strings will
      // fail and the failure will be visible.
      responses.push({ input: t.input, output: '', driver_error: res.reason });
      // If we cannot drive turn N, all later turns are meaningless. Abort.
      break;
    }
    responses.push({ input: t.input, output: res.output });
  }
  return responses;
}

// ── Assertion dispatch ────────────────────────────────────────────────────

function runAssertions(scenario, responses) {
  const results = [];

  // Concatenate all responses for "at least one across the conversation"
  // assertions. Per-turn scoring is also useful for diagnostics — we
  // include it.
  const allText = responses.map((r) => r.output || '').join('\n\n');

  for (const a of scenario.assertions || []) {
    let r;
    switch (a) {
      case 'vocabulary_at_least_one':
        r = assertVocabularyPresent(allText, { minCount: 1 });
        break;
      case 'no_forbidden_phrases':
        r = assertNoForbiddenPhrases(allText);
        break;
      case 'exemplar_rhythm_at_least_one':
        r = assertExemplarRhythm(allText, { minCount: 1 });
        break;
      case 'no_drift_first_vs_second_half': {
        const mid = Math.floor(responses.length / 2);
        const firstHalf = responses.slice(0, mid).map((r) => r.output || '');
        const secondHalf = responses.slice(mid).map((r) => r.output || '');
        r = assertNoDrift(firstHalf, secondHalf);
        break;
      }
      case 'artifact_clean_prose_has_voice':
        // Single-turn scenario — applies to the only response.
        r = assertArtifactCleanProseHasVoice(responses[0]?.output || '');
        break;
      default:
        r = {
          pass: false,
          reason: `unknown assertion: ${a}`,
          evidence: null,
        };
    }
    results.push({ assertion: a, ...r });
  }

  // Per-turn diagnostics — flag which specific turns produced forbidden
  // phrases. Helpful for actionable failure output, not gating on its own.
  // We store the full output, not a preview: when an assertion flags a
  // forbidden phrase past char 200, the diagnostician needs the full text
  // to see context. Full transcripts are small (~few KB per turn).
  const perTurn = responses.map((resp, i) => {
    const phraseCheck = assertNoForbiddenPhrases(resp.output || '');
    const vocabCheck = assertVocabularyPresent(resp.output || '', { minCount: 1 });
    const rhythmCheck = assertExemplarRhythm(resp.output || '', { minCount: 1 });
    return {
      turn: i + 1,
      input: resp.input || '',
      output: resp.output || '',
      driver_error: resp.driver_error || null,
      forbidden_phrases: phraseCheck.evidence,
      vocabulary: vocabCheck.evidence,
      rhythm_hits: rhythmCheck.evidence.length,
      rhythm_evidence: rhythmCheck.evidence,
    };
  });

  return { results, perTurn };
}

// ── Scenario runner ──────────────────────────────────────────────────────

function runScenario(scenario) {
  log(`scenario ${scenario.id} — ${scenario.scenario} (mode=${scenario.mode})`);

  if (scenario.mode === 'manual_walkthrough') {
    log(`  manual scenario, skipping automation — see manual-walkthrough.md`);
    return {
      id: scenario.id,
      mode: scenario.mode,
      skipped: true,
      reason: 'manual_walkthrough — automation not feasible for this scenario',
    };
  }

  if (!Array.isArray(scenario.turns) || scenario.turns.length === 0) {
    return {
      id: scenario.id,
      mode: scenario.mode,
      error: 'no turns defined',
    };
  }

  const responses = driveConversation(scenario.turns);
  const { results, perTurn } = runAssertions(scenario, responses);

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;

  log(`  ${scenario.id}: ${passed}/${total} assertions passed`);
  for (const r of results) {
    log(`    [${r.pass ? 'PASS' : 'FAIL'}] ${r.assertion}: ${r.reason}`);
  }

  return {
    id: scenario.id,
    scenario_name: scenario.scenario,
    mode: scenario.mode,
    passed,
    total,
    results,
    per_turn: perTurn,
  };
}

// ── Baseline + regression diff ────────────────────────────────────────────

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeBaseline(report) {
  const baseline = {};
  for (const s of report.scenarios) {
    if (s.skipped || s.error) continue;
    baseline[s.id] = { passed: s.passed, total: s.total };
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  log(`wrote baseline -> ${BASELINE_PATH}`);
}

function diffAgainstBaseline(report, baseline) {
  if (!baseline) return { regressions: [], improvements: [] };
  const regressions = [];
  const improvements = [];
  for (const s of report.scenarios) {
    if (s.skipped || s.error) continue;
    const base = baseline[s.id];
    if (!base) continue;
    if (s.passed < base.passed) {
      regressions.push({
        id: s.id,
        baseline_passed: base.passed,
        current_passed: s.passed,
        total: s.total,
      });
    } else if (s.passed > base.passed) {
      improvements.push({
        id: s.id,
        baseline_passed: base.passed,
        current_passed: s.passed,
        total: s.total,
      });
    }
  }
  return { regressions, improvements };
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(SCENARIOS_PATH)) {
    log(`FATAL: scenarios.jsonl missing at ${SCENARIOS_PATH}`);
    process.exit(2);
  }

  const allScenarios = loadScenarios();
  const scenarios = args.scenario
    ? allScenarios.filter((s) => s.id === args.scenario)
    : allScenarios;

  if (scenarios.length === 0) {
    log(`no scenarios matched (filter: ${args.scenario ?? 'none'})`);
    process.exit(2);
  }

  log(`running ${scenarios.length} scenario(s) against model=${MODEL} cwd=${RUN_CWD}`);
  writeFileSync(PROGRESS_PATH, '', 'utf8');

  const report = {
    started: new Date().toISOString(),
    model: MODEL,
    cwd: RUN_CWD,
    scenarios: [],
  };

  for (const s of scenarios) {
    const result = runScenario(s);
    report.scenarios.push(result);
    // Append progress incrementally.
    writeFileSync(PROGRESS_PATH,
      readFileSync(PROGRESS_PATH, 'utf8') + JSON.stringify(result) + '\n',
      'utf8');
  }

  report.finished = new Date().toISOString();
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
  log(`wrote report -> ${REPORT_PATH}`);

  if (args.baseline) {
    writeBaseline(report);
  }

  const baseline = loadBaseline();
  const diff = diffAgainstBaseline(report, baseline);

  // Summary to stdout (the rest is stderr — easy to grep).
  const summary = {
    total_scenarios: report.scenarios.length,
    automated: report.scenarios.filter((s) => !s.skipped && !s.error).length,
    manual: report.scenarios.filter((s) => s.skipped).length,
    errors: report.scenarios.filter((s) => s.error).length,
    assertion_total: report.scenarios.reduce((acc, s) => acc + (s.total || 0), 0),
    assertion_passed: report.scenarios.reduce((acc, s) => acc + (s.passed || 0), 0),
    regressions: diff.regressions,
    improvements: diff.improvements,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');

  // Exit code.
  const hasFailure = report.scenarios.some(
    (s) => !s.skipped && !s.error && s.passed < s.total
  );
  if (diff.regressions.length > 0) process.exit(2);
  if (hasFailure) process.exit(1);
  process.exit(0);
}

main();
