// Run from the repository root: node --test
// Pure checks of skills/npm-release/scripts/release-check.js, and one CLI run on a throwaway git repository
// (offline: no registry, no fetch).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'skills', 'npm-release', 'scripts', 'release-check.js');
const c = require(SCRIPT);
const levels = (results) => results.map((r) => r[0]);

test('versions compare numerically, pre-releases first', () => {
  assert.strictEqual(c.compareVersions('1.2.10', '1.2.9'), 1);
  assert.strictEqual(c.compareVersions('1.0.3', '1.0.3'), 0);
  assert.strictEqual(c.compareVersions('v1.1.0', '1.2.0'), -1);
  assert.strictEqual(c.compareVersions('2.0.0-beta.1', '2.0.0'), -1);
  assert.strictEqual(c.compareVersions('2.0.0', '2.0.0-beta.1'), 1);
});

test('an already published version fails; a higher one passes and says the npm page changes with it', () => {
  assert.deepStrictEqual(levels(c.checkRegistry('1.0.3', '1.0.3')), ['FAIL']);
  assert.deepStrictEqual(levels(c.checkRegistry('1.0.2', '1.0.3')), ['FAIL']);
  const ok = c.checkRegistry('1.0.4', '1.0.3');
  assert.deepStrictEqual(levels(ok), ['PASS']);
  assert.match(ok[0][1], /reach the npm page only with this publish/);
  assert.deepStrictEqual(levels(c.checkRegistry('1.0.0', null)), ['WARN']);
});

test('a long README warns, the badge is looked for, npx github: is flagged', () => {
  const long = '# x\n' + 'line\n'.repeat(466);
  assert.ok(c.checkReadme(long, { maxLines: 120 }).some((r) => r[0] === 'WARN' && /npm page/.test(r[1])));
  const short = '# my-tool\n[![npm](https://img.shields.io/npm/v/my-tool)](https://www.npmjs.com/package/my-tool)\n';
  assert.deepStrictEqual(levels(c.checkReadme(short, { name: 'my-tool' })), ['PASS', 'PASS']);
  assert.ok(c.checkReadme('# my-tool\n', { name: 'my-tool' }).some((r) => /badge/.test(r[1]) && r[0] === 'WARN'));
  assert.ok(c.checkReadme('# my-tool\nnpx github:o/my-tool ./tests\n', { name: 'my-tool' }).some((r) => /npx github/.test(r[1])));
  assert.deepStrictEqual(levels(c.checkReadme(null)), ['FAIL']);
});

test('a bin stored as 100644 fails with the fix command', () => {
  const pkg = { bin: { 'my-tool': './my-tool.js' } };
  const r = c.checkBinModes(pkg, '100644 0123456789abcdef0123456789abcdef01234567 0\tmy-tool.js');
  assert.deepStrictEqual(levels(r), ['FAIL']);
  assert.match(r[0][1], /git update-index --chmod=\+x my-tool\.js/);
  assert.deepStrictEqual(levels(c.checkBinModes(pkg, '100755 0123456789abcdef0123456789abcdef01234567 0\tmy-tool.js')), ['PASS']);
  assert.deepStrictEqual(levels(c.checkBinModes({ bin: 'cli.js' }, '')), ['FAIL'], 'untracked');
  assert.deepStrictEqual(levels([c.checkShebang('cli.js', 'console.log(1)')]), ['FAIL']);
});

test('package metadata: private fails, few keywords and missing links warn', () => {
  const r = c.checkPackage({ name: 'a', version: '1.0.0', description: 'd', license: 'MIT', private: true, keywords: ['x'] });
  assert.ok(r.some((x) => x[0] === 'FAIL' && /private/.test(x[1])));
  assert.ok(r.some((x) => x[0] === 'WARN' && /keywords/.test(x[1])));
  assert.ok(r.some((x) => x[0] === 'WARN' && /homepage/.test(x[1])));
});

test('tags: absent passes with the command, lightweight warns, a tag on another commit fails', () => {
  assert.match(c.checkTag('1.2.0', '', '', 'aaa')[0][1], /git tag -a v1\.2\.0/);
  assert.deepStrictEqual(levels(c.checkTag('1.2.0', 'commit', 'aaa', 'aaa')), ['WARN', 'PASS']);
  assert.deepStrictEqual(levels(c.checkTag('1.2.0', 'tag', 'bbbbbbb', 'aaa')), ['FAIL']);
});

test('branch: main behind origin fails (a bump merged into a stacked base never reached main)', () => {
  assert.deepStrictEqual(levels(c.checkBranch('main', 'aaa', 'bbb', false)), ['FAIL']);
  assert.deepStrictEqual(levels(c.checkBranch('main', 'aaa', 'aaa', false)), ['PASS']);
  assert.deepStrictEqual(levels(c.checkBranch('release/1.2.0', 'aaa', 'bbb', true)), ['WARN', 'PASS']);
  assert.deepStrictEqual(levels(c.checkBranch('release/1.x', 'aaa', 'bbb', false, 'release/1.x')), ['FAIL']);
  assert.deepStrictEqual(levels(c.checkBranch('release/1.x', 'aaa', 'aaa', false, 'release/1.x')), ['PASS']);
});

test('npm pack: both JSON shapes, file count, internal files', () => {
  const files = [{ path: 'README.md' }, { path: 'lib/a.js' }];
  assert.deepStrictEqual(c.packFiles([{ files }]), ['README.md', 'lib/a.js']);
  assert.deepStrictEqual(c.packFiles({ 'my-tool': { files } }), ['README.md', 'lib/a.js']);
  assert.deepStrictEqual(levels(c.checkPack(['a', 'b'], 3)), ['FAIL']);
  assert.ok(c.checkPack(['lib/a.js', 'audit/out/run.json', 'test/x.js'], 0).some((r) => r[0] === 'WARN' && /internal/.test(r[1])));
});

test('cli: a throwaway package with a non-executable bin fails, and passes after chmod in git', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'my-tool', version: '1.0.0', description: 'd', license: 'MIT', keywords: ['a', 'b', 'c', 'd', 'e'], repository: 'o/r', homepage: 'https://example.com', files: ['cli.js'], bin: { 'my-tool': 'cli.js' } }));
  fs.writeFileSync(path.join(dir, 'README.md'), '# my-tool\n[![npm](https://img.shields.io/npm/v/my-tool)](https://www.npmjs.com/package/my-tool)\n');
  fs.writeFileSync(path.join(dir, 'cli.js'), '#!/usr/bin/env node\nconsole.log(1);\n');
  git('init', '-q', '-b', 'release/1.0.0');
  git('config', 'core.fileMode', 'true');
  fs.chmodSync(path.join(dir, 'cli.js'), 0o644);
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'x');
  const run = () => spawnSync(process.execPath, [SCRIPT, dir, '--offline'], { encoding: 'utf8' });
  const bad = run();
  assert.strictEqual(bad.status, 1, bad.stdout);
  assert.match(bad.stdout, /FAIL\s+bin cli\.js is 100644/);
  git('update-index', '--chmod=+x', 'cli.js');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'chmod');
  const good = run();
  assert.match(good.stdout, /PASS\s+bin cli\.js is 100755/);
  assert.strictEqual(good.status, 0, good.stdout);
  fs.rmSync(dir, { recursive: true, force: true });
});
