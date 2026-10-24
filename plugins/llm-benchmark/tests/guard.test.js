// Run from the repository root: node --test
// Unit cases call decide(); CLI cases feed the hook a PreToolUse payload through stdin and check the exit code
// (0 = allowed, 2 = blocked) and the JSON on stdout.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const GUARD = path.join(__dirname, '..', 'scripts', 'guard.js');
const g = require(GUARD);

const NO_KEY = {};
const bash = (command, env = NO_KEY) => g.decide('Bash', { command }, env).decision;

test('effort max on the claude CLI is blocked', () => {
  assert.strictEqual(bash('claude -p "convert" --model claude-opus-5-5 --effort max'), 'deny');
  assert.strictEqual(bash('"$CLI" -p x --effort=max'), 'deny');
  assert.strictEqual(bash('cd /tmp/w && /opt/claude/claude -p x --effort max --output-format json'), 'deny');
  assert.strictEqual(bash('bash -c "claude -p x --effort max"'), 'deny');
});

test('a runner called with a model name followed by max is blocked', () => {
  assert.strictEqual(bash('node audit/llm/run.js opus max pilot'), 'deny');
  assert.strictEqual(bash('node run-chunked.js sonnet46 max 100 all'), 'deny');
  assert.strictEqual(bash('node run.js claude-haiku-5-5 max'), 'deny');
});

test('xhigh and lower pass', () => {
  for (const e of ['low', 'medium', 'high', 'xhigh']) assert.strictEqual(bash(`claude -p x --effort ${e}`), 'allow', e);
  assert.strictEqual(bash('node audit/llm/run.js opus xhigh pilot'), 'allow');
  assert.strictEqual(bash('node table.js --max 5'), 'allow');
});

test('max in quoted text, commit messages and heredocs is not a run', () => {
  assert.strictEqual(bash('git commit -m "never run --effort max again"'), 'allow');
  assert.strictEqual(bash('git commit -F - <<EOF\nclaude -p x --effort max\nEOF'), 'allow');
  assert.strictEqual(bash('grep -rn "effort max" docs/'), 'allow');
});

test('the bypass prefix asks the user', () => {
  const r = g.decide('Bash', { command: 'LLM_BENCH_ALLOW_MAX=1 claude -p x --effort max' }, NO_KEY);
  assert.strictEqual(r.decision, 'ask');
  assert.match(r.reasons[0], /effort max/);
});

test('Agent with effort max is blocked, other efforts pass', () => {
  assert.strictEqual(g.decide('Agent', { prompt: 'x', effort: 'max' }).decision, 'deny');
  assert.strictEqual(g.decide('Agent', { prompt: 'x', effort: 'xhigh' }).decision, 'allow');
  assert.strictEqual(g.decide('Agent', { prompt: 'x' }).decision, 'allow');
});

test('--bare without ANTHROPIC_API_KEY is blocked', () => {
  assert.strictEqual(bash('claude --bare -p x --effort low'), 'deny');
  assert.match(g.decide('Bash', { command: 'claude --bare -p x' }, NO_KEY).reasons[0], /setting-sources/);
  assert.strictEqual(bash('claude --bare -p x', { ANTHROPIC_API_KEY: 'k' }), 'allow');
  assert.strictEqual(bash('ANTHROPIC_API_KEY=k claude --bare -p x'), 'allow');
  assert.strictEqual(bash('mytool --bare'), 'allow', 'only the claude CLI');
});

test('other tools pass', () => {
  assert.strictEqual(g.decide('Read', { file_path: 'x' }).decision, 'allow');
});

function run(payload) {
  return spawnSync(process.execPath, [GUARD], { input: JSON.stringify(payload), encoding: 'utf8', env: { PATH: process.env.PATH } });
}

test('cli: deny is exit 2 with the reason on stderr', () => {
  const r = run({ tool_name: 'Bash', tool_input: { command: 'claude -p x --effort max' } });
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /llm-benchmark: effort max blocked/);
  const a = run({ tool_name: 'Agent', tool_input: { prompt: 'x', effort: 'max' } });
  assert.strictEqual(a.status, 2);
});

test('cli: ask is JSON with permissionDecision ask', () => {
  const r = run({ tool_name: 'Bash', tool_input: { command: 'LLM_BENCH_ALLOW_MAX=1 claude -p x --effort max' } });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'ask');
});

test('cli: allow is silent; broken input fails open', () => {
  const r = run({ tool_name: 'Bash', tool_input: { command: 'claude -p x --effort medium' } });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  const b = spawnSync(process.execPath, [GUARD], { input: '{not json', encoding: 'utf8' });
  assert.strictEqual(b.status, 0);
  assert.match(b.stderr, /internal error, command allowed/);
});
