# Appendix: iOS (WebDriverAgent, class chain, NSPredicate)

Facts found while building an XPath → class chain converter. Observed at Appium 3.8.0, appium-xcuitest-driver
12.16.0, WebDriverAgent 16.14.1, iOS 26–27, on a simulator and on one iPhone. Re-check them on your pins; WDA and
XCTest change.

## Engines

- **XPath** is evaluated by libxml2 over a snapshot of the tree: XPath 1.0 plus the functions WDA registers
  (`matches`, `ends-with`, `lower-case`, `upper-case`, `replace`, `tokenize`, `string-join`). Other XPath 2.0
  syntax is invalid on the device. WDA's `matches()` accepts `m`, `s`, `x` flags but applies only `i`, and reads a
  missing attribute as `""`.
- **Class chain** is parsed by WDA's class chain parser; each step's predicate is an NSPredicate in backticks, and
  `$…$` is a containment predicate (some descendant matches).
- The driver swallows WDA selector errors: an invalid XPath or class chain gives an empty result, not an error.
  Validate chains with WDA's parser separately.

## Order and positions

- XCTest returns matches **breadth-first** for both XPath and class chain. `(//X)[n]` → `**/X[n]` counts in a
  different order whenever matches sit at different depths: close at best, with a warning. Equal only when all
  matches are at one depth (rows of one list).
- A class chain index counts per parent. A position on a grouped expression has no exact chain; `[last()]` →
  `[-1]` and `[last()-n]` → `[-(n+1)]` share the same warning.
- `//X[2][@a="v"]` (position before a condition) has no exact chain; skip.
- `[1]` and `useFirstMatch` gave no speed gain.

## Structure

- `$…$` **also tests the element itself**; XPath `.//` does not. Emit `[$…$]` only when the outer and inner steps
  both name a type and the types differ; otherwise skip.
- WDA ends a `$…$` block at any `$`, even inside a string literal: skip literals with `$` inside containment.
- `//*` matches the application root; `**/*` never does. A path that starts at the application type must become an
  absolute chain, not a descendant step (`**/XCUIElementTypeApplication/…` found nothing).
- `ancestor::` from a leading `.//` can climb to the context node; skip it.
- WDA maps an unknown type name to `Other`: accept only names from its type table.
- Snapshot depth limit is 50 by default: below it both XPath and chain find nothing.

## NSPredicate text comparison

| Operator | Behaviour on the device |
| --- | --- |
| `==` | exact code points |
| `CONTAINS`, `BEGINSWITH` | canonical equivalence (decomposed = composed accent, Kelvin = K); a base-letter pattern misses the letter followed by a combining mark |
| `MATCHES` | whole string, dot-all, NFKC (fullwidth, ligatures, circled digits fold), case-sensitive; treats U+00A0 like a space |
| `[c]` | adds full case folding (`ß` = `ss`, `ſ` = `s`, Kelvin = `k`) |
| `CONTAINS ""`, `BEGINSWITH ""` | never match, while XPath `contains(x, "")` is always true |

- XPath `matches(x, p)` without flags → `x CONTAINS "p"` for a plain pattern, otherwise
  ``x MATCHES "(?s:.*)(?-s:p)(?s:.*)"`` (keeps XPath's `.` and `$`); flag `i` → `[c]` / `(?i)`.
- `lower-case(@a)="v"` → `a ==[c] "v"`; `contains(translate(…A–Z, a–z…), "v")` → `CONTAINS[c]`. Document that
  `[c]` folds more than ASCII.
- Skip `normalize-space()`, `string-length()` (`.length` counts UTF-16 units) and `MATCHES` patterns with a literal
  space.
- `value.doubleValue > 5` reads a numeric prefix (`"10abc"` = 10); XPath gives NaN. Skip `>` / `>=` on text.
- Boolean attributes: `contains(@enabled,"false")` raises; use `enabled == false`. `[@enabled=true()]` can be
  dropped: compared with a boolean, XPath only tests that the attribute exists, and WDA always writes it.
- Escape `\` and control characters in literals; a raw newline breaks the predicate parser.
- Attribute names: only WDA's aliases (`name`, `label`, `value`, `type`, `enabled`, `visible`, `accessible`,
  `selected`, `hittable`, `index`, `placeholderValue`, `traits`, `rect.*`, …); `x`/`y`/`width`/`height` → `rect.*`.
  An unknown attribute raises at runtime.

## Device and speed

- Simulator and a real iPhone gave the same outcome for all 246 oracle cases; the phone was ≈2.2× slower per
  lookup. Real-device runs need a signing team passed as an environment variable (never committed) and the app
  trusted on the phone; the USB tunnel dropped when the host display slept.
- Class chain was 22–29 % faster than XPath at 100–2000 elements; on small screens the gain disappeared, and a
  final-step `visible` predicate was much slower in a chain.
