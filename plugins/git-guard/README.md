# git-guard

A `PreToolUse` hook on the Bash tool: every change goes through a branch and a PR, never straight to `main`.

```
/plugin install git-guard --marketplace domovou69/claude-kit
```

It is meant for user scope, so it guards every project.

## What it blocks

- `git commit` while the current branch is `main` or `master`.
- `git push` whose target on the remote is `main` or `master`: a plain `git push` from `main`, `git push origin main`, `HEAD:main`, `topic:main`, `--all`, `--mirror`, deleting `:main`.

The command is parsed, not grepped: it finds `git` inside `&&`, `||`, `;`, pipes, `( )` subshells, `{ }` groups, `$( )`, backticks, `bash -c "…"`, `eval`, after `FOO=1`, `env`, `sudo`, with `git -C <dir>`, `git -c k=v` or an absolute path to `git`. `cd <dir> &&` and `git switch -c` / `git checkout -b` earlier in the same command are taken into account, so `git switch -c topic && git commit -m …` passes. Quoted text and heredoc bodies (commit messages) are not treated as commands.

On a block the hook exits 2 and tells Claude: *create a branch first: `git switch -c <topic>`*.

## Exceptions

- **First commit of a new repository**: allowed when the repository has no commits yet (`git rev-parse HEAD` fails).
- **First push of a new repository**: a push to `main`/`master` is allowed when the remote does not have that branch yet and the local branch holds exactly one commit. If the remote cannot be reached, the push is blocked.

Pushing another branch while `main` is checked out is allowed: it does not change `main`.

## Limits

It guards what Claude runs through the Bash tool, not your own terminal. It cannot see through git aliases, scripts that run git, or commands assembled from variables. On an internal error it lets the command through and says so on stderr.

## Tests

From the repository root, with Node 18 or newer and git:

```
node --test
```

Each case builds throwaway repositories (and bare remotes) in the temp directory and checks the hook's exit code.
