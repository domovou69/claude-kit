#!/usr/bin/env node
// Plan page generator: docs/plan.json + docs/known-issues.md -> one HTML file for the Artifact tool.
//   node plan-page.js [project dir] [--plan <file>] [--issues <file>] [--out <file>]   (default out: the temp folder)
// The plan file is validated first (all problems are listed, exit 1). The issues table is read as it is; a missing
// issues file means "no known issues". The page is rendered here, not in the browser: every text is escaped, the
// look comes from templates/plan-design.css, so every project's page is built the same way. Read-only except --out.
// Node, no dependencies.

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TEMPLATES = path.join(__dirname, '..', 'templates');
const STATUSES = ['done', 'now', 'next', 'parked'];
const STATUS_LABEL = { done: 'Done', now: 'Now', next: 'Next', parked: 'Parked' };
const PRIORITIES = ['P1', 'P2', 'P3'];

// ---------------------------------------------------------------- validation (tested)

const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function checkAmount(errors, where, v) {
  if (v === undefined) return;
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return errors.push(`${where}: expected { minutes, window_pct }`);
  for (const key of Object.keys(v)) {
    if (key !== 'minutes' && key !== 'window_pct') errors.push(`${where}.${key}: unknown field`);
    else if (!isNum(v[key]) || v[key] < 0) errors.push(`${where}.${key}: expected a number >= 0`);
  }
}

function checkStage(errors, where, s, ids, nested) {
  if (s === null || typeof s !== 'object' || Array.isArray(s)) return errors.push(`${where}: expected an object`);
  if (!isStr(s.id)) errors.push(`${where}.id: expected a non-empty string`);
  else if (ids.has(s.id)) errors.push(`${where}.id: "${s.id}" is used twice`);
  else ids.add(s.id);
  if (!isStr(s.title)) errors.push(`${where}.title: expected a non-empty string`);
  if (!STATUSES.includes(s.status)) errors.push(`${where}.status: expected one of ${STATUSES.join(', ')}`);
  for (const key of ['pr', 'note', 'prompt']) if (s[key] !== undefined && !isStr(s[key])) errors.push(`${where}.${key}: expected a non-empty string`);
  if (!nested && (s.status === 'now' || s.status === 'next') && !isStr(s.prompt)) errors.push(`${where}.prompt: a ${s.status} stage needs its prompt for the next window`);
  checkAmount(errors, `${where}.estimate`, s.estimate);
  checkAmount(errors, `${where}.actual`, s.actual);
  if (s.children !== undefined) {
    if (nested) errors.push(`${where}.children: sub-stages have one level only`);
    else if (!Array.isArray(s.children)) errors.push(`${where}.children: expected a list`);
    else s.children.forEach((c, i) => checkStage(errors, `${where}.children[${i}]`, c, ids, true));
  }
}

function validatePlan(plan) {
  const errors = [];
  if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) return ['plan: expected an object'];
  if (plan.schema !== 1) errors.push('schema: expected 1');
  if (!isStr(plan.project)) errors.push('project: expected a non-empty string');
  if (plan.repo !== undefined && !(isStr(plan.repo) && /^[\w.-]+\/[\w.-]+$/.test(plan.repo))) errors.push('repo: expected "owner/name"');
  if (!(isStr(plan.updated) && /^\d{4}-\d{2}-\d{2}$/.test(plan.updated))) errors.push('updated: expected YYYY-MM-DD');
  if (plan.here === null || typeof plan.here !== 'object' || !isStr(plan.here.stage) || !isStr(plan.here.next)) errors.push('here: expected { stage, next } with one line each');

  if (!Array.isArray(plan.dod) || !plan.dod.length) errors.push('dod: expected a non-empty list (no Definition of Done, no stop criterion)');
  else {
    const seen = new Set();
    plan.dod.forEach((g, i) => {
      const w = `dod[${i}]`;
      if (g === null || typeof g !== 'object') return errors.push(`${w}: expected an object`);
      if (!isStr(g.id)) errors.push(`${w}.id: expected a non-empty string`);
      else if (seen.has(g.id)) errors.push(`${w}.id: "${g.id}" is used twice`);
      else seen.add(g.id);
      if (!isStr(g.goal)) errors.push(`${w}.goal: expected a non-empty string`);
      for (const key of ['start', 'current', 'target']) if (!isNum(g[key])) errors.push(`${w}.${key}: expected a number`);
      if (g.ceiling !== undefined && !isNum(g.ceiling)) errors.push(`${w}.ceiling: expected a number`);
      for (const key of ['unit', 'note']) if (g[key] !== undefined && typeof g[key] !== 'string') errors.push(`${w}.${key}: expected a string`);
    });
  }

  if (!Array.isArray(plan.stages) || !plan.stages.length) errors.push('stages: expected a non-empty list');
  else {
    const ids = new Set();
    plan.stages.forEach((s, i) => checkStage(errors, `stages[${i}]`, s, ids, false));
    const now = plan.stages.filter((s) => s && s.status === 'now').length;
    if (now > 1) errors.push(`stages: ${now} top-level stages are "now"; there is one place we are`);
  }

  if (plan.undecided !== undefined) {
    if (!Array.isArray(plan.undecided)) errors.push('undecided: expected a list');
    else plan.undecided.forEach((u, i) => {
      if (u === null || typeof u !== 'object' || !isStr(u.text)) errors.push(`undecided[${i}].text: expected a non-empty string`);
      else if (u.recommended !== undefined && !isStr(u.recommended)) errors.push(`undecided[${i}].recommended: expected a non-empty string`);
    });
  }
  const slots = [];
  (function walk(v) {
    // Code in backticks (`Map<string, number>`) is not a slot.
    if (typeof v === 'string') for (const m of v.replace(/`[^`\n]*`/g, '').matchAll(/<[^\s<>][^<>\n]*>/g)) slots.push(m[0]);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(plan);
  if (slots.length) errors.push(`${slots.length} template slot(s) left (put code in backticks): ${[...new Set(slots)].slice(0, 5).join(' ')}`);
  return errors;
}

// ---------------------------------------------------------------- known-issues.md (tested)

// The table whose header has a "Priority" column. Cells split on an unescaped "|". Returns the rows (P1 first),
// the rows whose priority is not P1, P2 or P3 (dropped, to be reported) and whether the table was found at all.
function parseIssues(text) {
  const result = { rows: [], dropped: [], found: false };
  if (text === null || text === undefined) return result;
  const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
  const plain = (c) => c.replace(/[*_`]/g, '').trim();
  let cols = null;
  for (const line of text.split('\n')) {
    if (!/^\s*\|/.test(line)) { cols = null; continue; }
    const cells = splitRow(line);
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    if (!cols) {
      const idx = (re) => cells.findIndex((c) => re.test(plain(c)));
      if (idx(/^priority$/i) >= 0) { cols = { p: idx(/^priority$/i), item: idx(/^item$/i), seen: idx(/corpus|seen/i), when: idx(/fix when|when/i) }; result.found = true; }
      continue;
    }
    const p = plain(cells[cols.p] || '').replace(/\s/g, '').toUpperCase();
    if (!PRIORITIES.includes(p)) { if (cells.some(Boolean)) result.dropped.push(line.trim().slice(0, 60)); continue; }
    result.rows.push({ priority: p, item: cells[cols.item] || '', seen: cols.seen >= 0 ? cells[cols.seen] || '' : '', when: cols.when >= 0 ? cells[cols.when] || '' : '' });
  }
  result.rows = result.rows.map((x, i) => [x, i]).sort((a, b) => PRIORITIES.indexOf(a[0].priority) - PRIORITIES.indexOf(b[0].priority) || a[1] - b[1]).map((x) => x[0]);
  return result;
}

// ---------------------------------------------------------------- rendering (tested)

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// Escaped text with `code` spans kept.
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

// 0..1 along start -> target; works for goals that go down (a count of wrong results) as well as up.
function progress(g) {
  if (g.start === g.target) return g.current === g.target ? 1 : 0;
  return Math.min(1, Math.max(0, (g.current - g.start) / (g.target - g.start)));
}

function reached(g) {
  if (g.start === g.target) return g.current === g.target;
  return (g.current - g.target) * Math.sign(g.target - g.start) >= 0;
}

const fmt = (n) => String(Math.round(n * 100) / 100);
const fmtMin = (m) => (m >= 120 ? `${fmt(m / 60)} h` : `${fmt(m)} min`);
function amount(label, a) {
  if (!a) return '';
  const parts = [];
  if (a.minutes !== undefined) parts.push(fmtMin(a.minutes));
  if (a.window_pct !== undefined) parts.push(`${fmt(a.window_pct)} %`);
  return parts.length ? `<span>${label} ${parts.join(' · ')}</span>` : '';
}

// A stage without its own estimate stands for the sum of its sub-stages.
function own(stage, key) {
  if (stage[key]) return stage[key];
  const kids = (stage.children || []).map((c) => c[key]).filter(Boolean);
  if (!kids.length) return null;
  const sum = (f) => kids.reduce((n, k) => n + (k[f] || 0), 0);
  return { minutes: sum('minutes'), window_pct: sum('window_pct') };
}

function totals(stages) {
  const out = {};
  for (const key of ['estimate', 'actual']) {
    const all = stages.map((s) => own(s, key)).filter(Boolean);
    out[key] = { minutes: all.reduce((n, a) => n + (a.minutes || 0), 0), window_pct: all.reduce((n, a) => n + (a.window_pct || 0), 0), n: all.length };
  }
  return out;
}

const prLink = (plan, pr) => {
  if (!pr) return '';
  // "#85" and "#15–#31" both link every number; the text between is escaped on its own.
  const parts = pr.split(/(#\d+)/).map((t) => {
    const m = /^#(\d+)$/.exec(t);
    return m && plan.repo ? `<a href="https://github.com/${esc(plan.repo)}/pull/${m[1]}">${t}</a>` : esc(t);
  });
  return `<span class="pr">${parts.join('')}</span>`;
};

const statusMark = (status) => `<span class="st st-${status}">${STATUS_LABEL[status]}</span>`;

function promptBlock(prompt) {
  if (!prompt) return '';
  return `<div class="prompt-wrap"><button class="copy" type="button">Copy stage prompt</button><details><summary class="k">Prompt text</summary><pre class="prompt">${esc(prompt)}</pre></details></div>`;
}

function renderChild(plan, c) {
  const extra = [c.note ? `<p class="note">${inline(c.note)}</p>` : '', promptBlock(c.prompt)].filter(Boolean).join('');
  return `<li><div class="row">${statusMark(c.status)}<span class="title">${esc(c.title)}${prLink(plan, c.pr)}</span><span class="nums">${amount('est', c.estimate)}${amount('actual', c.actual)}</span></div>${extra ? `<div class="row-extra">${extra}</div>` : ''}</li>`;
}

function renderStage(plan, s) {
  const est = own(s, 'estimate');
  const act = own(s, 'actual');
  const kids = s.children && s.children.length ? `<ul class="children">${s.children.map((c) => renderChild(plan, c)).join('')}</ul>` : '';
  const body = [s.note ? `<p class="note">${inline(s.note)}</p>` : '', kids, promptBlock(s.prompt)].filter(Boolean).join('');
  const head = `${statusMark(s.status)}<span class="title">${esc(s.title)}${prLink(plan, s.pr)}</span><span class="nums">${amount('est', est)}${amount('actual', act)}</span>`;
  const open = s.status === 'now' || s.status === 'next' ? ' open' : '';
  if (!body) return `<li><div class="stage${s.status === 'now' ? ' is-now' : ''}"><div class="row">${head}</div></div></li>`;
  return `<li><details class="stage${s.status === 'now' ? ' is-now' : ''}"${open}><summary>${head}</summary><div class="stage-body">${body}</div></details></li>`;
}

function renderGoal(g) {
  const done = reached(g);
  const unit = g.unit ? esc(g.unit) : '';
  const range = [`start ${fmt(g.start)}`, `target ${fmt(g.target)}`, g.ceiling !== undefined ? `ceiling ${fmt(g.ceiling)}` : ''].filter(Boolean).join('</span><span>');
  return `<div class="goal${done ? ' reached' : ''}"><div class="name">${esc(g.goal)}</div><div class="num">${fmt(g.current)}<small>${unit}</small></div>`
    + `<div class="bar" role="img" aria-label="${esc(g.goal)}: ${Math.round(progress(g) * 100)} % of the way to the target"><i style="width:${Math.round(progress(g) * 100)}%"></i></div>`
    + `<div class="range"><span>${range}</span></div>`
    + `<div class="verdict">${done ? 'Target reached: stop adding scope' : `${Math.round(progress(g) * 100)} % of the way to the target`}</div>${g.note ? `<div class="note">${inline(g.note)}</div>` : ''}</div>`;
}

function renderIssue(x) {
  const meta = [x.seen ? `<span><b>In the corpus:</b> ${inline(x.seen)}</span>` : '', x.when ? `<span><b>Fix when:</b> ${inline(x.when)}</span>` : ''].filter(Boolean).join('');
  return `<li class="issue ${x.priority.toLowerCase()}"><span class="chip chip-${x.priority.toLowerCase()}">${x.priority}</span><span>${inline(x.item)}</span>${meta ? `<div class="meta">${meta}</div>` : ''}</li>`;
}

function renderBody(plan, issues) {
  const t = totals(plan.stages);
  const sum = (a) => [a.minutes ? fmtMin(a.minutes) : '', a.window_pct ? `${fmt(a.window_pct)} % of a window` : ''].filter(Boolean).join(' · ');
  const n = plan.stages.length;
  const totalLine = [t.estimate.n ? `planned ${sum(t.estimate)} (${t.estimate.n} of ${n} stages)` : '', t.actual.n ? `spent ${sum(t.actual)} (${t.actual.n} of ${n})` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ');
  const counts = PRIORITIES.map((p) => `${p} ${issues.filter((x) => x.priority === p).length}`).join(' · ');
  const hasP1 = issues.some((x) => x.priority === 'P1');
  const parts = [
    `<header class="top"><div class="top-line"><h1>${esc(plan.project)}</h1><span class="updated">updated ${esc(plan.updated)}</span></div>`
    + `<p class="here"><span class="k">Where we are</span><span class="v">${inline(plan.here.stage)}</span></p>`
    + `<p class="next"><span class="k">Next</span><span class="v">${inline(plan.here.next)}</span></p></header>`,
    `<section><h2>Definition of Done</h2><div class="dod">${plan.dod.map(renderGoal).join('')}</div></section>`,
    `<section><h2><span>Stages</span>${totalLine ? `<span class="sum">${totalLine}</span>` : ''}</h2><ul class="stages">${plan.stages.map((s) => renderStage(plan, s)).join('')}</ul></section>`,
    `<section><h2><span>Found bugs</span><span class="sum counts">${counts}</span></h2>`
    + (issues.length ? `<ul class="issues">${issues.map(renderIssue).join('')}</ul>` : '<p class="empty">No known issues.</p>')
    + (issues.length && !hasP1 ? '<p class="empty">No P1 in the list.</p>' : '') + '</section>',
  ];
  if (plan.undecided && plan.undecided.length) {
    parts.push(`<section><h2>New and undecided</h2><ul class="undecided">${plan.undecided.map((u) => `<li><span>${inline(u.text)}</span>${u.recommended ? `<span class="rec"><b>Recommended:</b> ${inline(u.recommended)}</span>` : ''}</li>`).join('')}</ul></section>`);
  }
  parts.push('<p class="foot">Built from docs/plan.json and docs/known-issues.md by project-kit plan-page.js</p>');
  return parts.join('\n');
}

function render(plan, issues) {
  const tpl = fs.readFileSync(path.join(TEMPLATES, 'plan-page.html'), 'utf8');
  const css = fs.readFileSync(path.join(TEMPLATES, 'plan-design.css'), 'utf8');
  // Function replacers: "$&" and friends in the data are not replacement patterns.
  const parts = { TITLE: esc(`${plan.project} plan`), CSS: css.trim(), BODY: renderBody(plan, issues) };
  return tpl.replace(/\{\{(TITLE|CSS|BODY)\}\}/g, (m, key) => parts[key]);
}

// ---------------------------------------------------------------- CLI

const read = (file) => {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
};

function main(argv) {
  let dir = '.';
  let planFile = null;
  let issuesFile = null;
  let out = null;
  const value = (i) => {
    if (i >= argv.length || argv[i].startsWith('--')) throw new Error(`${argv[i - 1]} needs a value`);
    return argv[i];
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--plan') planFile = value(++i);
    else if (argv[i] === '--issues') issuesFile = value(++i);
    else if (argv[i] === '--out') out = value(++i);
    else if (argv[i].startsWith('--')) throw new Error(`unknown argument ${argv[i]}`);
    else dir = argv[i];
  }
  planFile = planFile || path.join(dir, 'docs', 'plan.json');
  issuesFile = issuesFile || path.join(dir, 'docs', 'known-issues.md');
  const raw = read(planFile);
  if (raw === null) throw new Error(`cannot read ${planFile}`);
  let plan;
  try { plan = JSON.parse(raw); } catch (e) { throw new Error(`${planFile} is not JSON: ${e.message}`); }
  const errors = validatePlan(plan);
  if (errors.length) {
    process.stderr.write(`${planFile}: ${errors.length} problem(s)\n${errors.map((e) => `  ${e}`).join('\n')}\n`);
    return 1;
  }
  // A backlog the page cannot read must not look like an empty one.
  const issuesText = read(issuesFile);
  const parsed = parseIssues(issuesText);
  if (issuesText !== null && !parsed.found) {
    process.stderr.write(`${issuesFile}: no table with a "Priority" column; the page would show no issues\n`);
    return 1;
  }
  if (parsed.dropped.length) {
    process.stderr.write(`${issuesFile}: ${parsed.dropped.length} row(s) without a priority of P1, P2 or P3 left out of the page:\n${parsed.dropped.map((d) => `  ${d}`).join('\n')}\n`);
    return 1;
  }
  out = out || path.join(os.tmpdir(), `${path.basename(path.resolve(dir))}-plan-page.html`);
  fs.writeFileSync(out, render(plan, parsed.rows));
  const p1 = parsed.rows.filter((x) => x.priority === 'P1').length;
  process.stdout.write(`wrote ${out}: ${plan.stages.length} stages, ${plan.dod.length} goals, ${parsed.rows.length} known issues (${p1} P1)\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`plan-page: ${e.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { validatePlan, parseIssues, progress, reached, totals, esc, render, renderBody };
