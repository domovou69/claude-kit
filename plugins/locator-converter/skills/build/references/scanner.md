# Scanner

The scanner walks a folder of test code, finds locator literals, hands them to the converter and writes the
results back. Most users meet the converter through the scanner, so its mistakes are the converter's mistakes.

## Finding literals

- A cheap pre-filter first (for XPath: the string starts with `//`, `(//`, `/` plus a step, or `.//`), so URLs and
  prose are left alone. Check that the filter does not drop real forms: `(//X)[last()]`, absolute paths from a
  recorder, `.//X`.
- Unescape the host literal (JSON, Java, Python, JS template) before converting; re-escape for the same host
  literal when writing back. `\"` inside a JSON or Java string must not close the value.
- Keep dynamic parts as they are: `%s` / `%d`, `{0}` / `{name}`, `${x}`, `$x`, concatenation. Convert only when the
  pieces join into one literal value, and warn when a runtime value could break the target syntax (a quote, a
  trailing backslash).
- Platform detection: skip locators of the other platform (other platform's type names, `ios:` / `android:` keys).
  Mixed web and mobile repositories are the user's call; say so in the README rather than guess.

## The strategy call around the literal

**A converted string inside a call that still says "XPath" is a broken locator.** The first scanner rewrote the
string in `AppiumBy.xpath("…")`, `(By.XPATH, '…')` and `@…FindBy(xpath = "…")`, and the strategy stayed XPath.

Two safe options; pick one per call kind and test it:

1. **Rewrite the strategy and the string together** where the call is recognized.
2. **Leave the string untouched** and report it as `skipped_<source>_strategy` with the marker found.

```js
// Per-language markers that must end right before the opening quote (they may sit on an earlier line).
const XPATH_STRATEGY = [
  { lang: 'java',   re: /\b(?:AppiumBy|By|MobileBy)\.xpath\(\s*$/ },
  { lang: 'java',   re: /\bxpath\s*=\s*$/ },                       // @AndroidFindBy / @iOSXCUITFindBy
  { lang: 'python', re: /\b(?:AppiumBy|By|MobileBy)\.XPATH\s*,\s*$/ },
  { lang: 'ruby',   re: /:xpath\s*,\s*$/ },
  { lang: 'csharp', re: /\bMobileBy\.XPath\(\s*$/ },
];
function strategyBefore(text, quoteIndex) {
  const head = text.slice(Math.max(0, quoteIndex - 200), quoteIndex);
  return XPATH_STRATEGY.find(m => m.re.test(head)) ?? null;
}
```

- Verify each marker against the client library sources, not from memory.
- Bare strings with a framework convention (`$('…')`, a `{ ios: '…' }` map) may convert; data files and unknown
  calls are reported with the suggested target, not written.
- Known limit worth stating: a locator in a variable that is passed to an XPath call elsewhere is still rewritten.

## Writing

- Preview (diff) by default; `--write` only on request and only for folders.
- Atomic write (temporary file + rename, keep the file mode); exit code 2 and an `errors` list when a file cannot
  be read or written.
- `--json` report with every locator: file, line, status, output, warning or reason.
- Unknown flags are rejected; a single file path either works or gives a clear message.

## Fixtures

Keep a few real test files (permissive licenses, recorded in the corpus sources) as scanner contexts, one per
language, with literals inside each strategy call kind. Assert per file: how many literals found, how many inside
a source-strategy call, how many rewritten. When the real-world corpus is harvested, also record **scanner
misses**: literals a person can see that the scanner did not pick up.
