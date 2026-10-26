// Run from the repository root: node --test
// skills/kickoff/scripts/kickoff-check.js: PLAN.md and CLAUDE.md checks, the shipped templates, and one CLI run.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SKILL = path.join(__dirname, '..', 'skills', 'kickoff');
const SCRIPT = path.join(SKILL, 'scripts', 'kickoff-check.js');
const c = require(SCRIPT);
const level = (results, re) => (results.find((r) => re.test(r[1])) || [null])[0];

const GOOD_PLAN = `# Plan — my-tool

## 0. Health check

| Component | Latest release | Deprecation notices | Vendor direction | Verdict |
| --- | --- | --- | --- | --- |
| Driver | 8.7.0, 2026-09 | none found | — | green, 3+ years |

## Definition of Done

| Goal | How it is measured | Now | Target | Ceiling |
| --- | --- | --- | --- | --- |
| Correct conversions | harness, real corpus | 72 | 95 | 96 |

## Out of scope

- Android: another project.

## Stages

| # | Stage | Output | Wall time | Window | Status |
| --- | --- | --- | --- | --- | --- |
| 0 | Scaffold | CI green | ≈20 min | ≈5 % | done |
| 1 | Oracle | cases | ≈60 min | ≈15 % | planned |
| | Total | | ≈1.5 h | ≈20 % | |

Cheaper path: stage 1 on ten cases only.

## Decisions

| Date | Decision | Why | By |
| --- | --- | --- | --- |
| 2026-10-20 | Node, no deps | reuse | user |
`;

test('a filled plan passes every check', () => {
  const r = c.checkPlan(GOOD_PLAN);
  assert.deepStrictEqual(r.filter((x) => x[0] !== 'PASS'), []);
  assert.deepStrictEqual(c.checkCommon('PLAN.md', GOOD_PLAN).map((x) => x[0]), ['PASS', 'PASS']);
});

test('no plan, no health check, or a verdict only in prose fail', () => {
  assert.strictEqual(c.checkPlan(null)[0][0], 'FAIL');
  assert.strictEqual(level(c.checkPlan(GOOD_PLAN.replace('## 0. Health check', '## 0. Tools')), /health check section/), 'FAIL');
  const prose = GOOD_PLAN.replace('green, 3+ years', 'fine').replace('## Stages', 'On yellow or red: alternatives.\n\n## Stages');
  assert.strictEqual(level(c.checkPlan(prose), /verdict/), 'FAIL');
  const noHorizon = GOOD_PLAN.replace('green, 3+ years', 'green');
  assert.strictEqual(level(c.checkPlan(noHorizon), /horizon/), 'WARN');
  const late = GOOD_PLAN.replace('## 0. Health check', '## Why\n\nBecause.\n\n## 0. Health check');
  assert.strictEqual(level(c.checkPlan(late), /health check is section 2/), 'WARN');
});

test('stages without estimates, no total, no cheaper path, no decisions warn; a plan with no stage table fails', () => {
  const noEst = GOOD_PLAN.replace('≈60 min | ≈15 %', '— | —').replace('| | Total | | ≈1.5 h | ≈20 % | |\n', '').replace('Cheaper path: stage 1 on ten cases only.', '').replace('## Decisions', '## Notes');
  const r = c.checkPlan(noEst);
  assert.match(r.find((x) => /without an estimate/.test(x[1]))[1], /: 1$/);
  assert.strictEqual(level(r, /Total/), 'WARN');
  assert.strictEqual(level(r, /cheaper path/), 'WARN');
  assert.strictEqual(level(r, /Decisions/), 'WARN');
  const noTable = GOOD_PLAN.replace(/## Stages[\s\S]*?Cheaper/, '## Stages\n\nWe will see.\n\nCheaper');
  assert.strictEqual(level(c.checkPlan(noTable), /stage table/), 'FAIL');
});

test('a plan without a Definition of Done or an out-of-scope section warns', () => {
  const r = c.checkPlan(GOOD_PLAN.replace('## Definition of Done', '## Goals').replace('## Out of scope', '## Notes'));
  assert.strictEqual(level(r, /Definition of Done/), 'WARN');
  assert.strictEqual(level(r, /Out of scope/), 'WARN');
  assert.strictEqual(level(c.checkPlan(GOOD_PLAN), /Definition of Done section/), 'PASS');
  assert.strictEqual(level(c.checkPlan(GOOD_PLAN), /out-of-scope section/), 'PASS');
});

test('"## Phase N" sections without an estimate warn', () => {
  const phases = `${GOOD_PLAN}\n## Phase 4 — LLM grid\n\nRun every model at every effort.\n\n## Phase 5 — fixes\n\nAbout ≈40 min, ≈8 %.\n`;
  assert.match(c.checkPlan(phases).find((x) => /sections without/.test(x[1]))[1], /Phase 4$/);
});

test('template slots are found; HTML tags, autolinks, code and comments are not slots', () => {
  assert.deepStrictEqual(c.findSlots('Started <date>. Uses <plugin:skill>.'), ['<date>', '<plugin:skill>']);
  assert.deepStrictEqual(c.findSlots('a<br>b <https://x.y> `<code>` <!-- note -->\n```\n<in fence>\n```\nx < y > z'), []);
});

test('the shipped templates have slots, a health check first, a total and a decisions section', () => {
  const plan = fs.readFileSync(path.join(SKILL, 'templates', 'PLAN.md'), 'utf8');
  const claude = fs.readFileSync(path.join(SKILL, 'templates', 'CLAUDE.md'), 'utf8');
  assert.ok(c.findSlots(plan).length > 20);
  assert.ok(c.findSlots(claude).length > 3);
  const r = c.checkPlan(plan);
  assert.strictEqual(level(r, /health check is the first section/), 'PASS');
  assert.strictEqual(level(r, /verdict/), 'FAIL', 'an unfilled verdict slot is not a verdict');
  assert.strictEqual(level(r, /has a total/), 'PASS');
  assert.strictEqual(level(r, /decisions section/), 'PASS');
  assert.strictEqual(level(r, /Definition of Done section/), 'PASS');
  assert.strictEqual(level(r, /out-of-scope section/), 'PASS');
  for (const title of ['Architecture before code', 'Budgets', 'Stage-end criterion', 'Maintenance mode']) {
    assert.ok(plan.includes(`## ${title}`), `template section "${title}"`);
  }
});

test('personal rules copied into the project CLAUDE.md are flagged', () => {
  const user = '## Changes\n- A new branch and a PR for every change, never a commit on main.\n- Before a heavy task or step, give an estimate and wait for yes.\n';
  const project = '# Rules\n\n- A new branch and a PR for every change; never commit on main.\n- README.md is the npm page: keep it short, details go to docs.\n';
  const copied = c.copiedRules(project, user);
  assert.strictEqual(copied.length, 1);
  assert.match(copied[0], /new branch/);
  assert.strictEqual(c.checkClaude(project, user)[0][0], 'WARN');
  assert.strictEqual(c.checkClaude('- README.md is the npm page: keep it short, details go to docs.\n', user)[0][0], 'PASS');
  assert.strictEqual(c.checkClaude(null, user)[0][0], 'WARN');
});

test('private data: UDIDs, team ids, tokens, e-mail addresses, local paths; the GitHub noreply address is fine', () => {
  assert.deepStrictEqual(c.findPrivate('sim 12345678-ABCD-4EF0-9ABC-1234567890AB'), ['device UDID']);
  assert.deepStrictEqual(c.findPrivate('phone 00000000-0123456789ABCDEF'), ['device UDID']);
  assert.deepStrictEqual(c.findPrivate('Team ID: AB12CD34EF'), ['signing team id']);
  assert.deepStrictEqual(c.findPrivate('token ghp_abcdefghijklmnop1234'), ['token']);
  assert.deepStrictEqual(c.findPrivate('mail me@example.com'), ['e-mail address']);
  assert.deepStrictEqual(c.findPrivate('see /Users/someone/projects/x'), ['local path']);
  assert.deepStrictEqual(c.findPrivate('git config user.email 123+me@users.noreply.github.com; ~/.claude/CLAUDE.md; signing team in a local file'), []);
});

test('CLI: exit 1 on a FAIL, 0 on a filled plan', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kick-'));
  const user = path.join(dir, 'user-claude.md');
  fs.writeFileSync(user, '- Before a heavy task or step, give an estimate and wait for yes.\n');
  const run = () => spawnSync(process.execPath, [SCRIPT, dir, '--user-rules', user], { encoding: 'utf8' });
  let r = run();
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /FAIL no PLAN\.md/);
  fs.writeFileSync(path.join(dir, 'PLAN.md'), GOOD_PLAN);
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Project rules\n\n- README.md is the npm page: keep it short, details go to docs.\n');
  r = run();
  assert.strictEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /0 FAIL, 0 WARN/);
});
