# Upstream watch

A tool that encodes another project's behaviour (a locator converter encodes what the driver and its server accept)
goes stale silently when that project changes. A monthly workflow that compares the versions the tool was checked
with against the latest releases, and opens an issue only when something that matters changed, keeps the README's
"checked with" line honest.

## Shape

- `upstream.json` in the repo: the checked version of each component (single source of truth, the README quotes it)
  and the watched files per component (the source files the tool's rules cite).
- A check script: latest versions from the npm registry or GitHub releases; the files changed between the checked
  and the latest tag; writes an input file only when a watched file changed.
- Optional analysis step: an LLM reads the diff and says "important / not important" (when unsure: important). A
  deterministic variant (issue on any watched-file change, listing the rules that cite each file) needs no secret
  and was enough for the second project.
- Issue only when important, with a label (`upstream`) and a dedup key, so a re-run does not open a second one.
- Tracked issues: an upstream issue that could break the tool (for example a planned deprecation) is watched for
  state and new comments, with a "what you need to do" line.

## Pitfalls seen

- **The compare API stops at 300 files.** Comparing two tags of a large project through the GitHub compare endpoint
  missed a watched file; diff the two git trees instead.
- **`workflow_dispatch` works only once the workflow is on `main`.** Tests through Actions (a dry run with an old base
  version, a real issue, a broken secret on a branch) come after the merge; test the scripts locally first.
- A server package on npm may have no matching git tag: take the version the latest driver pins.
- With an LLM step, record the model and effort in the issue, keep effort low (`medium` was enough), and fail the job
  on an invalid report instead of opening an empty issue.

## Cost

One monthly run with an LLM step cost $0.05 when nothing mattered and $0.21 when nine files changed. The
deterministic version costs nothing.
