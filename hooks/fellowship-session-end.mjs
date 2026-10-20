#!/usr/bin/env node
// SessionEnd hook for Fellowship plugin.
//
// Responsibilities (in this order — ordering matters):
//   1. Subagent guard (tier 1). Bail silently if running inside a subagent.
//   2. Clear the main-session marker (guarded by session_id). Preserves the
//      voice-persistence/subagent-detection contract — runs FIRST so a later
//      failure can never block the marker cleanup.
//   3. Reconciliation pass. Survey transcript for companion DONE/APPROVED
//      reports; for each, locate the named artifact and set the missed
//      status transition. Logs every auto-correction to the trace.
//   4. Scorecard ledger. Append one JSONL record per companion report block
//      detected in the transcript (all seven protocol statuses, not just the
//      two reconciliation acts on) to the state-dir ledger
//      `<slug>.scorecard.jsonl`. Data capture only — no rendering.
//   5. Archival sweep. Walk docs/fellowship/{specs,plans,handoffs,design}/;
//      for each `status: reviewed` artifact, set `status: archived` and
//      renameSync to docs/fellowship/archive/<type>/.
//   6. Quest-log size control. If quest-log.md has > 50 entries, move the
//      oldest 25 to quest-log-archive.md.
//   7. Summary line. One stdout line summarizing what moved. Silent if
//      nothing happened. The ledger never appears here — it is
//      instrumentation, not project-state movement.
//
// Fail-silent: every error path exits 0. Sub-step failures don't take down
// other sub-steps — each is wrapped in its own try/catch. The user's session
// is already terminating; a noisy hook here is worse than a quiet one.
//
// Source-of-truth posture: artifact frontmatter is authoritative for the
// archival sweep. The transcript is only an input to the reconciliation
// pass (which writes frontmatter). The sweep ignores the transcript.
//
// Input (stdin): { session_id, reason, cwd, hook_event_name, transcript_path }
// Output: optional summary line on stdout, then `{}\n` per Claude Code's
//         SessionEnd hook contract.
//
// Spec: docs/fellowship/specs/2026-05-15-project-state-contract.md
// ADR:  docs/fellowship/specs/2026-05-24-adr-cluster-d-hooks.md (Hook 1)

import {
  readFileSync,
  writeFileSync,
  renameSync,
  appendFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import {
  readStdinPayloadSync,
  clearMainSessionMarker,
  debugLogIfEnabled,
  stateMarkerPath,
  ensureStateDir,
} from './lib/subagent-detection.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOCS_FELLOWSHIP_RELPATH = 'docs/fellowship';
const ARCHIVE_RELPATH = 'docs/fellowship/archive';
const QUEST_LOG_RELPATH = 'docs/fellowship/quest-log.md';
const QUEST_LOG_ARCHIVE_RELPATH = 'docs/fellowship/quest-log-archive.md';

// Artifact folders swept in this order — controls summary clause order too.
const ARTIFACT_DIRS = ['specs', 'plans', 'handoffs', 'design'];

// Singular labels for the summary line (the plural is "<label>s").
const ARTIFACT_LABEL = {
  specs: 'spec',
  plans: 'plan',
  handoffs: 'handoff',
  design: 'design artifact',
};

// Quest-log size-control trigger and archival batch size.
const QUEST_LOG_MAX_ENTRIES = 50;
const QUEST_LOG_ARCHIVE_BATCH = 25;

const TRACE_RELPATH = '.claude/fellowship-trace.log';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function projectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function fellowshipRoot() {
  return resolve(projectDir(), DOCS_FELLOWSHIP_RELPATH);
}

function archiveRoot() {
  return resolve(projectDir(), ARCHIVE_RELPATH);
}

/**
 * Resolve the trace log path. Prefers $HOME/.claude/fellowship-trace.log per
 * ADR D5; falls back to /tmp/fellowship-trace.log if homedir() yields empty.
 */
function tracePath() {
  const home = homedir();
  if (home && home.trim()) {
    return resolve(home, TRACE_RELPATH);
  }
  return '/tmp/fellowship-trace.log';
}

// ---------------------------------------------------------------------------
// Trace helper
// ---------------------------------------------------------------------------

/**
 * Append a JSON record to the plugin-internal trace log. Best-effort and
 * silent on every failure path — a failing trace must NEVER break the sweep.
 * The trace is diagnostic, not load-bearing.
 */
function traceEvent(sessionId, record) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      hook: 'fellowship-session-end',
      project: projectDir(),
      session_id: sessionId || null,
      ...record,
    };
    const path = tracePath();
    try {
      mkdirSync(dirname(path), { recursive: true });
    } catch {
      // Best-effort; appendFileSync will surface the real error if needed.
    }
    appendFileSync(path, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // Silent.
  }
}

// ---------------------------------------------------------------------------
// Frontmatter — hand-rolled, flat-scalar parser (per ADR D1, approach C)
// ---------------------------------------------------------------------------

/**
 * Parse a markdown file into { frontmatter: { lines: [...], map: {...} }, body }.
 *
 * Lines is the preserved ordering of frontmatter lines (raw); map is a
 * convenience lookup of key→value for already-set keys.
 *
 * Returns null when the file does not have well-formed frontmatter:
 *   - missing opening `---\n` as the first line
 *   - missing closing `---` delimiter
 *
 * Only flat scalars are recognized. Lines that don't match `key: value` are
 * preserved verbatim in `lines` but not added to `map`. This handles blank
 * lines and comments inside the block.
 */
function parseFrontmatter(content) {
  if (typeof content !== 'string') return null;
  const lines = content.split('\n');
  if (lines.length < 2 || lines[0].trim() !== '---') return null;

  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx < 0) return null;

  const fmLines = lines.slice(1, closeIdx);
  const map = {};
  for (const line of fmLines) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_\-]*)\s*:\s*(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2].trim();
      // Strip a single matched pair of surrounding quotes; leave embedded quotes alone.
      if (
        (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
        (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
      ) {
        val = val.slice(1, -1);
      }
      map[key] = val;
    }
  }

  const body = lines.slice(closeIdx + 1).join('\n');
  return { fmLines, map, body };
}

/**
 * Serialize a frontmatter parse back to a full file. Mutates the frontmatter
 * lines in place: any key in `updates` that exists in the block is rewritten
 * on its line; any key in `updates` that does NOT exist is appended as a new
 * line before the closing delimiter.
 *
 * `updates` is a flat object of string keys → string values.
 */
function writeFrontmatter(parsed, updates) {
  const fmLines = parsed.fmLines.slice();
  const seen = new Set();

  for (let i = 0; i < fmLines.length; i++) {
    const m = fmLines[i].match(/^([A-Za-z_][A-Za-z0-9_\-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fmLines[i] = `${key}: ${updates[key]}`;
      seen.add(key);
    }
  }

  for (const key of Object.keys(updates)) {
    if (!seen.has(key)) {
      fmLines.push(`${key}: ${updates[key]}`);
    }
  }

  return ['---', ...fmLines, '---', parsed.body].join('\n');
}

/**
 * Read an artifact, parse its frontmatter, and return { parsed, content }.
 * Returns null on read failure or malformed frontmatter. Logs trace on
 * parse failure.
 */
function readArtifact(filePath, sessionId) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'read',
      artifact: filePath,
      detail: String(err && err.message || err),
    });
    return null;
  }
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'frontmatter-parse',
      artifact: filePath,
      detail: 'missing delimiters or malformed block',
    });
    return null;
  }
  return { parsed, content };
}

/**
 * Atomic-ish write: write to a temp file in the same directory, then rename.
 * Same-filesystem rename is atomic on POSIX.
 */
function writeArtifact(filePath, newContent) {
  const tmp = filePath + '.' + process.pid + '.tmp';
  writeFileSync(tmp, newContent, 'utf8');
  renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// Reconciliation pass
// ---------------------------------------------------------------------------

/**
 * Best-effort transcript scan: read the JSONL transcript line by line,
 * pull out any text content containing `Status: DONE` or `Status: APPROVED`,
 * and locate artifact paths referenced near each status line.
 *
 * Returns an array of { status, companion, artifactPaths } records — one per
 * DONE/APPROVED report block detected. Companion is best-effort and may be
 * 'unknown' when not inferable.
 *
 * Failure modes are all silent — a corrupt or missing transcript yields [].
 */
function scanTranscript(transcriptPath, sessionId) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return [];
  if (!existsSync(transcriptPath)) return [];

  let raw;
  try {
    raw = readFileSync(transcriptPath, 'utf8');
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'transcript-read',
      detail: String(err && err.message || err),
    });
    return [];
  }

  // Pull text content from each transcript line — JSON-shape varies, so we
  // walk defensively. The text bodies are where companion reports live.
  const textBlocks = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    // Several possible places text can live: assistant text, user
    // tool_result content, etc. Walk known shapes.
    const message = obj && obj.message;
    if (!message) continue;
    const content = message.content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item) continue;
        if (typeof item.text === 'string') {
          textBlocks.push(item.text);
        } else if (Array.isArray(item.content)) {
          for (const inner of item.content) {
            if (inner && typeof inner.text === 'string') {
              textBlocks.push(inner.text);
            }
          }
        }
      }
    } else if (typeof content === 'string') {
      textBlocks.push(content);
    }
  }

  const reports = [];
  // All seven protocol status codes (companion-protocol.md). Reconciliation
  // only acts on DONE/APPROVED; the scorecard ledger records every code —
  // failure shapes (BLOCKED, CHANGES_REQUESTED, ...) are the point of the
  // ledger. Longer alternatives listed first so DONE never shadows
  // DONE_WITH_CONCERNS.
  const statusRe = /Status:\s+(DONE_WITH_CONCERNS|DONE|APPROVED_WITH_CONCERNS|APPROVED|CHANGES_REQUESTED|NEEDS_CONTEXT|BLOCKED)\b/g;
  const pathRe = /docs\/fellowship\/(specs|plans|handoffs|design)\/([A-Za-z0-9._\-]+\.md)/g;
  // Companion names recognized by inference. Order here is irrelevant —
  // inference picks by document proximity to the Status marker, not array
  // iteration order (per Legolas review).
  const COMPANION_SET = new Set([
    'gimli', 'legolas', 'aragorn', 'merry', 'pippin',
    'boromir', 'sam', 'arwen', 'bilbo',
  ]);
  // Word-boundary regex catching any companion name with optional possessive.
  // Case-insensitive; we scan against lowercased text.
  const companionRe = /\b(gimli|legolas|aragorn|merry|pippin|boromir|sam|arwen|bilbo)\b/g;

  for (const block of textBlocks) {
    let m;
    statusRe.lastIndex = 0;
    while ((m = statusRe.exec(block)) !== null) {
      const status = m[1];
      // Template guard: the report-format template quoted in agent files and
      // docs reads `Status: DONE | DONE_WITH_CONCERNS | ...`. A real report's
      // Status line carries exactly one code (companion-protocol.md). If the
      // rest of the line opens with `|`, this is the template — skip it, or
      // every session that Reads an agent file fabricates ledger records.
      const lineEnd = block.indexOf('\n', statusRe.lastIndex);
      const lineRest = block.slice(
        statusRe.lastIndex,
        lineEnd === -1 ? block.length : lineEnd,
      );
      if (/^\s*\|/.test(lineRest)) continue;
      // Symmetric ~2 KB window around the Status marker. Aragorn-style
      // reports often state `Reviewed: <path>` 600–1000 bytes BEFORE the
      // Status line, so the left side must match the right.
      const windowStart = Math.max(0, m.index - 1024);
      const windowEnd = Math.min(block.length, m.index + 1024);
      const win = block.slice(windowStart, windowEnd);
      // Marker position relative to the window — used for proximity scoring.
      const markerOffsetInWin = m.index - windowStart;

      const artifactPaths = new Set();
      pathRe.lastIndex = 0;
      let pm;
      while ((pm = pathRe.exec(win)) !== null) {
        artifactPaths.add(`docs/fellowship/${pm[1]}/${pm[2]}`);
      }

      // Companion inference: find every companion mention in the window,
      // pick the one whose match position is closest to the Status marker.
      // Document-order proximity, not array-iteration order — so a report
      // mentioning "gimli built X" before "Status: APPROVED" doesn't trump
      // a later mention closer to the marker.
      const lower = win.toLowerCase();
      let companion = 'unknown';
      let bestDistance = Infinity;
      companionRe.lastIndex = 0;
      let cm;
      while ((cm = companionRe.exec(lower)) !== null) {
        const distance = Math.abs(cm.index - markerOffsetInWin);
        if (distance < bestDistance) {
          bestDistance = distance;
          companion = cm[1];
        }
      }
      // Guard the Set membership — defensive even though the regex
      // hardcodes the same nine names.
      if (!COMPANION_SET.has(companion)) companion = 'unknown';

      reports.push({
        status,
        companion,
        artifactPaths: Array.from(artifactPaths),
      });
    }
  }

  return reports;
}

/**
 * Run the reconciliation pass over pre-scanned reports. For each
 * DONE/APPROVED report, locate the named artifact(s) and set the missing
 * status transition. Narrow logic per ADR D4 — no inference beyond what the
 * report explicitly names. Reports carrying any other status code are
 * skipped here untouched — they exist for the scorecard ledger.
 *
 * Returns the count of artifacts auto-corrected.
 */
function reconcile(reports, sessionId) {
  let count = 0;
  if (!reports.length) return 0;

  // De-dupe: only process each (artifact, status) once. Multiple reports for
  // the same artifact in one session should reconcile once, not N times.
  const seen = new Set();

  for (const report of reports) {
    // Reconciliation acts on exactly two statuses; everything else passes
    // through to the ledger only.
    if (report.status !== 'DONE' && report.status !== 'APPROVED') continue;
    for (const relPath of report.artifactPaths) {
      const key = `${report.status}::${relPath}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const fullPath = resolve(projectDir(), relPath);
      if (!existsSync(fullPath)) {
        traceEvent(sessionId, {
          event: 'error',
          stage: 'reconcile-missing',
          artifact: relPath,
          status: report.status,
        });
        continue;
      }

      const a = readArtifact(fullPath, sessionId);
      if (!a) continue;

      const currentStatus = a.parsed.map.status;
      const updates = {};

      if (report.status === 'DONE' && currentStatus === 'active') {
        updates.status = 'implemented';
        updates.implemented_by = report.companion;
        // Inference failure is itself a signal — trace it explicitly so the
        // audit trail records that we couldn't attribute the build. The
        // transition still applies; only the attribution is unknown.
        if (report.companion === 'unknown') {
          traceEvent(sessionId, {
            event: 'inference-fail',
            stage: 'reconcile-done',
            artifact: relPath,
            note: 'no companion name in window; implemented_by set to unknown',
          });
        }
      } else if (report.status === 'APPROVED' && currentStatus === 'implemented') {
        updates.status = 'reviewed';
        // Per the Lever 1 contract, only Legolas issues APPROVED. The
        // reviewer field is unambiguous; inference is wrong on principle
        // for this transition. Hardcode regardless of window contents.
        updates.reviewed_by = 'legolas';
      } else {
        // Either the transition is already done or the artifact's status
        // doesn't match the report's claim. Nothing to do.
        continue;
      }

      try {
        const newContent = writeFrontmatter(a.parsed, updates);
        writeArtifact(fullPath, newContent);
        traceEvent(sessionId, {
          event: 'reconcile',
          artifact: relPath,
          from: currentStatus,
          to: updates.status,
          reason: `${report.status} report from ${report.companion}`,
        });
        count++;
      } catch (err) {
        traceEvent(sessionId, {
          event: 'error',
          stage: 'reconcile-write',
          artifact: relPath,
          detail: String(err && err.message || err),
        });
      }
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Scorecard ledger
// ---------------------------------------------------------------------------

// Reviewer verdict codes (Legolas/Boromir per companion-protocol.md). Used
// to compute review_cycle — the nth verdict on the same artifact this session.
const REVIEW_STATUSES = new Set([
  'APPROVED', 'APPROVED_WITH_CONCERNS', 'CHANGES_REQUESTED',
]);

/**
 * Append one JSONL record per scanned report block to the per-project
 * scorecard ledger at `<state-dir>/<slug>.scorecard.jsonl`. Data capture
 * only (v1) — the ledger accumulates the evidence base for "does the
 * orchestration earn its cost": cycles to approval, failure shapes.
 *
 * Record shape: { ts, session_id, companion, status, artifact?,
 * review_cycle?, source }. Sparse by design — a field that is not cheaply
 * derivable from the scan is OMITTED, never guessed:
 *   - artifact: only when the report window names exactly ONE path; zero or
 *     several would make attribution a guess.
 *   - review_cycle: only on reviewer verdicts with a derivable artifact —
 *     nth verdict on that artifact this session, in transcript order.
 *
 * No de-dupe: a repeated DONE on the same artifact is re-dispatch signal,
 * not noise. Fail-silent: state dir uncreatable → skip (same posture as the
 * markers); any other failure traces and returns 0. Never touches the
 * reconciliation pass or the exit code.
 */
function appendScorecardRecords(reports, sessionId) {
  try {
    if (!reports.length) return 0;
    const ledgerPath = stateMarkerPath('scorecard.jsonl');
    if (!ledgerPath || !ensureStateDir()) return 0;

    const ts = new Date().toISOString();
    const verdictCounts = new Map();
    const lines = [];
    for (const report of reports) {
      // Omit session_id rather than write null — fields are present or absent,
      // never guessed (same rule as artifact/review_cycle).
      const record = {
        ts,
        ...(sessionId ? { session_id: sessionId } : {}),
        companion: report.companion,
        status: report.status,
      };
      if (report.artifactPaths.length === 1) {
        record.artifact = report.artifactPaths[0];
        if (REVIEW_STATUSES.has(report.status)) {
          const n = (verdictCounts.get(record.artifact) || 0) + 1;
          verdictCounts.set(record.artifact, n);
          record.review_cycle = n;
        }
      }
      record.source = 'session-end-v1';
      lines.push(JSON.stringify(record));
    }

    appendFileSync(ledgerPath, lines.join('\n') + '\n', 'utf8');
    traceEvent(sessionId, { event: 'scorecard-append', count: lines.length });
    return lines.length;
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'scorecard-append',
      detail: String(err && err.message || err),
    });
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Archival sweep
// ---------------------------------------------------------------------------

/**
 * Sweep one artifact dir for `status: reviewed` files. For each, set
 * `status: archived` and renameSync to archive/<dir>/. Returns the count
 * of artifacts archived from this dir.
 */
function sweepDir(dir, sessionId) {
  const root = fellowshipRoot();
  const srcDir = join(root, dir);
  const dstDir = join(archiveRoot(), dir);

  if (!existsSync(srcDir)) return 0;

  let entries;
  try {
    entries = readdirSync(srcDir);
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'sweep-readdir',
      dir,
      detail: String(err && err.message || err),
    });
    return 0;
  }

  let count = 0;
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const src = join(srcDir, entry);

    const a = readArtifact(src, sessionId);
    if (!a) continue;
    if (a.parsed.map.status !== 'reviewed') continue;

    const dst = join(dstDir, entry);

    // Collision guard: if archive/<dir>/<file> already exists, leave the
    // source alone and trace the violation. The duplicate is upstream.
    if (existsSync(dst)) {
      traceEvent(sessionId, {
        event: 'error',
        stage: 'archive-collision',
        artifact: `${DOCS_FELLOWSHIP_RELPATH}/${dir}/${entry}`,
        destination: `${ARCHIVE_RELPATH}/${dir}/${entry}`,
      });
      continue;
    }

    // Order: mkdir dst, rename source intact, then rewrite frontmatter at
    // destination. This keeps the source untouched if rename fails — next
    // sweep finds it still at `status: reviewed` and retries cleanly. If we
    // wrote status first and rename failed, the source would be stuck
    // (sweep filters on `reviewed`, so an archived-but-unmoved file becomes
    // invisible to future passes).
    try {
      mkdirSync(dstDir, { recursive: true });
    } catch (err) {
      traceEvent(sessionId, {
        event: 'error',
        stage: 'archive-mkdir',
        dir: dstDir,
        detail: String(err && err.message || err),
      });
      continue;
    }

    try {
      renameSync(src, dst);
    } catch (err) {
      traceEvent(sessionId, {
        event: 'error',
        stage: 'archive-rename',
        artifact: `${DOCS_FELLOWSHIP_RELPATH}/${dir}/${entry}`,
        detail: String(err && err.message || err),
      });
      continue;
    }

    // Rewrite frontmatter at the destination to set status: archived. If
    // this fails, the file is in archive/ at status: reviewed — and the
    // sweep never scans archive/, so the orphan would be permanent. Recover
    // by renaming the file BACK to the source location: the next sweep
    // finds it still at status: reviewed and retries cleanly.
    //
    // If the rename-back ALSO fails (the destination is now somehow stuck
    // and the source dir is also unwritable — rare double failure), the
    // file is truly orphaned and needs manual intervention. Trace it
    // explicitly with stage: 'archive-orphan' so an operator can find it.
    let statusWriteOk = true;
    try {
      const newContent = writeFrontmatter(a.parsed, { status: 'archived' });
      writeArtifact(dst, newContent);
    } catch (err) {
      statusWriteOk = false;
      traceEvent(sessionId, {
        event: 'error',
        stage: 'archive-status-write',
        artifact: `${ARCHIVE_RELPATH}/${dir}/${entry}`,
        detail: String(err && err.message || err),
      });
      // Recovery: rename the file back to source. Source still claims
      // status: reviewed (we never wrote it), so the next sweep retries.
      try {
        renameSync(dst, src);
        traceEvent(sessionId, {
          event: 'archive-rollback',
          artifact: `${DOCS_FELLOWSHIP_RELPATH}/${dir}/${entry}`,
          reason: 'destination frontmatter write failed; reverted to source for retry',
        });
      } catch (rollbackErr) {
        traceEvent(sessionId, {
          event: 'error',
          stage: 'archive-orphan',
          artifact: `${ARCHIVE_RELPATH}/${dir}/${entry}`,
          detail: String(rollbackErr && rollbackErr.message || rollbackErr),
          note: 'file stuck in archive/ at status: reviewed; manual move required',
        });
      }
    }

    // Only count the archive as successful when the file is at its
    // destination with the correct frontmatter. A rolled-back file is back
    // at source and not counted — the summary line stays honest.
    if (statusWriteOk) {
      traceEvent(sessionId, {
        event: 'archive',
        artifact: `${DOCS_FELLOWSHIP_RELPATH}/${dir}/${entry}`,
        destination: `${ARCHIVE_RELPATH}/${dir}/${entry}`,
      });
      count++;
    }
  }

  return count;
}

/** Run the full archival sweep across all artifact dirs. */
function archivalSweep(sessionId) {
  const counts = {};
  for (const dir of ARTIFACT_DIRS) {
    counts[dir] = sweepDir(dir, sessionId);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Quest-log size control
// ---------------------------------------------------------------------------

/**
 * If quest-log.md has more than QUEST_LOG_MAX_ENTRIES entries, move the
 * oldest QUEST_LOG_ARCHIVE_BATCH entries to quest-log-archive.md.
 *
 * Returns the count moved (0 if no-op).
 */
function questLogSizeControl(sessionId) {
  const logPath = resolve(projectDir(), QUEST_LOG_RELPATH);
  const archivePath = resolve(projectDir(), QUEST_LOG_ARCHIVE_RELPATH);

  if (!existsSync(logPath)) return 0;

  let content;
  try {
    content = readFileSync(logPath, 'utf8');
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'quest-log-read',
      detail: String(err && err.message || err),
    });
    return 0;
  }

  const lines = content.split('\n');
  const entryRe = /^- \[[ x]\]/;

  // Find indices of all entry lines.
  const entryIndices = [];
  for (let i = 0; i < lines.length; i++) {
    if (entryRe.test(lines[i])) entryIndices.push(i);
  }

  if (entryIndices.length <= QUEST_LOG_MAX_ENTRIES) return 0;

  const toMoveIndices = entryIndices.slice(0, QUEST_LOG_ARCHIVE_BATCH);
  const moveSet = new Set(toMoveIndices);
  const movedLines = toMoveIndices.map((i) => lines[i]);

  // Dedup against existing archive (per ADR D6): hash on the first 80 chars
  // of each entry. Skip lines whose hash is already in the archive file.
  let existingArchive = '';
  if (existsSync(archivePath)) {
    try {
      existingArchive = readFileSync(archivePath, 'utf8');
    } catch {
      existingArchive = '';
    }
  }

  const hash = (s) => (s || '').slice(0, 80);
  const existingHashes = new Set();
  for (const line of existingArchive.split('\n')) {
    if (entryRe.test(line)) existingHashes.add(hash(line));
  }

  const toAppend = movedLines.filter((l) => !existingHashes.has(hash(l)));

  // Build the appended block. If the archive file doesn't exist, prepend a header.
  let appendBlock = '';
  if (!existsSync(archivePath)) {
    appendBlock = '# Quest Log Archive\n\nOldest entries moved here automatically by the SessionEnd hook.\n\n';
  } else if (existingArchive.length > 0 && !existingArchive.endsWith('\n')) {
    appendBlock = '\n';
  }
  appendBlock += toAppend.join('\n');
  if (toAppend.length) appendBlock += '\n';

  try {
    appendFileSync(archivePath, appendBlock, 'utf8');
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'quest-log-archive-append',
      detail: String(err && err.message || err),
    });
    return 0;
  }

  // Rewrite quest-log.md without the moved lines. Write-then-rename for atomicity.
  const remaining = lines.filter((_, i) => !moveSet.has(i));
  const newContent = remaining.join('\n');
  try {
    const tmp = logPath + '.' + process.pid + '.tmp';
    writeFileSync(tmp, newContent, 'utf8');
    renameSync(tmp, logPath);
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'quest-log-rewrite',
      detail: String(err && err.message || err),
    });
    // Archive already has the entries appended; the source still has them
    // too. Idempotency dedup on hash will prevent double-appending on retry.
    return 0;
  }

  traceEvent(sessionId, {
    event: 'quest-log-archive',
    moved: toMoveIndices.length,
    remaining: entryIndices.length - toMoveIndices.length,
  });
  return toMoveIndices.length;
}

// ---------------------------------------------------------------------------
// Summary line — proportional output (per ADR D7)
// ---------------------------------------------------------------------------

function pluralize(n, singular) {
  if (n === 1) return `1 ${singular}`;
  if (singular === 'design artifact') return `${n} design artifacts`;
  return `${n} ${singular}s`;
}

/**
 * Compose the SessionEnd summary line from the work counts.
 * Returns an empty string when nothing happened — caller emits nothing.
 */
function summaryLine(reconciledCount, archivedCounts, questLogMoved) {
  const clauses = [];

  const archivedParts = [];
  for (const dir of ARTIFACT_DIRS) {
    const n = archivedCounts[dir] || 0;
    if (n > 0) archivedParts.push(pluralize(n, ARTIFACT_LABEL[dir]));
  }
  if (archivedParts.length > 0) {
    clauses.push(`Archived ${archivedParts.join(', ')} to archive/.`);
  }

  if (reconciledCount > 0) {
    const noun = reconciledCount === 1 ? 'status transition' : 'status transitions';
    clauses.push(`Reconciled ${reconciledCount} ${noun}.`);
  }

  if (questLogMoved > 0) {
    clauses.push(`Archived ${questLogMoved} quest-log entries to quest-log-archive.md.`);
  }

  return clauses.join(' ');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let summary = '';

try {
  const payload = readStdinPayloadSync();
  debugLogIfEnabled('fellowship-session-end', payload);

  const sessionId = payload && typeof payload.session_id === 'string'
    ? payload.session_id
    : null;

  // Subagent guard (tier 1). SessionEnd should not fire in subagents per
  // the docs, but bail defensively if the documented fields appear.
  if (
    payload &&
    typeof payload === 'object' &&
    ((typeof payload.agent_id === 'string' && payload.agent_id.trim()) ||
      (typeof payload.agent_type === 'string' && payload.agent_type.trim()))
  ) {
    // Don't even touch the marker — a subagent has no business clearing it.
    process.stdout.write(JSON.stringify({}) + '\n');
    process.exit(0);
  }

  // Step 2 — marker cleanup. PRESERVED VERBATIM from the prior version.
  // Runs FIRST so a later sub-step failure can never block it.
  try {
    clearMainSessionMarker(sessionId);
  } catch {
    // Best-effort; silent.
  }

  // If docs/fellowship/ doesn't exist, nothing else to do.
  if (!existsSync(fellowshipRoot())) {
    process.stdout.write(JSON.stringify({}) + '\n');
    process.exit(0);
  }

  const transcriptPath = payload && typeof payload.transcript_path === 'string'
    ? payload.transcript_path
    : null;

  // Transcript scan — runs ONCE; both the reconciliation pass and the
  // scorecard ledger consume the same report list.
  let reports = [];
  try {
    reports = scanTranscript(transcriptPath, sessionId);
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'transcript-scan',
      detail: String(err && err.message || err),
    });
    reports = [];
  }

  // Step 3 — reconciliation.
  let reconciledCount = 0;
  try {
    reconciledCount = reconcile(reports, sessionId);
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'reconcile-top',
      detail: String(err && err.message || err),
    });
  }

  // Step 4 — scorecard ledger. Isolated from reconciliation: a ledger
  // failure can never affect the status transitions, and vice versa.
  try {
    appendScorecardRecords(reports, sessionId);
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'scorecard-top',
      detail: String(err && err.message || err),
    });
  }

  // Step 5 — archival sweep.
  let archivedCounts = {};
  try {
    archivedCounts = archivalSweep(sessionId);
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'sweep-top',
      detail: String(err && err.message || err),
    });
    archivedCounts = {};
  }

  // Step 6 — quest-log size control.
  let questLogMoved = 0;
  try {
    questLogMoved = questLogSizeControl(sessionId);
  } catch (err) {
    traceEvent(sessionId, {
      event: 'error',
      stage: 'quest-log-top',
      detail: String(err && err.message || err),
    });
  }

  // Step 7 — summary line.
  summary = summaryLine(reconciledCount, archivedCounts, questLogMoved);
} catch {
  // Best-effort; silent.
}

if (summary) {
  try {
    process.stdout.write(summary + '\n');
  } catch {
    // Silent.
  }
}

process.stdout.write(JSON.stringify({}) + '\n');
process.exit(0);
