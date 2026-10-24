---
name: build
description: Use when planning, building, auditing or extending a converter that rewrites test locators from one locator language to another (for example XPath to iOS class chain, or XPath to Android UiSelector) — the device oracle, the converter and its fix loop, the source-file scanner, scoring and the real-world corpus. Not for converting a test suite with a converter that already exists (use that converter's own skill), not for running device test suites or LLM-versus-tool benchmarks on their own, and not for query languages other than locators.
---

# Build a locator converter

A locator converter reads locators written in a **source language** (usually XPath) and writes locators in a
**target language** (class chain, `UiSelector`, a CSS selector, …) that select the **same elements in the same
order** on the pinned platform. The hard part is not the parser; it is proving that the output is right on the
real engine, and saying "no" when it cannot be right.

The method below came from two converters built end to end (XPath → iOS class chain, XPath → Android
`UiSelector`). It fits other selector or query DSLs too, but only locator languages were tested.

## The five rules

These are the only hard rules. Everything else in this skill is a recommendation; adapt it to the project.

1. **Never a silent wrong locator.** Every input ends as exactly one of: *exact* (converted, same elements and
   order), *close* (converted, with a warning that says what can differ, and listed in the report), or *skip*
   (left as it was, with a reason). When unsure, skip. See [outcomes](references/outcomes.md).
2. **Oracle before converter.** Every rule the converter will use is proven on the real engine (device,
   simulator or emulator) with a hand-written expected output **before** the converter implements it. Source
   reading and transcribed re-implementations are hypotheses; the device decides. See [oracle](references/oracle.md).
3. **Scoring weights and denominators are fixed before the first measurement.** Write them in the plan; never
   tune them to make a number look better. See [scoring](references/scoring.md).
4. **WRONG is a separate headline number.** Every report states how many converted locators select something
   other than the source locator, next to the score and never folded into it only.
5. **Published results are never rescored.** A new scoring version applies from now on; articles, charts and
   released tables keep the version they were computed with.

## Workflow

Copy [templates/PLAN.md](templates/PLAN.md) into the project and fill its slots first. Then work in this order;
each stage is one branch and one PR (see [fix loop](references/fix-loop.md) for the branch rules).

| # | Stage | Output | Reference |
| --- | --- | --- | --- |
| 0 | Health check of the target | Is the target language deprecated or about to be? Verdict first in the plan | [templates/PLAN.md](templates/PLAN.md) |
| 1 | Plan and pins | Versions of every component, default settings, scoring weights (rule 3), outcome classes | [scoring](references/scoring.md) |
| 2 | Reference and edge cases | One row per engine fact (source file, line, pinned tag); at least one edge case per row with the expected target locator | [semantics traps](references/semantics-traps.md), [corpus](references/corpus.md) |
| 3 | Oracle | Test app + runner on the real engine; every edge case confirmed or corrected, no converter yet (rule 2) | [oracle](references/oracle.md) |
| 4 | Real-world corpus | Locators mined from real projects, anonymized, pinned; can run in parallel with 2–3 | [corpus](references/corpus.md) |
| 5 | Converter | Parser to an AST, a whitelist of supported forms, exact/close/skip per input (rule 1) | [outcomes](references/outcomes.md) |
| 6 | Fix loop | Every defect: failing test → fix → oracle → score row; fuzz and mutants on the corpus | [fix loop](references/fix-loop.md) |
| 7 | Scanner | Finds locator literals in test code, respects the strategy call around them, rewrites both | [scanner](references/scanner.md) |
| 8 | Report and release | Scores with WRONG as a headline (rule 4), limits, versions checked; published numbers frozen (rule 5) | [scoring](references/scoring.md) |

Platform facts that already cost a fix round on two engines are in the appendices:
[iOS (WDA, class chain, NSPredicate)](references/platform-ios-wda.md) and
[Android (UiAutomator2, UiSelector)](references/platform-android-uiautomator2.md). Read the one for your target
before stage 2; treat every fact there as a hypothesis to re-check on your pinned versions.

## Recommendations that pay off most

- Pin versions (driver, server, engine, OS image, app framework) on day one and record them next to every result.
- Read the target engine's source at the pinned tag for each rule, cite file and line, then confirm on the device.
  When the two disagree, the device wins and the reference row is corrected.
- Build the converter on an AST with an explicit whitelist. String and regex rewriting caused most of the defects
  in the first converter (operator precedence, literals, unknown syntax passed through as success).
- Keep the converter strict by default. Wider forms (case-insensitive matching, a looser structure) go behind an
  explicit opt-in flag, each with a warning.
- Timed runs: AC power, low-power mode off, display kept awake (`caffeinate` on macOS), host state recorded.
- Long runs: in the background, resumable (`--resume`), results written after every item, a progress check every
  5–10 minutes.
- One branch and one PR per change, each from a fresh main; no stacked PRs.

## When you finish a stage

Update the plan's stage table (status, result, numbers), add one row to the progress table of the report, and
say which stage is next and what it needs (device, network, time).
