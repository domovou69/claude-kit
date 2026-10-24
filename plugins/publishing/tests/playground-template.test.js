// Run from the repository root: node --test
// The playground templates work together: a throwaway library gets site/build.js, site/check.js and
// site/playground.js copied in with the slots filled, and check.js must pass; a core module that uses fs must
// fail the build.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TPL = path.join(__dirname, '..', 'skills', 'github-pages-playground', 'templates');

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playground-'));
  const w = (f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
  w('lib/status.js', "module.exports = { SUCCESS: 'success', SKIPPED: 'skipped' };\n");
  w('lib/parser.js', "exports.words = (s) => s.split(' ');\n");
  w('lib/converter.js', [
    "const STATUS = require('./status');",
    "const { words } = require('./parser.js');",
    'exports.convert = (s) => {',
    "  if (words(s).includes('skipped')) return { status: STATUS.SKIPPED, reason: 'not expressible' };",
    "  return { status: STATUS.SUCCESS, locator: s.toUpperCase(), warning: words(s).includes('warning') ? 'wider' : undefined };",
    '};',
  ].join('\n'));
  w('index.js', "module.exports = { ...require('./lib/converter'), STATUS: require('./lib/status') };\n");
  w('test/cases.json', JSON.stringify([{ id: 'a', input: 'converts exactly' }, { id: 'b', input: 'with a warning' }, { id: 'c', input: 'is skipped here' }]));
  fs.mkdirSync(path.join(dir, 'site'));
  for (const f of ['build.js', 'index.html', 'playground.js']) fs.copyFileSync(path.join(TPL, f), path.join(dir, 'site', f));
  fs.copyFileSync(path.join(TPL, 'site-check.js'), path.join(dir, 'site', 'check.js'));
  return dir;
}

test('the templates build and pass their own parity check', () => {
  const dir = project();
  const r = spawnSync(process.execPath, ['site/check.js'], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /3 cases match the library/);
  const b = spawnSync(process.execPath, ['site/build.js'], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(b.status, 0, b.stderr);
  for (const f of ['bundle.js', 'index.html', 'playground.js', '.nojekyll']) assert.ok(fs.existsSync(path.join(dir, '_site', f)), f);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a page example that does not give its label fails the check', () => {
  const dir = project();
  const p = path.join(dir, 'site', 'playground.js');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace("{ label: 'skip', text: 'slot: an input that is skipped with a reason' }", "{ label: 'skip', text: 'this one converts' }"));
  const r = spawnSync(process.execPath, ['site/check.js'], { cwd: dir, encoding: 'utf8' });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /example skip/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a core module that uses fs fails the build', () => {
  const dir = project();
  fs.appendFileSync(path.join(dir, 'lib', 'parser.js'), "const fs = require('fs');\n");
  const r = spawnSync(process.execPath, ['site/build.js'], { cwd: dir, encoding: 'utf8' });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /parser\.js uses require\('fs'\)/);
  fs.rmSync(dir, { recursive: true, force: true });
});
