// Run from the repository root: node --test
// Unit cases call the decision functions with a fake host; CLI cases feed the hook a payload through stdin with the
// host state in MOBILE_RUNS_HOST and check the exit code (0 = allowed, 2 = blocked) and the JSON on stdout.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const GUARD = path.join(__dirname, '..', 'scripts', 'guard.js');
const g = require(GUARD);

const OK = { platform: 'darwin', power: 'AC', lowPowerMode: false, displayAwake: false, emulators: [] };
const cfg = (over = {}) => ({ timedRuns: [], deviceRuns: [], defaults: true, warnings: [], ...over });
const pre = (command, host = OK, c = cfg()) => g.decidePre(command, c, () => host);
const decision = (command, host, c) => pre(command, host, c).decision;

test('parser: quotes, operators, redirections, heredocs, comments', () => {
  assert.deepStrictEqual(g.parseCommands('a "b c" \'d\' && e|f; g & h'), [['a', 'b c', 'd'], ['e'], ['f'], ['g'], ['h']]);
  assert.deepStrictEqual(g.parseCommands('node x.js > out.log 2>&1 &'), [['node', 'x.js']]);
  assert.deepStrictEqual(g.parseCommands('cat <<EOF\nnode bench.js\nEOF\nls'), [['cat'], ['ls']]);
  assert.deepStrictEqual(g.parseCommands('ls # node bench.js'), [['ls']]);
  assert.deepStrictEqual(g.parseCommands('x=$(node bench.js)'), [['node', 'bench.js'], ['x=$()']]);
});

test('timed runs are recognised by script and file name', () => {
  for (const c of ['node bench/scale.js --count 100', 'npm run bench', 'npm run bench:scale', 'yarn bench', 'python3 benchmark.py', './bench.sh', 'node audit/device/scale.js --resume'])
    assert.ok(g.isTimed(g.expand(c)[0].words), c);
  for (const c of ['node bench/make-scale-chart.js', 'node --test tests/bench.test.js', 'npm test', 'cat bench/scale.js', 'node run.js'])
    assert.ok(!g.isTimed(g.expand(c)[0].words), c);
});

test('device runs are recognised', () => {
  for (const c of ['xcodebuild test -scheme App', 'xcodebuild test-without-building', './gradlew connectedDebugAndroidTest', './gradlew :app:connectedCheck', 'maestro test flow.yaml', 'flutter drive'])
    assert.ok(g.isDevice(g.expand(c)[0].words), c);
  for (const c of ['xcodebuild build', './gradlew assembleRelease', 'maestro studio'])
    assert.ok(!g.isDevice(g.expand(c)[0].words), c);
});

test('timed run on battery or in Low Power Mode is blocked', () => {
  assert.strictEqual(decision('caffeinate -dimsu node bench/scale.js', { ...OK, power: 'battery' }), 'deny');
  assert.strictEqual(decision('caffeinate -dimsu node bench/scale.js', { ...OK, lowPowerMode: true }), 'deny');
  assert.match(pre('caffeinate -dimsu npm run bench', { ...OK, power: 'battery', lowPowerMode: true }).reasons[0], /on battery power and in Low Power Mode/);
});

test('timed run on AC with caffeinate passes', () => {
  assert.strictEqual(decision('caffeinate -dimsu node bench/scale.js'), 'allow');
  assert.strictEqual(decision('cd bench && caffeinate -dimsu -w 123 node scale.js'), 'allow');
  assert.strictEqual(decision('caffeinate -dimsu -w $$ & node bench/scale.js'), 'allow');
});

test('battery bypass asks the user instead of blocking', () => {
  const r = pre('MOBILE_RUNS_ALLOW_BATTERY=1 caffeinate -dimsu node bench/scale.js', { ...OK, power: 'battery' });
  assert.strictEqual(r.decision, 'ask');
  assert.match(r.reasons[0], /on battery power/);
  assert.strictEqual(decision('MOBILE_RUNS_ALLOW_BATTERY=0 caffeinate -dimsu node bench/scale.js', { ...OK, power: 'battery' }), 'deny');
});

test('device and timed runs need the display kept awake', () => {
  assert.strictEqual(decision('node bench/scale.js'), 'deny');
  assert.strictEqual(decision('xcodebuild test -scheme App'), 'deny');
  assert.match(pre('xcodebuild test -scheme App').reasons[0], /caffeinate -dimsu xcodebuild test/);
  assert.strictEqual(decision('node bench/scale.js', { ...OK, displayAwake: true }), 'allow');
  assert.strictEqual(decision('xcodebuild test -scheme App', { ...OK, power: 'battery' }), 'deny');
  assert.strictEqual(decision('caffeinate -dimsu xcodebuild test -scheme App', { ...OK, power: 'battery' }), 'allow', 'power applies to timed runs only');
});

test('timed run with a windowed emulator is blocked', () => {
  assert.strictEqual(decision('caffeinate -dimsu node bench/scale.js', { ...OK, emulators: [{ windowed: true }] }), 'deny');
  assert.strictEqual(decision('caffeinate -dimsu node bench/scale.js', { ...OK, emulators: [{ windowed: false }] }), 'allow');
  assert.strictEqual(decision('caffeinate -dimsu ./gradlew connectedDebugAndroidTest', { ...OK, emulators: [{ windowed: true }] }), 'allow', 'window rule applies to timed runs only');
});

test('commands inside quotes, commit messages and heredocs are not runs', () => {
  assert.strictEqual(decision('git commit -m "node bench/scale.js on battery"', { ...OK, power: 'battery' }), 'allow');
  assert.strictEqual(decision('git commit -F - <<EOF\nnpm run bench\nEOF', { ...OK, power: 'battery' }), 'allow');
  assert.strictEqual(decision('grep -n bench README.md', { ...OK, power: 'battery' }), 'allow');
});

test('bash -c and eval are looked into', () => {
  assert.strictEqual(decision('bash -c "node bench/scale.js"', { ...OK, power: 'battery' }), 'deny');
  assert.strictEqual(decision("eval 'npm run bench'", { ...OK, power: 'battery' }), 'deny');
});

test('creating, deleting and downloading devices asks the user', () => {
  for (const c of ['xcrun simctl create "Lab iPhone" com.apple.CoreSimulator.SimDeviceType.iPhone-17', 'xcrun simctl delete unavailable', 'xcrun simctl erase all',
    'xcrun simctl runtime add ios.dmg', 'xcodebuild -downloadPlatform iOS', 'avdmanager create avd -n Bench -k "system-images;android-36;default;arm64-v8a"',
    'avdmanager delete avd -n Bench', 'sdkmanager "system-images;android-36;default;arm64-v8a"'])
    assert.strictEqual(decision(c), 'ask', c);
  for (const c of ['xcrun simctl list devices', 'xcrun simctl boot ABC', 'avdmanager list avd', 'emulator -list-avds', 'sdkmanager --list'])
    assert.strictEqual(decision(c), 'allow', c);
});

test('deny wins over ask; reasons are not repeated', () => {
  const r = pre('xcrun simctl create X Y && node bench/scale.js && npm run bench');
  assert.strictEqual(r.decision, 'deny');
  assert.strictEqual(r.reasons.filter((x) => /display may sleep/.test(x)).length, 2);
});

test('other platforms: host rules are skipped, consent still asks', () => {
  assert.strictEqual(decision('node bench/scale.js', { platform: 'linux' }), 'allow');
  assert.strictEqual(decision('avdmanager create avd -n X', { platform: 'linux' }), 'ask');
});

test('host is not probed for ordinary commands', () => {
  let probed = 0;
  g.decidePre('git status && npm test', cfg(), () => { probed++; return OK; });
  assert.strictEqual(probed, 0);
});

test('project config adds patterns and can switch the defaults off', () => {
  const c = cfg({ timedRuns: [/^node tools\/measure\.js/], deviceRuns: [/^npx wdio/] });
  assert.strictEqual(decision('caffeinate -dimsu node tools/measure.js', { ...OK, power: 'battery' }, c), 'deny');
  assert.strictEqual(decision('npx wdio run wdio.conf.js', OK, c), 'deny');
  assert.strictEqual(decision('node bench/scale.js', OK, cfg({ defaults: false })), 'allow');
});

test('loadConfig reads .claude/mobile-test-runs.json and survives a broken file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtr-'));
  try {
    fs.mkdirSync(path.join(dir, '.claude'));
    fs.writeFileSync(path.join(dir, '.claude', 'mobile-test-runs.json'), JSON.stringify({ timedRuns: ['^node run\\.js'], defaults: false }));
    const c = g.loadConfig(dir);
    assert.ok(c.timedRuns[0].test('node run.js'));
    assert.strictEqual(c.defaults, false);
    assert.match(c.warnings.join(), /"defaults": false/);
    fs.writeFileSync(path.join(dir, '.claude', 'mobile-test-runs.json'), '{ broken');
    const b = g.loadConfig(dir);
    assert.strictEqual(b.defaults, true);
    assert.strictEqual(b.warnings.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('post: a background device run gets a monitor reminder', () => {
  assert.match(g.decidePost({ command: 'caffeinate -dimsu node bench/scale.js', run_in_background: true }, cfg()), /progress monitor/);
  assert.strictEqual(g.decidePost({ command: 'caffeinate -dimsu node bench/scale.js' }, cfg()), null);
  assert.strictEqual(g.decidePost({ command: 'npm install', run_in_background: true }, cfg()), null);
});

// ---------------------------------------------------------------- CLI

function run(mode, toolInput, host = OK, toolName = 'Bash') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtr-cli-'));
  try {
    const env = { ...process.env, MOBILE_RUNS_TEST: '1', MOBILE_RUNS_HOST: JSON.stringify(host), CLAUDE_PROJECT_DIR: dir };
    const input = JSON.stringify({ hook_event_name: mode === 'post' ? 'PostToolUse' : 'PreToolUse', tool_name: toolName, tool_input: toolInput, cwd: dir });
    return spawnSync(process.execPath, [GUARD, mode], { input, env, encoding: 'utf8' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('cli pre: deny is exit 2 with the reason on stderr', () => {
  const r = run('pre', { command: 'caffeinate -dimsu node bench/scale.js' }, { ...OK, power: 'battery' });
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /mobile-test-runs: timed run blocked/);
});

test('cli pre: ask is JSON with permissionDecision ask', () => {
  const r = run('pre', { command: 'xcrun simctl create X Y' });
  assert.strictEqual(r.status, 0);
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.strictEqual(out.hookEventName, 'PreToolUse');
  assert.strictEqual(out.permissionDecision, 'ask');
  assert.match(out.permissionDecisionReason, /creates a new simulator/);
});

test('cli pre: allow is exit 0 with no output', () => {
  const r = run('pre', { command: 'git status' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
});

test('cli post: additionalContext for a background run', () => {
  const r = run('post', { command: 'caffeinate -dimsu xcodebuild test -scheme App', run_in_background: true });
  assert.strictEqual(r.status, 0);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /--resume/);
});

test('cli: other tools and broken input fail open', () => {
  assert.strictEqual(run('pre', { file_path: 'x' }, OK, 'Read').status, 0);
  const r = spawnSync(process.execPath, [GUARD, 'pre'], { input: '{not json', encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.match(r.stderr, /internal error, command allowed/);
});
