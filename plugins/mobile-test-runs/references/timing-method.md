# Timing method

How to take timings on a simulator, an emulator or a phone that you can publish. The rules on the host
([run conditions](run-conditions.md)) come first; this file is about the measurement itself.

## Decide before the first measurement

Write these in the plan and do not change them after seeing numbers:

- **What one sample is.** Example: one cold `findElements` call on the current screen, timed on the client.
- **Warm or cold.** Real tests look an element up once; a warm-up plus repeats measures something nobody runs.
  Cold lookups were the user-approved choice in both locator benchmarks.
- **Passes.** For example 3 passes, median per case. One pass per case is enough for a sanity check, not for a table.
- **Order.** Alternate which side goes first (A/B, then B/A) so caches and thermal state do not favour one side.
- **Sizes.** Realistic sizes (100–500 elements) and stress sizes (1000–2000) are reported separately and named as such.
- **What is reported.** Both milliseconds and per cent saved; a geometric mean of per-case speedups; how many cases
  were faster. Per cent alone hides that the saving in ms grows while the per cent falls.

## Separate first-call costs

- The first lookup after an app start cost an extra 400–900 ms at 2000 elements for every strategy on Android. Do a
  throw-away lookup after each launch, or start the clock after it.
- The first Appium session on a fresh device installs the on-device server (18 s on Android). Never time a session
  start together with lookups.
- UiAutomator2 resets its accessibility cache before each lookup by default, so repeats are not faster; WDA keeps
  snapshots per request. Check what your stack caches before you decide warm or cold.

## Keep the device quiet

- **Emulator guest load.** Read `/proc/loadavg` over `adb shell` before every pass; wait until the 1-minute load is
  below a threshold (1.5 worked). After the pass, discard and repeat it if the load rose above another threshold (3),
  at most twice; keep discarded passes in the file (`discardedPasses`) instead of deleting them.
- **Host CPU of the emulator.** Record the qemu process's CPU time per pass (`ps -o time= -p <pid>`). A steady 125–140 %
  meant a healthy pass; a quiet guest with slow lookups and low host CPU meant macOS had deprioritised the emulator.
- **Build type.** Time a release (not debuggable) build; refuse a debuggable build unless asked (`--allow-debug`).
- **Background work.** Images with store services do background compilation that a load check catches only
  sometimes; see the Android skill.

## Record with every result

Host (CPU, RAM, OS, power, Low Power Mode), device (model, OS, build fingerprint or simulator runtime), stack
versions, app build type, the emulator command line, passes kept and discarded, guest load and host CPU per pass.

## Limits section

Every timing report ends with what it does not cover: implicit waits and retries, synthetic screens, one driver
version, one device and OS, the host and its power states, emulator versus real phone. Readers trust a table more
when its limits are written next to it.
