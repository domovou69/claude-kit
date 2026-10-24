# The npm page

## What updates when

| Change | Visible on npmjs.com |
| :- | :- |
| README text, badge, links | Only after the next publish: the page renders the README of the latest version |
| `description`, `keywords`, `homepage`, `repository` | Only after the next publish |
| Badge image (shields.io / badge.fury.io) | Its number updates on its own once the badge is in the published README |
| GitHub repo "About" (description, website, topics) | At once (a repo setting, `gh repo edit`; the hook asks) |

So batch README and metadata changes before a release. If one has to go out alone (the README was unreadable, search
did not find the package), make a patch release with no code change and say that in the PR:
"Bumps the version so the npm page picks up the short README. No code changes."

Seen in practice:
- A short README merged after 1.0.0 needed 1.0.1 just to show up.
- New search metadata needed 1.0.2.
- A badge added right after the first publish showed on npm only with the next version. Put the badge in before the
  first publish: shields.io renders "package not found" until then, which is fine for one PR.
- A README section added after a release ("three modes") waited for the next one.

## Search

npm search ranks by text match, then quality and popularity; a new package has no popularity, so the text decides.

- `description` starts with the phrase people type: "XPath to iOS Class Chain converter for Appium (XCUITest)", not
  "A tool that…".
- 10–15 `keywords`: the package name split into words, the source and target formats, the framework, the category
  (`converter`, `codemod`, `test-automation`, `mobile-testing`).
- `homepage`: the docs or the playground; the repo "About" website the same.
- Check a day after the publish: `npm search <words>` and a keyword search (`keywords:<word>`). A package indexed under
  its keywords but not ranked by name is normal for a few days.

## First publish

- `npm view <name>`: 404 means the name is free. A name close to an existing package may be refused.
- `private` removed, `version` 1.0.0 (or 0.x if the API will change), `license`, `files` listing only what users need
  (`npm pack --dry-run` shows the list; keep its file count in the release PR, so later changes notice a new file).
- Scoped packages (`@scope/name`) need `npm publish --access public` the first time.
- The user logs in (`npm login`) and publishes; with two-factor auth npm asks for a code, which only the user has.
