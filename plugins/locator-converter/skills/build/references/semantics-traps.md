# Semantics traps

Places where two locator languages look equivalent and are not. Each one produced a wrong or broken locator in a
real converter. Turn every item into a reference row and an edge case before the converter handles the form.

For each item: read the target engine's source at the pinned tag, write the expected output by hand, and let the
[oracle](oracle.md) confirm it.

## Matching

| Trap | What went wrong | Check |
| --- | --- | --- |
| **Case sensitivity per method** | Android `textContains` / `textStartsWith` / `descriptionContains` / `descriptionStartsWith` lowercase both sides; XPath `contains()` does not. 20 of 29 wrong locators from one LLM run used them | For every target method, find the comparison in the source; never assume the name tells you |
| **Regex flags per method** | Android `textMatches` / `descriptionMatches` compile with DOTALL, the other `…Matches` methods do not; the reference said "no flags" for all. `.` crossed a line break the XPath did not | Read the flags of each method; add a line-break trap to every regex case |
| **Whole match vs find** | XPath `matches()` is a search (`find`), most `…Matches` / `MATCHES` are whole-string | Wrap the pattern: `(?s:.*)(?:p)(?s:.*)`, keeping `.` and `$` of the source |
| **Anchors and line ends** | XPath `$` also matches before a final `\n`; dot-all engines differ | Edge cases with trailing `\n` and with CR LF |
| **Empty needle** | `contains(x, "")` is true for every element in XPath; `CONTAINS ""` never matches in NSPredicate | Skip, or drop the test when the target has an always-true form |
| **Unicode normalization and folding** | NSPredicate `CONTAINS` compares canonically equivalent text, `MATCHES` compares NFKC, `[c]` adds full case folding; XPath compares code points | Probes with decomposed accents, fullwidth letters, ligatures, `ß`, `ſ`, the Kelvin sign |
| **Case folding in regex** | ICU `(?i)` folds the Kelvin sign; XPath `upper-case()` / `translate()` do not | Keep `lower-case` only if the device agrees; skip the rest or mark close |
| **Numeric coercion** | `@value > 5` → `value.doubleValue > 5`: `doubleValue` reads `"10abc"` as 10, XPath `number()` gives NaN | A fixture with `10abc`, `7`, `abc`, `1e3` |
| **Missing vs empty attribute** | Engines read a missing attribute as `""`, `nil` or not at all; patterns that match `""` then match everything | Null vs empty on the trap screen; skip patterns that match `""` |
| **Data only the page source has** | Android range widgets show their value as text in the page source; `UiSelector` does not see it, so `contains(@text,"1.5")` matched a slider only in XPath | List every attribute the XML dump synthesizes; mark tests a number can pass as close |
| **Elements only the page source has** | Toasts exist only in the XML dump | Skip them |

## Structure and order

| Trap | What went wrong | Check |
| --- | --- | --- |
| **Result order** | XPath returns document order; XCTest returned breadth-first for both languages, so `(//X)[n]` → `**/X[n]` picks another element when matches sit at different depths | Duplicates at several depths on the trap screen; a position with no exact form is close or skip |
| **Position scope** | Positions can count globally, per parent or per container. Android `childSelector` copies the selector, so `instance` counts inside each container; only `[1]` stayed exact | One case per scope with matches spread over two containers |
| **Self-inclusion** | `[.//*[p]]` → `$p$`: the containment operator also tests the element itself; XPath `.//` never does | Emit only when the outer and inner steps name different types; else skip |
| **Root element** | `//*` matches the application root in XPath; the target's `**/*` never does. A path starting at the root type matched nothing when rewritten as a descendant step | Root cases on the trap screen |
| **Depth limits** | Snapshots stop at a fixed depth (50 on one engine, 70 on another); below it both sides find nothing | One target past the limit; document, do not convert differently |
| **Operator precedence** | Joining predicates as `A OR B AND C` instead of `(A OR B) AND C` | AST, or parenthesize every predicate with `OR` |
| **Predicate order** | `//X[2][@a="v"]` is not `//X[@a="v"][2]` | Skip a position that precedes a condition |
| **Optimizations that widen** | Rules that dropped container steps or moved a `visible` test changed the matched set | No rewrite that is not proven equal; remove such rules |

## Syntax and literals

| Trap | What went wrong | Check |
| --- | --- | --- |
| **Engine version of the source language** | One server evaluates XPath 2.0 (PsychoPath) unless a setting forces 1.0; the other is XPath 1.0 (libxml2) plus a few registered functions. Assuming the wrong one skips valid locators or converts invalid ones | Pin the engine and its mode in the plan |
| **Unknown syntax passed through** | `matches(...)`, `@a eq "x"`, `("a","b")` sequences were copied into the target and reported as success | Whitelist on the AST; anything else is a skip "unsupported syntax" |
| **Unknown names mapped silently** | WDA maps an unknown type name to `Other`, so a misspelled type matched every container | Accept only names from the engine's own table |
| **Unknown attributes** | An attribute the target engine does not know raised an exception at runtime | Whitelist attribute aliases from the engine source |
| **Literal escaping** | A raw newline broke the predicate parser; `\` was not doubled; Android `UiSelector` literals unescape only `\"`; a `$` inside a literal ended a `$…$` block | Edge cases with `"`, `'`, `\`, `\n`, `$`, backtick, `]`, `%s`, non-ASCII, empty |
| **Text that looks like code inside a value** | A value `'contains(@a,"b")'` was rewritten as if it were a function | Quote-aware rewriting, or an AST |
| **Host-language quoting** | `\"` inside a JSON or Java string closed the value early | Unescape the host literal first, convert, re-escape for the host |

## Environment

| Trap | What went wrong | Check |
| --- | --- | --- |
| **Driver settings** | Settings such as forcing XPath 1.0, showing invisible elements, multi-window or snapshot depth change what a lookup returns | Support default settings only; list every setting and mark the ones that change results |
| **Errors swallowed** | The driver returned `[]` for an invalid locator, so "invalid" looked like "not found" | Validate the target locator separately |
| **Deprecation** | The Android target method was announced for removal in the driver README; nobody checked before building | Stage 0 health check, and an upstream watch after release |
