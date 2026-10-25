# mobile-test-runs

Skills and hooks for device test runs and timing benchmarks that do not have to be redone.

| Skill | Use it when | Not for |
| :- | :- | :- |
| `mobile-test-runs:ios-simulator` | Preparing or running Appium / XCUITest runs or benchmarks on an iOS simulator | A physical iPhone, Android, cloud device farms, building a converter |
| `mobile-test-runs:ios-real-device` | The same on a physical iPhone or iPad over USB: signing, install once, ports, USB drops | The simulator, Android, cloud device farms |
| `mobile-test-runs:android-emulator` | Preparing or running Appium / UiAutomator2 runs or benchmarks on an Android emulator | Physical Android phones (not covered yet), iOS, cloud device farms |

Shared references: [run conditions](references/run-conditions.md) (power, `caffeinate`, devices, network, ports,
public repos), [long runs](references/long-runs.md) (resume, merge, background, monitor, stop file),
[timing method](references/timing-method.md) (cold lookups, passes, first-call costs, guest load, what to record).

## Hooks

Only rules that must always hold are hooks. `scripts/guard.js`, Node, no dependencies; it parses the shell command
(quotes, `&&`, pipes, heredocs, `bash -c`), so a commit message that mentions a benchmark is not a benchmark.

| Event | Rule | Effect |
| :- | :- | :- |
| `PreToolUse` Bash | A **timed run** on battery or in Low Power Mode (macOS) | Denied. With `MOBILE_RUNS_ALLOW_BATTERY=1` in front of the command the user is asked instead |
| `PreToolUse` Bash | A **timed or device run** with no `caffeinate` in the command and no display-sleep assertion held | Denied, with the command to use |
| `PreToolUse` Bash | A **timed run** while an Android emulator runs with a window | Denied, with the headless start command |
| `PreToolUse` Bash | Creating, cloning, erasing or deleting simulators / AVDs, adding runtimes, downloading platforms or system images | The user is asked |
| `PostToolUse` Bash | A timed or device run started in the background | Claude gets a reminder to arm a progress monitor and to use `--resume` |

What counts as a timed or device run, and how to add your own runner, is in
[run conditions](references/run-conditions.md#the-hooks-patterns) (`.claude/mobile-test-runs.json`). On an internal
error the hook lets the command through and says so on stderr. A project config with `"defaults": false` switches the
built-in patterns off, and the hook says so on stderr every time. Host checks run on macOS only; the "ask first" rule
runs everywhere.

## Test

From the repository root: `node --test`. [tests/past-mistakes.md](tests/past-mistakes.md) replays eight real
mistakes from three projects; each must map to a hook rule or a skill item.

## Install

```
/plugin install mobile-test-runs@claude-kit
```

Then ask by task ("run the benchmark on the emulator") or call `/mobile-test-runs:android-emulator`.
