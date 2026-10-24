#!/usr/bin/env node
// Kickoff check for a project's PLAN.md and CLAUDE.md, before the plan PR.
//   node kickoff-check.js [project dir] [--user-rules <file>]
// PLAN.md: health check section first with a green / yellow / red verdict, a stage table with an estimate per stage,
// a total, a cheaper path, a decisions section. Both files: no template slots left, no personal rules copied from
// the user-level CLAUDE.md (default ~/.claude/CLAUDE.md), no device ids, tokens, e-mail addresses or local paths.
// Prints one line per check; exit 1 when a FAIL is found. Read-only. Node, no dependencies.

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HTML_TAG = /^\/?(a|b|i|br|hr|img|em|strong|code|kbd|sub|sup|details|summary|p|div|span|table|thead|tbody|tr|td|th|ul|ol|li|pre|picture|source|video)(\s[^>]*)?\/?$/i;
const STOP = new Set('a an and are as at be by do does for from has have in into is it its of on or that the then this to with without when where which who will not no every each all any only than its your you our'.split(' '));

// ---------------------------------------------------------------- pure checks (tested)

// Code fences, inline code and HTML comments are not prose.
const stripCode = (text) => text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '').replace(/<!--[\s\S]*?-->/g, '');

// `<slot>` placeholders left from a template. HTML tags and <https://…> autolinks are not slots.
function findSlots(text) {
  const out = [];
  for (const m of stripCode(text).matchAll(/<([^\s<>][^<>\n]*)>/g)) {
    if (HTML_TAG.test(m[1]) || /^(https?:|mailto:)/.test(m[1])) continue;
    out.push(m[0]);
  }
  return out;
}

// Markdown tables as arrays of rows of trimmed cells; the separator row is dropped.
function tables(text) {
  const out = [];
  let cur = null;
  for (const line of text.split('\n')) {
    if (/^\s*\|/.test(line)) {
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
      (cur = cur || []).push(cells);
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function sections(text) {
  const out = [];
  for (const block of text.split(/^(?=## )/m)) {
    const m = /^## (.*)/.exec(block);
    if (m) out.push({ title: m[1].trim(), body: block });
  }
  return out;
}

function checkPlan(text) {
  if (text === null) return [['FAIL', 'no PLAN.md: the plan comes before code (kickoff step 5)']];
  const out = [];
  const secs = sections(text);
  const health = secs.findIndex((s) => /health/i.test(s.title));
  if (health < 0) out.push(['FAIL', 'no health check section: verdict on every key technology first (kickoff rule 1)']);
  else {
    out.push(health === 0 ? ['PASS', 'health check is the first section'] : ['WARN', `health check is section ${health + 1}; put the verdict first`]);
    // The verdict is a table cell; prose like "on yellow or red: alternatives" and template slots do not count.
    const body = tables(secs[health].body).flatMap((t) => t.slice(1)).flat().join(' | ').replace(/<[^<>\n]*>/g, '');
    if (!/\b(green|yellow|red)\b/i.test(body)) out.push(['FAIL', 'health check has no green / yellow / red verdict in its table']);
    else out.push(/\d+\s*(\+\s*)?(years?|yrs?)\b/i.test(body) ? ['PASS', 'health check verdict with a horizon'] : ['WARN', 'health check verdict has no horizon in years']);
  }

  const stageTables = tables(text).filter((t) => {
    const h = t[0] || [];
    return h.some((c) => /^(#|stages?|steps?)$/i.test(c)) && h.some((c) => /estimate|wall|window|time|%/i.test(c));
  });
  if (!stageTables.length) out.push(['FAIL', 'no stage table with an estimate column (wall time and share of the window per stage)']);
  else {
    const missing = [];
    let total = false;
    for (const t of stageTables) {
      const est = t[0].map((c, i) => (/estimate|wall|window|time|%/i.test(c) ? i : -1)).filter((i) => i >= 0);
      for (const row of t.slice(1)) {
        if (row.some((c) => /^\**total\**$/i.test(c))) total = true;
        if (!row.some(Boolean)) continue;
        if (!est.some((i) => /\d/.test(row[i] || ''))) missing.push(row[0] || row[1]);
      }
    }
    out.push(missing.length ? ['WARN', `stages without an estimate: ${missing.join(', ')}`] : ['PASS', 'every stage has an estimate']);
    out.push(total ? ['PASS', 'stage table has a total'] : ['WARN', 'no "Total" row: give the whole plan in hours and share of the window']);
  }
  // Plans written as "## Phase 3 — …" sections need an estimate in each of them too.
  const unestimated = secs.filter((s) => /^(phase|stage|step)\s*\d/i.test(s.title) && !/≈\s*\d|~\s*\d|\d+\s*(min|h)\b|\d+\s*%/.test(s.body));
  if (unestimated.length) out.push(['WARN', `sections without an estimate: ${unestimated.map((s) => s.title.split(/\s+[—–-]\s+/)[0]).join(', ')}`]);
  out.push(/cheap/i.test(text) ? ['PASS', 'cheaper path given'] : ['WARN', 'no cheaper path: say which stages can be dropped and what is lost']);
  out.push(secs.some((s) => /decision/i.test(s.title)) ? ['PASS', 'decisions section'] : ['WARN', 'no "Decisions" section: choices agreed in chat go there with a date']);
  return out;
}

const words = (s) => new Set((s.toLowerCase().match(/[a-z][a-z-]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w)));

// Jaccard similarity of the significant words of two lines.
function similarity(a, b) {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return both / (x.size + y.size - both);
}

const ruleLines = (text) => stripCode(text).split('\n')
  .map((l) => l.replace(/^\s*([-*]|\d+\.)\s+/, '').replace(/[*_`]/g, '').trim())
  .filter((l) => words(l).size >= 5 && !/^#/.test(l));

// Lines of the project CLAUDE.md that repeat a line of the user-level CLAUDE.md.
function copiedRules(projectText, userText, threshold = 0.45) {
  if (!userText) return [];
  const user = ruleLines(userText);
  const out = [];
  for (const line of ruleLines(projectText)) {
    const best = Math.max(0, ...user.map((u) => similarity(line, u)));
    if (best >= threshold) out.push(line.length > 90 ? line.slice(0, 87) + '…' : line);
  }
  return out;
}

const PRIVATE = [
  ['device UDID', /\b[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\b|\b[0-9A-F]{8}-[0-9A-F]{16}\b/i],
  ['signing team id', /\bteam(\s*id)?\b[^\n]{0,20}\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10}\b/i],
  ['token', /\b(ghp_|gho_|github_pat_|npm_|sk-ant-|sk-|xox[abp]-|AKIA)[A-Za-z0-9_-]{12,}/],
  ['e-mail address', /\b[\w.+-]+@(?!users\.noreply\.github\.com)[\w-]+\.[a-z]{2,}\b/i],
  ['local path', /(^|[\s(`'"])(\/Users\/|\/home\/)[^\s/]+\/|[A-Z]:\\Users\\/],
];

function findPrivate(text) {
  return PRIVATE.filter(([, re]) => re.test(text)).map(([what]) => what);
}

function checkCommon(file, text) {
  const out = [];
  const slots = findSlots(text);
  out.push(slots.length
    ? ['FAIL', `${file}: ${slots.length} template slot(s) left: ${[...new Set(slots)].slice(0, 5).join(' ')}`]
    : ['PASS', `${file}: no template slots left`]);
  const priv = findPrivate(text);
  out.push(priv.length
    ? ['FAIL', `${file}: looks like private data (${priv.join(', ')}); keep it in a git-ignored local file`]
    : ['PASS', `${file}: no device ids, tokens, e-mail addresses or local paths`]);
  return out;
}

function checkClaude(text, userText) {
  if (text === null) return [['WARN', 'no project CLAUDE.md: project parameters and project-only rules go there (kickoff step 6)']];
  const copied = copiedRules(text, userText);
  return [copied.length
    ? ['WARN', `CLAUDE.md repeats ${copied.length} personal rule(s) from the user-level CLAUDE.md; link or drop them: ${copied.map((c) => `"${c}"`).join('; ')}`]
    : ['PASS', 'CLAUDE.md does not repeat personal rules']];
}

// ---------------------------------------------------------------- CLI

const read = (file) => {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
};

function main(argv) {
  let dir = '.';
  let userRules = path.join(os.homedir(), '.claude', 'CLAUDE.md');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--user-rules') userRules = argv[++i];
    else if (argv[i].startsWith('--')) throw new Error(`unknown argument ${argv[i]}`);
    else dir = argv[i];
  }
  const plan = read(path.join(dir, 'PLAN.md'));
  const claude = read(path.join(dir, 'CLAUDE.md')) ?? read(path.join(dir, '.claude', 'CLAUDE.md'));
  const results = [
    ...checkPlan(plan),
    ...(plan === null ? [] : checkCommon('PLAN.md', plan)),
    ...checkClaude(claude, read(userRules)),
    ...(claude === null ? [] : checkCommon('CLAUDE.md', claude)),
  ];
  for (const [level, msg] of results) process.stdout.write(`${level.padEnd(4)} ${msg}\n`);
  const fails = results.filter((r) => r[0] === 'FAIL').length;
  const warns = results.filter((r) => r[0] === 'WARN').length;
  process.stdout.write(`\n${fails} FAIL, ${warns} WARN\n`);
  return fails ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`kickoff-check: ${e.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { findSlots, tables, checkPlan, checkClaude, copiedRules, similarity, findPrivate, checkCommon };
