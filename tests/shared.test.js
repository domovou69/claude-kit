// Tests for shared/: every plugin copy matches its source, and the shared parser sees commands the old
// per-plugin copies missed. Run from the repository root: node --test

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { targets, stale } = require(path.join(ROOT, 'scripts', 'sync-shared.js'));
const { parseCommands, expand } = require(path.join(ROOT, 'shared', 'shell-parse.js'));
const publishing = require(path.join(ROOT, 'plugins', 'publishing', 'scripts', 'guard.js'));
const llm = require(path.join(ROOT, 'plugins', 'llm-benchmark', 'scripts', 'guard.js'));

test('sync: every plugin with a guard has a copy, and every copy matches shared/', () => {
  const plugins = targets().map(([, dst]) => path.basename(path.dirname(path.dirname(dst))));
  assert.deepStrictEqual(plugins, ['git-guard', 'llm-benchmark', 'mobile-test-runs', 'publishing']);
  assert.deepStrictEqual(stale().map(([, dst]) => path.relative(ROOT, dst)), [],
    'a copy differs from shared/: edit shared/shell-parse.js, then run node scripts/sync-shared.js');
});

const commands = (src) => expand(src).map((c) => c.words.join(' '));

test('parser: substitutions inside double quotes, groups, redirections', () => {
  assert.deepStrictEqual(parseCommands('echo "$(npm publish)"'), [['npm', 'publish'], ['echo', '$()']]);
  assert.deepStrictEqual(parseCommands('echo "`npm publish`"'), [['npm', 'publish'], ['echo', '$()']]);
  assert.deepStrictEqual(parseCommands('{ npm publish; }'), [['npm', 'publish']]);
  assert.deepStrictEqual(parseCommands('npm publish &>/dev/null'), [['npm', 'publish']]);
  assert.deepStrictEqual(parseCommands('git commit -m "x" 2>&1 | tee log'), [['git', 'commit', '-m', 'x'], ['tee', 'log']]);
  assert.deepStrictEqual(parseCommands("git commit -m \"$(cat <<'EOF'\nnpm publish\nEOF\n)\""), [['cat'], ['git', 'commit', '-m', '$()']]);
});

test('unwrap: wrappers with value flags and leading arguments', () => {
  assert.deepStrictEqual(commands('timeout 30 npm publish'), ['npm publish']);
  assert.deepStrictEqual(commands('sudo -u me npm publish'), ['npm publish']);
  assert.deepStrictEqual(commands('env -u FOO X=1 npm publish'), ['npm publish']);
  assert.deepStrictEqual(commands('nice -n 5 caffeinate -w 1 node bench.js'), ['node bench.js']);
  assert.strictEqual(expand('caffeinate -dimsu node bench.js')[0].caffeinate, true);
  assert.deepStrictEqual(commands('bash -lc "npm publish"'), ['bash -lc npm publish', 'npm publish']);
  assert.deepStrictEqual(expand('LLM_BENCH_ALLOW_MAX=1 node run.js opus max')[0].env, { LLM_BENCH_ALLOW_MAX: '1' });
});

test('guards: bypasses the old copies missed are caught', () => {
  for (const c of ['echo "$(npm publish)"', 'timeout 60 npm publish', 'bash -lc "npm publish"', '{ npm publish; }'])
    assert.strictEqual(publishing.decide('Bash', { command: c }).decision, 'deny', c);
  assert.strictEqual(publishing.decide('Bash', { command: 'git commit -m "npm publish later"' }).decision, 'allow');
  assert.strictEqual(llm.decide('Bash', { command: 'out="$(claude -p x --effort max)"' }).decision, 'deny');
});
