---
name: ios-real-device
description: Use when preparing or running Appium / XCUITest test runs or timing benchmarks on a physical iPhone or iPad over USB — WDA signing with a personal team, installing and launching the app, ports next to a simulator, USB tunnel drops, reruns and merges, and keeping identifiers out of a public repo. Not for the iOS simulator (use mobile-test-runs:ios-simulator), not for Android phones or emulators, not for cloud device farms, and not for building a locator converter itself (locator-converter:build).
---

# iOS real-device runs

Shared rules first: [run conditions](../../references/run-conditions.md), [long runs](../../references/long-runs.md)
and, for timings, [timing method](../../references/timing-method.md). The plugin's hook enforces power and
`caffeinate`: with the Mac's display asleep the USB tunnel to the phone dropped.

Run the same cases on the simulator first (mobile-test-runs:ios-simulator). The phone run then answers one question:
does anything differ on hardware?

## Setup

1. **Signing.** A free Apple ID gives a personal team. Pass the team ID through an environment variable
   (`XCODE_ORG_ID`) and never commit it. WDA and the test app need bundle ids under a prefix you own; keep them in an
   ignored local config, not in a public repo.
2. **Trust.** With a free account, every newly installed app must be trusted on the phone (Settings → General → VPN &
   Device Management) before it launches. Ask the user to do it; Claude cannot.
3. **Device identity.** The device's UDID goes into an environment variable or an ignored local file. Results record
   the model and iOS version only.
4. **Ports.** The simulator's WDA holds 8100; give the phone 8101 (`appium:wdaLocalPort`). A runner can choose
   real-device mode by finding the UDID in a local `devices` list.
5. **Install the app once** (`xcrun devicectl device install app …`) and start each session by `bundleId`. Letting
   Appium reinstall the app for every session (`appium:app`) made iOS refuse launches.
6. **Retry session start** a few times; the first session after connecting the phone often fails.
7. **Auto-lock.** The user may not want auto-lock turned off on their own phone; ask. `caffeinate` keeps the Mac
   awake, not the phone; a locked phone ends the session, so keep runs in chunks that fit.

## The USB tunnel will drop

It dropped twice in one run, both times right after the heaviest lookups, and once when the Mac's display slept.
Plan for it:

- Write results after every screen; `--resume` continues; `--only <ids>` reruns the affected cases and `--merge`
  puts them into the run ([long runs](../../references/long-runs.md)).
- Do not repeat a whole run for a drop. If an earlier attempt covered part of the cases, it can serve as the repeat
  when its outcomes match; say so in the report.
- Watch for a session that fails every request after a drop: reconnect, then resume.

## What to expect against the simulator

- Outcomes (which elements a locator finds) matched the simulator in all 246 cases; differences came from the larger
  screen (more rows), the device locale (`Favourite`) and a scroll bar, and they hit both sides equally.
- Lookups took about 2.2× as long on the phone, for both strategies; the ratio between strategies stayed the same.
- At small trees the fixed USB cost per request dominates (2.6× the simulator at 100 elements, 1.55× at 1000+).

## Timed runs

Same as the simulator: AC power, Low Power Mode off, cold lookups, 3 passes, median, host and device recorded; see
[timing method](../../references/timing-method.md). Report the phone and simulator side by side with the same scale.

## After the run

Leave the phone's state as you found it: the trusted developer apps can stay only if the user agrees. Nothing that
identifies the phone, the team or the user's bundle prefix is committed.
