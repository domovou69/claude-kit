---
name: ios-simulator
description: Use when preparing or running Appium / XCUITest (also `xcodebuild test`, Maestro, Detox, Flutter drive) test runs or timing benchmarks on an iOS simulator — picking and pinning the simulator, installing a runtime, WDA and xcuitest-driver setup, page source and lookup pitfalls, long background runs with --resume, and recording the host state. Not for a physical iPhone (use mobile-test-runs:ios-real-device), not for Android (mobile-test-runs:android-emulator), not for cloud device farms, and not for building a locator converter itself (locator-converter:build).
---

# iOS simulator runs

Shared rules first: [run conditions](../../references/run-conditions.md) (power, `caffeinate`, devices, network,
ports), [long runs](../../references/long-runs.md) (background, monitor, `--resume`) and, for timings,
[timing method](../../references/timing-method.md). The plugin's hook enforces power, `caffeinate` and asking before
a new simulator or runtime.

## Before the first run

1. **One named simulator.** Use the simulator the project plan names (device type, runtime, its identifier kept in
   an environment variable or an ignored local file, not in a public repo). `xcrun simctl list devices` to find it.
   If it is missing, ask the user; do not create another.
2. **Pin the stack** and write it into the results: Xcode build, simulator runtime build, Appium, xcuitest-driver,
   WDA version (the driver's pinned one; note when a newer one exists and you did not use it).
3. **Appium locally.** `appium` and the driver as exact devDependencies with `APPIUM_HOME` inside the project, so a
   global Appium or another project's driver never leaks in.
4. **Ports.** WDA on 8100 for the simulator; Appium on a project-specific port when another project may run at the
   same time.
5. **A smoke session** that opens the app and finds one element by each strategy you will measure.

## Runtime missing or download stuck

`xcodebuild -downloadPlatform iOS` and Xcode's own download fetch through `mobileassetd`. On a phone hotspot (macOS
marks it expensive) they stayed at "Preparing to download…" for good; a reboot did not help. Ask the user before any
runtime download (≈8 GB). Workaround that worked:

1. Read the asset catalog for the runtime under
   `/System/Library/AssetsV2/com_apple_MobileAsset_iOSSimulatorRuntime/…xml`: base URL + relative path (a public Apple
   CDN URL), the archive decryption key and the SHA-256.
2. Download with resume and a stall limit in a retry loop (`curl -C - --speed-limit 50000 --speed-time 60`), then
   verify the SHA-256.
3. `aea decrypt` with the key, extract the archive (its payloads may be pbzx-compressed), and add the disk image
   with `xcrun simctl runtime add <file>.dmg`.

## Pitfalls that cost a rerun

| Pitfall | What to do |
| --- | --- |
| xcuitest-driver hides WDA selector errors: `findElements` returns `[]` for an invalid XPath or class chain | An empty result is never a pass. Plant a target that must match, and treat "nothing found on both sides" as its own outcome |
| XCTest returns matches breadth-first (XPath and class chain alike), not in document order | Compare result lists as lists; a position (`[n]`) can pick another element than the XPath on the host would |
| Default page source took 53 s at 1000 elements | Exclude expensive attributes (`pageSourceExcludedAttributes=visible`) and measure source separately from lookups |
| WDA snapshot depth limit (default 50): nothing below it is found, by any strategy | Keep targets above the limit, or add one case below it to show the limit |
| `visible` in the last step of a query was ~6× slower | Time it as its own case, do not mix it into an average |
| SwiftUI merges single-child containers, so a deep test tree flattens | Build deep test branches in UIKit inside the SwiftUI app |
| Another project kills Appium (`pkill appium`) during your run | Separate Appium port per project; never kill processes you did not start |

## Timed runs

- AC power and Low Power Mode off, enforced by the hook; record the host state per load or size.
- A battery-versus-AC comparison is a separate named run (`MOBILE_RUNS_ALLOW_BATTERY=1`, the user confirms). On an
  M1 Pro the ratios between strategies were identical on battery and AC; absolute times were 14–16 % faster on AC.
- Cold lookups, alternating order, 3 passes and the median per case; see [timing method](../../references/timing-method.md).
- Simulator times are not phone times: a phone was 2.6× slower at 100 elements and 1.55× at 1000+ (fixed per-request
  USB overhead). Say so next to the table.

## After the run

Leave the simulator and Appium running only if the next step needs them and the user agrees; otherwise stop what you
started. Results, versions and host state go into the repo; the simulator identifier does not.
