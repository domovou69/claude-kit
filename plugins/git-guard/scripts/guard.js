#!/usr/bin/env node
// git-guard: PreToolUse hook for the Bash tool.
// Blocks `git commit` and `git push` on main/master (exit 2, reason on stderr).
// Exceptions: the first commit of a repository with no commits yet, and the
// first push of a branch the remote does not have yet that holds exactly one commit.
// No dependencies; any internal error fails open (exit 0) so the guard never wedges a session.

'use strict';

const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const PROTECTED = new Set(['main', 'master']);

// ---------------------------------------------------------------- shell parsing

// shell-parse.js is a copy of shared/shell-parse.js (node scripts/sync-shared.js); do not edit it here.
const { parseCommands, expand } = require('./shell-parse');

// ---------------------------------------------------------------- git state

function git(dir, args) {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', timeout: 20000 });
  return { code: r.status, out: (r.stdout || '').trim() };
}

function topLevel(dir) {
  const r = git(dir, ['rev-parse', '--show-toplevel']);
  return r.code === 0 ? r.out : null;
}

function hasHead(dir) {
  return git(dir, ['rev-parse', '-q', '--verify', 'HEAD']).code === 0;
}

function localBranchExists(dir, name) {
  return git(dir, ['show-ref', '--verify', '-q', `refs/heads/${name}`]).code === 0;
}

// ---------------------------------------------------------------- checks

const BRANCH_FIRST = 'Create a branch first: git switch -c <topic>';

function commitMessage(branch) {
  return `git-guard: \`git commit\` on "${branch}" is blocked. ${BRANCH_FIRST}, commit there and open a PR. ` +
    `(A commit on ${branch} is allowed only as the very first commit of a new repository.)`;
}

function pushMessage(target, reason) {
  return `git-guard: \`git push\` to "${target}" is blocked (${reason}). ${BRANCH_FIRST}, push that branch and open a PR. ` +
    `(A push to ${target} is allowed only as the first push of a new repository: the remote has no "${target}" yet and it holds exactly one commit.)`;
}

function stripHeads(ref) {
  return ref.replace(/^refs\/heads\//, '');
}

// Simple commands in order (bash -c and eval bodies right after their command), so `cd` and
// `git switch -c` earlier in the line are seen before a later commit or push.
function analyze(command, state) {
  for (const cmd of expand(command)) {
    const msg = analyzeOne(cmd.words, state);
    if (msg) return msg;
  }
  return null;
}

function analyzeOne(w, state) {
  if (!w.length) return null;
  const base = path.basename(w[0]);

  if ((base === 'cd' || base === 'pushd') && w[1] && w[1] !== '-') {
    state.cwd = path.resolve(state.cwd, w[1].replace(/^~(?=$|\/)/, os.homedir()));
    return null;
  }

  if (base !== 'git') return null;

  // Global options before the subcommand.
  let dir = state.cwd;
  let k = 1;
  while (k < w.length && w[k].startsWith('-')) {
    const opt = w[k];
    if (opt === '-C') { dir = path.resolve(dir, w[k + 1] ?? '.'); k += 2; }
    else if (opt === '-c' || opt === '--git-dir' || opt === '--work-tree' || opt === '--namespace') k += 2;
    else k++;
  }
  const sub = w[k];
  const args = w.slice(k + 1);
  const top = topLevel(dir);
  if (!top) return null;

  const current = () => {
    if (state.branch.has(top)) return state.branch.get(top);
    const r = git(dir, ['symbolic-ref', '--short', '-q', 'HEAD']);
    return r.code === 0 ? r.out : null;
  };

  if (sub === 'switch' || sub === 'checkout') {
    const createFlags = sub === 'switch' ? ['-c', '-C', '--create', '--force-create'] : ['-b', '-B'];
    const f = args.findIndex((a) => createFlags.includes(a));
    if (f >= 0 && args[f + 1]) state.branch.set(top, args[f + 1]);
    else {
      const target = args.find((a) => !a.startsWith('-'));
      if (target && localBranchExists(dir, target)) state.branch.set(top, target);
    }
    return null;
  }

  if (sub === 'commit') {
    if (!hasHead(dir) && !state.branch.has(top)) { state.firstCommit.add(top); return null; }
    const b = current();
    return b && PROTECTED.has(b) ? commitMessage(b) : null;
  }

  if (sub === 'push') return checkPush(dir, args, current(), state.firstCommit.has(top));

  return null;
}

// firstCommit: the same command makes the first commit of this repository before pushing.
function checkPush(dir, args, cur, firstCommit) {
  const valued = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);
  const positional = [];
  let all = false;
  let tags = false;
  let repo = null;
  for (let n = 0; n < args.length; n++) {
    const a = args[n];
    if (a === '--') { positional.push(...args.slice(n + 1)); break; }
    if (valued.has(a)) { if (a === '--repo') repo = args[n + 1]; n++; continue; }
    if (a.startsWith('--repo=')) { repo = a.slice(7); continue; }
    if (a === '--all' || a === '--mirror' || a === '--branches') { all = true; continue; }
    if (a === '--tags') { tags = true; continue; }
    if (a.startsWith('-')) continue;
    positional.push(a);
  }

  const upstream = cur ? git(dir, ['config', `branch.${cur}.remote`]).out : '';
  const remote = positional[0] || repo || upstream || 'origin';
  const refspecs = positional.slice(1);

  // Each pair: [local source ref or null, remote branch name].
  const pairs = [];
  if (refspecs.length) {
    for (const spec of refspecs) {
      const s = spec.replace(/^\+/, '');
      const [src, dst] = s.includes(':') ? s.split(':', 2) : [s, s];
      const resolve = (r) => stripHeads(r === 'HEAD' ? (cur ?? 'HEAD') : r);
      pairs.push([src ? resolve(src) : null, resolve(dst || src)]);
    }
  } else if (all) {
    for (const b of PROTECTED) if (localBranchExists(dir, b)) pairs.push([b, b]);
  } else if (!tags && cur) {
    pairs.push([cur, cur]);
  }

  for (const [src, dst] of pairs) {
    if (!PROTECTED.has(dst)) continue;
    if (!src) return pushMessage(dst, 'it deletes the branch on the remote');
    const ls = git(dir, ['ls-remote', '--exit-code', '--heads', remote, `refs/heads/${dst}`]);
    if (ls.code === 0) return pushMessage(dst, `"${remote}" already has "${dst}"`);
    if (ls.code !== 2) return pushMessage(dst, `could not check "${remote}"`);
    const count = firstCommit && !hasHead(dir) ? { code: 0, out: '1' } : git(dir, ['rev-list', '--count', src]);
    if (count.code !== 0 || count.out !== '1') {
      return pushMessage(dst, `"${src}" holds ${count.code === 0 ? count.out : 'no'} commits, not exactly one`);
    }
  }
  return null;
}

// ---------------------------------------------------------------- entry point

function main() {
  let input;
  try {
    input = JSON.parse(require('node:fs').readFileSync(0, 'utf8') || '{}');
  } catch {
    return 0;
  }
  const command = input?.tool_input?.command;
  if (input?.tool_name && input.tool_name !== 'Bash') return 0;
  if (typeof command !== 'string' || !/\bgit\b/.test(command)) return 0;

  const state = { cwd: input.cwd || process.cwd(), branch: new Map(), firstCommit: new Set() };
  const msg = analyze(command, state);
  if (!msg) return 0;
  process.stderr.write(msg + '\n');
  return 2;
}

if (require.main === module) {
  let code = 0;
  try {
    code = main();
  } catch (e) {
    process.stderr.write(`git-guard: internal error, command allowed: ${e && e.message}\n`);
    code = 0;
  }
  process.exit(code);
}

module.exports = { parseCommands };
