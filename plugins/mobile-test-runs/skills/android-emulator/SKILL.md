---
name: android-emulator
description: Use when preparing or running Appium / UiAutomator2 (also Espresso via `gradlew connected…AndroidTest`, Maestro, Detox, Flutter drive) test runs or timing benchmarks on an Android emulator (AVD) — choosing the system image, starting it headless, keeping the guest quiet, adb and intent size limits, local Appium setup, long background runs with --resume, and recording the host state. Not for physical Android phones (not covered yet), not for iOS (mobile-test-runs:ios-simulator or ios-real-device), not for cloud device farms, and not for building a locator converter itself (locator-converter:build).
---

# Android emulator runs

Shared rules first: [run conditions](../../references/run-conditions.md), [long runs](../../references/long-runs.md)
and, for timings, [timing method](../../references/timing-method.md). The plugin's hook enforces power, `caffeinate`
and a headless emulator for timed runs, and asks before an AVD is created or deleted or a system image installed.

## Before the first run

1. **One named AVD.** Use the AVD the project plan names (`emulator -list-avds`). If it is missing, ask; do not
   create one. Record its image, API level, cores, RAM, screen and build fingerprint.
2. **Image choice for timings: AOSP (`default`), not Google Play.** On a Play image, Play services background work
   (`artd` compiling `com.google.android.gms`) pushed the guest load average to 5–9 in the middle of passes. Keep a
   Play AVD for compatibility checks; time on AOSP. A second Android version from an AVD that already exists is
   cheaper than a download; ask before downloading an image.
3. **No `cmdline-tools`?** Android Studio may install the SDK without `sdkmanager` / `avdmanager`. An image can be
   downloaded from the official repository URL with its published SHA-1 checked and the AVD config copied from an
   existing one with the image changed; only with the user's OK.
4. **Environment.** Appium needs `ANDROID_HOME` and `JAVA_HOME` (Android Studio's bundled JBR works).
5. **Appium locally.** `appium` and `appium-uiautomator2-driver` as exact devDependencies; deny Appium's
   `postinstall` extension installs; record the on-device UiAutomator2 server version (`dumpsys package`).
6. **Ports.** A project-specific Appium port (`APPIUM_URL`) when another project may run at the same time.
7. **Release build** of the test app for timings (`./gradlew installRelease`); a runner refuses a debuggable build
   unless asked.

## Start it headless for timed runs

```sh
emulator -avd <name> -no-window -no-snapshot-load -no-boot-anim -no-audio
```

With a window that was hidden or minimised, macOS deprioritised the emulator: at 2000 elements lookups jumped
between ~1 s and ~6 s while the guest load stayed quiet. Headless, the emulator ran at a steady 125–140 % host CPU in
every pass. One emulator at a time.

## Keep the guest quiet

- Wait for the guest's 1-minute load (`adb shell cat /proc/loadavg`) to fall below 1.5 before every pass, not only
  before each size.
- Discard and repeat a pass that ends with load above 3, at most twice; keep discarded passes in the file.
- Record the qemu process's host CPU per pass and the emulator command line.

## Pitfalls that cost a rerun

| Pitfall | What to do |
| --- | --- |
| `adb shell` refused a long command line | Send large payloads through the device shell's stdin |
| One `am start` argument is capped at about 128 KB | Split screens into batches (≈143 items per batch worked, not ≈500) |
| `snapshotMaxDepth=70` limits XPath and page source, not `UiSelector` | Keep targets above it, or add one case below it to show the limit |
| First lookup after an app start: +400–900 ms at 2000 elements, any strategy | A throw-away lookup after each launch |
| Edge-to-edge layouts hide views under the status bar; only on-screen views count with default settings | Check the target is on screen before timing it |
| A toast left from a previous step shows up in the next lookup | Wait it out or set it aside before comparing results |
| A second window is invisible to both strategies by default; with `enableMultiWindows` only XPath sees it | Keep test screens in one window |
| Appium proxy timeouts during long fuzz runs | `--resume` reruns only the pairs that failed in transit |

## Versions on another API level

Comparing two Android versions: run the same cases with `--out <name>` so the first run's files stay untouched, and
compare pair by pair. Bounds move between versions (window and row heights); compare elements, not coordinates.

## After the run

Stop the emulator and Appium you started unless the next step needs them; never stop ones you did not start.
