// The playground must give what the library gives: build the bundle, run it and playground.js in a vm, and compare
// with the library on every test case. Copy to site/check.js (not test.js: node --test would pick that name up);
// run it in CI on every PR and before each deploy. Fill the slots.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { build, OUT, GLOBAL } = require('./build');
const lib = require('..'); // slot: the library entry point
const CASES = require('../test/cases.json'); // slot: every input the library tests use, e.g. [{ id, input, opts }]

build();
const ctx = vm.createContext({});
for (const f of ['bundle.js', 'playground.js']) vm.runInContext(fs.readFileSync(path.join(OUT, f), 'utf8'), ctx, { filename: f });
const browser = ctx[GLOBAL];
const plain = (v) => JSON.parse(JSON.stringify(v));

assert.deepStrictEqual(plain(browser.STATUS), plain(lib.STATUS), 'status values differ');
for (const c of CASES) {
  assert.deepStrictEqual(plain(browser.convert(c.input, c.opts)), plain(lib.convert(c.input, c.opts)), `${c.id}: bundle differs`);
  // slot: also compare the page model, e.g. ctx.Playground.convertLines(c.input, browser.convert, browser.STATUS, c.opts)
}
// the examples on the page show the kind on their label
for (const e of ctx.Playground.EXAMPLES || []) {
  for (const r of ctx.Playground.convertLines(e.text, browser.convert, browser.STATUS)) assert.strictEqual(r.kind, e.label, `example ${e.label}: ${r.input}`);
}
const src = fs.readFileSync(path.join(OUT, 'bundle.js'), 'utf8');
assert(!/require\(['"](node:)?(fs|path|os|child_process)['"]\)/.test(src), 'the bundle carries Node-only code');
fs.rmSync(OUT, { recursive: true, force: true });
console.log(`playground: ${CASES.length} cases match the library`);
