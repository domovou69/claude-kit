// Run from the repository root: node --test
// Each case builds throwaway repositories in the OS temp dir, feeds the hook a
// PreToolUse payload and checks the exit code (0 = allowed, 2 = blocked).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const GUARD = path.join(__dirname, '..', 'scripts', 'guard.js');
const ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.com',
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-guard-'));
test.after(() => fs.rmSync(root, { recursive: true, force: true }));
let seq = 0;

function sh(dir, ...args) {
  return execFileSync('git', args, { cwd: dir, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

// Repository states used by the cases.
// commits: commits on the initial branch; branch: initial branch name;
// remote: 'none' | 'empty' (bare, no branches) | 'has-main' (bare with the branch pushed);
// switchTo: create and switch to this branch at the end; detach: detached HEAD.
function repo({ commits = 0, branch = 'main', remote = 'none', switchTo, detach } = {}) {
  const dir = path.join(root, `r${++seq}`);
  fs.mkdirSync(dir);
  sh(dir, 'init', '-q', '-b', branch);
  for (let n = 0; n < commits; n++) sh(dir, 'commit', '-q', '--allow-empty', '-m', `c${n}`);
  if (remote !== 'none') {
    const bare = `${dir}.git`;
    execFileSync('git', ['init', '-q', '--bare', bare], { env: ENV });
    sh(dir, 'remote', 'add', 'origin', bare);
    if (remote === 'has-main') sh(dir, 'push', '-q', 'origin', branch);
  }
  if (switchTo) sh(dir, 'switch', '-q', '-c', switchTo);
  if (detach) sh(dir, 'switch', '-q', '--detach');
  return dir;
}

function run(command, cwd, extra = {}) {
  const payload = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd, ...extra };
  const r = spawnSync(process.execPath, [GUARD], { input: JSON.stringify(payload), env: ENV, encoding: 'utf8' });
  return { code: r.status, stderr: r.stderr };
}

function expect(name, state, command, code) {
  test(`${code === 2 ? 'blocks' : 'allows'}: ${name}`, () => {
    const dir = typeof state === 'function' ? state() : repo(state);
    const cmd = command.replaceAll('$REPO', dir);
    const r = run(cmd, dir);
    assert.strictEqual(r.code, code, `command: ${cmd}\nstderr: ${r.stderr}`);
    if (code === 2) assert.match(r.stderr, /git switch -c <topic>/);
  });
}

const onMain = { commits: 1 };
const onFeature = { commits: 1, switchTo: 'topic' };

// ---- exception 1: first commit of a new repository
expect('first commit on main in an empty repo', {}, 'git commit -m init', 0);
expect('first commit chained after git add', {}, 'git add -A && git commit -m init', 0);
expect('second commit on main', onMain, 'git commit -m second', 2);
expect('commit with a quoted git word', onMain, "g'i't commit -m x", 2);
expect('commit with an escaped git word', onMain, 'g\\it commit -m x', 2);
expect('commit on master', { commits: 1, branch: 'master' }, 'git commit -m x', 2);
expect('commit --amend on main', onMain, 'git commit --amend --no-edit', 2);

// ---- feature branches and other commands
expect('commit on a feature branch', onFeature, 'git commit -m x', 0);
expect('push of a feature branch', { commits: 1, remote: 'has-main', switchTo: 'topic' }, 'git push -u origin topic', 0);
expect('push HEAD from a feature branch', { commits: 1, remote: 'has-main', switchTo: 'topic' }, 'git push -u origin HEAD', 0);
expect('git status on main', onMain, 'git status && git log --oneline', 0);
expect('commit in detached HEAD', { commits: 1, detach: true }, 'git commit -m x', 0);
expect('commit outside a repository', () => fs.mkdtempSync(path.join(root, 'plain-')), 'git commit -m x', 0);
expect('non-git command mentioning git', onMain, 'echo "git commit -m x"', 0);
expect('commit message mentioning git push on a feature branch', { commits: 1, remote: 'has-main', switchTo: 'topic' },
  'git commit -m "docs: explain git push origin main"', 0);

// ---- chains, subshells, wrappers
expect('chain with &&', onMain, 'git add . && git commit -m x', 2);
expect('chain with ;', onMain, 'echo hi; git commit -m x', 2);
expect('chain with ||', onMain, 'false || git commit -m x', 2);
expect('pipe', onMain, 'git commit -m x | tee log.txt', 2);
expect('subshell', onMain, '(git commit -m x)', 2);
expect('brace group', onMain, '{ git commit -m x; }', 2);
expect('command substitution', onMain, 'echo $(git commit -m x)', 2);
expect('substitution inside double quotes', onMain, 'echo "result: $(git commit -m x)"', 2);
expect('backticks', onMain, 'echo `git commit -m x`', 2);
expect('bash -c', onMain, 'bash -c "git add . && git commit -m x"', 2);
expect('env assignment prefix', onMain, 'GIT_EDITOR=true git commit -m x', 2);
expect('git -c option before subcommand', onMain, 'git -c user.name=x commit -m x', 2);
expect('absolute git path', onMain, '/usr/bin/git commit -m x', 2);
expect('redirections', onMain, 'git commit -m x > /dev/null 2>&1', 2);
expect('heredoc commit message', onMain,
  "git commit -F - <<'EOF'\nfix: thing (don't care)\nEOF", 2);
expect('heredoc body mentioning git push on a feature branch', { commits: 1, remote: 'has-main', switchTo: 'topic' },
  "git commit -m \"$(cat <<'EOF'\nfix: it's done (see git push origin main)\nEOF\n)\"", 0);
expect('branch check pattern on a feature branch', onFeature,
  '[ "$(git branch --show-current)" = "topic" ] && git commit -m x', 0);

// ---- directory changes inside the command
expect('git -C into a repo on main', () => { repo(); return repo(onMain); }, 'git -C $REPO commit -m x', 2);
test('blocks: cd into a repo on main from elsewhere', () => {
  const dir = repo(onMain);
  const r = run(`cd ${dir} && git commit -m x`, os.tmpdir());
  assert.strictEqual(r.code, 2, r.stderr);
});
test('allows: cd into a repo on a feature branch from elsewhere', () => {
  const dir = repo(onFeature);
  const r = run(`cd ${dir} && git commit -m x`, os.tmpdir());
  assert.strictEqual(r.code, 0, r.stderr);
});

// ---- branch switches inside the command
expect('switch -c then commit on main', onMain, 'git switch -c topic && git commit -m x', 0);
expect('checkout -b then commit on main', onMain, 'git checkout -b topic && git commit -m x', 0);
expect('switch to main then commit', onFeature, 'git switch main && git commit -m x', 2);

// ---- exception 2: first push of a new repository
expect('first push: remote has no main, one commit', { commits: 1, remote: 'empty' }, 'git push -u origin main', 0);
expect('first push without arguments', { commits: 1, remote: 'empty' }, 'git push', 0);
expect('first commit and first push in one command', { remote: 'empty' },
  'git add -A && git commit -m init && git push -u origin main', 0);
expect('push to main when remote already has main', { commits: 1, remote: 'has-main' }, 'git push origin main', 2);
expect('push to main with two local commits', { commits: 2, remote: 'empty' }, 'git push -u origin main', 2);
expect('plain git push on main with remote main', { commits: 1, remote: 'has-main' }, 'git push', 2);
expect('force push to main', { commits: 1, remote: 'has-main' }, 'git push --force origin main', 2);
expect('push HEAD:main from a feature branch', { commits: 1, remote: 'has-main', switchTo: 'topic' },
  'git push origin HEAD:main', 2);
expect('push topic:main', { commits: 1, remote: 'has-main', switchTo: 'topic' }, 'git push origin topic:refs/heads/main', 2);
expect('push --all with remote main', { commits: 1, remote: 'has-main' }, 'git push --all origin', 2);
expect('delete remote main', { commits: 1, remote: 'has-main', switchTo: 'topic' }, 'git push origin :main', 2);
expect('push with unreachable remote', onMain, 'git push /nonexistent/remote.git main', 2);
expect('push of a feature branch while on main', { commits: 1, remote: 'has-main' },
  'git branch topic && git push origin topic', 0);

// ---- payloads that are not Bash git commands
test('allows: other tools and empty payloads', () => {
  const dir = repo(onMain);
  assert.strictEqual(run('git commit -m x', dir, { tool_name: 'Write' }).code, 0);
  const r = spawnSync(process.execPath, [GUARD], { input: 'not json', encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
});
