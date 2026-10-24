// Builds the playground into _site/: the library core wrapped for the browser, plus the page.
// No dependencies; the core is read from its own folder, never copied into site/.
// Copy to site/build.js and fill the four slots below.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_site');
const CORE = path.join(ROOT, 'lib'); // slot: folder of the core modules
const MODULES = ['status', 'parser', 'converter']; // slot: core modules, any order; each may require('./other')
const GLOBAL = 'MyTool'; // slot: window.<GLOBAL> in the page
const EXPORTS = { convert: ['converter', 'convert'], STATUS: ['status', null] }; // slot: name → [module, export or null for the whole module]
const PAGE = ['index.html', 'playground.js']; // files copied from site/ as they are

// A module that touches the file system or the process cannot run in a browser: fail the build, not the page.
const NODE_ONLY = /require\(\s*['"](node:)?(fs|path|os|child_process|process|worker_threads)['"]\s*\)|\bprocess\.(argv|env|exit|cwd)|\bBuffer\./;

function bundle() {
  const defs = MODULES.map((name) => {
    const src = fs.readFileSync(path.join(CORE, `${name}.js`), 'utf8');
    const bad = NODE_ONLY.exec(src);
    if (bad) throw new Error(`${name}.js uses ${bad[0]}: keep it out of MODULES or move that code out of the core`);
    return `  ${JSON.stringify('./' + name)}: function (module, exports, require) {\n${src}\n  },`;
  }).join('\n');
  const api = Object.entries(EXPORTS)
    .map(([k, [mod, exp]]) => `${JSON.stringify(k)}: load(${JSON.stringify('./' + mod)})${exp ? `[${JSON.stringify(exp)}]` : ''}`)
    .join(', ');
  return `(function (root) {
'use strict';
var defs = {
${defs}
};
var cache = {};
function load(id) {
  id = id.replace(/\\.js$/, '');
  if (!defs[id]) throw new Error('not in the bundle: ' + id);
  if (!cache[id]) {
    var m = { exports: {} };
    cache[id] = m;
    defs[id](m, m.exports, load);
  }
  return cache[id].exports;
}
root[${JSON.stringify(GLOBAL)}] = { ${api} };
})(typeof globalThis !== 'undefined' ? globalThis : window);
`;
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'bundle.js'), bundle());
  for (const f of PAGE) fs.copyFileSync(path.join(__dirname, f), path.join(OUT, f));
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
}

if (require.main === module) { build(); console.log(`built ${OUT}`); }
module.exports = { build, bundle, OUT, GLOBAL };
