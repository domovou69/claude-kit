#!/usr/bin/env node
// Retro scan: what the user's memory says that no rule, hook or skill says yet, and which kit skills are not used.
//   node retro-scan.js [--projects <dir>] [--project <name>]… [--user-rules <file>] [--kit <dir>]
//                      [--settings <file>] [--since YYYY-MM-DD] [--no-transcripts] [--json]
// Reads every project's memory in ~/.claude/projects/*/memory (or --projects), the user-level CLAUDE.md, each
// project's CLAUDE.md (project folder taken from its transcripts), and the kit's skills and hook READMEs (default:
// the installed claude-kit marketplace). Prints, per feedback memory, how well each layer covers it and a suggestion;
// the same rule kept in several projects; memory index problems; and how often each kit skill was invoked in the
// transcripts. The scores are word overlaps — a triage aid, not a verdict. Read-only. Node, no dependencies.

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOME = os.homedir();
const DEFAULTS = {
  projects: path.join(HOME, '.claude', 'projects'),
  userRules: path.join(HOME, '.claude', 'CLAUDE.md'),
  kit: path.join(HOME, '.claude', 'plugins', 'marketplaces', 'claude-kit'),
  settings: path.join(HOME, '.claude', 'settings.json'),
};
const COVERED = 0.4;
const PARTLY = 0.25;
const STOP = new Set(('also after before being both does done each every from have here into just like made make more most must need never only once other over same should show some such than that their them then there these they this those through very what when where which while with without would your ' +
  'user said says asked wants rule rules always first time next again how apply why every whole need needs goes keep until into').split(' '));
const REPEAT = /\b(again|second time|third|twice|repeated(ly)?|another (commit|time|run))\b/gi;

// ---------------------------------------------------------------- pure parts (tested)

function parseMemory(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  const fm = m ? m[1] : '';
  const get = (key) => {
    const r = new RegExp(`^\\s*${key}:\\s*(.*)$`, 'm').exec(fm);
    return r ? r[1].trim().replace(/^(['"])(.*)\1$/, '$2') : '';
  };
  return { name: get('name'), description: get('description'), type: get('type'), body: m ? m[2] : text };
}

const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '');
function terms(text) {
  const out = new Set();
  for (const w of String(text).toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []) {
    for (const part of w.split('-')) if (part.length >= 4 && !STOP.has(part)) out.add(stem(part));
  }
  return out;
}

// The rule a feedback memory states, in short: its name and description.
const ruleText = (mem) => `${mem.name.replace(/-/g, ' ')} ${mem.description}`;

// A rule is covered when one place says it, so sources are split into chunks: a list item (with its continuation
// lines), a table row, a paragraph.
function chunks(text) {
  const out = [];
  let para = [];
  let item = false;
  const flush = () => {
    if (para.length) out.push(para.join(' '));
    para = [];
    item = false;
  };
  for (const line of String(text).split('\n')) {
    if (!line.trim() || /^#/.test(line)) flush();
    else if (/^\s*\|/.test(line)) { flush(); out.push(line); }
    else if (/^\s*([-*]|\d+\.)\s/.test(line)) { flush(); para = [line]; item = true; }
    else if (item && !/^\s/.test(line)) { flush(); para = [line]; }
    else para.push(line);
  }
  flush();
  return out;
}

// sources: [{ label, text }] → [{ label, chunks: [{ text, terms }] }]
const withChunks = (sources) => sources.map((s) => ({ label: s.label, chunks: chunks(s.text).map((c) => ({ text: c, terms: terms(c) })) }));

// Rare words weigh more: "caffeinate" says more about a rule than "run".
function idf(sourceLists) {
  const df = new Map();
  let n = 0;
  for (const list of sourceLists) for (const s of list) for (const c of s.chunks) {
    n++;
    for (const t of c.terms) df.set(t, (df.get(t) || 0) + 1);
  }
  return (t) => Math.log(1 + n / (1 + (df.get(t) || 0)));
}

// Weighted share of the memory's terms found in one chunk.
function coverage(memTerms, chunkTerms, weight = () => 1) {
  let all = 0;
  let hit = 0;
  for (const t of memTerms) {
    const w = weight(t);
    all += w;
    if (chunkTerms.has(t)) hit += w;
  }
  return all ? hit / all : 0;
}

// The best-covering chunk across sources.
function best(memTerms, sources, weight) {
  let top = { label: null, score: 0, where: '' };
  for (const s of sources) for (const c of s.chunks) {
    const score = coverage(memTerms, c.terms, weight);
    if (score > top.score) top = { label: s.label, score, where: c.text.trim().replace(/\s+/g, ' ').slice(0, 100) };
  }
  return top;
}

function incidents(body) {
  return {
    dates: new Set(body.match(/\b20\d\d-\d\d-\d\d\b/g) || []).size,
    repeats: (body.match(REPEAT) || []).length,
  };
}

// layers = { rules, hook, skill } → { rules: {label, score}, … }. Scores are word overlaps: a covered rule still
// needs a look at the best match, a missing one may be worded differently.
function suggest(layers, inc) {
  const covered = (l) => layers[l].score >= COVERED;
  const partly = (l) => layers[l].score >= PARTLY;
  const any = (test) => ['rules', 'hook', 'skill'].some(test);
  const repeated = inc.dates >= 2 || inc.repeats > 0;
  if (repeated && covered('hook')) return 'hook exists — memory can shrink to a pointer';
  if (repeated) return any(partly)
    ? 'hook candidate — written, broken again; hook only if it must always hold and a tool call shows it'
    : 'missing rule, repeated — write it now, then consider a hook';
  if (any(covered)) return 'covered — memory can shrink to a pointer';
  if (any(partly)) return 'partly covered — read the best match; extend that rule or write a new one';
  return 'missing rule — write it in the right layer (rule-layers.md)';
}

const jaccard = (a, b) => {
  let both = 0;
  for (const t of a) if (b.has(t)) both++;
  return a.size + b.size - both ? both / (a.size + b.size - both) : 0;
};

// Feedback memories that say the same thing in different projects: same name, or similar name + description.
function duplicates(mems, threshold = 0.3) {
  const groups = [];
  const seen = new Set();
  for (let i = 0; i < mems.length; i++) {
    if (seen.has(i)) continue;
    const group = [i];
    const ti = terms(`${mems[i].name.replace(/-/g, ' ')} ${mems[i].description}`);
    for (let j = i + 1; j < mems.length; j++) {
      if (seen.has(j) || mems[j].project === mems[i].project) continue;
      const tj = terms(`${mems[j].name.replace(/-/g, ' ')} ${mems[j].description}`);
      if (mems[j].name === mems[i].name || jaccard(ti, tj) >= threshold) group.push(j);
    }
    if (group.length > 1) {
      group.forEach((k) => seen.add(k));
      const bodies = new Set(group.map((k) => mems[k].body.trim()));
      groups.push({ members: group.map((k) => `${mems[k].project}/${mems[k].file}`), diverged: bodies.size > 1 });
    }
  }
  return groups;
}

// MEMORY.md links to missing files, and memory files the index does not link.
function indexProblems(indexText, files) {
  const linked = new Set([...String(indexText || '').matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]));
  return {
    missing: [...linked].filter((f) => !files.includes(f)),
    unindexed: files.filter((f) => !linked.has(f)),
  };
}

// Invocations of each skill in a transcript: the Skill tool and slash commands, not mentions in text.
function countSkillUse(text, skillNames) {
  const out = {};
  for (const name of skillNames) {
    const short = name.split(':')[1];
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tool = new RegExp(`"name":"Skill","input":\\{"skill":"(${esc(name)}|${esc(short)})"`, 'g');
    const slash = new RegExp(`<command-name>/${esc(name)}</command-name>`, 'g');
    out[name] = (text.match(tool) || []).length + (text.match(slash) || []).length;
  }
  return out;
}

// "-Users-<name>-projects-foo" → "foo" when the project folder is unknown; never prints the user name.
const projectLabel = (dir, cwd) => (cwd ? path.basename(cwd) : dir.replace(/^-(Users|home)-[^-]+-(projects-)?/, ''));

// ---------------------------------------------------------------- file system

const read = (file) => {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
};
const ls = (dir) => {
  try { return fs.readdirSync(dir).sort(); } catch { return []; }
};

function projectCwd(dir) {
  for (const f of ls(dir).filter((x) => x.endsWith('.jsonl'))) {
    const fd = fs.openSync(path.join(dir, f), 'r');
    const buf = Buffer.alloc(65536);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const m = /"cwd":"([^"]+)"/.exec(buf.toString('utf8', 0, n));
    if (m) return m[1];
  }
  return null;
}

function readKit(kitDir) {
  const market = JSON.parse(read(path.join(kitDir, '.claude-plugin', 'marketplace.json')) || '{"plugins":[]}');
  const plugins = [];
  const hooks = [];
  const skills = [];
  for (const p of market.plugins || []) {
    const dir = path.resolve(kitDir, typeof p.source === 'string' ? p.source : '');
    const git = spawnSync('git', ['-C', kitDir, 'log', '--reverse', '--format=%as', '--', path.relative(kitDir, dir)], { encoding: 'utf8' });
    plugins.push({ name: p.name, since: git.status === 0 ? git.stdout.split('\n')[0] || null : null });
    const shared = ls(path.join(dir, 'references')).map((f) => read(path.join(dir, 'references', f)) || '').join('\n');
    if (fs.existsSync(path.join(dir, 'hooks', 'hooks.json'))) hooks.push({ label: p.name, text: read(path.join(dir, 'README.md')) || '' });
    for (const s of ls(path.join(dir, 'skills'))) {
      const sd = path.join(dir, 'skills', s);
      const text = [read(path.join(sd, 'SKILL.md')) || '', ...ls(path.join(sd, 'references')).map((f) => read(path.join(sd, 'references', f)) || ''), shared].join('\n');
      skills.push({ label: `${p.name}:${s}`, plugin: p.name, text });
    }
  }
  return { name: market.name || 'claude-kit', plugins, hooks, skills };
}

// Status of a kit skill from its invocation count, whether its plugin is on, and how long it has been in the kit.
function skillStatus(count, enabled, since, now = Date.now(), minDays = 14) {
  if (count) return 'used';
  if (!enabled) return 'plugin not enabled — enable it where it fits, or drop the skill if no project needs it';
  if (since && (now - Date.parse(since)) / 864e5 < minDays) return `new (in the kit since ${since}) — check again later`;
  return 'never invoked — fix the description (when + Not for) or remove it';
}

function scan(opts) {
  const projects = ls(opts.projects)
    .filter((d) => fs.existsSync(path.join(opts.projects, d, 'memory')))
    .map((d) => {
      const cwd = projectCwd(path.join(opts.projects, d));
      return { dir: d, cwd, label: projectLabel(d, cwd) };
    })
    .filter((p) => !opts.only.length || opts.only.some((o) => p.label.includes(o)));

  const kit = readKit(opts.kit);
  const hookSources = withChunks(kit.hooks);
  const skillSources = withChunks(kit.skills);
  const userRules = read(opts.userRules) || '';

  const mems = [];
  const index = [];
  for (const p of projects) {
    const mdir = path.join(opts.projects, p.dir, 'memory');
    const files = ls(mdir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
    index.push({ project: p.label, ...indexProblems(read(path.join(mdir, 'MEMORY.md')), files) });
    const projectRules = p.cwd ? [read(path.join(p.cwd, 'CLAUDE.md')), read(path.join(p.cwd, '.claude', 'CLAUDE.md'))].filter(Boolean).join('\n') : '';
    const ruleSources = withChunks([{ label: '~/.claude/CLAUDE.md', text: userRules }, ...(projectRules ? [{ label: `${p.label}/CLAUDE.md`, text: projectRules }] : [])]);
    for (const f of files) {
      const mem = parseMemory(read(path.join(mdir, f)) || '');
      mems.push({ project: p.label, file: f, ...mem, ruleSources });
    }
  }

  const weight = idf([hookSources, skillSources, ...mems.map((m) => m.ruleSources).filter((r, i, all) => all.indexOf(r) === i)]);
  const feedback = mems.filter((m) => ['feedback', 'user'].includes(m.type)).map((m) => {
    const t = terms(ruleText(m));
    const layers = { rules: best(t, m.ruleSources, weight), hook: best(t, hookSources, weight), skill: best(t, skillSources, weight) };
    const inc = incidents(m.body);
    return { project: m.project, file: m.file, description: m.description, layers, incidents: inc, suggestion: suggest(layers, inc) };
  });

  let skillUse = null;
  if (opts.transcripts) {
    const names = kit.skills.map((s) => s.label);
    const counts = Object.fromEntries(names.map((n) => [n, 0]));
    const since = opts.since ? Date.parse(opts.since) : 0;
    for (const d of ls(opts.projects)) {
      for (const f of ls(path.join(opts.projects, d)).filter((x) => x.endsWith('.jsonl'))) {
        const file = path.join(opts.projects, d, f);
        if (fs.statSync(file).mtimeMs < since) continue;
        const found = countSkillUse(read(file) || '', names);
        for (const n of names) counts[n] += found[n];
      }
    }
    let settings = {};
    try { settings = JSON.parse(read(opts.settings) || '{}'); } catch { /* unreadable settings: nothing enabled */ }
    const enabled = (plugin) => Boolean((settings.enabledPlugins || {})[`${plugin}@${kit.name}`]);
    skillUse = kit.skills.map((s) => {
      const since = (kit.plugins.find((p) => p.name === s.plugin) || {}).since || null;
      return { skill: s.label, count: counts[s.label], enabled: enabled(s.plugin), since, status: skillStatus(counts[s.label], enabled(s.plugin), since) };
    });
  }

  return {
    projects: projects.map((p) => p.label),
    memories: mems.length,
    feedback,
    duplicates: duplicates(mems.filter((m) => ['feedback', 'user'].includes(m.type))),
    index: index.filter((i) => i.missing.length || i.unindexed.length),
    skillUse,
  };
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const a = { ...DEFAULTS, only: [], since: null, transcripts: true, json: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--projects') a.projects = argv[++i];
    else if (v === '--project') a.only.push(argv[++i]);
    else if (v === '--user-rules') a.userRules = argv[++i];
    else if (v === '--kit') a.kit = argv[++i];
    else if (v === '--settings') a.settings = argv[++i];
    else if (v === '--since') a.since = argv[++i];
    else if (v === '--no-transcripts') a.transcripts = false;
    else if (v === '--json') a.json = true;
    else throw new Error(`unknown argument ${v}`);
  }
  return a;
}

function format(r) {
  const pct = (l) => (l.label ? `${Math.round(l.score * 100)} % ${l.label}` : '—');
  const lines = [`Projects: ${r.projects.join(', ') || 'none'}; ${r.memories} memory files, ${r.feedback.length} feedback`, '', '## Feedback memories', ''];
  for (const f of r.feedback) {
    lines.push(`${f.project}/${f.file} — ${f.description.length > 110 ? f.description.slice(0, 107) + '…' : f.description}`);
    lines.push(`  rules ${pct(f.layers.rules)} | hook ${pct(f.layers.hook)} | skill ${pct(f.layers.skill)} | ${f.incidents.dates} dates, ${f.incidents.repeats} repeat words`);
    const top = ['rules', 'hook', 'skill'].map((l) => f.layers[l]).sort((a, b) => b.score - a.score)[0];
    if (top.where) lines.push(`  best match: "${top.where}"`);
    lines.push(`  → ${f.suggestion}`);
  }
  lines.push('', '## Same rule in several projects', '');
  if (!r.duplicates.length) lines.push('none');
  for (const d of r.duplicates) lines.push(`${d.diverged ? 'DIVERGED' : 'same text'}: ${d.members.join(', ')}`);
  lines.push('', '## Memory index', '');
  if (!r.index.length) lines.push('every index matches its files');
  for (const i of r.index) {
    if (i.missing.length) lines.push(`${i.project}: MEMORY.md links missing files: ${i.missing.join(', ')}`);
    if (i.unindexed.length) lines.push(`${i.project}: files not in MEMORY.md: ${i.unindexed.join(', ')}`);
  }
  if (r.skillUse) {
    lines.push('', '## Kit skills invoked (Skill tool or slash command)', '');
    for (const s of [...r.skillUse].sort((a, b) => a.count - b.count)) lines.push(`${String(s.count).padStart(4)}  ${s.skill} — ${s.status}`);
  }
  return lines.join('\n') + '\n';
}

if (require.main === module) {
  try {
    const r = scan(parseArgs(process.argv.slice(2)));
    process.stdout.write(process.argv.includes('--json') ? JSON.stringify(r, null, 2) + '\n' : format(r));
  } catch (e) {
    process.stderr.write(`retro-scan: ${e.message}\n`);
    process.exit(2);
  }
}

module.exports = { parseMemory, terms, chunks, withChunks, idf, coverage, best, skillStatus, incidents, suggest, duplicates, indexProblems, countSkillUse, projectLabel, scan, format };
