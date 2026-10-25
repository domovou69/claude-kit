# claude-kit

A personal [Claude Code](https://code.claude.com) plugin marketplace: skills and hooks distilled from real projects, reused across them.

Each plugin is one direction; each skill inside it is one task and shows up as `plugin:skill`. Hook-only plugins enforce rules that must always hold.

## Plugins

| Plugin | Skills / hooks | When to use | Used in |
| :- | :- | :- | :- |
| [git-guard](plugins/git-guard) | hook `PreToolUse` on Bash | Always on, every project: blocks `git commit` / `git push` on `main` or `master` except a new repository's first commit and first push. Not for repositories where you commit to `main` on purpose | xpath-to-class-chain, xpath-to-uiselector |
| [locator-converter](plugins/locator-converter) | skill `locator-converter:build` | Planning, building, auditing or extending a converter between locator languages (XPath → iOS class chain, XPath → Android `UiSelector`): oracle on the real engine first, exact / close / skip outcomes, fix loop, scanner, fixed scoring, real-world corpus. Not for converting a suite with an existing converter, device test runs or LLM benchmarks on their own | xpath-to-class-chain, xpath-to-uiselector |
| [mobile-test-runs](plugins/mobile-test-runs) | skills `mobile-test-runs:ios-simulator`, `mobile-test-runs:ios-real-device`, `mobile-test-runs:android-emulator`; hooks `PreToolUse` / `PostToolUse` on Bash | Device test runs and timing benchmarks on an iOS simulator, a real iPhone or an Android emulator: hooks deny timed runs on battery or in Low Power Mode, device runs without `caffeinate`, timed runs with a windowed emulator, and ask before new simulators, AVDs or images; skills cover setup, pitfalls, `--resume` and monitors. Not for physical Android phones or cloud device farms (not covered yet), or building a converter | xpath-to-class-chain, xpath-to-uiselector, appium-android-locator-benchmark |
| [llm-benchmark](plugins/llm-benchmark) | skill `llm-benchmark:llm-vs-tool`; hook `PreToolUse` on Bash and Agent | Comparing Claude models with a deterministic tool on the same task: isolated chunked runs, one prompt, tool = 100 %, WRONG on its own line, cost and time per run; the hook blocks effort `max` and `claude --bare` without an API key. Not for building the tool, device timings or evaluations with no reference tool | xpath-to-class-chain, xpath-to-uiselector |
| [publishing](plugins/publishing) | skills `publishing:npm-release`, `publishing:devto-article`, `publishing:github-pages-playground`; hook `PreToolUse` on Bash | Releasing an npm package (README as the npm page, metadata, badge, `bin` bit, bump PR, tag, GitHub release, check after publishing), writing a dev.to article about it (format, PNG charts, cover, numbers and flags checked, link back) and adding a GitHub Pages playground built from the library with a parity check; the hook denies `npm publish` and other registry writes (the user runs them) and asks before GitHub releases, tag pushes, Pages changes and dev.to API writes. Not for private registries, monorepo release tooling, docs sites or social posts | xpath-to-class-chain, xpath-to-uiselector |
| [project-kit](plugins/project-kit) | skills `project-kit:kickoff`, `project-kit:retro` | Starting a project (health check, which kit plugins to use, `CLAUDE.md` and `PLAN.md` from templates with an estimate per stage, checked by a script) and reviewing one (a scan of the feedback memory against the user and project `CLAUDE.md`, the kit's hooks and skills: missing rules, rules broken again as hook candidates, duplicated rules, stale memory index, kit skills never invoked; the result is a PR to this kit). Not for the next stage of a planned project or the domain work itself | xpath-to-class-chain, xpath-to-uiselector, appium-android-locator-benchmark |

## Install

Add the marketplace once, in a Claude Code session:

```
/plugin marketplace add domovou69/claude-kit
```

Then install a plugin for all your projects (user scope):

```
/plugin install <plugin>@claude-kit
```

Or from the shell: `claude plugin marketplace add domovou69/claude-kit` and `claude plugin install <plugin>@claude-kit`.

For one repository only, run `claude plugin install <plugin>@claude-kit --scope project` there and commit the `.claude/settings.json` it writes:

```json
{
  "extraKnownMarketplaces": {
    "claude-kit": { "source": { "source": "github", "repo": "domovou69/claude-kit" } }
  },
  "enabledPlugins": { "<plugin>@claude-kit": true }
}
```

## Update

Plugins here carry no `version`, so an update means a new commit on `main`. Pull it with `/plugin marketplace update claude-kit` (or `claude plugin update <plugin>@claude-kit`), or turn on auto-update for the marketplace under **Marketplaces** in `/plugin`.

## Development

Tests: `node --test` from the repository root (Node 18 or newer, git).

The hook guards share one shell parser. Its source is [shared/shell-parse.js](shared/shell-parse.js); each plugin with
a guard carries a copy in its `scripts/` folder, because a plugin installs on its own and cannot load files outside
it. Edit the source, then run `node scripts/sync-shared.js`; `node --test` fails while a copy differs.

## License

[MIT](LICENSE)
