#!/usr/bin/env node
// Pre-release check for an npm package: run it on the release branch before the bump PR, and again on main after
// the merge, before the user runs `npm publish`.
//   node release-check.js [package dir] [--offline] [--max-readme-lines 120] [--expect-files 13]
// Checks package.json metadata, README length and badge, the executable bit of every `bin` file in git, the version
// against the registry, the release tag, the branch, and the `npm pack --dry-run` file list.
// Prints one line per check; exit 1 when a FAIL is found. Node, no dependencies. Never publishes anything.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BADGE = /badge\.fury\.io\/js\/|img\.shields\.io\/npm\/v\//;

// ---------------------------------------------------------------- pure checks (tested)

// "1.2.10" > "1.2.9"; pre-release tags sort before the release. Returns -1, 0 or 1.
function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre = ''] = String(v).replace(/^v/, '').split('-', 2);
    return { nums: core.split('.').map((n) => parseInt(n, 10) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if ((x.nums[i] || 0) !== (y.nums[i] || 0)) return (x.nums[i] || 0) > (y.nums[i] || 0) ? 1 : -1;
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre > y.pre ? 1 : -1;
}

const binFiles = (pkg) => (typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin || {})).map((f) => f.replace(/^\.\//, ''));

function checkPackage(pkg) {
  const out = [];
  for (const k of ['name', 'version', 'description', 'license'])
    out.push(pkg[k] ? ['PASS', `package.json ${k}`] : ['FAIL', `package.json has no ${k}`]);
  if (pkg.private) out.push(['FAIL', 'package.json has "private": true — npm refuses to publish it']);
  const kw = (pkg.keywords || []).length;
  out.push(kw >= 5 ? ['PASS', `${kw} keywords`] : ['WARN', `${kw} keywords: npm search ranks by name, description and keywords; add the words users type`]);
  if (!pkg.repository) out.push(['WARN', 'no repository: the npm page shows no GitHub link']);
  if (!pkg.homepage) out.push(['WARN', 'no homepage (the npm page links it; point it at the docs or the playground)']);
  if (!pkg.files) out.push(['WARN', 'no "files" list: everything not in .npmignore ships; check the npm pack list']);
  return out;
}

function checkReadme(text, { maxLines = 120, name = '' } = {}) {
  if (text === null) return [['FAIL', 'no README.md: it is the npm page']];
  const out = [];
  const lines = text.split('\n').length;
  out.push(lines <= maxLines
    ? ['PASS', `README ${lines} lines (≤ ${maxLines})`]
    : ['WARN', `README ${lines} lines: it is the npm page; keep what it does, how to run, one example, a few results, docs links; move the rest to docs/`]);
  out.push(BADGE.test(text) ? ['PASS', 'npm version badge'] : ['WARN', 'no npm version badge (the npm page shows it only after the next publish)']);
  if (name && !text.includes(name)) out.push(['WARN', `README never mentions the package name ${name}`]);
  if (/npx\s+github:/.test(text)) out.push(['WARN', 'README still says `npx github:…`; use the npm name once it is published']);
  return out;
}

// `git ls-files -s` lines → FAIL for every bin file stored without the executable bit.
function checkBinModes(pkg, lsFiles) {
  const modes = new Map();
  for (const line of lsFiles.split('\n')) {
    const m = /^(\d{6}) \S+ \d+\t(.+)$/.exec(line);
    if (m) modes.set(m[2], m[1]);
  }
  return binFiles(pkg).map((f) => {
    const mode = modes.get(f);
    if (!mode) return ['FAIL', `bin ${f} is not tracked by git`];
    if (mode !== '100755') return ['FAIL', `bin ${f} is ${mode} in git: npx from a clone fails with "Permission denied" after a pull or checkout; run \`git update-index --chmod=+x ${f}\``];
    return ['PASS', `bin ${f} is 100755`];
  });
}

function checkShebang(file, text) {
  return text.startsWith('#!/usr/bin/env node') ? ['PASS', `bin ${file} has the node shebang`] : ['FAIL', `bin ${file} does not start with #!/usr/bin/env node`];
}

function checkRegistry(local, published) {
  if (published === null) return [['WARN', 'the registry was not asked (offline, or the package is not published yet)']];
  const c = compareVersions(local, published);
  if (c <= 0) return [['FAIL', `version ${local} is not above the published ${published}: bump it in its own release PR`]];
  return [['PASS', `version ${local} > published ${published}; README, badge and metadata reach the npm page only with this publish`]];
}

// tagType: '' (absent), 'tag' (annotated) or 'commit' (lightweight); tagCommit / head: commit ids.
function checkTag(version, tagType, tagCommit, head) {
  const t = `v${version}`;
  if (!tagType) return [['PASS', `tag ${t} does not exist yet: after the merge, \`git tag -a ${t} -m ${t}\` on the merge commit`]];
  const out = [];
  if (tagType !== 'tag') out.push(['WARN', `tag ${t} is lightweight; release tags are annotated (git tag -a)`]);
  out.push(tagCommit === head ? ['PASS', `tag ${t} points at HEAD`] : ['FAIL', `tag ${t} exists on another commit (${tagCommit.slice(0, 7)})`]);
  return out;
}

function checkBranch(branch, head, originMain, dirty) {
  const out = [];
  if (dirty) out.push(['WARN', 'uncommitted changes: npm publish packs the working tree, not the commit']);
  if (branch === 'main' || branch === 'master') {
    out.push(originMain && head === originMain ? ['PASS', `on ${branch}, equal to origin`] : ['FAIL', `on ${branch} but HEAD differs from origin/${branch}: pull (or the bump PR was merged into another branch, not main)`]);
  } else {
    out.push(['PASS', `on ${branch}: fine for the bump PR; the user publishes from an up-to-date main after the merge`]);
  }
  return out;
}

// `npm pack --dry-run --json` prints an array in older npm and an object keyed by package name in newer npm.
const packFiles = (json) => (Array.isArray(json) ? json[0] : Object.values(json)[0]).files.map((f) => f.path);

function checkPack(files, expect) {
  if (!files) return [['WARN', 'npm pack --dry-run did not run']];
  const out = [[expect && files.length !== expect ? 'FAIL' : 'PASS', `npm pack: ${files.length} files${expect ? ` (expected ${expect})` : ''}`]];
  const odd = files.filter((f) => /(^|\/)(test|tests|audit|site|_site|docs|\.github|coverage|node_modules)\//.test(f) || /\.(log|tgz)$|(^|\/)\.env/.test(f));
  if (odd.length) out.push(['WARN', `npm pack ships files that look internal: ${odd.slice(0, 5).join(', ')}${odd.length > 5 ? ', …' : ''}`]);
  return out;
}

// ---------------------------------------------------------------- side effects

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function main(argv) {
  const opt = { dir: '.', offline: false, maxLines: 120, expect: 0 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--offline') opt.offline = true;
    else if (argv[i] === '--max-readme-lines') opt.maxLines = Number(argv[++i]);
    else if (argv[i] === '--expect-files') opt.expect = Number(argv[++i]);
    else opt.dir = argv[i];
  }
  const dir = path.resolve(opt.dir);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const readmePath = path.join(dir, 'README.md');
  const results = [...checkPackage(pkg), ...checkReadme(fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : null, { maxLines: opt.maxLines, name: pkg.name })];

  const ls = sh('git', ['ls-files', '-s', ...binFiles(pkg)], dir);
  if (binFiles(pkg).length) results.push(...checkBinModes(pkg, ls || ''));
  for (const f of binFiles(pkg)) if (fs.existsSync(path.join(dir, f))) results.push(checkShebang(f, fs.readFileSync(path.join(dir, f), 'utf8')));

  const published = opt.offline ? null : sh('npm', ['view', pkg.name, 'version'], dir);
  results.push(...checkRegistry(pkg.version, published || null));

  const head = sh('git', ['rev-parse', 'HEAD'], dir) || '';
  const branch = sh('git', ['branch', '--show-current'], dir) || '';
  if (!opt.offline) sh('git', ['fetch', '--quiet', 'origin', branch === 'master' ? 'master' : 'main'], dir);
  const originMain = sh('git', ['rev-parse', `origin/${branch === 'master' ? 'master' : 'main'}`], dir);
  const dirty = (sh('git', ['status', '--porcelain'], dir) || '').length > 0;
  results.push(...checkBranch(branch, head, originMain, dirty));
  const tag = `v${pkg.version}`;
  const tagType = sh('git', ['cat-file', '-t', `refs/tags/${tag}`], dir) || '';
  results.push(...checkTag(pkg.version, tagType, tagType ? sh('git', ['rev-list', '-n', '1', tag], dir) || '' : '', head));

  const pack = sh('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], dir);
  let files = null;
  try { files = pack ? packFiles(JSON.parse(pack)) : null; } catch { files = null; }
  results.push(...checkPack(files, opt.expect));

  for (const [level, msg] of results) console.log(`${level.padEnd(4)}  ${msg}`);
  const fails = results.filter((r) => r[0] === 'FAIL').length;
  console.log(fails ? `\n${fails} FAIL — fix before the release.` : '\nNo FAIL. The user runs `npm publish`; then check `npx <name>@<version>` in a clean folder.');
  return fails ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { compareVersions, packFiles, checkPackage, checkReadme, checkBinModes, checkShebang, checkRegistry, checkTag, checkBranch, checkPack };
