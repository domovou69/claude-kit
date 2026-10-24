# Plan — <converter name>

Converts <source language> locators in <platform> tests to <target language> locators, and refuses to convert the
ones that have no exact <target language> form.

Started <date>. Related projects: <links or "none">.

## 0. Health check of the target

| Component | Latest release | Deprecation notices | Vendor direction | Verdict |
| --- | --- | --- | --- | --- |
| <target locator strategy> | <version, date> | <quotes with links, or "none found"> | <new API it displaces, if any> | <green / yellow / red, horizon in years> |
| <driver> | | | | |
| <engine / server> | | | | |

On yellow or red: 2–3 alternatives and the user's decision before stage 1.

## Rules (from the locator-converter:build skill)

1. Never a silent wrong locator: exact, close with a warning, or skip with a reason.
2. Oracle before converter: every rule proven on the real engine before it is implemented.
3. Scoring weights and denominators fixed below, before the first measurement.
4. WRONG reported as a separate headline number.
5. Published results never rescored.

## Pins

| Component | Version | Where recorded |
| --- | --- | --- |
| <automation server, e.g. Appium> | <x.y.z> | <docs/environment.md> |
| <driver> | | |
| <engine that evaluates the source language> | <version, mode (e.g. XPath 1.0 / 2.0)> | |
| <engine that evaluates the target language> | | |
| <OS image / simulator runtime> | | |
| <host OS, toolchain> | | |
| Device or emulator id | <kept locally, never committed> | <local env file, git-ignored> |

Driver settings: <defaults only / list>. Settings that change lookup results: <list with defaults>.

## Scope

- Source forms in scope: <list>. Out of scope: <list, e.g. web XPaths, other platform>.
- Client languages for the scanner, by corpus frequency: <list with shares>.
- Strategy calls: <rewrite strategy and string / leave untouched and report>.
- Modes: `--exact` <yes/no>, default, `--loose` <yes/no, only on request>.

## Outcome classes

| Form | Target | Class | Decided by | Date |
| --- | --- | --- | --- | --- |
| <form> | <target or —> | <exact / close / skip> | <oracle case id, user> | <date> |

## Scoring (fixed before the first measurement)

- Version: <v1>. Credit: CORRECT <1>, DRIFT <0.5>, WRONG <−1>, INVALID <−1>, GAP <0>; CORRECT-SKIP outside the
  denominator.
- R denominator: <real locators with an exact or close form, from the frozen key>.
- S categories and weights: <A 15, B 15, …, sum 100>.
- Headline columns: R, S, C, **WRONG**, GAP.
- Comparison with other tools or models: <% of converter / Q formula with weights>.
- Published results: <list of articles, releases, charts and the scoring version each used>.

## Oracle

- Test app: <name, how screens are built (JSON at launch)>.
- Runner: <path>, outcomes `EQUAL`, `ORDER_DIFFERS`, `SET_DIFFERS`, `SOURCE_ONLY`, `TARGET_ONLY`, `SOURCE_ERROR`,
  `TARGET_ERROR`, `VACUOUS`.
- Trap screens: <list>.
- Run conditions: AC power, low-power mode off, display kept awake, headless, `--resume`.

## Corpus

- Edge cases (S): <expected count>, check script: <command>.
- Real-world (R): <projects, languages, how found>, anonymization: <method, salt kept outside the repo>.

## Stages

One branch and one PR per stage, into main. Share is of the usage window.

| # | Stage | Status | Result | Estimate |
| --- | --- | --- | --- | --- |
| 0 | Health check and plan | todo | | |
| 1 | Scaffold and pins | todo | | |
| 2 | Reference and edge cases | todo | | |
| 3 | Oracle (no converter yet) | todo | | |
| 4 | Real-world corpus | todo | | |
| 5 | Converter | todo | | |
| 6 | Fix loop: fuzz, mutants, matrix screens | todo | | |
| 7 | Scanner and CLI | todo | | |
| 8 | Report and release | todo | | |

## Progress

| Branch | Root causes | R | C | S | WRONG | GAP |
| --- | --- | --- | --- | --- | --- | --- |
| <baseline> | | | | | | |

## Decisions

1. <date>: <decision, who decided, why>.

## Parked findings

- <date>: <finding, the input that shows it, why it is parked>.
