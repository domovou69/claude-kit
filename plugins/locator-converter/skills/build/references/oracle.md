# Oracle

The oracle answers one question: on the same screen, does the target locator select the same elements, in the
same order, as the source locator? It is the real engine (device, simulator or emulator) with pinned versions.

**Rule 2:** the oracle exists, and has confirmed or corrected every edge case, before the converter implements the
rule. Building the converter first and the oracle later cost the first project most of its commits: a baseline of
72 on real locators and 7.7 on edge cases, then fifteen root-cause rounds.

## What counts as an oracle

| Kind | Use | Trust |
| --- | --- | --- |
| Real engine on a device, simulator or emulator | Final verdict on every rule and every edge case | Decides |
| Engine sources compiled on the host ("mini engine") | Fast fuzzing of thousands of cases between device runs | A hypothesis. It was wrong on result order and on self-inclusion until the device corrected it |
| A matcher transcribed from the sources by hand | Avoid; a second implementation to keep right | Low |
| Reading the sources | Writing the reference rows and the expected outputs | A hypothesis. On Android it predicted an exact form the device refuted |

If you keep a host-side engine for speed, re-run its disagreements on the device and fix the host engine, not the
verdicts.

## Test app

- One app, screens built from JSON passed at launch (intent extra, launch argument), so any class name, id or
  text from a corpus literal renders without a rebuild.
- Generic views whose accessibility node carries every attribute the source language can test (class/type,
  id, text, description, the boolean flags, a range value).
- Fixed **trap screens** for the edge cases: duplicates at several depths, nested matches, the element that
  matches its own descendant test, null versus empty attribute, all booleans in both states, a deep branch past
  the engine's depth limit, a second window or overlay, range widgets, line breaks and non-ASCII text.

## Runner

For each case and each screen: find all elements with the source locator and with the target locator, compare
the two lists by an attribute fingerprint **and** by order, record the times.

```js
// Compare two element lists from findElements; fingerprint = stable attributes read from the page source.
function compare(sourceEls, targetEls, { sourceError, targetError } = {}) {
  if (sourceError) return 'SOURCE_ERROR';
  if (targetError) return 'TARGET_ERROR';
  const a = sourceEls.map(fingerprint);
  const b = targetEls.map(fingerprint);
  if (a.length === 0 && b.length === 0) return 'VACUOUS';        // proves nothing: plant a target
  if (b.length === 0) return 'SOURCE_ONLY';
  if (a.length === 0) return 'TARGET_ONLY';
  if (a.join('\n') === b.join('\n')) return 'EQUAL';
  if ([...a].sort().join('\n') === [...b].sort().join('\n')) return 'ORDER_DIFFERS';
  return 'SET_DIFFERS';
}
```

- `VACUOUS` is not a pass. A case where neither side finds anything says nothing about the conversion; add a
  planted target and a near miss so both sides must find exactly one thing.
- Drivers can swallow selector errors and return an empty list for an invalid locator. Check validity separately
  (the engine's own parser, or a direct engine call) so that "invalid" is not read as "found nothing".
- Write results after every case, support `--resume`, store the versions in the result file, and make two full
  runs agree before you trust a run.

## Fuzzing the real-world corpus

Edge cases test the rules; fuzzing tests the converter on what people actually write.

1. **Random screens** built from the literals of each batch of locators: for every locator, a cell with its
   targets and near misses (one attribute changed, one character changed, case changed, a line break added).
2. **Mutants:** make wrong target locators on purpose (drop a condition, swap text and description, use the
   case-insensitive method, drop a regex flag, shift a position) and run them on the same screens. The share of
   mutants the screens catch is the strength of the traps. Random traps caught only 62 % on Android.
3. **Matrix screens:** for every locator, a cell that breaks each tested condition in every way that applies,
   plus invisible targets and matches placed first for positions. Mutants killed rose to 99.5 %; the survivors
   were equivalent on those screens.
4. Report by **locator form**, not only as a raw count: a form with one locator is as important as a form
   with a hundred.

## Run conditions

- Pinned versions recorded in the result file (driver, server, engine, OS image, host OS).
- Timed runs on AC power with low-power mode off; keep the display awake. On one host, low-power mode made the
  emulator 6–40× slower, and display sleep alone ≈5× slower. Record power state next to every timing table.
- One emulator at a time, headless for timed runs. Reuse one fixed simulator or AVD; do not create new ones
  without asking.
- Simulator and real device gave the same outcomes on iOS (246 of 246); the device is ≈2× slower. A real-device
  pass is a confirmation, not a separate oracle.

## Outcome to verdict

| Oracle outcome | Converter said | Verdict |
| --- | --- | --- |
| `EQUAL` | exact | CORRECT |
| `ORDER_DIFFERS`, or `SET_DIFFERS` as the warning predicts | close | DRIFT (documented) |
| `ORDER_DIFFERS` / `SET_DIFFERS` not predicted | exact or close | WRONG |
| `TARGET_ERROR` | exact or close | INVALID |
| `SOURCE_ONLY` | skip, no exact form exists | CORRECT-SKIP |
| `EQUAL` possible (a hand-written exact form exists) | skip | GAP |
| `VACUOUS` | anything | not checked; fix the screen |
