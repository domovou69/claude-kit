// Shell command parser shared by the kit's hook guards. Each plugin installs on its own, so every plugin with a
// guard carries a byte-identical copy in its scripts/ folder. This file is the source: edit it here, then run
// `node scripts/sync-shared.js` from the repository root; `node --test` fails while a copy differs.
// No dependencies.

'use strict';

const path = require('node:path');

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'fi', 'do', 'done', 'while', 'until', '!', '{', '}', 'time']);
// Wrappers that run the rest of the line as a command, and their flags that take a value.
const WRAPPERS = {
  command: [], builtin: [], exec: ['-a'], nohup: [], time: ['-o', '-f'], xargs: ['-I', '-L', '-n', '-P', '-s', '-d', '-E'],
  sudo: ['-u', '-g', '-p', '-C', '-D', '-h', '-r', '-t', '-U', '-T'], doas: ['-u', '-C'],
  nice: ['-n'], env: ['-u', '-C', '--unset', '--chdir'], caffeinate: ['-w', '-t'],
  timeout: ['-s', '-k', '--signal', '--kill-after'], gtimeout: ['-s', '-k', '--signal', '--kill-after'],
  stdbuf: ['-i', '-o', '-e'], ionice: ['-c', '-n', '-p'], chronic: [], unbuffer: [],
};
// Wrappers whose first plain argument is not the command (timeout 10 npm publish).
const LEADING_ARG = new Set(['timeout', 'gtimeout']);

// Splits a shell command line into simple commands (arrays of words).
// Handles quotes, escapes, ; && || | & newlines, comments, ( ) and { } groups, $( ) and backtick substitutions,
// also inside double quotes (their commands are listed before the command that contains them, which gets the
// placeholder `$()` instead), redirections (their targets are dropped) and heredocs (bodies are skipped).
function parseCommands(src) {
  const out = [];
  let i = 0;

  function list(stop) {
    let words = [];
    let word = null;
    let drop = false;
    const heredocs = [];

    const add = (s) => { word = (word ?? '') + s; };
    const endWord = () => {
      if (word === null) return;
      if (drop) drop = false;
      else words.push(word);
      word = null;
    };
    const endCmd = () => {
      endWord();
      drop = false;
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
      } else if (c === '<' || c === '>' || (c === '&' && src[i + 1] === '>')) {
        if (word !== null && /^\d+$/.test(word)) word = null; // a file descriptor number, not an argument
        else endWord();
        while (i < src.length && '<>&|'.includes(src[i])) i++;
        if (/\d/.test(src[i] ?? '') && !/\S/.test(src[i + 1] ?? '')) i++; // 2>&1
        else drop = true; // the redirection target
      } else if (c === '(' || ((c === '{' || c === '}') && word === null)) {
        endCmd();
        i++;
        if (c === '(') list(')');
      } else if (';&|)'.includes(c)) {
        endCmd();
        i++;
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

// Strips keywords, VAR=value prefixes and wrappers (sudo, env, nohup, timeout, caffeinate, …) from a simple command.
// Returns { env: the VAR=value prefixes, caffeinate: whether caffeinate wraps it, words }.
function unwrap(raw) {
  const env = {};
  let caffeinate = false;
  const w = [...raw];
  for (;;) {
    while (w.length && KEYWORDS.has(w[0])) w.shift();
    while (w.length && /^[A-Za-z_]\w*=/.test(w[0])) {
      const s = w.shift();
      env[s.slice(0, s.indexOf('='))] = s.slice(s.indexOf('=') + 1);
    }
    if (!w.length) break;
    const b = path.basename(w[0]);
    if (!Object.hasOwn(WRAPPERS, b)) break;
    if (b === 'caffeinate') caffeinate = true;
    w.shift();
    while (w.length && w[0].startsWith('-') && w[0] !== '-') {
      const f = w.shift();
      if (f === '--') break;
      if (WRAPPERS[b].includes(f) && w.length) w.shift();
    }
    if (LEADING_ARG.has(b) && w.length) w.shift();
  }
  return { env, caffeinate, words: w };
}

// All simple commands of a command line, unwrapped, in order, with `bash -c "…"` / `bash -lc "…"` and `eval "…"`
// parsed recursively right after the command that runs them.
function expand(src, depth = 0) {
  const out = [];
  for (const raw of parseCommands(src)) {
    const cmd = unwrap(raw);
    out.push(cmd);
    if (depth > 3 || !cmd.words.length) continue;
    const b = path.basename(cmd.words[0]);
    const k = cmd.words.findIndex((a, n) => n > 0 && /^-[a-z]*c[a-z]*$/.test(a));
    if (SHELLS.has(b) && k > 0 && cmd.words[k + 1] !== undefined) out.push(...expand(cmd.words[k + 1], depth + 1));
    if (b === 'eval') out.push(...expand(cmd.words.slice(1).join(' '), depth + 1));
  }
  return out;
}

module.exports = { parseCommands, unwrap, expand, SHELLS };
