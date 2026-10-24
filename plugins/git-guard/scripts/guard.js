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
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
const WRAPPERS = new Set(['command', 'builtin', 'exec', 'nohup', 'time', 'sudo', 'nice', 'xargs']);

// ---------------------------------------------------------------- shell parsing

// Splits a shell command line into simple commands (arrays of words).
// Handles quotes, escapes, ; && || | & newlines, ( ) and { } groups,
// $( ) and backtick substitutions (their commands are listed before the
// command that contains them) and heredocs (bodies are skipped).
function parseCommands(src) {
  const out = [];
  let i = 0;

  function list(stop) {
    let words = [];
    let word = null;
    let dropNext = false;
    const heredocs = [];

    const add = (s) => { word = (word ?? '') + s; };
    const endWord = () => {
      if (word === null) return;
      if (dropNext) dropNext = false;
      else words.push(word);
      word = null;
    };
    const endCmd = () => {
      endWord();
      if (words.length) out.push(words);
      words = [];
    };
    const skipHeredocs = () => {
      while (heredocs.length) {
        const delim = heredocs.shift();
        while (i < src.length) {
          let nl = src.indexOf('\n', i);
          if (nl < 0) nl = src.length;
          const line = src.slice(i, nl);
          i = nl + 1;
          if (line.trim() === delim) break;
        }
      }
    };
    const substitution = (close) => {
      list(close);
      add('$()');
    };

    while (i < src.length) {
      const c = src[i];
      if (c === stop) { i++; endCmd(); return; }
      if (c === '\\') {
        if (src[i + 1] !== '\n') add(src[i + 1] ?? '');
        i += 2;
      } else if (c === "'") {
        const j = src.indexOf("'", i + 1);
        const end = j < 0 ? src.length : j;
        add(src.slice(i + 1, end));
        i = end + 1;
      } else if (c === '"') {
        add('');
        i++;
        while (i < src.length && src[i] !== '"') {
          if (src[i] === '\\' && '"\\$`\n'.includes(src[i + 1])) { add(src[i + 1]); i += 2; }
          else if (src[i] === '$' && src[i + 1] === '(') { i += 2; substitution(')'); }
          else if (src[i] === '`') { i++; substitution('`'); }
          else { add(src[i]); i++; }
        }
        i++;
      } else if (c === '$' && src[i + 1] === '(') {
        i += 2;
        substitution(')');
      } else if (c === '`') {
        i++;
        substitution('`');
      } else if (c === '#' && word === null) {
        while (i < src.length && src[i] !== '\n') i++;
      } else if (c === '\n') {
        endCmd();
        i++;
        skipHeredocs();
      } else if (c === ' ' || c === '\t') {
        endWord();
        i++;
      } else if (c === '(' || ((c === '{' || c === '}') && word === null)) {
        endCmd();
        i++;
        if (c === '(') list(')');
      } else if (';&|)'.includes(c)) {
        endCmd();
        i++;
      } else if (c === '<' && src[i + 1] === '<' && src[i + 2] !== '<') {
        endWord();
        i += 2;
        if (src[i] === '-') i++;
        while (src[i] === ' ' || src[i] === '\t') i++;
        let delim = '';
        while (i < src.length && !' \t\n;&|<>()'.includes(src[i])) {
          if (src[i] !== "'" && src[i] !== '"' && src[i] !== '\\') delim += src[i];
          i++;
        }
        heredocs.push(delim);
      } else if (c === '<' || c === '>') {
        if (word !== null && /^\d+$/.test(word)) word = null;
        endWord();
        i++;
        while (src[i] === '<' || src[i] === '>' || src[i] === '&' || src[i] === '|') i++;
        if (/\d/.test(src[i] ?? '') && !/\S/.test(src[i + 1] ?? '')) i++;
        else dropNext = true;
      } else {
        add(c);
        i++;
      }
    }
    endCmd();
  }

  list(null);
  return out;
}

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

function analyze(cmds, state) {
  for (const raw of cmds) {
    const msg = analyzeOne(raw, state);
    if (msg) return msg;
  }
  return null;
}

function analyzeOne(raw, state) {
  let w = raw.slice();
  // Leading assignments and wrappers: FOO=1 sudo env -i git commit ...
  for (;;) {
    if (!w.length) return null;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0])) { w.shift(); continue; }
    const base = path.basename(w[0]);
    if (WRAPPERS.has(base)) { w.shift(); while (w.length && w[0].startsWith('-')) w.shift(); continue; }
    if (base === 'env') {
      w.shift();
      while (w.length && (w[0].startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0]))) w.shift();
      continue;
    }
    break;
  }

  const base = path.basename(w[0]);

  if (SHELLS.has(base)) {
    const k = w.findIndex((a, n) => n > 0 && /^-[a-z]*c[a-z]*$/.test(a));
    if (k > 0 && w[k + 1] !== undefined) return analyze(parseCommands(w[k + 1]), state);
    return null;
  }
  if (base === 'eval') return analyze(parseCommands(w.slice(1).join(' ')), state);

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
  const msg = analyze(parseCommands(command), state);
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
