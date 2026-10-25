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
const STATUSES = ['done', 'now', 'next', 'postponed', 'blocked'];
const STATUS_LABEL = { done: 'Done', now: 'Now', next: 'Next', postponed: 'Postponed', blocked: 'Blocked' };
// The order of the stage list: what is happening first, finished work last (newest first).
const STATUS_ORDER = ['now', 'next', 'blocked', 'postponed', 'done'];
const IMPORTANCE = ['high', 'medium', 'low'];
const PRIORITIES = ['P1', 'P2', 'P3'];

// ---------------------------------------------------------------- validation (tested)

const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
// A real calendar day written YYYY-MM-DD.
const isDay = (v) => {
  if (!isStr(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

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
  if (s.importance !== undefined && !IMPORTANCE.includes(s.importance)) errors.push(`${where}.importance: expected one of ${IMPORTANCE.join(', ')}`);
  for (const key of ['started', 'finished']) if (s[key] !== undefined && !isDay(s[key])) errors.push(`${where}.${key}: expected a real date YYYY-MM-DD`);
  if (isDay(s.started) && isDay(s.finished) && s.finished < s.started) errors.push(`${where}.finished: is before started`);
  if (s.status === 'blocked') {
    if (!isStr(s.blocked_by)) errors.push(`${where}.blocked_by: a blocked stage says what blocks it (a stage id, or a few words)`);
    else if (s.blocked_by === s.id) errors.push(`${where}.blocked_by: a stage cannot block itself`);
  } else if (s.blocked_by !== undefined) errors.push(`${where}.blocked_by: only a blocked stage has it`);
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
  if (!isDay(plan.updated)) errors.push('updated: expected a real date YYYY-MM-DD');
  const points = (v) => isStr(v) || (Array.isArray(v) && v.length > 0 && v.every(isStr));
  if (plan.here === null || typeof plan.here !== 'object' || !points(plan.here.stage) || !points(plan.here.next)) errors.push('here: expected { stage, next }, each a line or a list of short points');

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
      if (idx(/^priority$/i) >= 0) { cols = { p: idx(/^priority$/i), title: idx(/^title$/i), item: idx(/^(item|details?|description)$/i), seen: idx(/corpus|seen/i), when: idx(/fix when|when/i) }; result.found = true; }
      continue;
    }
    const p = plain(cells[cols.p] || '').replace(/\s/g, '').toUpperCase();
    if (!PRIORITIES.includes(p)) { if (cells.some(Boolean)) result.dropped.push(line.trim().slice(0, 60)); continue; }
    result.rows.push({ priority: p, title: cols.title >= 0 ? cells[cols.title] || '' : '', item: cols.item >= 0 ? cells[cols.item] || '' : '', seen: cols.seen >= 0 ? cells[cols.seen] || '' : '', when: cols.when >= 0 ? cells[cols.when] || '' : '' });
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

// "3 days ago": today, yesterday, days up to a week, then weeks, months, years; a longer unit appears only once reached.
// The page runs this function in the browser (its source is copied in), so the age stays right while the page is open.
function ageLabel(days) {
  var n = function (v, unit) { return v + ' ' + unit + (v === 1 ? '' : 's') + ' ago'; };
  if (days < 0) return 'in the future';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return n(days, 'day');
  if (days < 30) return n(Math.floor(days / 7), 'week');
  if (days < 365) return n(Math.floor(days / 30), 'month');
  return n(Math.floor(days / 365), 'year');
}

// Calendar days from started to finished, both included.
const spanDays = (from, to) => Math.round((Date.UTC(...to.split('-').map((v, i) => (i === 1 ? v - 1 : +v))) - Date.UTC(...from.split('-').map((v, i) => (i === 1 ? v - 1 : +v)))) / 86400000) + 1;
const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;

// The lines behind the info button. A stage that is not done shows its estimate; a done stage shows what it really
// took (and says so when only the estimate was recorded).
function infoLines(s) {
  const lines = [];
  if (s.started && s.finished) lines.push(`<span><b>Dates</b> ${esc(s.started)} → ${esc(s.finished)} (${plural(spanDays(s.started, s.finished), 'day')})</span>`);
  else if (s.finished) lines.push(`<span><b>Finished</b> ${esc(s.finished)}</span>`);
  else if (s.started) lines.push(`<span><b>Started</b> ${esc(s.started)}</span>`);
  const act = own(s, 'actual');
  const est = own(s, 'estimate');
  const has = (a) => a && (a.minutes || a.window_pct);
  const text = (a) => [a.minutes ? fmtMin(a.minutes) : '', a.window_pct ? `${fmt(a.window_pct)} % of a 5-hour window` : ''].filter(Boolean).join(' · ');
  if (s.status === 'done') {
    if (has(act)) lines.push(`<span><b>Actual</b> ${text(act)}</span>`);
    else if (has(est)) lines.push(`<span><b>Estimate</b> ${text(est)} (actual not recorded)</span>`);
  } else {
    if (has(est)) lines.push(`<span><b>Estimate</b> ${text(est)}</span>`);
    if (has(act)) lines.push(`<span><b>Spent so far</b> ${text(act)}</span>`);
  }
  return lines;
}

function blockerText(plan, by) {
  const hit = [...plan.stages, ...plan.stages.flatMap((x) => x.children || [])].find((x) => x.id === by);
  return hit ? hit.title : by;
}

const importanceMark = (level) => `<span class="imp imp-${level}" title="Importance: ${level}" aria-label="Importance: ${level}"><span class="bars"><i></i><i></i><i></i></span>${level}</span>`;

// One row: status, title with importance and PR, the blocker, the buttons; the info box sits right under it.
function rowParts(plan, s, extraActions) {
  const lines = infoLines(s);
  const infoId = `info-${s.id}`.replace(/[^\w-]/g, '_');
  const imp = s.importance ? importanceMark(s.importance) : '';
  const blocked = s.status === 'blocked' ? `<span class="blocked-by">Blocked by: ${esc(blockerText(plan, s.blocked_by))}</span>` : '';
  const buttons = (lines.length ? `<button class="act info" type="button" aria-label="Dates, time and estimate" aria-expanded="false" aria-controls="${esc(infoId)}">i</button>` : '') + (extraActions || '');
  const head = `${statusMark(s.status)}<span class="title"><span class="line"><span>${esc(s.title)}</span>${imp}${prLink(plan, s.pr)}</span>${blocked}</span>${buttons ? `<span class="actions">${buttons}</span>` : '<span></span>'}`;
  const box = lines.length ? `<div class="info-box" id="${esc(infoId)}" hidden>${lines.join('')}</div>` : '';
  return { head, box };
}

function renderChild(plan, c) {
  const { head, box } = rowParts(plan, c);
  const extra = [c.note ? `<p class="note">${inline(c.note)}</p>` : '', promptBlock(c.prompt)].filter(Boolean).join('');
  return `<li><div class="row">${head}</div>${box}${extra ? `<div class="row-extra">${extra}</div>` : ''}</li>`;
}

// Stages in the order of the page: now, next, blocked, postponed, then done with the newest first. Each done stage
// gets a rank (0 = newest) that the filters use. Without dates a later stage in the file counts as newer.
function orderStages(stages) {
  const indexed = stages.map((s, i) => ({ s, i }));
  const done = indexed.filter((x) => x.s.status === 'done').sort((a, b) => (b.s.finished || '').localeCompare(a.s.finished || '') || b.i - a.i);
  const rank = new Map(done.map((x, r) => [x.s, r]));
  const rest = indexed.filter((x) => x.s.status !== 'done').sort((a, b) => STATUS_ORDER.indexOf(a.s.status) - STATUS_ORDER.indexOf(b.s.status) || a.i - b.i);
  return [...rest, ...done].map((x) => ({ stage: x.s, rank: rank.has(x.s) ? rank.get(x.s) : null }));
}

// A stage with a body opens and closes on a click of its row (the page script collapses it; without the script it is
// open), and the info box stays right under the row in both states.
function renderStage(plan, s, rank) {
  const kids = s.children && s.children.length ? `<ul class="children">${s.children.map((c) => renderChild(plan, c)).join('')}</ul>` : '';
  const body = [s.note ? `<p class="note">${inline(s.note)}</p>` : '', kids, promptBlock(s.prompt)].filter(Boolean).join('');
  const from = s.status === 'done' ? `<button class="act from" type="button" data-id="${esc(s.id)}" title="Hide the done stages older than this one">From here</button>` : '';
  const { head, box } = rowParts(plan, s, from);
  const attrs = `data-status="${s.status}" data-id="${esc(s.id)}"${rank !== null ? ` data-rank="${rank}"` : ''}${s.finished ? ` data-finished="${esc(s.finished)}"` : ''}`;
  const now = s.status === 'now' ? ' is-now' : '';
  const open = s.status === 'now' || s.status === 'next';
  const row = body ? `<div class="row clickable" role="button" tabindex="0" aria-expanded="true" data-open="${open ? 1 : 0}">${head}</div>` : `<div class="row">${head}</div>`;
  return `<li ${attrs}><div class="stage${now}">${row}${box}${body ? `<div class="stage-body">${body}</div>` : ''}</div></li>`;
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

// The title of a bug: its own column, else the first sentence of the description.
function issueTitle(x) {
  if (x.title) return x.title;
  const first = x.item.split(/(?<=[.!?])\s/)[0];
  return first.length > 90 ? `${first.slice(0, 87).trimEnd()}…` : first;
}

function renderIssue(x) {
  const title = issueTitle(x);
  const meta = [x.seen ? `<span><b>In the corpus:</b> ${inline(x.seen)}</span>` : '', x.when ? `<span><b>Fix when:</b> ${inline(x.when)}</span>` : ''].filter(Boolean).join('');
  const body = [x.item && x.item !== title ? `<p>${inline(x.item)}</p>` : '', meta ? `<div class="meta">${meta}</div>` : ''].filter(Boolean).join('');
  const p = x.priority.toLowerCase();
  const head = `<span class="chip chip-${p}">${x.priority}</span><span class="ititle">${inline(title)}</span>`;
  if (!body) return `<li data-priority="${x.priority}"><div class="issue ${p}"><div class="row-plain">${head}</div></div></li>`;
  return `<li data-priority="${x.priority}"><details class="issue ${p}"${x.priority === 'P1' ? ' open' : ''}><summary>${head}</summary><div class="ibody">${body}</div></details></li>`;
}

// "All" is on at first; the other chips are off. Choosing one turns All off and several may be on; choosing All turns
// the others off. The chips of a group that is not there (no P1 bugs, no blocked stages) are not drawn.
function filterChips(label, total, entries) {
  const all = `<button class="chip-f" type="button" aria-pressed="true" data-key="all">All <span class="n">${total}</span></button>`;
  const rest = entries.map(([key, text, count, mark]) => `<button class="chip-f" type="button" aria-pressed="false" data-key="${esc(key)}"><span class="dot ${mark}"></span>${esc(text)} <span class="n">${count}</span></button>`).join('');
  return `<div class="chips" role="group" aria-label="${esc(label)}">${all}${rest}</div>`;
}

function renderStages(plan) {
  const ordered = orderStages(plan.stages);
  const count = (st) => plan.stages.filter((s) => s.status === st).length;
  const present = STATUS_ORDER.filter((st) => count(st));
  const done = ordered.filter((o) => o.rank !== null);
  const options = '<optgroup label="By date"><option value="last:3" selected>Last 3 stages</option><option value="days:7">Last 7 days</option><option value="days:30">Last 30 days</option><option value="days:90">Last 90 days</option><option value="all">All</option></optgroup>'
    + (done.length ? `<optgroup label="From stage">${done.map((o) => `<option value="from:${esc(o.stage.id)}">From: ${esc(o.stage.title)}</option>`).join('')}</optgroup>` : '');
  // The toolbar stays hidden until the page script runs: without it every stage is visible.
  const chips = present.length > 1 ? filterChips('Filter by status', plan.stages.length, present.map((st) => [st, STATUS_LABEL[st], count(st), `dot-${st}`])) : '';
  const since = done.length ? `<label class="done-since">Done since <select>${options}</select></label>` : '';
  const toolbar = chips || since ? `<div class="toolbar" hidden>${chips}${since}</div>` : '';
  const note = done.length ? '<p class="hidden-note" hidden></p>' : '';
  return `${toolbar}<ul class="stages">${ordered.map((o) => renderStage(plan, o.stage, o.rank)).join('')}</ul>${note}`;
}

function renderIssues(issues) {
  if (!issues.length) return '<p class="empty">No known issues.</p>';
  const present = PRIORITIES.filter((pr) => issues.some((x) => x.priority === pr));
  const chips = present.length > 1 ? `<div class="toolbar" hidden>${filterChips('Filter by priority', issues.length, present.map((pr) => [pr, pr, issues.filter((x) => x.priority === pr).length, `dot-${pr.toLowerCase()}`]))}</div>` : '';
  return `${chips}<ul class="issues">${issues.map(renderIssue).join('')}</ul>`;
}

// A line, or a list of short points.
const points = (v) => (Array.isArray(v) ? `<ul class="points">${v.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>` : `<span>${inline(v)}</span>`);

function renderBody(plan, issues) {
  const t = totals(plan.stages);
  const sum = (a) => [a.minutes ? fmtMin(a.minutes) : '', a.window_pct ? `${fmt(a.window_pct)} % of a window` : ''].filter(Boolean).join(' · ');
  const n = plan.stages.length;
  const totalLine = [t.estimate.n ? `planned ${sum(t.estimate)} (${t.estimate.n} of ${n} stages)` : '', t.actual.n ? `spent ${sum(t.actual)} (${t.actual.n} of ${n})` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ');
  const parts = [
    `<header class="top"><div class="top-line"><h1>${esc(plan.project)}</h1><span class="updated">Updated ${esc(plan.updated)} <span class="age" data-age-of="${esc(plan.updated)}"></span></span></div>`
    + `<div class="where"><div class="here"><span class="k">Where we are</span><div class="v">${points(plan.here.stage)}</div></div>`
    + `<div class="next"><span class="k">Next</span><div class="v">${points(plan.here.next)}</div></div></div></header>`,
    `<section class="panel panel-dod"><h2>Definition of Done</h2><div class="dod">${plan.dod.map(renderGoal).join('')}</div></section>`,
    `<section class="panel panel-stages"><h2><span>Stages</span>${totalLine ? `<span class="sum">${totalLine}</span>` : ''}</h2>${renderStages(plan)}</section>`,
    `<section class="panel panel-bugs"><h2>Found bugs</h2>${renderIssues(issues)}</section>`,
  ];
  if (plan.undecided && plan.undecided.length) {
    parts.push(`<section class="panel panel-undecided"><h2>New and undecided</h2><ul class="undecided">${plan.undecided.map((u) => `<li><span>${inline(u.text)}</span>${u.recommended ? `<span class="rec"><b>Recommended:</b> ${inline(u.recommended)}</span>` : ''}</li>`).join('')}</ul></section>`);
  }
  parts.push('<p class="foot">Built from docs/plan.json and docs/known-issues.md by project-kit plan-page.js</p>');
  return parts.join('\n');
}

function render(plan, issues) {
  const tpl = fs.readFileSync(path.join(TEMPLATES, 'plan-page.html'), 'utf8');
  const css = fs.readFileSync(path.join(TEMPLATES, 'plan-design.css'), 'utf8');
  // One pass with function replacers: "$&" and placeholder-like text in the data are not replacement patterns.
  const parts = { TITLE: esc(`${plan.project} plan`), CSS: css.trim(), BODY: renderBody(plan, issues), AGE_FN: ageLabel.toString() };
  return tpl.replace(/\{\{(TITLE|CSS|BODY|AGE_FN)\}\}/g, (m, key) => parts[key]);
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

module.exports = { validatePlan, parseIssues, progress, reached, totals, ageLabel, orderStages, issueTitle, esc, render, renderBody };
