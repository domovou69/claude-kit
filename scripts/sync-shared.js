#!/usr/bin/env node
// Copies shared/shell-parse.js into scripts/ of every plugin that has a hook guard (plugins/*/scripts/guard.js).
// Each plugin installs on its own, so it cannot require a file outside its folder.
// `--check` changes nothing and exits 1 when a copy is missing or differs.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SHARED = ['shell-parse.js'];

// [source, copy] pairs for every shared file and every plugin with a guard.
function targets(root = ROOT) {
  const plugins = path.join(root, 'plugins');
  const out = [];
  for (const p of fs.readdirSync(plugins).sort()) {
    const scripts = path.join(plugins, p, 'scripts');
    if (!fs.existsSync(path.join(scripts, 'guard.js'))) continue;
    for (const f of SHARED) out.push([path.join(root, 'shared', f), path.join(scripts, f)]);
  }
  return out;
}

// Copies that are missing or differ from their source.
function stale(root = ROOT) {
  return targets(root).filter(([src, dst]) => !fs.existsSync(dst) || !fs.readFileSync(src).equals(fs.readFileSync(dst)));
}

function main() {
  const check = process.argv.includes('--check');
  const bad = stale();
  for (const [src, dst] of bad) {
    if (check) console.log(`differs: ${path.relative(ROOT, dst)}`);
    else { fs.copyFileSync(src, dst); console.log(`copied: ${path.relative(ROOT, dst)}`); }
  }
  if (!bad.length) console.log('all copies match shared/');
  return check && bad.length ? 1 : 0;
}

if (require.main === module) process.exit(main());

module.exports = { targets, stale };
