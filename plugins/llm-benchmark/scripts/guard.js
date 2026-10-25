#!/usr/bin/env node
// llm-benchmark guard: a PreToolUse hook for the Bash and Agent tools.
// Blocks effort `max` (a `claude` run with `--effort max`, a runner script called with a model name followed by
// `max`, or an Agent call with effort max) and `claude --bare` without ANTHROPIC_API_KEY, which fails because
// --bare ignores the subscription login.
// LLM_BENCH_ALLOW_MAX=1 before a Bash command turns the max block into a question to the user.
// A block is exit 2 with the reason on stderr; an ask is JSON on stdout.
// No dependencies; any internal error fails open (exit 0) so the guard never wedges a session.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MODEL = /^(haiku|sonnet|opus|fable)[\w.-]*$|^claude-[\w.-]+$/i;
const BYPASS = 'LLM_BENCH_ALLOW_MAX';

// ---------------------------------------------------------------- shell parsing

// shell-parse.js is a copy of shared/shell-parse.js (node scripts/sync-shared.js); do not edit it here.
let parseCommands;
let expand;
try {
  ({ parseCommands, expand } = require('./shell-parse'));
} catch (e) {
  if (require.main !== module) throw e;
  process.stderr.write(`llm-benchmark: internal error, command allowed: ${e.message}\n`);
  process.exit(0);
}

// ---------------------------------------------------------------- decisions

function usesMax(words) {
  for (let i = 0; i < words.length; i++) {
    if (/^--effort=max$/i.test(words[i])) return true;
    if (words[i] === '--effort' && /^max$/i.test(words[i + 1] || '')) return true;
    if (i > 0 && /^max$/i.test(words[i]) && MODEL.test(words[i - 1])) return true; // node run.js opus max …
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
