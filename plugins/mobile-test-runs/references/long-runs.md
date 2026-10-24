# Long runs

A device run that takes more than a few minutes will be interrupted sooner or later: a USB tunnel drops, an Appium
proxy times out, a session limit hits, a laptop lid closes. Design every runner so that an interruption costs
minutes, not the run.

## The runner

| Must | Why |
| --- | --- |
| Write results after every item (or every screen / size), atomically (temp file + rename) | Partial data survives a crash |
| `--resume`: skip items already in the results file | A dropped run continues where it stopped |
| `--only <ids>` and `--merge <file>`: rerun some items and replace them in the run | A USB drop on two screens costs two screens, not the run |
| `--redo <sizes>` for timed passes | A disturbed pass is replaced, not averaged in |
| `--out <name>`: results for a second configuration go to a new file | The first run's files stay byte for byte |
| Versions and host state in the file header | The file explains itself without the chat |
| Retry opening a session a few times | The first session after a device boot often fails |
| Exit codes: 0 done, 2 refused (power, missing device), other = crashed | A monitor can tell the three apart |

Record what you did with interrupted runs in the report: "USB dropped twice on the `states` screen; those cases were
rerun with `--only` and merged; an earlier attempt that stopped after 196 cases serves as the repeat (all 196
outcomes match)."

## Running in the background

1. Estimate the time first (items × seconds per item, from a short smoke run) and say it to the user.
2. Start the run in the background (Claude Code: `run_in_background`), under `caffeinate`.
3. Arm a progress monitor at once. Every 5–10 minutes it reports done / total, errors and the current step, and it
   emits immediately when the run finishes, fails or the process is gone. A monitor expires (Claude Code's `Monitor`
   lasts up to 30 minutes): re-arm it until the run ends. The plugin's hook reminds you after a background device run
   starts.
4. Post one short status line on every ping. Silence during a 25–40 minute run looks like a hang to the user.

A monitor can be a loop over the results file:

```sh
while kill -0 <pid> 2>/dev/null; do
  sleep 300
  node -e 'const r=require("./results.json"); console.log(`${r.items.length}/${r.total} done, ${r.items.filter(x=>x.error).length} errors`)'
done; echo "run ended"
```

## Stopping a run

- Prefer a stop file the runner checks between items (`touch STOP`) over killing it. Killing a wrapper script in the
  middle of a wave did not stop the next wave it had already scheduled.
- After a stop, `--resume` must continue cleanly; test that once on a short run before the long one.

## Chunks

Split a long run into chunks the user can see finish: per screen, per size, per batch of about 100–150 items. A chunk is
also the unit of `--resume` and `--merge`. Very long single commands (one `am start` with a whole screen, one shell
line with a large payload) hit device limits; see the Android skill.
