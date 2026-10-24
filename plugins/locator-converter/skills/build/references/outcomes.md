# Outcomes: exact, close, skip

**Rule 1:** never a silent wrong locator. Every input ends as exactly one of three outcomes, and the user can see
which.

| Outcome | Meaning | Written to the file? | Reported |
| --- | --- | --- | --- |
| **exact** | The target selects the same elements in the same order on the pinned platform, proven on the oracle | yes | count |
| **close** | The target can differ in a known, documented way (order of matches at different depths, a widened set on rare data, a runtime value); the first element usually agrees | yes, unless the user asks for exact only | warning per locator: what can differ and when |
| **skip** | No exact or close form is known, or the input is not a locator | no | reason per locator, and a rewrite hint when there is one |

When unsure, skip. A skipped locator still works (it keeps its old strategy); a wrong one breaks a test silently
or, worse, makes it pass on the wrong element.

## Deciding the class of a form

1. No reference row and no oracle result → skip ("not verified").
2. Oracle `EQUAL` on every trap screen → exact.
3. Oracle differs in a way you can describe in one sentence that a user can act on → close, with that sentence as
   the warning. Decide each close form with the user and record the decision in the plan.
4. Oracle differs in any other way → skip, with the reason.

A skip of a locator that has an exact form is a **GAP**; a conversion that differs without a matching warning is
**WRONG** (see [scoring](scoring.md)).

## Result shape

Keep one shape for the CLI, the `--json` report and the library call:

```js
// One result per input locator.
/** @typedef {{
 *   input: string,
 *   status: 'exact' | 'close' | 'skipped',
 *   output?: string,          // target locator, for exact and close
 *   warning?: string,         // close only: what can differ
 *   reason?: string,          // skipped only: why
 *   hint?: string,            // skipped only: how a person could rewrite it
 * }} Result */

function convert(input, opts = {}) {
  const ast = parse(input);                      // throws on syntax outside the whitelist
  if (!ast) return { input, status: 'skipped', reason: 'unsupported syntax' };
  const r = emit(ast);                           // { output, warning } or { reason, hint }
  if (r.reason) return { input, status: 'skipped', reason: r.reason, hint: r.hint };
  if (r.warning && opts.exact) return { input, status: 'skipped', reason: `not exact: ${r.warning}` };
  return r.warning
    ? { input, status: 'close', output: r.output, warning: r.warning }
    : { input, status: 'exact', output: r.output };
}
```

## Modes

| Mode | Converts | Use |
| --- | --- | --- |
| `--exact` | exact only; close becomes a skip | Suites that must not change behaviour at all |
| default | exact and close, each close with a warning | Most users |
| `--loose` (opt-in) | adds wider forms the user asked for (case-insensitive methods, a looser structure), each close with a warning | Only on an explicit request |

An LLM asked to convert without rules tends to produce loose forms without saying so: on Android, 55 of 65
case-insensitive answers matched the converter's `--loose` output exactly. The difference between a converter and
a model is the warning.

## Messages

- Reasons and warnings name the trap, not the code path: `"contains() is case-sensitive; textContains is not"`,
  `"position counts breadth-first on the device"`, `"descendant test would also match the element itself"`.
- Keep the reason text stable: reports, tests and the scoring script group by it.
- The console prints a summary line per status and lists every close and skipped locator with file and line.
