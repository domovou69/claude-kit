// Run from the repository root: node --test
// skills/retro/scripts/retro-scan.js: memory parsing, coverage scoring, suggestions, duplicates, index problems,
// skill invocation counts, and a full scan of a throwaway projects folder, kit and settings.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'skills', 'retro', 'scripts', 'retro-scan.js');
const r = require(SCRIPT);

function write(root, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), typeof text === 'string' ? text : JSON.stringify(text));
  }
  return root;
}

const mem = (name, type, description, body) => `---\nname: ${name}\ndescription: "${description}"\nmetadata:\n  type: ${type}\n---\n${body}\n`;

test('memory front matter: nested metadata type, quoted description, body', () => {
  const m = r.parseMemory(mem('caffeinate-runs', 'feedback', 'Device runs need caffeinate', 'Body line.'));
  assert.deepStrictEqual(m, { name: 'caffeinate-runs', description: 'Device runs need caffeinate', type: 'feedback', body: 'Body line.\n' });
  assert.strictEqual(r.parseMemory('---\nname: x\ntype: user\n---\nb').type, 'user');
  assert.strictEqual(r.parseMemory('plain text').body, 'plain text');
});

test('chunks: list items keep their continuation lines, table rows and paragraphs stand alone', () => {
  const c = r.chunks('# T\n\n- first item\n  continues here\n- second\n\n| a | b |\nA paragraph\nover two lines.\n');
  assert.deepStrictEqual(c, ['- first item   continues here', '- second', '| a | b |', 'A paragraph over two lines.']);
});

test('coverage is the weighted share of the memory terms in one chunk; rare words weigh more', () => {
  const sources = r.withChunks([{ label: 'hooks', text: '- Denied: a timed run on battery or in Low Power Mode.\n- Denied: a run without caffeinate.\n- A run.\n- A run.\n' }]);
  const weight = r.idf([sources]);
  const t = r.terms('caffeinate device runs');
  const top = r.best(t, sources, weight);
  assert.strictEqual(top.label, 'hooks');
  assert.match(top.where, /caffeinate/);
  const one = (w) => r.terms(w).values().next().value;
  assert.ok(weight(one('caffeinate')) > weight(one('denied')), 'a word in one chunk weighs more than a word in two');
  assert.strictEqual(r.coverage(new Set(), new Set(['a'])), 0);
  assert.strictEqual(r.best(r.terms('unrelated words entirely'), sources, weight).score, 0);
});

test('suggestions: covered, partly, missing, repeated with and without a hook', () => {
  const L = (rules, hook, skill) => ({ rules: { score: rules }, hook: { score: hook }, skill: { score: skill } });
  const once = { dates: 1, repeats: 0 };
  const twice = { dates: 3, repeats: 1 };
  assert.match(r.suggest(L(0.6, 0, 0), once), /^covered/);
  assert.match(r.suggest(L(0.3, 0, 0), once), /^partly covered/);
  assert.match(r.suggest(L(0.1, 0.1, 0.1), once), /^missing rule —/);
  assert.match(r.suggest(L(0.5, 0.6, 0), twice), /^hook exists/);
  assert.match(r.suggest(L(0.5, 0.1, 0), twice), /^hook candidate/);
  assert.match(r.suggest(L(0, 0, 0), { dates: 0, repeats: 2 }), /^missing rule, repeated/);
});

test('incidents count distinct dates and repeat words', () => {
  assert.deepStrictEqual(r.incidents('On 2026-10-14 two commits; 2026-10-15 a third commit; again on 2026-10-14.'), { dates: 2, repeats: 2 });
});

test('duplicates across projects: same name or similar description; same text or diverged', () => {
  const ms = [
    { project: 'a', file: 'cost.md', name: 'cost-estimate-first', description: 'estimate before heavy steps', body: 'x' },
    { project: 'b', file: 'cost.md', name: 'cost-estimate-first', description: 'estimate before heavy steps', body: 'x' },
    { project: 'a', file: 'lang.md', name: 'language-rule', description: 'English in project files, Russian chat', body: 'one' },
    { project: 'b', file: 'language.md', name: 'language', description: 'project files English, chat Russian', body: 'two' },
    { project: 'a', file: 'other.md', name: 'other-thing', description: 'unrelated', body: 'z' },
  ];
  assert.deepStrictEqual(r.duplicates(ms), [
    { members: ['a/cost.md', 'b/cost.md'], diverged: false },
    { members: ['a/lang.md', 'b/language.md'], diverged: true },
  ]);
});

test('index problems: links to missing files and files not in the index', () => {
  assert.deepStrictEqual(r.indexProblems('- [A](a.md) — x\n- [Gone](gone.md) — y\n', ['a.md', 'b.md']), { missing: ['gone.md'], unindexed: ['b.md'] });
  assert.deepStrictEqual(r.indexProblems(null, ['a.md']), { missing: [], unindexed: ['a.md'] });
});

test('skill use counts Skill tool calls and slash commands, not mentions in text', () => {
  const text = [
    '{"type":"tool_use","name":"Skill","input":{"skill":"publishing:npm-release"}}',
    '{"type":"tool_use","name":"Skill","input":{"skill":"npm-release","args":"1.2.0"}}',
    '{"content":"<command-name>/publishing:npm-release</command-name>"}',
    '{"content":"we should use publishing:npm-release and publishing:devto-article"}',
  ].join('\n');
  assert.deepStrictEqual(r.countSkillUse(text, ['publishing:npm-release', 'publishing:devto-article']), { 'publishing:npm-release': 3, 'publishing:devto-article': 0 });
});

test('skill status and project labels', () => {
  const now = Date.parse('2026-11-30');
  assert.strictEqual(r.skillStatus(2, true, '2026-10-01', now), 'used');
  assert.match(r.skillStatus(0, false, '2026-10-01', now), /^plugin not enabled/);
  assert.match(r.skillStatus(0, true, '2026-11-25', now), /^new/);
  assert.match(r.skillStatus(0, true, '2026-10-01', now), /^never invoked/);
  assert.strictEqual(r.projectLabel('-Users-someone-projects-my-tool', null), 'my-tool');
  assert.strictEqual(r.projectLabel('-home-someone-work', null), 'work');
  assert.strictEqual(r.projectLabel('-x', '/tmp/a/my-tool'), 'my-tool');
});

test('full scan on a throwaway projects folder, kit and settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-'));
  const projA = path.join(root, 'work', 'tool-a');
  write(projA, { 'CLAUDE.md': '# Project rules\n\n- README.md is the npm page: keep it short, details go to docs.\n' });
  const kit = write(path.join(root, 'kit'), {
    '.claude-plugin/marketplace.json': { name: 'claude-kit', plugins: [{ name: 'guard', source: './plugins/guard' }, { name: 'docs', source: './plugins/docs' }] },
    'plugins/guard/hooks/hooks.json': { hooks: { PreToolUse: [{ matcher: 'Bash' }] } },
    'plugins/guard/README.md': '| Rule | Effect |\n| --- | --- |\n| `git commit` on the main branch | Denied: create a branch first |\n',
    'plugins/docs/skills/write/SKILL.md': '---\nname: write\ndescription: Use when writing docs.\n---\n- Keep one rules file, rewritten in place; old versions live in git.\n',
  });
  const projects = write(path.join(root, 'projects'), {
    '-Users-someone-work-tool-a/s1.jsonl': `{"cwd":"${projA}"}\n{"type":"tool_use","name":"Skill","input":{"skill":"docs:write"}}\n`,
    '-Users-someone-work-tool-a/memory/MEMORY.md': '- [Branch](branch.md) — x\n- [Readme](readme.md) — y\n- [Gone](gone.md) — z\n',
    '-Users-someone-work-tool-a/memory/branch.md': mem('branch-never-main', 'feedback', 'Never commit on the main branch; create a branch first',
      'On 2026-10-14 two commits went to main. On 2026-10-15 a third commit landed on main again.\n**Why:** x'),
    '-Users-someone-work-tool-a/memory/readme.md': mem('readme-npm', 'feedback', 'README.md is the npm page, keep it short', 'Said 2026-10-21.'),
    '-Users-someone-work-tool-a/memory/state.md': mem('status', 'project', 'Stage 3 done', 'facts'),
    '-Users-someone-work-tool-b/memory/MEMORY.md': '- [Rules](rules.md) — x\n',
    '-Users-someone-work-tool-b/memory/rules.md': mem('single-rules-file', 'feedback', 'Keep one rules file rewritten in place, no v2 v3 versions', 'Said 2026-10-23.'),
    '-Users-someone-work-tool-b/memory/health.md': mem('health-check-first', 'feedback', 'Deprecation and longevity check before choosing a technology', 'Said 2026-10-22.'),
  });
  const userRules = write(path.join(root, 'user'), { 'CLAUDE.md': '- Before a heavy task, give an estimate.\n' });
  const settings = write(path.join(root, 'settings'), { 'settings.json': { enabledPlugins: { 'docs@claude-kit': true } } });

  const res = r.scan({ projects, only: [], userRules: path.join(userRules, 'CLAUDE.md'), kit, settings: path.join(settings, 'settings.json'), since: null, transcripts: true });
  assert.deepStrictEqual(res.projects, ['tool-a', 'work-tool-b']);
  const by = Object.fromEntries(res.feedback.map((f) => [f.file, f]));
  assert.deepStrictEqual(Object.keys(by).sort(), ['branch.md', 'health.md', 'readme.md', 'rules.md'], 'project memories are not rules');
  assert.match(by['branch.md'].suggestion, /^hook exists/);
  assert.strictEqual(by['branch.md'].layers.hook.label, 'guard');
  assert.match(by['readme.md'].suggestion, /^covered/);
  assert.strictEqual(by['readme.md'].layers.rules.label, 'tool-a/CLAUDE.md');
  assert.strictEqual(by['rules.md'].layers.skill.label, 'docs:write');
  assert.match(by['health.md'].suggestion, /^missing rule —/);
  assert.deepStrictEqual(res.index, [
    { project: 'tool-a', missing: ['gone.md'], unindexed: ['state.md'] },
    { project: 'work-tool-b', missing: [], unindexed: ['health.md'] },
  ]);
  assert.deepStrictEqual(res.skillUse.map((s) => [s.skill, s.count, s.enabled]), [['docs:write', 1, true]]);

  const only = r.scan({ projects, only: ['tool-b'], userRules: '/none', kit, settings: '/none', since: null, transcripts: false });
  assert.deepStrictEqual(only.projects, ['work-tool-b']);
  assert.strictEqual(only.skillUse, null);

  const cli = spawnSync(process.execPath, [SCRIPT, '--projects', projects, '--kit', kit, '--user-rules', path.join(userRules, 'CLAUDE.md'), '--settings', path.join(settings, 'settings.json')], { encoding: 'utf8' });
  assert.strictEqual(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /tool-a\/branch\.md — Never commit on the main branch/);
  assert.match(cli.stdout, /→ hook exists/);
  assert.match(cli.stdout, /tool-a: MEMORY\.md links missing files: gone\.md/);
  assert.match(cli.stdout, /1 {2}docs:write — used/);
  assert.doesNotMatch(cli.stdout, /someone/, 'the user name in folder names is never printed');
  const json = JSON.parse(spawnSync(process.execPath, [SCRIPT, '--projects', projects, '--kit', kit, '--no-transcripts', '--json'], { encoding: 'utf8' }).stdout);
  assert.strictEqual(json.feedback.length, 4);
  assert.strictEqual(spawnSync(process.execPath, [SCRIPT, '--bogus'], { encoding: 'utf8' }).status, 2);
});
