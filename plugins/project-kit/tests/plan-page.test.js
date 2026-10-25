// Run from the repository root: node --test
// skills/kickoff/scripts/plan-page.js: plan.json validation, the known-issues table, the rendered page, one CLI run.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SKILL = path.join(__dirname, '..', 'skills', 'kickoff');
const SCRIPT = path.join(SKILL, 'scripts', 'plan-page.js');
const p = require(SCRIPT);

const PLAN = {
  schema: 1,
  project: 'demo',
  repo: 'me/demo',
  updated: '2026-10-25',
  here: { stage: 'Stage 1 is running', next: 'Review the PR' },
  dod: [
    { id: 'r', goal: 'Correct conversions', unit: '%', start: 72.2, current: 96, target: 96, ceiling: 96 },
    { id: 'wrong', goal: 'Wrong results', start: 8, current: 2, target: 0 },
  ],
  stages: [
    { id: 's0', title: 'Scaffold', status: 'done', pr: '#1', estimate: { minutes: 30, window_pct: 5 }, actual: { minutes: 20, window_pct: 3 } },
    {
      id: 's1', title: 'Oracle', status: 'now', prompt: 'Read PLAN.md first.\nThen start.', estimate: { minutes: 60, window_pct: 12 },
      children: [{ id: 's1a', title: 'Cases', status: 'done', estimate: { minutes: 20, window_pct: 4 } }, { id: 's1b', title: 'Runner', status: 'next', prompt: 'Build it.' }],
    },
    { id: 's2', title: 'Report', status: 'parked' },
  ],
  undecided: [{ text: 'Publish now?', recommended: 'Yes' }],
};
const copy = () => JSON.parse(JSON.stringify(PLAN));

test('a filled plan is valid', () => {
  assert.deepStrictEqual(p.validatePlan(PLAN), []);
});

test('problems are listed together, with where they are', () => {
  const bad = copy();
  bad.updated = 'today';
  bad.dod = [];
  bad.stages[1].status = 'doing';
  bad.stages[2].id = 's0';
  bad.stages[1].children[0].children = [];
  const errors = p.validatePlan(bad).join('\n');
  assert.match(errors, /updated: expected YYYY-MM-DD/);
  assert.match(errors, /dod: expected a non-empty list/);
  assert.match(errors, /stages\[1\]\.status/);
  assert.match(errors, /stages\[2\]\.id: "s0" is used twice/);
  assert.match(errors, /children\[0\]\.children: sub-stages have one level only/);
});

test('a now or next stage needs its prompt; two top-level "now" stages are refused', () => {
  const bad = copy();
  delete bad.stages[1].prompt;
  bad.stages[2].status = 'now';
  bad.stages[2].prompt = 'x';
  const errors = p.validatePlan(bad).join('\n');
  assert.match(errors, /stages\[1\]\.prompt: a now stage needs its prompt/);
  assert.match(errors, /2 top-level stages are "now"/);
  const noKid = copy();
  delete noKid.stages[1].children[1].prompt;
  assert.deepStrictEqual(p.validatePlan(noKid), [], 'a sub-stage runs in its stage\'s window');
});

test('numbers must be numbers; unknown amount fields are refused; template slots are found', () => {
  const bad = copy();
  bad.dod[0].current = '96';
  bad.stages[0].estimate = { minutes: -1, hours: 2 };
  bad.project = '<project name>';
  const errors = p.validatePlan(bad).join('\n');
  assert.match(errors, /dod\[0\]\.current: expected a number/);
  assert.match(errors, /estimate\.minutes: expected a number >= 0/);
  assert.match(errors, /estimate\.hours: unknown field/);
  assert.match(errors, /1 template slot\(s\) left: <project name>/);
});

test('the shipped plan.json template has slots and is otherwise valid', () => {
  const raw = fs.readFileSync(path.join(SKILL, 'templates', 'plan.json'), 'utf8');
  assert.match(p.validatePlan(JSON.parse(raw)).join('\n'), /template slot/);
  const filled = raw.replace('<owner>/<name>', 'me/demo').replace('<YYYY-MM-DD>', '2026-10-25').replace(/<[^\s<>][^<>\n]*>/g, 'filled');
  assert.deepStrictEqual(p.validatePlan(JSON.parse(filled)), []);
});

test('progress and "reached" work for goals that go up and goals that go down', () => {
  assert.strictEqual(p.progress({ start: 0, current: 50, target: 100 }), 0.5);
  assert.strictEqual(p.progress({ start: 8, current: 2, target: 0 }), 0.75);
  assert.strictEqual(p.progress({ start: 0, current: 120, target: 100 }), 1);
  assert.strictEqual(p.progress({ start: 10, current: 5, target: 100 }), 0);
  assert.strictEqual(p.reached({ start: 0, current: 100, target: 100 }), true);
  assert.strictEqual(p.reached({ start: 8, current: 0, target: 0 }), true);
  assert.strictEqual(p.reached({ start: 8, current: 2, target: 0 }), false);
  assert.strictEqual(p.reached({ start: 5, current: 5, target: 5 }), true);
});

test('totals: a stage without its own estimate stands for its sub-stages', () => {
  const t = p.totals(PLAN.stages);
  assert.deepStrictEqual([t.estimate.minutes, t.estimate.window_pct, t.estimate.n], [90, 17, 2]);
  assert.deepStrictEqual([t.actual.minutes, t.actual.window_pct, t.actual.n], [20, 3, 1]);
});

const ISSUES = `# Known issues

| Priority | Item | Seen in the corpus | Fix when |
|---|---|---|---|
| P3 | A cosmetic \`thing\` with a \\| pipe | no | never |
| **P1** | Wrong result on <b>input</b> | yes: 3 | now |
| P2 | A default | n/a | when touched |
| Other | not a priority | | |

| Name | Value |
|---|---|
| P1 | not an issues table |
`;

test('known issues: only the Priority table, P1 first, escaped pipes kept', () => {
  const rows = p.parseIssues(ISSUES);
  assert.deepStrictEqual(rows.map((r) => r.priority), ['P1', 'P2', 'P3']);
  assert.strictEqual(rows[2].item, 'A cosmetic `thing` with a | pipe');
  assert.strictEqual(rows[0].seen, 'yes: 3');
  assert.strictEqual(rows[0].when, 'now');
  assert.deepStrictEqual(p.parseIssues(null), []);
});

test('the page: escaped text, P1 marked, stage prompt kept whole, no leftovers', () => {
  const issues = p.parseIssues(ISSUES);
  const hostile = copy();
  hostile.project = 'a<script>alert(1)</script>';
  hostile.here.stage = '$& and "quotes"';
  const html = p.render(hostile, issues);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /a&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /\$&amp; and &quot;quotes&quot;/);
  assert.match(html, /Wrong result on &lt;b&gt;input&lt;\/b&gt;/);
  assert.match(html, /class="issue p1"/);
  assert.ok(html.indexOf('class="issue p1"') < html.indexOf('class="issue p2"'));
  assert.match(html, /<pre class="prompt">Read PLAN\.md first\.\nThen start\.<\/pre>/);
  assert.match(html, /href="https:\/\/github\.com\/me\/demo\/pull\/1">#1</);
  const range = copy();
  range.stages[0].pr = '#15–#31';
  assert.match(p.render(range, []), /pull\/15">#15<\/a>–<a href="https:\/\/github\.com\/me\/demo\/pull\/31">#31</);
  assert.match(html, /planned 90 min · 17 % of a window \(2 of 3 stages\)/);
  assert.match(html, /Target reached: stop adding scope/);
  assert.match(html, /75 % of the way to the target/);
  assert.ok(!html.includes('{{'), 'no template marker left');
  assert.match(html, /<title>a&lt;script&gt;/);
  assert.match(html, /--font-mono/, 'the design system is inlined');
});

test('no issues file means "No known issues"', () => {
  const html = p.render(PLAN, []);
  assert.match(html, /No known issues\./);
  assert.match(html, /No P1: nothing known gives a silently wrong result/);
});

test('CLI: writes the page; exits 1 with the problems listed; 2 without a plan', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-page-'));
  const out = path.join(dir, 'page.html');
  const run = () => spawnSync(process.execPath, [SCRIPT, dir, '--out', out], { encoding: 'utf8' });
  assert.strictEqual(run().status, 2);
  fs.mkdirSync(path.join(dir, 'docs'));
  fs.writeFileSync(path.join(dir, 'docs', 'plan.json'), JSON.stringify({ ...PLAN, dod: [] }));
  let r = run();
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /dod: expected a non-empty list/);
  fs.writeFileSync(path.join(dir, 'docs', 'plan.json'), JSON.stringify(PLAN));
  fs.writeFileSync(path.join(dir, 'docs', 'known-issues.md'), ISSUES);
  r = run();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /3 stages, 2 goals, 3 known issues \(1 P1\)/);
  assert.match(fs.readFileSync(out, 'utf8'), /class="issue p1"/);
});
