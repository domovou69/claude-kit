#!/usr/bin/env node
// Lists the plugins of the claude-kit marketplace for a project kickoff: skills (name, when to use), hooks, whether
// each plugin is enabled in the user or project settings, and the signals found in the project that point to it.
//   node kit-inventory.js [--kit <marketplace dir>] [--project <dir>] [--settings <file>]… [--json]
// Default kit: the installed marketplace in ~/.claude/plugins/marketplaces/claude-kit. Default settings:
// ~/.claude/settings.json and the project's .claude/settings.json and settings.local.json.
// Read-only. Node, no dependencies.

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEFAULT_KIT = path.join(os.homedir(), '.claude', 'plugins', 'marketplaces', 'claude-kit');

// Signals per plugin: hints only, the skill matches plugins against the project's goal.
const SIGNALS = {
  'git-guard': [{ why: 'git repository', test: (p) => p.isGit }],
  'locator-converter': [
    { why: 'locator conversion code or data', test: (p) => p.files.some((f) => /xpath|class-?chain|uiselector|locator/i.test(path.basename(f))) },
    { why: 'package name mentions locators', test: (p) => /xpath|locator|selector/i.test(p.pkg.name || '') },
  ],
  'mobile-test-runs': [
    { why: 'mobile test dependencies', test: (p) => p.deps.some((d) => /^(appium|webdriverio|@wdio\/|detox$|appium-)/.test(d)) },
    { why: 'iOS project files', test: (p) => p.files.some((f) => /\.xcodeproj\/|(^|\/)Podfile$|\.xcworkspace\//.test(f)) },
    { why: 'Android project files', test: (p) => p.files.some((f) => /(^|\/)(build\.gradle(\.kts)?|AndroidManifest\.xml)$/.test(f)) },
    { why: 'Maestro flows', test: (p) => p.files.some((f) => /(^|\/)\.maestro\//.test(f)) },
  ],
  'llm-benchmark': [
    { why: 'LLM SDK dependency', test: (p) => p.deps.some((d) => /^(@anthropic-ai\/|openai$)/.test(d)) },
    { why: 'llm/ folder or prompt files', test: (p) => p.files.some((f) => /(^|\/)llm\/|(^|\/)prompts?[-\w]*\.md$/i.test(f)) },
  ],
  publishing: [
    { why: 'npm package (not private)', test: (p) => Boolean(p.pkg.name) && !p.pkg.private },
    { why: 'package has a bin', test: (p) => Boolean(p.pkg.bin) },
    { why: 'articles folder', test: (p) => p.files.some((f) => /(^|\/)articles\//.test(f)) },
    { why: 'GitHub Pages workflow or site/ folder', test: (p) => p.files.some((f) => /\.github\/workflows\/pages\.ya?ml$|^site\//.test(f)) },
  ],
  'project-kit': [
    { why: 'no PLAN.md yet (kickoff)', test: (p) => p.dir !== null && !p.files.includes('PLAN.md') },
  ],
};

// ---------------------------------------------------------------- pure parts (tested)

// Front matter of a SKILL.md: flat `key: value` lines between the first two `---` lines.
function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

// "Use when X. Not for Y." → { when: "Use when X.", notFor: "Not for Y." }
function splitDescription(description = '') {
  const i = description.search(/\bNot for\b/);
  return i < 0 ? { when: description.trim(), notFor: '' } : { when: description.slice(0, i).trim(), notFor: description.slice(i).trim() };
}

// Plugin names enabled in the given settings objects, as { name: [where, …] }. The list goes from user to project
// settings; a later `false` (a project turning a plugin off) wins.
function enabledIn(settingsList, marketplace) {
  const out = {};
  for (const { where, settings } of settingsList) {
    for (const [key, on] of Object.entries((settings && settings.enabledPlugins) || {})) {
      const [name, market] = key.split('@');
      if (market !== marketplace) continue;
      if (on) (out[name] = out[name] || []).push(where);
      else delete out[name];
    }
  }
  return out;
}

function projectSignals(project, pluginNames) {
  const out = {};
  for (const name of pluginNames) {
    const hits = (SIGNALS[name] || []).filter((s) => {
      try { return s.test(project); } catch { return false; }
    });
    out[name] = hits.map((s) => s.why);
  }
  return out;
}

// ---------------------------------------------------------------- file system

const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};

function readKit(kitDir) {
  const market = readJson(path.join(kitDir, '.claude-plugin', 'marketplace.json'));
  if (!market) throw new Error(`no .claude-plugin/marketplace.json in ${kitDir}`);
  const plugins = (market.plugins || []).map((p) => {
    const dir = path.resolve(kitDir, typeof p.source === 'string' ? p.source : '');
    const skillsDir = path.join(dir, 'skills');
    const skills = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir).sort().flatMap((s) => {
        const file = path.join(skillsDir, s, 'SKILL.md');
        if (!fs.existsSync(file)) return [];
        const fm = parseFrontMatter(fs.readFileSync(file, 'utf8'));
        return [{ name: `${p.name}:${fm.name || s}`, ...splitDescription(fm.description) }];
      })
      : [];
    const hooksJson = readJson(path.join(dir, 'hooks', 'hooks.json'));
    const hooks = Object.entries((hooksJson && hooksJson.hooks) || {}).map(([event, list]) =>
      `${event}(${[...new Set(list.map((h) => h.matcher || '*'))].join(', ')})`);
    return { name: p.name, description: p.description || '', skills, hooks };
  });
  return { name: market.name, plugins };
}

function listProjectFiles(dir) {
  const git = spawnSync('git', ['-C', dir, 'ls-files'], { encoding: 'utf8' });
  if (git.status === 0) return { isGit: true, files: git.stdout.split('\n').filter(Boolean) };
  const files = [];
  const walk = (rel, depth) => {
    if (depth > 4 || files.length > 5000) return;
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r, depth + 1);
      else files.push(r);
    }
  };
  walk('', 0);
  return { isGit: fs.existsSync(path.join(dir, '.git')), files };
}

function readProject(dir) {
  if (!dir) return { dir: null, isGit: false, files: [], pkg: {}, deps: [] };
  const { isGit, files } = listProjectFiles(dir);
  const pkg = readJson(path.join(dir, 'package.json')) || {};
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies });
  return { dir, isGit, files, pkg, deps };
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const a = { kit: DEFAULT_KIT, project: null, settings: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--kit') a.kit = argv[++i];
    else if (argv[i] === '--project') a.project = argv[++i];
    else if (argv[i] === '--settings') a.settings.push(argv[++i]);
    else if (argv[i] === '--json') a.json = true;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!a.settings.length) {
    a.settings.push(path.join(os.homedir(), '.claude', 'settings.json'));
    if (a.project) a.settings.push(path.join(a.project, '.claude', 'settings.json'), path.join(a.project, '.claude', 'settings.local.json'));
  }
  return a;
}

function main(argv) {
  const args = parseArgs(argv);
  const kit = readKit(args.kit);
  const projectDir = args.project && path.resolve(args.project) + path.sep;
  const settingsList = args.settings.map((f) => ({
    where: projectDir && path.resolve(f).startsWith(projectDir) ? 'project' : 'user',
    settings: readJson(f),
  }));
  const enabled = enabledIn(settingsList, kit.name);
  const project = readProject(args.project && path.resolve(args.project));
  const signals = projectSignals(project, kit.plugins.map((p) => p.name));
  const result = kit.plugins.map((p) => ({ ...p, enabled: enabled[p.name] || [], signals: signals[p.name] }));
  if (args.json) {
    process.stdout.write(JSON.stringify({ marketplace: kit.name, plugins: result }, null, 2) + '\n');
    return;
  }
  const lines = [`${kit.name}: ${result.length} plugins (${args.kit})`, ''];
  for (const p of result) {
    lines.push(`${p.name} — ${p.enabled.length ? `enabled (${[...new Set(p.enabled)].join(', ')})` : 'not enabled'}`);
    for (const s of p.skills) lines.push(`  skill ${s.name}: ${s.when.length > 200 ? s.when.slice(0, 197) + '…' : s.when}`);
    for (const h of p.hooks) lines.push(`  hook ${h}`);
    if (args.project) lines.push(`  signals: ${p.signals.length ? p.signals.join('; ') : 'none'}`);
    lines.push('');
  }
  process.stdout.write(lines.join('\n'));
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`kit-inventory: ${e.message}\n`);
    process.exit(2);
  }
}

module.exports = { parseFrontMatter, splitDescription, enabledIn, projectSignals, readKit, readProject, SIGNALS };
