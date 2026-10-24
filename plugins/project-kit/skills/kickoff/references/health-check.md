# Health check

Before a project depends on a technology, check that it will still be there for the project's horizon. The check
that matters most is also the easiest to skip: the deprecation notice is often in the vendor's README, one level
below the tool the project actually uses.

A worked example: a converter to a mobile locator strategy was built through eleven PRs before anyone noticed that
the driver's README warned the platform vendor would remove that strategy (announced a year earlier). The fix was a
documentation PR about the risk, a planned second target, and a rule: health check first, verdict first.

## What to check

For every key technology (the language, framework, API, locator strategy, driver, service, data source):

| Question | Where to look |
| --- | --- |
| Is it deprecated or announced for removal? | The project's own README and docs; **the README of every layer above and below it** (driver → server → the platform library it wraps); release notes; the vendor's own docs |
| Is it maintained? | Last release and last commit dates; release cadence over the last year; open issues and PRs that mention `deprecat`, `remove`, `sunset`, `end of life`, `replacement` |
| Where is the vendor moving? | A new API that does the same job, and what it says about the old one; conference talks or blog posts by the maintainers |
| What does it depend on? | The dependency chain to the platform (for example test driver → automation server → platform UI library); each link gets the same questions |
| What would break the project? | A removal, a licence change, an API key or a paid tier, a platform version that drops it |

Use the source itself (README, changelog, issue search on the repository) and quote it with a link. A search
summary is a lead, not evidence.

## The verdict

The first section of PLAN.md, one row per technology:

| Component | Latest release | Deprecation notices | Vendor direction | Verdict |
| --- | --- | --- | --- | --- |
| <name> | <version, date> | <quote with link, or "none found"> | <what replaces it, if anything> | <green / yellow / red, horizon in years> |

- **Green**: maintained, no notice, no replacement in sight. Go.
- **Yellow**: maintained, but a replacement exists or a removal is talked about without a date. Compare 2–3
  alternatives (what each costs now, what each saves later) and let the user decide; write the decision and the
  watch item (what to re-check, how often) into the plan.
- **Red**: a removal is announced or the project is unmaintained. Do not start on it without the user's explicit
  decision; propose the alternative first.

## Repeat it

- At every major pivot (a new target, a new data source, a new platform version).
- When the project is published: a watch on what it depends on (the `publishing:npm-release` skill describes an
  upstream watch) catches a deprecation after the start.
