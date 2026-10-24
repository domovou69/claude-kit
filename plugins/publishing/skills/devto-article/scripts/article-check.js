#!/usr/bin/env node
// Checks a Markdown article before it is pasted into dev.to, and again after edits.
//   node article-check.js <article.md> [--package <npm name>] [--offline] [--max-table-width 100]
// Front matter (title, description, at most 4 tags, cover), images dev.to cannot show (SVG, relative paths),
// tables that wrap or cram on dev.to, placeholders and local paths, and — with --package — command-line flags that
// the published package's README does not mention yet (an article must not promise an unreleased flag).
// Prints one line per finding; exit 1 when a FAIL is found. Node, no dependencies.

'use strict';

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

// ---------------------------------------------------------------- pure checks (tested)

function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return null;
  const fm = { raw: m[1], body: text.slice(m[0].length) };
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return fm;
}

function checkFrontMatter(fm) {
  if (!fm) return [['FAIL', 'no front matter (--- title / published / description / tags / cover_image ---)']];
  const out = [];
  for (const k of ['title', 'description', 'tags']) if (!fm[k]) out.push(['FAIL', `front matter has no ${k}`]);
  const tags = (fm.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  if (tags.length > 4) out.push(['FAIL', `${tags.length} tags: dev.to takes at most 4`]);
  for (const t of tags) if (!/^[a-z0-9]+$/.test(t)) out.push(['FAIL', `tag "${t}": dev.to tags are lower-case letters and digits only`]);
  if (fm.published === 'true') out.push(['WARN', 'published: true — keep the repo copy at false; publish from the dev.to editor']);
  if (!fm.cover_image && !/cover_image/.test(fm.raw)) out.push(['WARN', 'no cover_image: the post shows no header image and a plain card in feeds (1000×420 PNG)']);
  return out;
}

const lineNo = (text, index) => text.slice(0, index).split('\n').length;

function checkImages(text) {
  const out = [];
  const re = /!\[[^\]]*\]\(([^)\s]+)[^)]*\)|<img[^>]+src=["']([^"']+)["']/g;
  for (let m; (m = re.exec(text));) {
    const src = m[1] || m[2];
    const at = `line ${lineNo(text, m.index)}`;
    if (/\.svg(\?|$)/i.test(src)) out.push(['FAIL', `${at}: ${src} is SVG; dev.to does not take SVG — render a 2× PNG`]);
    if (!/^https?:\/\//.test(src)) out.push(['WARN', `${at}: ${src} is a relative path; dev.to cannot resolve it — upload it in the editor or use its raw GitHub URL`]);
  }
  return out;
}

// Markdown tables: wide rows wrap on dev.to and phones; <br> in cells is cramped; "12 %" or "< 0.1" may break
// between the number and the unit; long prose in a 3+ column table reads better as a list.
function checkTables(text, { maxWidth = 100 } = {}) {
  const out = [];
  const lines = text.split('\n');
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*```/.test(l)) inCode = !inCode;
    if (inCode || !/^\s*\|.*\|\s*$/.test(l) || /^\s*\|[\s:|-]+\|\s*$/.test(l)) continue;
    const cells = l.trim().slice(1, -1).split('|').map((c) => c.trim());
    const shown = cells.join(' | ').replace(/&nbsp;/g, ' ').replace(/\*\*|`/g, '');
    const at = `line ${i + 1}`;
    if (shown.length > maxWidth) out.push(['WARN', `${at}: table row ${shown.length} characters wide; it wraps on dev.to — shorten headers and units, or split the table`]);
    if (/<br\s*\/?>/i.test(l)) out.push(['WARN', `${at}: <br> in a table cell is cramped on dev.to; use two rows or a list`]);
    if (cells.some((c) => /\d [%×]|[<>≤≥~] \d|\d (ms|s|min|kB|MB)\b/.test(c))) out.push(['WARN', `${at}: a number and its unit are split by a plain space; use &nbsp; so the cell does not wrap between them`]);
    if (cells.length >= 3 && cells.some((c) => c.length > 60)) out.push(['WARN', `${at}: long text in a ${cells.length}-column table; on dev.to and phones it reads better as a list`]);
  }
  return out;
}

function checkLeftovers(text) {
  const out = [];
  const rules = [
    [/\bTODO\b|\bTBD\b|\bXXX\b|placeholder|<[A-Za-z ]*(URL|link)>/i, 'FAIL', 'a placeholder is left'],
    [/(^|[\s("'])\/(Users|home)\/[^\s)]+|[A-Z]:\\Users\\/, 'FAIL', 'a local path'],
    [/https?:\/\/(localhost|127\.0\.0\.1)|file:\/\//, 'FAIL', 'a local link'],
    [/npx\s+github:/, 'WARN', '`npx github:…` — use the npm name once the package is published'],
  ];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^<!--|^\s*#\s*cover_image/.test(lines[i])) continue;
    for (const [re, level, what] of rules) if (re.test(lines[i])) out.push([level, `line ${i + 1}: ${what}: ${lines[i].trim().slice(0, 80)}`]);
  }
  return out;
}

const flagsIn = (text) => [...new Set((text.match(/(?<![\w-])--[a-z][a-z0-9-]+/g) || []))];

// Flags the article uses that the published README never mentions: likely added after the last publish.
function checkFlags(articleText, publishedReadme, pkgName) {
  if (publishedReadme === null) return [['WARN', `the published README of ${pkgName} was not read; check by hand that every flag the article uses is on npm`]];
  const missing = flagsIn(articleText).filter((f) => !publishedReadme.includes(f));
  return missing.length
    ? [['FAIL', `the article uses ${missing.join(', ')}, which the README published on npm does not mention: release first, or drop the flag from the article`]]
    : [['PASS', `every flag in the article appears in the published README of ${pkgName}`]];
}

function checkStructure(body) {
  const out = [];
  if (!/^#{1,3} *TL;?DR/im.test(body)) out.push(['WARN', 'no TL;DR section at the top']);
  if (!/^#{1,3} *(Contents|Table of contents)/im.test(body)) out.push(['WARN', 'no Contents list']);
  if (!/^#{1,3} *Limits/im.test(body)) out.push(['WARN', 'no Limits section (what was not checked)']);
  return out;
}

// ---------------------------------------------------------------- main

function main(argv) {
  const opt = { file: '', pkg: '', offline: false, maxWidth: 100 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--package') opt.pkg = argv[++i];
    else if (argv[i] === '--offline') opt.offline = true;
    else if (argv[i] === '--max-table-width') opt.maxWidth = Number(argv[++i]);
    else opt.file = argv[i];
  }
  if (!opt.file) {
    console.error('usage: node article-check.js <article.md> [--package <npm name>] [--offline] [--max-table-width 100]');
    return 2;
  }
  const text = fs.readFileSync(opt.file, 'utf8');
  const fm = frontMatter(text);
  const body = fm ? fm.body : text;
  const results = [...checkFrontMatter(fm), ...checkStructure(body), ...checkImages(body), ...checkTables(body, opt), ...checkLeftovers(body)];
  if (opt.pkg) {
    let readme = null;
    if (!opt.offline) {
      const r = spawnSync('npm', ['view', opt.pkg, 'readme'], { encoding: 'utf8' });
      readme = r.status === 0 && r.stdout.trim() ? r.stdout : null;
    }
    results.push(...checkFlags(body, readme, opt.pkg));
  }
  for (const [level, msg] of results) console.log(`${level.padEnd(4)}  ${msg}`);
  const fails = results.filter((r) => r[0] === 'FAIL').length;
  console.log(fails ? `\n${fails} FAIL.` : `\nNo FAIL (${results.length} notes).`);
  return fails ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { frontMatter, checkFrontMatter, checkImages, checkTables, checkLeftovers, checkFlags, checkStructure, flagsIn };
