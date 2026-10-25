// Run from the repository root: node --test
// Unit cases call decide(); CLI cases feed the hook a PreToolUse payload through stdin and check the exit code
// (0 = allowed, 2 = blocked) and the JSON on stdout.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const GUARD = path.join(__dirname, '..', 'scripts', 'guard.js');
const g = require(GUARD);

const bash = (command) => g.decide('Bash', { command }).decision;

test('registry writes are denied for every package manager', () => {
  for (const c of [
    'npm publish',
    'npm publish --access public',
    'cd pkg && npm publish',
    'npm --prefix pkg publish',
    'pnpm publish --no-git-checks',
    'pnpm -C pkg publish',
    'yarn publish',
    'yarn npm publish',
    'bun publish',
    'npm unpublish my-pkg@1.0.1',
    'npm deprecate my-pkg@1.0.0 "use 1.0.1"',
    'npm dist-tag add my-pkg@1.2.0 latest',
    'npm dist-tag rm my-pkg beta',
    'npm owner add someone my-pkg',
    'npm access set status=public my-pkg',
    'yarn npm tag add my-pkg@1.0.0 latest',
  ]) assert.strictEqual(bash(c), 'deny', c);
});

test('release tools that publish are denied', () => {
  for (const c of ['npx np', 'npx np@10 patch', 'npx release-it', 'npx semantic-release', 'np minor', 'pnpm dlx release-it', 'npm exec np', 'npx lerna publish', 'npx changeset publish'])
    assert.strictEqual(bash(c), 'deny', c);
});

test('the deny reason tells Claude to hand the command to the user', () => {
  const r = g.decide('Bash', { command: 'npm publish' });
  assert.match(r.reasons[0], /only the user runs/);
  assert.match(r.reasons[0], /! npm publish/);
});

test('dry runs and read-only npm commands pass', () => {
  for (const c of ['npm publish --dry-run', 'npm pack --dry-run --json', 'npm view my-pkg version', 'npm view my-pkg readme', 'npm dist-tag ls my-pkg', 'npm owner ls my-pkg', 'npm version patch --no-git-tag-version', 'npm test', 'npx changeset version', 'npx my-tool ./tests'])
    assert.strictEqual(bash(c), 'allow', c);
});

test('publish in quoted text, commit messages and heredocs is not a publish', () => {
  assert.strictEqual(bash('git commit -m "after the merge the user runs npm publish"'), 'allow');
  assert.strictEqual(bash('gh pr create --body "After merge: npm publish (user)"'), 'allow');
  assert.strictEqual(bash('cat > notes.md <<EOF\nnpm publish\nEOF'), 'allow');
  assert.strictEqual(bash('grep -rn "npm publish" docs/'), 'allow');
  assert.strictEqual(bash('bash -c "npm publish"'), 'deny', 'bash -c is parsed');
});

test('GitHub releases and tag pushes ask', () => {
  for (const c of ['gh release create v1.2.0 --title v1.2.0 --notes-file notes.md', 'gh release edit v1.2.0 --draft=false', 'gh release delete v1.0.0', 'gh release upload v1.0.0 a.tgz', 'git push origin v1.2.0', 'git push origin --tags', 'git push --follow-tags', 'git push origin refs/tags/v1.2.0', 'git push origin HEAD:refs/tags/v1', 'git push origin :v1.0.0', 'git push origin tag v2.0.0', 'git -C repo push origin v1.0.0'])
    assert.strictEqual(bash(c), 'ask', c);
  for (const c of ['gh release list', 'gh release view v1.2.0', 'git push -u origin feat/x', 'git push origin main', 'git tag -a v1.2.0 -m v1.2.0', 'git push origin release/1.2.0'])
    assert.strictEqual(bash(c), 'allow', c);
});

test('repo settings and GitHub Pages changes ask; reads pass', () => {
  assert.strictEqual(bash('gh repo edit --homepage https://example.github.io/tool/'), 'ask');
  assert.strictEqual(bash('gh api -X POST repos/o/r/pages -f build_type=workflow'), 'ask');
  assert.strictEqual(bash('gh api repos/o/r/pages -f build_type=workflow'), 'ask', 'fields imply POST');
  assert.strictEqual(bash('gh api --method PUT repos/o/r/pages --input p.json'), 'ask');
  assert.strictEqual(bash('gh api repos/o/r/pages'), 'allow');
  assert.strictEqual(bash('gh api repos/o/r/pages/builds/latest'), 'allow');
  assert.strictEqual(bash('gh repo view --json homepageUrl'), 'allow');
});

test('writes to the dev.to API ask; reads pass', () => {
  for (const c of [
    'curl -X POST https://dev.to/api/articles -H "api-key: $DEVTO_KEY" -d @article.json',
    'curl -s https://dev.to/api/articles --data-binary @a.json',
    'curl --request PUT https://dev.to/api/articles/123 --json @a.json',
    'http POST https://dev.to/api/articles api-key:$K < a.json',
  ]) assert.strictEqual(bash(c), 'ask', c);
  assert.strictEqual(bash('curl -s https://dev.to/api/articles/me/published -H "api-key: $K"'), 'allow');
  assert.strictEqual(bash('curl -s https://dev.to/api/articles?username=someone'), 'allow');
  assert.strictEqual(bash('curl -X POST https://example.com/api/articles -d x'), 'allow', 'only dev.to');
});

test('deny wins over ask in one command line', () => {
  assert.strictEqual(bash('gh release create v1.0.0 --notes x && npm publish'), 'deny');
});

test('other tools pass', () => {
  assert.strictEqual(g.decide('Read', { file_path: 'package.json' }).decision, 'allow');
  assert.strictEqual(g.decide('Bash', {}).decision, 'allow');
});

function run(payload) {
  return spawnSync(process.execPath, [GUARD], { input: JSON.stringify(payload), encoding: 'utf8', env: { PATH: process.env.PATH } });
}

test('cli: deny is exit 2 with the reason on stderr', () => {
  const r = run({ tool_name: 'Bash', tool_input: { command: 'npm publish' } });
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /^publishing: `npm publish` blocked/);
});

test('cli: ask is JSON with permissionDecision ask', () => {
  const r = run({ tool_name: 'Bash', tool_input: { command: 'gh release create v1.0.0 --notes x' } });
  assert.strictEqual(r.status, 0);
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.strictEqual(out.permissionDecision, 'ask');
  assert.match(out.permissionDecisionReason, /gh release create/);
});

test('cli: allow is silent; broken input fails open', () => {
  const r = run({ tool_name: 'Bash', tool_input: { command: 'npm pack --dry-run' } });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  const b = spawnSync(process.execPath, [GUARD], { input: '{not json', encoding: 'utf8' });
  assert.strictEqual(b.status, 0);
  assert.match(b.stderr, /internal error, command allowed/);
});

test('gh workflow run asks; a package.json script that publishes is denied', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  assert.strictEqual(bash('gh workflow run release.yml'), 'ask');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-script-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { release: 'npm test && npm publish', test: 'node --test', ship: 'timeout 60 npm publish --dry-run' } }));
  const at = (command) => g.decide('Bash', { command }, dir).decision;
  assert.strictEqual(at('npm run release'), 'deny');
  assert.strictEqual(at('yarn release'), 'deny');
  assert.strictEqual(at('pnpm run release'), 'deny');
  assert.strictEqual(at('npm run test'), 'allow');
  assert.strictEqual(at('npm run ship'), 'allow');
  assert.strictEqual(at('npm run missing'), 'allow');
  assert.strictEqual(g.decide('Bash', { command: 'npm run release' }, path.join(dir, 'nowhere')).decision, 'allow');
});
