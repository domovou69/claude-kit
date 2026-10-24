# Replay test: past mistakes

Eight real mistakes from device runs in three projects
([xpath-to-class-chain](https://github.com/domovou69/xpath-to-class-chain), "CC";
[xpath-to-uiselector](https://github.com/domovou69/xpath-to-uiselector), "US";
[appium-android-locator-benchmark](https://github.com/domovou69/appium-android-locator-benchmark), "AB").
The test: a project that follows this plugin must not hit any of them, or must hit it at once with a clear message.
Every row names the hook rule or skill item that catches it. When the plugin changes, replay this table; a row with no
matching item is a regression. The hook rows are also covered by `tests/guard.test.js`.

| # | Mistake | Cost | Source | Caught by |
| --- | --- | --- | --- | --- |
| P01 | **Low Power Mode / battery.** The first iOS simulator scale run went on battery with Low Power Mode on; an Android emulator later built a 2000-view screen 6–40× slower in Low Power Mode | A second run on AC power; a power footnote on every simulator table | CC #12 and project notes; AB spike (project notes) | **Hook** `pre`: timed run denied on battery or in Low Power Mode (bypass only with the user's confirmation); [run conditions](../references/run-conditions.md) "Power" |
| P02 | **Display sleep.** `caffeinate` was not started; the display slept during the matrix fuzz and the emulator went from ≈0.8 s to ≈4 s per item | A slow, suspect run; user had to point it out | US #7 and project notes | **Hook** `pre`: device and timed runs denied without `caffeinate` or a display-sleep assertion; [run conditions](../references/run-conditions.md) "Display and system awake" |
| P03 | **USB tunnel drops.** The tunnel to the iPhone dropped when the Mac's display slept, and twice right after the heaviest lookups | Two partial runs; cases rerun and merged by hand | CC #12, CC #11 | **Hook** `pre` (`caffeinate`); [ios-real-device](../skills/ios-real-device/SKILL.md) "The USB tunnel will drop"; [long runs](../references/long-runs.md) `--only` / `--merge` |
| P04 | **Hidden emulator window.** With the emulator window hidden or minimised, macOS deprioritised it: lookups at 2000 elements jumped between ~1 s and ~6 s with a quiet guest | Disturbed passes; a new AVD and a rerun | AB #8 | **Hook** `pre`: timed run denied while an emulator runs with a window; [android-emulator](../skills/android-emulator/SKILL.md) "Start it headless" |
| P05 | **Play image load.** Play services background compilation on a Google Play image pushed the guest load to 5–9 in the middle of passes | The Play run set aside; benchmark moved to an AOSP image | AB #8 | [android-emulator](../skills/android-emulator/SKILL.md) "Image choice for timings"; [timing method](../references/timing-method.md) "Keep the device quiet" (guest-load wait, discard and repeat) |
| P06 | **New devices without asking.** The user had to state twice that runs use the one existing simulator / AVD and that new ones need consent; images are gigabytes on a hotspot | Risk of a look-alike device and a large download on a metered link | CC and AB project notes | **Hook** `pre`: `simctl create/clone/delete/erase/runtime add`, `xcodebuild -downloadPlatform`, `avdmanager create/delete`, `sdkmanager system-images;…` ask the user; [run conditions](../references/run-conditions.md) "Devices and images", "Network" |
| P07 | **Silent background run.** A 25–40 minute device run went on with no status; the user could not tell progress from a hang | The user's standing rule: a progress ping every 5–10 minutes | CC project notes | **Hook** `post`: a background device run gets the monitor reminder; [long runs](../references/long-runs.md) "Running in the background" |
| P08 | **App reinstalled per session.** Letting Appium reinstall the app for every session on a real iPhone made iOS refuse launches | Failed sessions until the app was installed once and launched by bundle id | CC #11 | [ios-real-device](../skills/ios-real-device/SKILL.md) "Setup" step 5 |

Checked on 2026-10-25: 8 of 8 rows map to a hook rule or a skill item.
