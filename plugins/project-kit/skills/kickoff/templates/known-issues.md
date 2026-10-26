# Known issues and ideas

Problems that were found and deliberately not fixed, sorted by priority. The rule for what gets fixed and what lands here is the "Scope of fixes" rule in `CLAUDE.md`. A row leaves this file when it is fixed or when it turns out to matter (a user report, a corpus hit, a silent wrong result).

- **P1** — a silently wrong result (wrong output reported as success, a corrupted file, data loss) or a crash, on input a real user could have. Never stays here: fix it.
- **P2** — wrong or confusing, but visible to the user (a vague message, a surprising default), or a decision that is the maintainer's.
- **P3** — cosmetic, internal, or needs input that real data does not contain.

Last reviewed: <date>.

| Priority | Title | Item | Seen in the corpus | Fix when |
|---|---|---|---|---|
| <P1 / P2 / P3> | <a short name, shown in the list> | <what happens, with an input a real user could have> | <yes: how many / no / n/a> | <the change that would touch this code, or "never, unless …"> |

## Not bugs

- <behavior that looks wrong and is on purpose, with the reason>.

## Ideas

- <something worth doing if a user asks>.
