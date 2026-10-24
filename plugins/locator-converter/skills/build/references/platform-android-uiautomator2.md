# Appendix: Android (UiAutomator2, UiSelector)

Facts found while building an XPath → `UiSelector` (`-android uiautomator`) converter. Observed at Appium 3.8.0,
appium-uiautomator2-driver 8.7.0, UiAutomator2 server 10.6.6, androidx `uiautomator` 2.3.0, on emulators with
Android 16 and 17. Re-check them on your pins.

## Health first

The driver README announces that Google will remove `UiSelector` lookups. This was noticed only after the converter
was built. Check the target's status before stage 1 and keep an upstream watch on the issue.

## Engines

- **XPath** is evaluated by Eclipse PsychoPath, **XPath 2.0**, over the XML dump, unless the `enforceXPath1`
  setting is on. `ends-with`, `matches`, `lower-case`, sequences like `@a=("x","y")`, `if`, `some` are valid.
  Models often believe "UiAutomator2 is XPath 1.0" and skip valid locators.
- `matches()` is Java regex with `find()` and `UNIX_LINES`: convert with a whole-string wrapper.
- **UiSelector** strings are parsed by the server's own parser: literals unescape only `\"`; a backslash stays as
  is, and a value that ends in `\` cannot be written. In a regex form write `"` and `\` as `\x22` and `\x5c`.
- `findElement` uses only the first `;` statement: no union through `;`.

## Matching

| Method | Behaviour |
| --- | --- |
| `text`, `description`, `resourceId`, `className`, `packageName` | exact string |
| `textContains`, `textStartsWith`, `descriptionContains`, `descriptionStartsWith` | **case-insensitive** (both sides lowercased): never emit for XPath `contains()` / `starts-with()` |
| `textMatches`, `descriptionMatches` | whole match, **DOTALL**: emit `(?-s:…)` around a pattern that came without `s` |
| `resourceIdMatches`, `classNameMatches`, `packageNameMatches` | whole match, no flags |
| `(?i)` | ICU, folds Unicode (Kelvin sign); `lower-case` agreed on the device, `upper-case` and `translate` did not |

- With DOTALL, ICU's `.` takes CR LF as one character: use `[\s\S]{n}` for `string-length`, not `(?s).{n}`.
- Range widgets (SeekBar, ProgressBar) show their value as `@text` in the XML dump; `UiSelector` does not see it.
  A text test that a number could pass is close, with a range-widget warning.
- Toasts appear only in the XML dump: skip.
- `@text` is `""` for text-less nodes; tests that hold for `""` need care.

## Order and positions

- `UiSelector` traverses in pre-order, the same as XPath document order, with the same visibility rule:
  `(//X)[n]` → `instance(n-1)` is exact.
- `//A//B` → `A.childSelector(B)`: the first element agrees; `findElements` returns at most one per container.
  Close.
- `childSelector` stores a **copy**, so `instance` counts within each container. Only `(//A//B)[1]` is exact, as
  `A.instance(0).childSelector(B.instance(0))`; the server reads `instance` only on the outer selector.
- `A.instance(n-1).childSelector(B)` falls through to the next `A` when the n-th has none: wrong, not close.
- `instance(n)` makes `findElements` return one element.
- `classNameMatches` makes `findElements` iterate `index(0..n)` and lose most elements: never emit it.
- `fromParent` searches the parent's whole subtree, not only siblings.
- XPath finds nothing below depth 70 in the dump; `UiSelector` does. Document, do not convert differently.
- `//*` → `new UiSelector()` is exact: `findElements` never returns the `<hierarchy>` root.

## Settings

Conversions are exact for default driver settings only. Settings that change lookup results: `enforceXPath1`,
`allowInvisibleElements`, `ignoreUnimportantViews`, `enableMultiWindows`, `snapshotMaxDepth`, `normalizeTagNames`.
List every setting with its default at the pinned version in the project docs. A second window is in neither
result by default; with `enableMultiWindows` only XPath sees it.

## Oracle app and emulator

- An app cannot set its nodes' package; class name, resource id, text, description, booleans and a range value
  can be set through the accessibility node, so screens can come from JSON with no rebuild.
- A screen sent through `am start` is capped at about 128 KB; send it on the shell's stdin, and keep fuzz batches
  small enough (about 140 locators per batch).
- Use an AOSP image for timed runs: on a Play image, background services pushed guest load up mid-run. Start the
  emulator headless; a hidden window was deprioritized by the host and lookups slowed ≈6×.
- AC power, low-power mode off, `caffeinate` for the whole run. The local Appium can run on its own port when
  another project's Appium is on the default one.
- `UiSelector` was faster than XPath in 30 of 30 cases (49 % at 100 elements, 12 % at 2000).
