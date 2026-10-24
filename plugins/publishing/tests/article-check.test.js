// Run from the repository root: node --test
// Checks of skills/devto-article/scripts/article-check.js on small articles built in the test.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'skills', 'devto-article', 'scripts', 'article-check.js');
const a = require(SCRIPT);
const has = (results, level, re) => results.some((r) => r[0] === level && re.test(r[1]));

const FM = '---\ntitle: "A title"\npublished: false\ndescription: "One line."\ntags: android, appium, testing, ai\ncover_image: https://example.com/cover.png\n---\n';

test('front matter: missing keys, too many tags, bad tags, no cover', () => {
  assert.ok(has(a.checkFrontMatter(null), 'FAIL', /no front matter/));
  assert.deepStrictEqual(a.checkFrontMatter(a.frontMatter(FM + 'x')), []);
  const r = a.checkFrontMatter(a.frontMatter('---\ntitle: t\ndescription: d\ntags: a, b, c, d, e-x\n---\n'));
  assert.ok(has(r, 'FAIL', /5 tags/));
  assert.ok(has(r, 'FAIL', /tag "e-x"/));
  assert.ok(has(r, 'WARN', /no cover_image/));
  assert.ok(!has(a.checkFrontMatter(a.frontMatter('---\ntitle: t\ndescription: d\ntags: a\n# cover_image: upload img/cover.png\n---\n')), 'WARN', /cover/), 'a cover note counts');
});

test('images: SVG fails, relative paths warn, absolute PNG passes', () => {
  const r = a.checkImages('![chart](img/chart.svg)\n![c](img/c.png)\n![ok](https://example.com/c.png)\n<img src="x.svg">');
  assert.ok(has(r, 'FAIL', /line 1: img\/chart\.svg is SVG/));
  assert.ok(has(r, 'WARN', /line 2: img\/c\.png is a relative path/));
  assert.ok(has(r, 'FAIL', /line 4: x\.svg is SVG/));
  assert.ok(!r.some((x) => /line 3/.test(x[1])));
});

test('tables: wide rows, <br>, split units, prose in many columns; code blocks are skipped', () => {
  const wide = '| Opus 5.5 with the rules prompt | Edge-case score 86.0 of 93.6 | Real-world score 95.0 of 96.0 | Wrong answers: none | 12 |';
  const t = [
    '| Model | Score | Time |', '| --- | --- | --- |',
    '| Opus | 78.3 % | 12.2 |', '| Sonnet | 75.7&nbsp;% | < 0.1 |',
    '| Haiku<br>5.5 | 1 | 2 |', wide,
    `| \`//A[contains(@text,"x")]\` | textContains("x") | ${'it ignores case, so it also matches X and other strings that look the same'} |`,
    '```', '| inside | code | 1 % |', '```',
  ].join('\n');
  const r = a.checkTables(t);
  assert.ok(has(r, 'WARN', /line 3: a number and its unit/));
  assert.ok(has(r, 'WARN', /line 4: a number and its unit/), '< 0.1 splits');
  assert.ok(!r.some((x) => /line 2/.test(x[1])), 'separator row');
  assert.ok(has(r, 'WARN', /line 5: <br>/));
  assert.ok(has(r, 'WARN', /line 6: table row \d+ characters wide/));
  assert.ok(has(r, 'WARN', /line 7: long text in a 3-column table/));
  assert.ok(!r.some((x) => /line 9/.test(x[1])), 'code block');
  assert.deepStrictEqual(a.checkTables('| A | B |\n| - | - |\n| 1&nbsp;% | <&nbsp;0.1 |'), []);
});

test('placeholders, local paths and npx github: are caught', () => {
  const r = a.checkLeftovers('Author: <LinkedIn URL>\nRun /Users/me/x.js\nopen http://localhost:3000\nnpx github:o/r ./tests\nTODO numbers');
  assert.ok(has(r, 'FAIL', /line 1: a placeholder/));
  assert.ok(has(r, 'FAIL', /line 2: a local path/));
  assert.ok(has(r, 'FAIL', /line 3: a local link/));
  assert.ok(has(r, 'WARN', /line 4: `npx github/));
  assert.ok(has(r, 'FAIL', /line 5: a placeholder/));
});

test('flags the published README does not mention fail; all present pass', () => {
  const article = 'Run `npx my-tool ./tests --write`, or `--loose` for wider forms. An em dash -- is not a flag.';
  assert.deepStrictEqual(a.flagsIn(article), ['--write', '--loose']);
  assert.ok(has(a.checkFlags(article, 'Usage: my-tool <dir> [--write] [--exact]', 'my-tool'), 'FAIL', /--loose/));
  assert.ok(has(a.checkFlags(article, '--write --loose', 'my-tool'), 'PASS', /every flag/));
  assert.ok(has(a.checkFlags(article, null, 'my-tool'), 'WARN', /not read/));
});

test('structure: TL;DR, Contents and Limits are looked for', () => {
  assert.strictEqual(a.checkStructure('## TL;DR\n\n## Contents\n\n## Limits\n').length, 0);
  assert.strictEqual(a.checkStructure('## Intro\n').length, 3);
});

test('cli: exit 1 on a FAIL, 0 on a clean article', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'article-check-'));
  const bad = path.join(dir, 'bad.md');
  const good = path.join(dir, 'good.md');
  fs.writeFileSync(bad, FM + '## TL;DR\n![x](img/x.svg)\n');
  fs.writeFileSync(good, FM + '## TL;DR\n\n## Contents\n\n1. Limits\n\n## Limits\n\n![x](https://example.com/x.png)\n');
  const r1 = spawnSync(process.execPath, [SCRIPT, bad], { encoding: 'utf8' });
  assert.strictEqual(r1.status, 1, r1.stdout);
  const r2 = spawnSync(process.execPath, [SCRIPT, good], { encoding: 'utf8' });
  assert.strictEqual(r2.status, 0, r2.stdout);
  assert.strictEqual(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});
