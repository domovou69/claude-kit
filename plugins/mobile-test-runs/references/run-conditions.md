# Run conditions

Rules for the host and the devices, shared by every skill in this plugin. Three of them are enforced by the plugin's
hook (marked **hook**); the rest are checks you do yourself before a run.

## Power: AC, Low Power Mode off (hook, timed runs)

Timings taken on battery or in Low Power Mode are not comparable with anything else.

- An Android emulator built a 2000-view screen in 6–7.5 s in Low Power Mode on battery, against 0.15–1 s on AC:
  6–40× slower.
- An iOS simulator run on battery with Low Power Mode on was 14–16 % slower in absolute time than the same run on AC.
  The XPath / class chain ratios were the same, so ratios survive; absolute numbers do not.

Before a timed run: `pmset -g batt` must say `AC Power`, and `pmset -g` must show `lowpowermode 0`. If not, ask the
user to plug in and wait. Waiting is fine; measuring anyway is not.

A deliberate battery measurement (for example "how much slower is battery?") is a separate, named run. The hook
lets it through only with `MOBILE_RUNS_ALLOW_BATTERY=1` in front of the command, and then the user confirms it.

Record the power state in every result file, next to the numbers: `power` (AC / battery), `lowPowerMode`, CPU, RAM,
OS version. Readers compare against their own machines.

## Display and system awake (hook, timed and device runs)

With the display asleep macOS slows the emulator down (≈0.8 s → ≈4 s per item, about 5×) and drops the USB tunnel to
a real iPhone. Run every device run under `caffeinate`:

```sh
caffeinate -dimsu node bench/scale.js --resume        # caffeinate lives as long as the run
caffeinate -dimsu -w <pid>                            # or tie it to a process that is already running
```

A runner may also spawn it itself; it is cheap, and a duplicate does no harm:

```js
if (process.platform === 'darwin')
  require('node:child_process').spawn('caffeinate', ['-dimsu', '-w', String(process.pid)], { stdio: 'ignore', detached: true }).unref();
```

Check during a run: `pmset -g assertions` shows `PreventUserIdleDisplaySleep 1`.

## Devices and images: ask first (hook)

- Reuse the device named in the project plan: one simulator, one AVD, one phone. Do not create, clone, erase or
  delete simulators or AVDs, and do not download simulator runtimes or system images, without the user's OK. The
  hook turns these commands into a question to the user.
- If the named device is missing, stop and ask; do not create a look-alike.
- Run one emulator or simulator at a time for timed runs.

## Network

- Ask before large downloads (simulator runtimes ≈8 GB, emulator images ≈1 GB, Xcode components). The host may be on a
  phone hotspot or a metered link.
- On a phone hotspot macOS marks the link as expensive, and `mobileassetd` downloads (Xcode's platform download,
  `xcodebuild -downloadPlatform`) can hang at "Preparing to download…" indefinitely. A reboot does not help. The iOS
  skill has the workaround.
- Prefer offline installs where you can: `npm --offline` from the cache, Gradle `--offline`.

## Ports and parallel projects

- Each project that may run at the same time gets its own Appium port (4723, 4724, …) through an environment
  variable, and its own WDA port (the simulator's WDA holds 8100; give a real device 8101).
- Never `pkill appium` or kill an emulator you did not start: another project may be running on it.

## Versions

Pin and record, next to every result: Appium, the driver, the on-device server (WDA, UiAutomator2 server), Xcode or
the Android SDK tools, the OS image, the app build (release or debug), Node. Install Appium as a local
devDependency, not globally, so each project keeps its own versions.

## Public repositories

Never commit device identifiers (UDIDs, serials), signing team IDs, personal bundle ids, local paths or account
names. Keep them in environment variables or an ignored local file; results record the device model and OS version
instead.

## The hook's patterns

The hook treats a command as a **timed run** when it runs a file named `bench`, `benchmark`, `perf` or `scale`
(`node bench/scale.js`, `python3 benchmark.py`, `./bench.sh`) or a package script named `bench…` / `perf…`
(`npm run bench:scale`). It treats as a **device run**: `xcodebuild test`, Gradle `connected…AndroidTest` /
`connectedCheck`, `maestro test`, `detox test`, `flutter drive`. Add your own runners in
`.claude/mobile-test-runs.json` at the project root:

```json
{
  "timedRuns": ["^node audit/device/run\\.js"],
  "deviceRuns": ["^node audit/device/fuzz\\.js", "^npx wdio"],
  "defaults": true
}
```

Each entry is a regular expression matched against one simple command after `VAR=…`, `nohup`, `caffeinate` and similar
prefixes are removed. `"defaults": false` turns the built-in patterns off.
