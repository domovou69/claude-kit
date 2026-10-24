#!/usr/bin/env node
// llm-benchmark guard: a PreToolUse hook for the Bash and Agent tools.
// Blocks effort `max` (a `claude` run with `--effort max`, a runner script called with a model name followed by
// `max`, or an Agent call with effort max) and `claude --bare` without ANTHROPIC_API_KEY, which fails because
// --bare ignores the subscription login.
// LLM_BENCH_ALLOW_MAX=1 before a Bash command turns the max block into a question to the user.
// A block is exit 2 with the reason on stderr; an ask is JSON on stdout.
// No dependencies; any internal error fails open (exit 0) so the guard never wedges a session.
// The shell parser is the same as in mobile-test-runs; each plugin installs on its own, so it is copied.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
const WRAPPERS = new Set(['command', 'builtin', 'exec', 'nohup', 'time', 'sudo', 'nice', 'env', 'caffeinate']);
const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'fi', 'do', 'done', 'while', 'until', '!', '{', '}']);
const MODEL = /^(haiku|sonnet|opus|fable)[\w.-]*$|^claude-[\w.-]+$/i;
const BYPASS = 'LLM_BENCH_ALLOW_MAX';

// ---------------------------------------------------------------- shell parsing

// Splits a shell command line into simple commands (arrays of words). Handles quotes, escapes, ; & | && ||,
// newlines, ( ) groups, $( ) and backticks, comments, redirections (their targets are dropped) and heredocs
// (bodies are skipped). `bash -c "…"` and `eval "…"` are expanded later by expand().
function parseCommands(src) {
  const out = [];
  const heredocs = [];
  let words = [];
  let word = null;
  let drop = false;
  let i = 0;

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

  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      if (src[i + 1] !== '\n') add(src[i + 1] ?? '');
      i += 2;
    } else if (c === "'") {
      let j = src.indexOf("'", i + 1);
      if (j < 0) j = src.length;
      add(src.slice(i + 1, j));
      i = j + 1;
    } else if (c === '"') {
      let s = '';
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && '"\\$`'.includes(src[i + 1])) { s += src[i + 1]; i += 2; } else s += src[i++];
      }
      add(s);
      i++;
    } else if (c === '#' && word === null) {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '\n') {
      endCmd();
      i++;
      skipHeredocs();
    } else if (c === ' ' || c === '\t') {
      endWord();
      i++;
    } else if (c === '<' && src.startsWith('<<', i) && src[i + 2] !== '<') {
      endWord();
      i += 2;
      if (src[i] === '-') i++;
      while (src[i] === ' ' || src[i] === '\t') i++;
      let d = '';
      while (i < src.length && !/[\s;&|<>()]/.test(src[i])) {
        if (!`"'\\`.includes(src[i])) d += src[i];
        i++;
      }
      heredocs.push(d);
    } else if (c === '<' || c === '>' || (c === '&' && src[i + 1] === '>')) {
      if (word !== null && /^\d+$/.test(word)) word = null; // a file descriptor number, not an argument
      else endWord();
      while (i < src.length && '<>&|'.includes(src[i])) i++;
      drop = true; // the redirection target
    } else if (c === '$' && src[i + 1] === '(') {
      endCmd();
      i += 2;
    } else if (';&|()`'.includes(c)) {
      endCmd();
      i++;
    } else {
      add(c);
      i++;
    }
  }
  endCmd();
  return out;
}

// Strips keywords, VAR=value prefixes and wrappers from a simple command.
function unwrap(raw) {
  const env = {};
  const w = [...raw];
  for (;;) {
    while (w.length && KEYWORDS.has(w[0])) w.shift();
    while (w.length && /^[A-Za-z_]\w*=/.test(w[0])) {
      const s = w.shift();
      env[s.slice(0, s.indexOf('='))] = s.slice(s.indexOf('=') + 1);
    }
    if (!w.length || !WRAPPERS.has(path.basename(w[0]))) break;
    w.shift();
    while (w.length && w[0].startsWith('-')) {
      const f = w.shift();
      if (/^-[a-z]*[wtn]$/.test(f) && w.length && !w[0].startsWith('-')) w.shift(); // caffeinate -w <pid>, nice -n <n>
    }
  }
  return { env, words: w };
}

// All simple commands of a command line, with `bash -c "…"` and `eval "…"` parsed recursively.
function expand(src, depth = 0) {
  const out = [];
  for (const raw of parseCommands(src)) {
    const cmd = unwrap(raw);
    out.push(cmd);
    if (depth > 3 || !cmd.words.length) continue;
    const b = path.basename(cmd.words[0]);
    const c = cmd.words.indexOf('-c');
    if (SHELLS.has(b) && c > 0 && cmd.words[c + 1] !== undefined) out.push(...expand(cmd.words[c + 1], depth + 1));
    if (b === 'eval') out.push(...expand(cmd.words.slice(1).join(' '), depth + 1));
  }
  return out;
}

// ---------------------------------------------------------------- decisions

function usesMax(words) {
  for (let i = 0; i < words.length; i++) {
    if (words[i] === '--effort=max') return true;
    if (words[i] === '--effort' && words[i + 1] === 'max') return true;
    if (i > 0 && words[i] === 'max' && MODEL.test(words[i - 1])) return true; // node run.js opus max …
  }
  return false;
}

const isClaude = (words) => path.basename(words[0]) === 'claude';

// Returns { decision: 'allow' | 'ask' | 'deny', reasons: [...] }.
function decide(toolName, input, env = process.env) {
  if (toolName === 'Agent') {
    if (input.effort === 'max')
      return { decision: 'deny', reasons: ['effort max is not used: in past benchmarks it spent 80–90 % of the output on thinking for no better result, and one Opus max run used up a 5-hour usage window without finishing. Use xhigh at most.'] };
    return { decision: 'allow', reasons: [] };
  }
  if (toolName !== 'Bash') return { decision: 'allow', reasons: [] };
  const deny = [];
  const ask = [];
  for (const c of expand(input.command || '')) {
    if (!c.words.length) continue;
    const line = c.words.join(' ');
    if (usesMax(c.words)) {
      if (c.env[BYPASS] === '1') ask.push(`\`${line}\` runs a model at effort max, which can use up the 5-hour usage window.`);
      else deny.push(`effort max blocked in \`${line}\`. In past benchmarks max spent 80–90 % of the output on thinking for no better result, and one Opus max run used up a 5-hour usage window without finishing. Use xhigh at most. Only if the user explicitly asked for max, prefix the command with ${BYPASS}=1; the user will be asked to confirm.`);
    }
    if (isClaude(c.words) && c.words.includes('--bare') && !c.env.ANTHROPIC_API_KEY && !env.ANTHROPIC_API_KEY)
      deny.push(`\`claude --bare\` needs ANTHROPIC_API_KEY: it ignores the subscription login and fails without a key. For an isolated run with the login, drop --bare and use --setting-sources "" --strict-mcp-config --mcp-config '{"mcpServers":{}}' --tools Read,Write --no-session-persistence in an empty temporary folder, and write the deviation into the report.`);
  }
  if (deny.length) return { decision: 'deny', reasons: [...new Set(deny)] };
  if (ask.length) return { decision: 'ask', reasons: [...new Set(ask)] };
  return { decision: 'allow', reasons: [] };
}

// ---------------------------------------------------------------- main

function main() {
  const payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  const { decision, reasons } = decide(payload.tool_name, payload.tool_input || {});
  if (decision === 'deny') {
    process.stderr.write(reasons.map((r) => `llm-benchmark: ${r}`).join('\n') + '\n');
    return 2;
  }
  if (decision === 'ask') {
    const reason = `llm-benchmark: ${reasons.join(' ')} Allow?`;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }) + '\n');
  }
  return 0;
}

if (require.main === module) {
  let code = 0;
  try {
    code = main();
  } catch (e) {
    process.stderr.write(`llm-benchmark: internal error, command allowed: ${e.message}\n`);
    code = 0;
  }
  process.exit(code);
}

module.exports = { parseCommands, expand, usesMax, decide };
