#!/usr/bin/env node
// publishing guard: a PreToolUse hook for the Bash tool.
// Denies registry writes, which only the user runs: npm / pnpm / yarn / bun publish, unpublish, deprecate,
// dist-tag add/rm, owner add/rm, access, and release tools that publish (np, release-it, semantic-release,
// lerna publish, changeset publish). `--dry-run` publishes nothing and passes.
// Asks the user before other public release actions: gh release create/edit/delete/upload, pushing tags,
// gh repo edit, enabling or changing GitHub Pages through gh api, and writes to the dev.to API.
// A block is exit 2 with the reason on stderr; an ask is JSON on stdout.
// No dependencies; any internal error fails open (exit 0) so the guard never wedges a session.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const REGISTRY_WRITES = new Set(['publish', 'unpublish', 'deprecate', 'undeprecate', 'access']);
const SUBCOMMANDED = new Set(['dist-tag', 'dist-tags', 'owner', 'author']); // write only with add / rm
const RELEASE_TOOLS = new Set(['np', 'release-it', 'semantic-release']);
const RUNNERS = new Set(['npx', 'bunx', 'pnpx']);
const WRITE_METHODS = /^(POST|PUT|PATCH|DELETE)$/i;

// ---------------------------------------------------------------- shell parsing

// shell-parse.js is a copy of shared/shell-parse.js (node scripts/sync-shared.js); do not edit it here.
const { parseCommands, expand } = require('./shell-parse');

// ---------------------------------------------------------------- decisions

const base = (w) => path.basename(w || '');
const VALUE_FLAGS = new Set(['-C', '--prefix', '--registry', '--userconfig', '--cwd', '--dir', '-w', '--workspace', '--filter']);
// Words that are not flags, skipping the values of flags that take one (`npm --prefix x publish` → [publish]).
const positional = (words) => words.filter((w, i) => !w.startsWith('-') && !VALUE_FLAGS.has(words[i - 1]));

// `npm publish`, `yarn npm publish`, `npx np`, `pnpm dlx release-it`, `npx lerna publish`, … → a description, or null.
function registryWrite(words) {
  let w = words;
  const b = base(w[0]);
  if (RUNNERS.has(b) || ((b === 'pnpm' || b === 'yarn') && w[1] === 'dlx') || (b === 'npm' && (w[1] === 'exec' || w[1] === 'x'))) {
    w = positional(w.slice(b === 'npx' || b === 'bunx' || b === 'pnpx' ? 1 : 2)).filter((x) => x !== '--');
    if (!w.length) return null;
    w = [w[0].replace(/@[^/]*$/, ''), ...w.slice(1)]; // np@10 → np
  }
  const tool = base(w[0]);
  const args = positional(w.slice(1));
  if (words.includes('--dry-run')) return null;
  if (RELEASE_TOOLS.has(tool)) return tool;
  if ((tool === 'lerna' || tool === 'changeset') && args[0] === 'publish') return `${tool} publish`;
  if (!MANAGERS.has(tool)) return null;
  let sub = args[0];
  let rest = args.slice(1);
  if (tool === 'yarn' && sub === 'npm') { sub = rest[0]; rest = rest.slice(1); }
  if (tool === 'yarn' && sub === 'tag' && /^(add|remove|rm)$/.test(rest[0] || '')) return `${tool} tag ${rest[0]}`;
  if (REGISTRY_WRITES.has(sub)) return `${tool} ${sub}`;
  if (SUBCOMMANDED.has(sub) && /^(add|rm|remove)$/.test(rest[0] || '')) return `${tool} ${sub} ${rest[0]}`;
  return null;
}

const methodOf = (words) => {
  for (let i = 0; i < words.length; i++) {
    const m = /^(?:-X|--request|--method)=?(.*)$/.exec(words[i]);
    if (m) return (m[1] || words[i + 1] || '').toUpperCase();
  }
  return '';
};

// A public release action that the user confirms → a description, or null.
function releaseAction(words) {
  const b = base(words[0]);
  const args = positional(words.slice(1));
  if (b === 'gh') {
    if (args[0] === 'release' && /^(create|edit|delete|upload|delete-asset)$/.test(args[1] || '')) return `gh release ${args[1]}`;
    if (args[0] === 'repo' && args[1] === 'edit') return 'gh repo edit (changes the public repository settings)';
    if (args[0] === 'api' && words.some((w) => /(^|\/)pages(\/|$)/.test(w))) {
      const m = methodOf(words);
      const fields = words.some((w) => /^(-f|-F|--field|--raw-field|--input)(=|$)/.test(w));
      if (WRITE_METHODS.test(m) || (!m && fields)) return 'gh api … /pages (enables or changes GitHub Pages)';
    }
    return null;
  }
  if (b === 'git' && args[0] === 'push') {
    const refs = args.slice(2);
    if (words.includes('--tags') || words.includes('--follow-tags') || refs.some((r) => /refs\/tags\/|^tag$/.test(r) || /^[+:]?v?\d+\.\d+\.\d+([-.+][\w.]+)?$/.test(r)))
      return 'git push of a tag (a public release marker)';
    return null;
  }
  if (b === 'curl' || b === 'wget' || b === 'http' || b === 'https' || b === 'xh') {
    if (!words.some((w) => /(^|\/\/|\.)dev\.to\/api\//.test(w))) return null;
    const m = methodOf(words) || (b === 'http' || b === 'https' || b === 'xh' ? (args.find((a) => WRITE_METHODS.test(a)) || '').toUpperCase() : '');
    const body = words.some((w) => /^(-d|--data(-\w+)?|-F|--form|--json|--post-data|--post-file|--body-data)(=|$)/.test(w) || /^-d./.test(w));
    if (WRITE_METHODS.test(m) || body) return 'a write to the dev.to API (publishes or changes an article)';
  }
  return null;
}

// Returns { decision: 'allow' | 'ask' | 'deny', reasons: [...] }.
function decide(toolName, input) {
  if (toolName !== 'Bash') return { decision: 'allow', reasons: [] };
  const deny = [];
  const ask = [];
  for (const c of expand(input.command || '')) {
    if (!c.words.length) continue;
    const line = c.words.join(' ');
    const w = registryWrite(c.words);
    if (w) deny.push(`\`${line}\` blocked: ${w} writes to the package registry, and only the user runs that. Finish the checks in publishing:npm-release, then ask the user to run it themselves (in a terminal, or as \`! ${line}\` in the prompt). \`npm publish --dry-run\` and \`npm pack --dry-run\` are allowed.`);
    const r = releaseAction(c.words);
    if (r) ask.push(`\`${line}\` is ${r}.`);
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
    process.stderr.write(reasons.map((r) => `publishing: ${r}`).join('\n') + '\n');
    return 2;
  }
  if (decision === 'ask') {
    const reason = `publishing: ${reasons.join(' ')} It is public and hard to undo. Allow?`;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }) + '\n');
  }
  return 0;
}

if (require.main === module) {
  let code = 0;
  try {
    code = main();
  } catch (e) {
    process.stderr.write(`publishing: internal error, command allowed: ${e.message}\n`);
    code = 0;
  }
  process.exit(code);
}

module.exports = { parseCommands, expand, registryWrite, releaseAction, decide };
