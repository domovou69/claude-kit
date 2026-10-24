// Run from the repository root: node --test
// Runs the template runner against a fake `claude` binary (CLAUDE_BIN): isolation flags, chunking, resume after a
// failed chunk, the STOP file, cost from the result line, and the refusal of effort max.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TEMPLATE = path.join(__dirname, '..', 'skills', 'llm-vs-tool', 'templates', 'run.js');

// The fake CLI answers every item unless the marker file named in the prompt exists and the chunk holds id "i3".
// It logs each call (cwd, args, environment keys) to the log file named in the prompt.
const FAKE = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('9.9.9 (fake)'); process.exit(0); }
const prompt = args[args.indexOf('-p') + 1];
const log = prompt.match(/LOG:(\\S+)/)[1], marker = prompt.match(/FAIL:(\\S+)/)[1];
const input = JSON.parse(fs.readFileSync('input.json', 'utf8'));
fs.appendFileSync(log, JSON.stringify({ cwd: process.cwd(), args, env: Object.keys(process.env), ids: input.map(x => x.id), files: fs.readdirSync('.') }) + '\\n');
console.log(JSON.stringify({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 10, output_tokens: 5 } } }));
if (fs.existsSync(marker) && input.some(x => x.id === 'i3')) process.exit(1);
fs.writeFileSync('output.json', JSON.stringify(input.map(x => ({ id: x.id, answer: x.q.toUpperCase() }))));
console.log(JSON.stringify({ type: 'result', total_cost_usd: 0.25, usage: { input_tokens: 100, output_tokens: 50, output_tokens_details: { thinking_tokens: 20 } } }));
`;

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-tpl-'));
  fs.copyFileSync(TEMPLATE, path.join(dir, 'run.js'));
  const fake = path.join(dir, 'fake-claude');
  fs.writeFileSync(fake, FAKE, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify([...Array(5).keys()].map((i) => ({ id: `i${i}`, q: `q${i}` }))));
  const log = path.join(dir, 'calls.log');
  const marker = path.join(dir, 'fail-marker');
  fs.writeFileSync(path.join(dir, 'prompt.md'), `Convert the {{COUNT}} items. LOG:${log} FAIL:${marker}\n`);
  const run = (...a) => spawnSync(process.execPath, [path.join(dir, 'run.js'), ...a], {
    encoding: 'utf8', env: { ...process.env, CLAUDE_BIN: fake, SECRET_FROM_PARENT: 'x' },
  });
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []);
  return { dir, run, calls, marker, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('effort max and unknown models are refused', () => {
  const t = setup();
  try {
    assert.strictEqual(t.run('opus', 'max').status, 2);
    assert.strictEqual(t.run('gpt', 'low').status, 2);
    assert.strictEqual(t.calls().length, 0);
  } finally { t.cleanup(); }
});

test('chunks run isolated and merge with cost and time', () => {
  const t = setup();
  try {
    const r = t.run('haiku', 'medium', '--size', '2', '--name', 'pilot');
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    const calls = t.calls();
    assert.strictEqual(calls.length, 3);
    for (const c of calls) {
      assert.ok(!c.cwd.startsWith(t.dir), 'runs outside the project folder');
      assert.deepStrictEqual(c.files, ['input.json'], 'the folder holds input.json only');
      assert.ok(!c.env.includes('SECRET_FROM_PARENT'), 'parent environment is not passed');
      for (const f of ['--setting-sources', '--strict-mcp-config', '--no-session-persistence', '--tools'])
        assert.ok(c.args.includes(f), f);
      assert.ok(!c.args.includes('--bare'));
      assert.strictEqual(c.args[c.args.indexOf('--effort') + 1], 'medium');
    }
    assert.match(calls[0].args[calls[0].args.indexOf('-p') + 1], /Convert the 2 items/);
    assert.match(calls[2].args[calls[2].args.indexOf('-p') + 1], /Convert the 1 items/);
    const merged = JSON.parse(fs.readFileSync(path.join(t.dir, 'runs', 'haiku-medium-pilot.json'), 'utf8'));
    assert.strictEqual(merged.output.length, 5);
    assert.strictEqual(merged.costUsd, 0.75);
    assert.strictEqual(merged.costComplete, true);
    assert.strictEqual(merged.usage.output, 150);
    assert.strictEqual(merged.usage.thinking, 60);
    assert.strictEqual(merged.cliVersion, '9.9.9 (fake)');
    assert.match(merged.promptText, /\{\{COUNT\}\}/);
    assert.ok(typeof merged.wallMs === 'number');
  } finally { t.cleanup(); }
});

test('a failed chunk is kept with partial usage; resume reruns only that chunk', () => {
  const t = setup();
  try {
    fs.writeFileSync(t.marker, '');
    const r1 = t.run('sonnet', 'low', '--size', '2');
    assert.strictEqual(r1.status, 1, 'not all chunks valid');
    assert.ok(!fs.existsSync(path.join(t.dir, 'runs', 'sonnet-low-run.json')), 'no merge with a failed chunk');
    const failed = JSON.parse(fs.readFileSync(path.join(t.dir, 'runs', 'sonnet-low-run', 'chunk-2.json'), 'utf8'));
    assert.strictEqual(failed.valid, false);
    assert.strictEqual(failed.costComplete, false);
    assert.strictEqual(failed.usage.output, 5, 'per-message usage kept for a stopped chunk');
    assert.strictEqual(t.calls().length, 3);
    fs.rmSync(t.marker);
    const r2 = t.run('sonnet', 'low', '--size', '2');
    assert.strictEqual(r2.status, 0, r2.stdout + r2.stderr);
    const calls = t.calls();
    assert.strictEqual(calls.length, 4, 'only the failed chunk ran again');
    assert.deepStrictEqual(calls[3].ids, ['i2', 'i3']);
    assert.match(r2.stdout, /chunk 1: done before, skipped/);
  } finally { t.cleanup(); }
});

test('the STOP file stops before the next chunk', () => {
  const t = setup();
  try {
    fs.writeFileSync(path.join(t.dir, 'STOP'), '');
    const r = t.run('opus', 'xhigh', '--size', '2');
    assert.strictEqual(r.status, 1);
    assert.match(r.stdout, /STOP file found/);
    assert.strictEqual(t.calls().length, 0);
  } finally { t.cleanup(); }
});
