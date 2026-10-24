# locator-converter

Skills for building converters between test locator languages.

| Skill | Use it when | Not for |
| :- | :- | :- |
| `locator-converter:build` | Planning, building, auditing or extending a converter such as XPath → iOS class chain or XPath → Android `UiSelector` | Converting a suite with an existing converter, device test runs, LLM-versus-tool benchmarks on their own, non-locator DSLs |

## What `build` gives you

- A workflow: health check → plan and pins → reference and edge cases → **oracle on the real engine** →
  real-world corpus → converter → fix loop → scanner → report.
- Five hard rules: never a silent wrong locator; oracle before converter; scoring weights fixed before the first
  measurement; WRONG as a separate headline; published results never rescored. Everything else is advice.
- References: [oracle](skills/build/references/oracle.md), [semantics traps](skills/build/references/semantics-traps.md),
  [outcomes](skills/build/references/outcomes.md), [fix loop](skills/build/references/fix-loop.md),
  [scanner](skills/build/references/scanner.md), [scoring](skills/build/references/scoring.md),
  [corpus](skills/build/references/corpus.md).
- Platform appendices: [iOS (WDA, class chain, NSPredicate)](skills/build/references/platform-ios-wda.md),
  [Android (UiAutomator2, UiSelector)](skills/build/references/platform-android-uiautomator2.md).
- A plan template with empty slots: [templates/PLAN.md](skills/build/templates/PLAN.md).

Examples are in Node. The method should fit other selector or query DSLs; only locator languages were tested.

## Test

[tests/past-mistakes.md](tests/past-mistakes.md) replays fifteen real mistakes from the two source projects; each
must map to an item of the skill.

## Install

```
/plugin install locator-converter@claude-kit
```

Then ask for it by task ("plan an XPath to class chain converter") or call `/locator-converter:build`.
