#!/usr/bin/env node
// mobile-test-runs guard: a hook for the Bash tool, run as `guard.js pre` (PreToolUse) or `guard.js post` (PostToolUse).
// pre:  a timed run (benchmark) starts only on AC power with Low Power Mode off, with the display kept awake and with
//       no Android emulator window open; a device run starts only with the display kept awake; creating, deleting
//       or downloading simulators, emulators and OS images asks the user first.
// post: a timed or device run started in the background gets a reminder to arm a progress monitor.
// A block is exit 2 with the reason on stderr; an ask or a reminder is JSON on stdout.
// No dependencies; any internal error fails open (exit 0) so the guard never wedges a session.

'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const RUNNERS = new Set(['node', 'deno', 'bun', 'python', 'python3', 'ruby', 'bash', 'sh', 'zsh', 'make']);
const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const TIMED_FILE = /^(bench|benchmark|benchmarks|perf|scale)(\.[cm]?[jt]s|\.py|\.sh)?$/i;
const TIMED_SCRIPT = /^(bench|benchmark|perf)([:_-][\w:.-]*)?$/i;
const BYPASS = 'MOBILE_RUNS_ALLOW_BATTERY';

// ---------------------------------------------------------------- shell parsing

// shell-parse.js is a copy of shared/shell-parse.js (node scripts/sync-shared.js); do not edit it here.
let parseCommands;
let expand;
try {
  ({ parseCommands, expand } = require('./shell-parse'));
} catch (e) {
  if (require.main !== module) throw e;
  process.stderr.write(`mobile-test-runs: internal error, command allowed: ${e.message}\n`);
  process.exit(0);
}

// ---------------------------------------------------------------- classification

function isTimed(words) {
  const b = path.basename(words[0]);
  if (PACKAGE_MANAGERS.has(b)) {
    const script = words[1] === 'run' || words[1] === 'run-script' ? words[2] : b === 'npm' ? null : words[1];
    if (script && TIMED_SCRIPT.test(script)) return true;
  }
  if (RUNNERS.has(b)) return words.slice(1).some((t) => !t.startsWith('-') && TIMED_FILE.test(path.basename(t)));
  return TIMED_FILE.test(b);
}

function isDevice(words) {
  const b = path.basename(words[0]);
  const rest = words.slice(1);
  if (b === 'xcodebuild') return rest.includes('test') || rest.includes('test-without-building');
  if (b === 'gradlew' || b === 'gradle') return rest.some((t) => /^(:?[\w-]+:)*connected\w*(AndroidTest|Check)$/.test(t));
  if (b === 'maestro' || b === 'detox') return rest[0] === 'test';
  if (b === 'flutter') return rest[0] === 'drive';
  return false;
}

// A reason to ask the user first, or null.
function consent(words) {
  let b = path.basename(words[0]);
  let rest = words.slice(1);
  if (b === 'xcrun' && rest[0] === 'simctl') { b = 'simctl'; rest = rest.slice(1); }
  if (b === 'simctl') {
    if (['create', 'clone'].includes(rest[0])) return 'creates a new simulator';
    if (['delete', 'erase'].includes(rest[0])) return `runs simctl ${rest[0]} (removes or wipes simulators)`;
    if (rest[0] === 'runtime' && ['add', 'delete'].includes(rest[1])) return `runs simctl runtime ${rest[1]} (a simulator runtime of several GB)`;
  }
  if (b === 'xcodebuild' && rest.some((t) => /^-(downloadPlatform|downloadAllPlatforms|importPlatform|downloadComponent)$/.test(t)))
    return 'downloads or imports a platform or simulator runtime (several GB)';
  if (b === 'avdmanager' && rest.includes('create')) return 'creates a new Android virtual device';
  if (b === 'avdmanager' && rest.includes('delete')) return 'deletes an Android virtual device';
  if (b === 'sdkmanager' && rest.some((t) => t.startsWith('system-images;'))) return 'installs or removes an emulator system image (about 1 GB or more)';
  return null;
}

// ---------------------------------------------------------------- config and host

function loadConfig(dir) {
  const cfg = { timedRuns: [], deviceRuns: [], defaults: true, warnings: [] };
  const file = path.join(dir, '.claude', 'mobile-test-runs.json');
  if (!fs.existsSync(file)) return cfg;
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    cfg.timedRuns = (j.timedRuns || []).map((s) => new RegExp(s));
    cfg.deviceRuns = (j.deviceRuns || []).map((s) => new RegExp(s));
    if (j.defaults === false) {
      cfg.defaults = false;
      cfg.warnings.push(`mobile-test-runs: ${file} sets "defaults": false, so the built-in timed and device run patterns are off; only its own patterns apply.`);
    }
  } catch (e) {
    cfg.warnings.push(`mobile-test-runs: ignoring ${file}: ${e.message}`);
  }
  return cfg;
}

function sh(cmd, args) {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }); } catch { return null; }
}

// Power source, Low Power Mode, display-sleep assertion and running emulators (macOS only).
function probeHost() {
  if (process.env.MOBILE_RUNS_TEST === '1' && process.env.MOBILE_RUNS_HOST) return JSON.parse(process.env.MOBILE_RUNS_HOST); // test seam
  if (process.platform !== 'darwin') return { platform: process.platform };
  const batt = sh('pmset', ['-g', 'batt']) || '';
  const g = sh('pmset', ['-g']) || '';
  const lpm = g.match(/\blowpowermode\s+(\d)/) || g.match(/\bpowermode\s+(\d)/);
  const assertions = sh('pmset', ['-g', 'assertions']) || '';
  const ps = sh('ps', ['-axo', 'args=']) || '';
  return {
    platform: 'darwin',
    power: /AC Power/.test(batt) ? 'AC' : /Battery Power/.test(batt) ? 'battery' : null,
    lowPowerMode: lpm ? lpm[1] === '1' : null,
    displayAwake: /PreventUserIdleDisplaySleep\s+1/.test(assertions),
    emulators: ps.split('\n').filter((l) => /qemu-system-/.test(l)).map((l) => ({ windowed: !/(^|\s)-no-window(\s|$)/.test(l) })),
  };
}

// ---------------------------------------------------------------- decisions

function classify(command, cfg) {
  const cmds = expand(command);
  const caffeinated = cmds.some((c) => c.caffeinate);
  const found = [];
  for (const c of cmds) {
    if (!c.words.length) continue;
    const line = c.words.join(' ');
    const timed = cfg.timedRuns.some((r) => r.test(line)) || (cfg.defaults && isTimed(c.words));
    const device = timed || cfg.deviceRuns.some((r) => r.test(line)) || (cfg.defaults && isDevice(c.words));
    const ask = consent(c.words);
    if (timed || device || ask) found.push({ line, env: c.env, timed, device, ask });
  }
  return { cmds: found, caffeinated };
}

// Returns { decision: 'allow' | 'ask' | 'deny', reasons: [...] }. host is a function, probed only when needed.
function decidePre(command, cfg, host) {
  const { cmds, caffeinated } = classify(command, cfg);
  const deny = [];
  const ask = [];
  let h = null;
  const getHost = () => (h ??= host());
  for (const c of cmds) {
    if (c.ask) ask.push(`\`${c.line}\` ${c.ask}. Reuse the existing device and images unless you asked for this.`);
    if (!c.device || getHost().platform !== 'darwin') continue;
    const hs = getHost();
    if (c.timed && (hs.power === 'battery' || hs.lowPowerMode === true)) {
      const state = [hs.power === 'battery' && 'on battery power', hs.lowPowerMode === true && 'in Low Power Mode'].filter(Boolean).join(' and ');
      if (c.env[BYPASS] === '1') ask.push(`\`${c.line}\` is a timed run while the Mac is ${state}; the timings will be slower than on AC power. Record the power state next to the results.`);
      else deny.push(`timed run blocked: the Mac is ${state}. Timings taken this way are not comparable (an emulator ran 6–40× slower in Low Power Mode). Ask the user to plug in and turn Low Power Mode off, wait, then rerun. Only if the user explicitly asked for a measurement on battery, prefix the command with ${BYPASS}=1; the user will be asked to confirm.`);
    }
    if (!caffeinated && !hs.displayAwake)
      deny.push(`${c.timed ? 'timed' : 'device'} run blocked: the display may sleep during it (no caffeinate in the command and no display-sleep assertion held). Display sleep slowed an emulator about 5× and dropped the USB tunnel to a real iPhone. Run it as \`caffeinate -dimsu ${c.line}\`.`);
    if (c.timed && (hs.emulators || []).some((e) => e.windowed))
      deny.push('timed run blocked: an Android emulator is running with a window. With the window hidden or minimised macOS deprioritised the emulator and lookups jumped from about 1 s to 6 s. Restart it headless: `emulator -avd <name> -no-window -no-snapshot-load -no-boot-anim -no-audio`, then rerun.');
  }
  if (deny.length) return { decision: 'deny', reasons: [...new Set(deny)] };
  if (ask.length) return { decision: 'ask', reasons: [...new Set(ask)] };
  return { decision: 'allow', reasons: [] };
}

function decidePost(input, cfg) {
  if (!input.run_in_background) return null;
  const { cmds } = classify(input.command || '', cfg);
  if (!cmds.some((c) => c.device)) return null;
  return 'mobile-test-runs: a device run is now in the background. Arm a progress monitor now: every 5–10 minutes report done/total, errors and the current step, emit at once on finish, error or process exit, and re-arm it until the run ends. If the run dies, continue it with --resume instead of starting over.';
}

// ---------------------------------------------------------------- main

function main() {
  const mode = process.argv[2] === 'post' ? 'post' : 'pre';
  const payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  if (payload.tool_name !== 'Bash' || !payload.tool_input) return 0;
  const cfg = loadConfig(process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd());
  for (const w of cfg.warnings) process.stderr.write(w + '\n');
  if (mode === 'post') {
    const note = decidePost(payload.tool_input, cfg);
    if (note) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: note } }) + '\n');
    return 0;
  }
  const { decision, reasons } = decidePre(payload.tool_input.command || '', cfg, probeHost);
  if (decision === 'deny') {
    process.stderr.write(reasons.map((r) => `mobile-test-runs: ${r}`).join('\n') + '\n');
    return 2;
  }
  if (decision === 'ask') {
    const reason = `mobile-test-runs: ${reasons.join(' ')} Allow?`;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }) + '\n');
  }
  return 0;
}

if (require.main === module) {
  let code = 0;
  try {
    code = main();
  } catch (e) {
    process.stderr.write(`mobile-test-runs: internal error, command allowed: ${e.message}\n`);
    code = 0;
  }
  process.exit(code);
}

module.exports = { parseCommands, expand, isTimed, isDevice, consent, loadConfig, classify, decidePre, decidePost };
