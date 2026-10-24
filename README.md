# claude-kit

A personal [Claude Code](https://code.claude.com) plugin marketplace: skills and hooks distilled from real projects, reused across them.

Each plugin is one direction; each skill inside it is one task and shows up as `plugin:skill`. Hook-only plugins enforce rules that must always hold.

## Plugins

| Plugin | Skills / hooks | When to use | Used in |
| :- | :- | :- | :- |
| [git-guard](plugins/git-guard) | hook `PreToolUse` on Bash | Always on, every project: blocks `git commit` / `git push` on `main` or `master` except a new repository's first commit and first push. Not for repositories where you commit to `main` on purpose | xpath-to-class-chain, xpath-to-uiselector |
| [locator-converter](plugins/locator-converter) | skill `locator-converter:build` | Planning, building, auditing or extending a converter between locator languages (XPath → iOS class chain, XPath → Android `UiSelector`): oracle on the real engine first, exact / close / skip outcomes, fix loop, scanner, fixed scoring, real-world corpus. Not for converting a suite with an existing converter, device test runs or LLM benchmarks on their own | xpath-to-class-chain, xpath-to-uiselector |

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

## License

[MIT](LICENSE)
