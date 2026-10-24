# Cost, time and chunks

## Where the numbers come from

- **Cost:** the CLI's `total_cost_usd` from the result line, per run (per chunk, summed). It is computed at API list
  prices even when the run uses a subscription, so it is "what this would cost on the API", not what the user paid.
  Say so in the report.
- **Tokens:** `usage` from the result line (input, cache write, cache read, output, thinking). Summing per-message
  usage from `stream-json` undercounts output; use it only for a chunk that stopped before its result line, and
  mark such a run as incomplete in cost.
- **Time:** minutes per run (sum of chunk times). With chunks in parallel, also give the wall-clock time of the wave.

## Check numbers that look wrong

A Haiku run came out at $0.12 for 680 inputs, which looked too low next to Sonnet's $0.95. It was checked against the
price list before publishing: list prices apply, with a higher rate above a request-size threshold, and per run
Haiku was only 3–8× cheaper than Sonnet (the rules wave: $0.33 against $0.89). Before a cost number goes into a table: check the model's current list
price, the cost basis the CLI used, and whether some chunks have no result line.

## The usage window

- Estimate each wave before it starts: minutes, and share of the 5-hour window. Offer a cheaper variant (fewer cells,
  one effort, a smaller sample).
- `max` effort: blocked by the plugin's hook. Two Opus `max` attempts took 81 minutes and $12.98 together and produced
  no usable result; one was cut off by the session limit at 460 of 678 answers, the retry on the rest wrote nothing.
- Never two expensive runs in parallel; cheap runs in parallel are fine and save wall time.
- If the window runs low mid-wave, stop with the stop file and resume after the reset; finished chunks are kept.

## Chunks

| Without chunks | With chunks |
| --- | --- |
| Sonnet 4.6 wrote nothing for the whole 678-item file in 20 minutes | 7 chunks of 100: done in 23 minutes, $2.58 |
| An Opus `max` retry ran 42 minutes and wrote no file | A stopped chunk loses only that chunk |
| One older model answered 100 of 678 in one run and none in another | Missing ids are found per chunk and rerun |

- 50–100 items per chunk; the same prompt with only the count changed.
- Each chunk is an isolated run with its own record (`chunk-N.json`: ids, valid, missing, cost, tokens, time,
  output).
- `--resume` is the default: a valid chunk is skipped. Merge only when every chunk is valid.
- A timeout per chunk (10 minutes worked); a chunk that times out is saved as failed with whatever usage it had.
- Stop with a stop file checked between chunks (`touch STOP`). Killing a wrapper script mid-wave did not stop the next
  wave it had already scheduled.
- Report a chunked run as such ("7 × 100 chunks"); its conditions differ from a one-request run.

## Long waves in the background

Start a wave in the background, arm a progress monitor (done chunks / total, cost so far, errors) every 5–10 minutes,
re-arm it until the wave ends, and post a short status line on every ping.
