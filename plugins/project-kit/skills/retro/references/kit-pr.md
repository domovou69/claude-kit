# The kit PR

The retro's output for the kit is one PR to the claude-kit repository. It follows the repository's own layout.

## Before the branch

- Clone or update the kit repository (not the installed marketplace copy, which is replaced on every update).
- Branch from a fresh `origin/main`: `git switch -c retro/<date or topic> origin/main`. Never stack on an open PR; if
  the previous kit PR is not merged, ask the user to merge it first.

## What goes in

| Change | Where | With |
| --- | --- | --- |
| New hook rule in an existing plugin | `plugins/<plugin>/scripts/guard.js` and `hooks/hooks.json` | Test cases in `plugins/<plugin>/tests/*.test.js` (deny, ask, pass, a message that only mentions the command, the bypass); a row in the plugin README's hook table |
| New skill item | `plugins/<plugin>/skills/<skill>/SKILL.md` or a reference | The incident it prevents, generalized |
| Fixed description | The skill's front matter | "Use when …" in the words the user types; "Not for …" naming the sibling skills |
| Removed skill | The skill folder, README rows, marketplace description | One line in the PR on why (never invoked since <date>, no project needs it) |
| Every change above | `plugins/<plugin>/tests/past-mistakes.md` | A row: mistake, cost, source (repository and PR number, or "project notes" with the date), the item that catches it |
| New plugin (only for a new direction) | `plugins/<name>/` with `.claude-plugin/plugin.json` and a README | A row in `.claude-plugin/marketplace.json` and in the root README table |

Each plugin carries its own copy of the shell parser in `scripts/guard.js`, because plugins are installed separately;
a parser fix goes into every copy.

## Checks

- `node --test` from the repository root: all green.
- `claude plugin validate .` (and for the changed plugin): no errors. A missing `version` is expected; plugins track
  commits.
- The public-repo grep on the diff, before the commit:

  ```
  git diff --cached | grep -n -i -E '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{8}-[0-9a-f]{16}|team ?id|bundle|/Users/|/home/|@[a-z0-9-]+\.[a-z]{2,}|ghp_|github_pat_|npm_[A-Za-z0-9]{20}|sk-ant-'
  ```

  Every hit is either guidance text (the word "bundle id" in a rule) or removed.
- A live check for new hook rules: a fresh `claude -p` session with `--plugin-dir plugins/<plugin>` and a prompt that
  should be denied; hooks load at session start.

## The PR description

- What changed per plugin, in a short list.
- The table "memory → layer → change" from the retro report, anonymized (project names that are public are fine;
  private ones become "project A").
- Test count before and after; `plugin validate` result.
- The closing "Generated with Claude Code" line once; no attribution trailers in the commits.

After the user merges: `claude plugin marketplace update claude-kit`.
