# Playground recipe

## Files

```
site/
  build.js        reads lib/<core>.js, writes _site/bundle.js + copies the page; no dependencies
  index.html      the page: input, examples, output, links; light/dark; 360 px
  playground.js   pure convertLines() for the check + the DOM part (runs only when document exists)
  check.js        bundle + page model in a vm, compared with the library on every case
.github/workflows/pages.yml   check → build → upload-pages-artifact → deploy-pages, on push to main
```

`_site/` is a build output: in `.gitignore`, never committed.

## The bundle

- A tiny `require` shim: each core module becomes `function (module, exports, require) { <source> }` in a map keyed
  by `./name`; `load('./name')` runs it once and caches `module.exports`. Modules keep their own
  `require('./other')` calls unchanged.
- The page gets one global (`window.MyTool`) with the functions and constants it needs.
- The build refuses a module that uses `fs`, `path`, `os`, `child_process`, `process.argv/env/exit/cwd` or `Buffer`.
  In the two converters the scanner (reads files) and the strategy rewriter (CLI) stayed out; the converter and its
  parser, optimizer and status constants went in.

## The page model

`convertLines(text, convert, STATUS, opts)` splits the input into lines, drops blanks, converts each, and returns plain
objects: input, kind (exact / close / skip), output, warning, reason, hint. The DOM part only renders these. Because
the model is pure, `check.js` runs the real page logic, not a copy of it.

- One example button per kind; the check asserts each example line really gives its label (an example that drifts
  after a converter change fails CI).
- Options: one checkbox per library option the page offers (for example "optimize" or "loose"), off by default, the
  same default as the library. The check runs every case with each option.
- If the tool has more detail than the CLI shows (for example whether an optimizer would change the output), the page
  may show it as a tag; the check covers that field too.
- An input with a line break cannot be typed on one line: check those cases on the bundle only and say so in the
  check's output.

## The workflow

- Trigger: `push` to `main` + `workflow_dispatch`. Permissions `pages: write`, `id-token: write`; concurrency group
  `pages`.
- Steps: checkout → setup-node → `node site/check.js` → `node site/build.js` → `configure-pages` →
  `upload-pages-artifact` (path `_site`) → `deploy-pages`.
- Also run `node site/check.js` in the normal test workflow on every PR, so a converter change that breaks the page
  fails before the merge.
- Enabling Pages: Settings → Pages → Source "GitHub Actions", or
  `gh api -X POST repos/OWNER/REPO/pages -f build_type=workflow` (the hook asks). Only after that does the first
  deploy succeed.

## After it is live

- README: one line under the run commands ("Or online, no install: …"); the npm page shows it from the next publish.
- Repo "About" website: the playground URL (`gh repo edit --homepage …`, the hook asks).
- Articles: link it in the intro next to npm and GitHub.
- Open it once at phone width and in dark mode; paste one real input.
