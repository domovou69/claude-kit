// Copy to site/playground.js. Page logic: lines in, one entry per input out. The pure part (no DOM) is what
// site/check.js runs against the library; the DOM part below runs only in a browser. Slots: GLOBAL, EXAMPLES, kinds.
(function (root) {
  'use strict';

  // kind: exact (no warning), close (converted with a warning), skip (no output, a reason instead)
  function convertLines(text, convert, STATUS, opts) {
    return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((input) => {
      const r = convert(input, opts);
      const ok = r.status === STATUS.SUCCESS;
      return {
        input,
        kind: !ok ? 'skip' : r.warning ? 'close' : 'exact',
        output: ok ? r.locator : null, // slot: the result field
        warning: r.warning || null,
        reason: ok ? null : r.reason || r.status,
      };
    });
  }

  // One example per kind; site/check.js asserts that each line really gives its label.
  const EXAMPLES = [
    { label: 'exact', text: 'slot: an input that converts exactly' },
    { label: 'close', text: 'slot: an input that converts with a warning' },
    { label: 'skip', text: 'slot: an input that is skipped with a reason' },
  ];

  const api = { convertLines, EXAMPLES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Playground = api;
  if (typeof document === 'undefined') return;

  const lib = root.MyTool; // slot: GLOBAL from site/build.js
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text; // textContent, never innerHTML: the input is user text
    return e;
  };

  function render() {
    const out = $('out');
    out.replaceChildren();
    for (const r of convertLines($('input').value, lib.convert, lib.STATUS)) {
      const row = el('div', `row ${r.kind}`);
      row.append(el('div', 'muted', `${r.kind}: ${r.input}`));
      if (r.output) {
        const pre = el('pre', null, r.output);
        const copy = el('button', null, 'Copy');
        copy.onclick = () => navigator.clipboard && navigator.clipboard.writeText(r.output);
        row.append(pre, copy);
      }
      if (r.warning) row.append(el('div', null, `Warning: ${r.warning}`));
      if (r.reason) row.append(el('div', null, `Skipped: ${r.reason}`));
      out.append(row);
    }
  }

  for (const e of EXAMPLES) {
    const b = el('button', null, e.label);
    b.onclick = () => { $('input').value = e.text; render(); };
    $('examples').append(b, ' ');
  }
  $('input').addEventListener('input', render);
})(typeof globalThis !== 'undefined' ? globalThis : window);
