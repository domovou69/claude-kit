// Run from the repository root: node --test
// skills/kickoff/scripts/kit-inventory.js: front matter, enabled plugins, project signals, and one CLI run on a
// throwaway marketplace and project.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'skills', 'kickoff', 'scripts', 'kit-inventory.js');
const k = require(SCRIPT);

function write(root, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), typeof text === 'string' ? text : JSON.stringify(text));
  }
  return root;
}

function fixtureKit() {
  return write(fs.mkdtempSync(path.join(os.tmpdir(), 'kit-')), {
    '.claude-plugin/marketplace.json': { name: 'claude-kit', plugins: [
      { name: 'git-guard', source: './plugins/git-guard' },
      { name: 'publishing', source: './plugins/publishing' },
    ] },
    'plugins/git-guard/hooks/hooks.json': { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [] }] } },
    'plugins/publishing/skills/npm-release/SKILL.md': '---\nname: npm-release\ndescription: Use when releasing an npm package. Not for articles.\n---\n# x\n',
  });
}

test('front matter and the "Not for" split', () => {
  const fm = k.parseFrontMatter('---\nname: kickoff\ndescription: "Use when starting. Not for retros."\n---\nbody');
  assert.deepStrictEqual(fm, { name: 'kickoff', description: 'Use when starting. Not for retros.' });
  assert.deepStrictEqual(k.splitDescription(fm.description), { when: 'Use when starting.', notFor: 'Not for retros.' });
  assert.deepStrictEqual(k.splitDescription('Use when X.'), { when: 'Use when X.', notFor: '' });
  assert.deepStrictEqual(k.parseFrontMatter('no front matter'), {});
});

test('enabled plugins: user and project scope; a project false turns a user plugin off; other marketplaces ignored', () => {
  const list = [
    { where: 'user', settings: { enabledPlugins: { 'git-guard@claude-kit': true, 'publishing@claude-kit': true, 'x@other': true } } },
    { where: 'project', settings: { enabledPlugins: { 'publishing@claude-kit': false, 'llm-benchmark@claude-kit': true } } },
    { where: 'project', settings: null },
  ];
  assert.deepStrictEqual(k.enabledIn(list, 'claude-kit'), { 'git-guard': ['user'], 'llm-benchmark': ['project'] });
});

test('project signals point at the matching plugins only', () => {
  const project = {
    dir: '/p', isGit: true,
    files: ['package.json', 'android/app/build.gradle', 'audit/llm/run.js', 'lib/xpath.js'],
    pkg: { name: 'my-tool', bin: { 'my-tool': 'cli.js' } },
    deps: ['appium', 'webdriverio'],
  };
  const s = k.projectSignals(project, ['git-guard', 'mobile-test-runs', 'llm-benchmark', 'publishing', 'locator-converter', 'project-kit', 'unknown']);
  assert.deepStrictEqual(s['git-guard'], ['git repository']);
  assert.deepStrictEqual(s['mobile-test-runs'], ['mobile test dependencies', 'Android project files']);
  assert.deepStrictEqual(s['llm-benchmark'], ['llm/ folder or prompt files']);
  assert.deepStrictEqual(s.publishing, ['npm package (not private)', 'package has a bin']);
  assert.deepStrictEqual(s['locator-converter'], ['locator conversion code or data']);
  assert.deepStrictEqual(s['project-kit'], ['no PLAN.md yet (kickoff)']);
  assert.deepStrictEqual(s.unknown, []);
  const quiet = k.projectSignals({ dir: '/q', isGit: false, files: ['PLAN.md'], pkg: { name: 'x', private: true }, deps: [] }, ['publishing', 'project-kit']);
  assert.deepStrictEqual(quiet, { publishing: [], 'project-kit': [] });
});

test('readKit lists skills with their "when" part and hooks with matchers', () => {
  const kit = k.readKit(fixtureKit());
  assert.strictEqual(kit.name, 'claude-kit');
  assert.deepStrictEqual(kit.plugins[0], { name: 'git-guard', description: '', skills: [], hooks: ['PreToolUse(Bash)'] });
  assert.deepStrictEqual(kit.plugins[1].skills, [{ name: 'publishing:npm-release', when: 'Use when releasing an npm package.', notFor: 'Not for articles.' }]);
});

test('CLI: text and JSON on a throwaway kit and project', () => {
  const kit = fixtureKit();
  const project = write(fs.mkdtempSync(path.join(os.tmpdir(), 'proj-')), {
    'package.json': { name: 'my-tool', bin: 'cli.js' },
    '.claude/settings.json': { enabledPlugins: { 'publishing@claude-kit': true } },
  });
  const user = write(fs.mkdtempSync(path.join(os.tmpdir(), 'user-')), { 'settings.json': { enabledPlugins: { 'git-guard@claude-kit': true } } });
  const args = [SCRIPT, '--kit', kit, '--project', project, '--settings', path.join(user, 'settings.json'), '--settings', path.join(project, '.claude', 'settings.json')];
  const text = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.strictEqual(text.status, 0, text.stderr);
  assert.match(text.stdout, /git-guard — enabled \(user\)/);
  assert.match(text.stdout, /publishing — enabled \(project\)/);
  assert.match(text.stdout, /skill publishing:npm-release: Use when releasing an npm package\./);
  assert.match(text.stdout, /signals: npm package \(not private\); package has a bin/);
  const json = JSON.parse(spawnSync(process.execPath, [...args, '--json'], { encoding: 'utf8' }).stdout);
  assert.deepStrictEqual(json.plugins.map((p) => [p.name, p.enabled]), [['git-guard', ['user']], ['publishing', ['project']]]);
  const bad = spawnSync(process.execPath, [SCRIPT, '--kit', project], { encoding: 'utf8' });
  assert.strictEqual(bad.status, 2);
  assert.match(bad.stderr, /no \.claude-plugin\/marketplace\.json/);
});
