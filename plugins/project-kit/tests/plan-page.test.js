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
    { id: 's0', title: 'Scaffold', status: 'done', pr: '#1', started: '2026-10-01', finished: '2026-10-03', estimate: { minutes: 30, window_pct: 5 }, actual: { minutes: 20, window_pct: 3 } },
    {
      id: 's1', title: 'Oracle', status: 'now', importance: 'medium', prompt: 'Read PLAN.md first.\nThen start.', estimate: { minutes: 60, window_pct: 12 },
      children: [{ id: 's1a', title: 'Cases', status: 'done', estimate: { minutes: 20, window_pct: 4 } }, { id: 's1b', title: 'Runner', status: 'next', prompt: 'Build it.' }],
    },
    { id: 's2', title: 'Report', status: 'postponed', importance: 'low' },
    { id: 's3', title: 'Publish', status: 'blocked', blocked_by: 's1', importance: 'high' },
    { id: 's4', title: 'Docs', status: 'done', finished: '2026-10-09' },
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
  assert.match(errors, /updated: expected a real date/);
  assert.match(errors, /dod: expected a non-empty list/);
  assert.match(errors, /stages\[1\]\.status/);
  assert.match(errors, /stages\[2\]\.id: "s0" is used twice/);
  assert.match(errors, /children\[0\]\.children: sub-stages have one level only/);
});

test('importance, dates and blockers are checked; updated must be a real date', () => {
  const bad = copy();
  bad.updated = '2026-13-45';
  bad.stages[0].importance = 'urgent';
  bad.stages[0].started = '2026-10-05';
  bad.stages[0].finished = '2026-10-03';
  bad.stages[1].started = '2026-02-30';
  delete bad.stages[3].blocked_by;
  bad.stages[2].blocked_by = 's1';
  const errors = p.validatePlan(bad).join('\n');
  assert.match(errors, /updated: expected a real date/);
  assert.match(errors, /stages\[0\]\.importance: expected one of high, medium, low/);
  assert.match(errors, /stages\[0\]\.finished: is before started/);
  assert.match(errors, /stages\[1\]\.started: expected a real date/);
  assert.match(errors, /stages\[3\]\.blocked_by: a blocked stage says what blocks it/);
  assert.match(errors, /stages\[2\]\.blocked_by: only a blocked stage has it/);
  const self = copy();
  self.stages[3].blocked_by = 's3';
  assert.match(p.validatePlan(self).join('\n'), /a stage cannot block itself/);
  const text = copy();
  text.stages[3].blocked_by = 'waiting for a reply from the maintainers';
  assert.deepStrictEqual(p.validatePlan(text), [], 'a blocker may be free text');
});

test('ageLabel: a longer unit appears only once it is reached', () => {
  const l = p.ageLabel;
  assert.deepStrictEqual([0, 1, 2, 6, 7, 13, 14, 29, 30, 59, 60, 364, 365, 800].map(l),
    ['today', 'yesterday', '2 days ago', '6 days ago', '1 week ago', '1 week ago', '2 weeks ago', '4 weeks ago', '1 month ago', '1 month ago', '2 months ago', '12 months ago', '1 year ago', '2 years ago']);
  assert.strictEqual(l(-3), 'in the future');
});

test('the order of stages: now, next, blocked, postponed, then done with the newest first and a rank', () => {
  const o = p.orderStages(PLAN.stages);
  assert.deepStrictEqual(o.map((x) => x.stage.id), ['s1', 's3', 's2', 's4', 's0']);
  assert.deepStrictEqual(o.map((x) => x.rank), [null, null, null, 0, 1]);
  const undated = p.orderStages([{ id: 'a', status: 'done' }, { id: 'b', status: 'done' }, { id: 'c', status: 'next' }]);
  assert.deepStrictEqual(undated.map((x) => x.stage.id), ['c', 'b', 'a'], 'without dates the later stage in the file is the newer one');
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
  assert.match(errors, /1 template slot\(s\) left \(put code in backticks\): <project name>/);
  const code = copy();
  code.stages[1].prompt = 'Read the `Map<string, number>` type.';
  assert.deepStrictEqual(p.validatePlan(code), []);
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
  assert.strictEqual(p.progress({ start: 0, current: 3, target: 0 }), 0, 'a goal that starts at its target and slips is not done');
  assert.strictEqual(p.reached({ start: 0, current: 3, target: 0 }), false);
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
  const { rows, dropped, found } = p.parseIssues(ISSUES);
  assert.strictEqual(found, true);
  assert.strictEqual(dropped.length, 1, 'the "Other" row is reported, not lost');
  assert.deepStrictEqual(rows.map((r) => r.priority), ['P1', 'P2', 'P3']);
  assert.strictEqual(rows[2].item, 'A cosmetic `thing` with a | pipe');
  assert.strictEqual(rows[0].seen, 'yes: 3');
  assert.strictEqual(rows[0].when, 'now');
  const titled = p.parseIssues('| Priority | Title | Details | Fix when |\n|---|---|---|---|\n| P2 | Short name | Long description. Two sentences. | later |\n').rows[0];
  assert.deepStrictEqual([titled.title, titled.item], ['Short name', 'Long description. Two sentences.']);
  assert.strictEqual(p.issueTitle({ title: '', item: 'First sentence. Second sentence.' }), 'First sentence.');
  assert.strictEqual(p.issueTitle({ title: '', item: 'x'.repeat(120) }).length, 88);
  assert.deepStrictEqual(p.parseIssues(null), { rows: [], dropped: [], found: false });
  const bold = p.parseIssues('| **Priority** | Item |\n|---|---|\n| **P1** | x |\n');
  assert.deepStrictEqual([bold.found, bold.rows.length], [true, 1], 'a bold header still counts');
  assert.strictEqual(p.parseIssues('| Name | Value |\n|---|---|\n| P1 | x |\n').found, false);
});

test('the page: escaped text, P1 marked, stage prompt kept whole, no leftovers', () => {
  const issues = p.parseIssues(ISSUES).rows;
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
  const odd = copy();
  odd.stages[0].pr = "#85's follow-up";
  odd.project = 'x {{BODY}} y';
  const oddHtml = p.render(odd, []);
  assert.match(oddHtml, /pull\/85">#85<\/a>&#39;s follow-up/);
  assert.match(oddHtml, /<title>x \{\{BODY\}\} y plan<\/title>/, 'placeholders are filled in one pass');
  assert.match(html, /planned 90 min · 17 % of a window \(2 of 5 stages\)/);
  assert.match(html, /Target reached: stop adding scope/);
  assert.match(html, /75 % of the way to the target/);
  assert.ok(!html.includes('{{'), 'no template marker left');
  assert.match(html, /<title>a&lt;script&gt;/);
  assert.match(html, /--font-mono/, 'the design system is inlined');
});

test('a bug shows its title; the description opens on click; P1 is open; a row without a body is plain', () => {
  const html = p.render(PLAN, p.parseIssues('| Priority | Title | Details | Seen in the corpus | Fix when |\n|---|---|---|---|---|\n| P1 | Wrong chain | Long text. | yes | now |\n| P3 | Only a title | Only a title | | |\n').rows);
  assert.match(html, /<details class="issue p1" open><summary><span class="chip chip-p1">P1<\/span><span class="ititle">Wrong chain<\/span><\/summary><div class="ibody"><p>Long text\.<\/p>/);
  assert.match(html, /<div class="issue p3"><div class="row-plain">/);
});

test('the stage list: statuses, importance on every row, blocker, info box under the row, filter data', () => {
  const html = p.render(PLAN, []);
  assert.match(html, /<span class="st st-postponed">Postponed<\/span>/);
  assert.match(html, /<span class="imp imp-low" title="Importance: low"/);
  assert.match(html, /<span class="imp imp-high"[^>]*><span class="bars"><i><\/i><i><\/i><i><\/i><\/span>high<\/span>/);
  assert.match(html, /Blocked by: Oracle/, 'a stage id becomes the stage title');
  assert.match(html, /<li data-status="done" data-id="s4" data-rank="0" data-finished="2026-10-09">/);
  assert.match(html, /<option value="from:s0">From: Scaffold<\/option>/);
  assert.match(html, /<button class="act from" type="button" data-id="s4"/);
  assert.match(html, /<div class="toolbar" hidden>/, 'filters stay hidden until the script runs');
  assert.match(html, /data-age-of="2026-10-25"/);
  assert.match(html, /var ageLabel = function ageLabel\(days\)/, 'the age function is copied into the page');
  // A stage with a body: a clickable row, then the info box, then the body; open without the script.
  assert.match(html, /<div class="row clickable" role="button" tabindex="0" aria-expanded="true" data-open="1">[\s\S]*?<\/div><div class="info-box" id="info-s1" hidden>[\s\S]*?<\/div><div class="stage-body">/);
});

test('info: a stage that is not done shows its estimate, a done stage what it really took', () => {
  const html = p.render(PLAN, []);
  assert.match(html, /<b>Dates<\/b> 2026-10-01 → 2026-10-03 \(3 days\)/);
  assert.match(html, /<b>Actual<\/b> 20 min · 3 % of a 5-hour window/);
  assert.ok(!html.includes('<b>Estimate</b> 30 min'), 'the estimate of a done stage with an actual is replaced');
  assert.match(html, /<b>Estimate<\/b> 60 min · 12 % of a 5-hour window/);
  const onlyEstimate = copy();
  delete onlyEstimate.stages[0].actual;
  assert.match(p.render(onlyEstimate, []), /<b>Estimate<\/b> 30 min · 5 % of a 5-hour window \(actual not recorded\)/);
  const running = copy();
  running.stages[1].actual = { minutes: 15 };
  assert.match(p.render(running, []), /<b>Spent so far<\/b> 15 min/);
});

test('status chips: All on, the others off and drawn only for statuses that exist', () => {
  const html = p.render(PLAN, []);
  assert.match(html, /<button class="chip-f" type="button" aria-pressed="true" data-key="all">All <span class="n">5<\/span><\/button>/);
  assert.match(html, /aria-pressed="false" data-key="blocked"><span class="dot dot-blocked"><\/span>Blocked <span class="n">1<\/span>/);
  assert.ok(!html.includes('data-key="next"'), 'no next stage, no chip');
  assert.ok(!/class="hidden-note"[^>]*><[^>]*button/.test(html), 'the caption has no "Show all" button');
});

test('bug chips show counts and are drawn only for priorities that exist', () => {
  const rows = p.parseIssues('| Priority | Title | Details |\n|---|---|---|\n| P2 | A | a |\n| P3 | B | b |\n| P3 | C | c |\n').rows;
  const html = p.render(PLAN, rows);
  assert.match(html, /data-key="all">All <span class="n">3<\/span>/);
  assert.match(html, /data-key="P3"><span class="dot dot-p3"><\/span>P3 <span class="n">2<\/span>/);
  assert.ok(!html.includes('data-key="P1"'), 'no P1 bugs, no P1 chip');
  assert.match(html, /<li data-priority="P2">/);
  const one = p.render(PLAN, p.parseIssues('| Priority | Title | Details |\n|---|---|---|\n| P3 | B | b |\n').rows);
  assert.ok(!one.includes('aria-label="Filter by priority"'), 'one priority needs no filter');
});

test('where we are and next take a line or a list of points', () => {
  const list = copy();
  list.here.stage = ['One', 'Two `code`'];
  assert.deepStrictEqual(p.validatePlan(list), []);
  const html = p.render(list, []);
  assert.match(html, /<ul class="points"><li>One<\/li><li>Two <code>code<\/code><\/li><\/ul>/);
  assert.match(html, /<span>Review the PR<\/span>/);
  list.here.next = [];
  assert.match(p.validatePlan(list).join('\n'), /here: expected \{ stage, next \}/);
});

test('no issues file means "No known issues"', () => {
  const html = p.render(PLAN, []);
  assert.match(html, /No known issues\./);
  assert.ok(!html.includes('No P1'), 'an empty backlog is not an assurance');
});

test('CLI: writes the page; exits 1 with the problems listed; 2 without a plan', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-page-'));
  const out = path.join(dir, 'page.html');
  const run = (...extra) => spawnSync(process.execPath, [SCRIPT, dir, '--out', out, ...extra], { encoding: 'utf8' });
  assert.strictEqual(run().status, 2);
  fs.mkdirSync(path.join(dir, 'docs'));
  fs.writeFileSync(path.join(dir, 'docs', 'plan.json'), JSON.stringify({ ...PLAN, dod: [] }));
  let r = run();
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /dod: expected a non-empty list/);
  fs.writeFileSync(path.join(dir, 'docs', 'plan.json'), JSON.stringify(PLAN));
  fs.writeFileSync(path.join(dir, 'docs', 'known-issues.md'), ISSUES.replace('| Other | not a priority | | |\n', ''));
  r = run();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /5 stages, 2 goals, 3 known issues \(1 P1\)/);
  assert.match(fs.readFileSync(out, 'utf8'), /class="issue p1"/);
});

test('CLI: a backlog the page cannot read is an error, not "no issues"; --out needs a value', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-page-'));
  fs.mkdirSync(path.join(dir, 'docs'));
  fs.writeFileSync(path.join(dir, 'docs', 'plan.json'), JSON.stringify(PLAN));
  const out = path.join(dir, 'page.html');
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, dir, ...args], { encoding: 'utf8' });
  fs.writeFileSync(path.join(dir, 'docs', 'known-issues.md'), 'No table here.\n');
  let r = run('--out', out);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /no table with a "Priority" column/);
  fs.writeFileSync(path.join(dir, 'docs', 'known-issues.md'), '| Priority | Item |\n|---|---|\n| P0 | bad |\n| P1 | real |\n');
  r = run('--out', out);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /1 row\(s\) without a priority/);
  assert.ok(!fs.existsSync(out), 'nothing is written when the backlog is unreadable');
  r = run('--out');
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /--out needs a value/);
});
