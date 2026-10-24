# Corpus

Two sets of inputs, built for different jobs:

| Set | Job | Size that worked |
| --- | --- | --- |
| **S, edge cases** | Prove each rule, including the traps; every case has a hand-written expected output | 115–170 |
| **R, real-world locators** | Show what people actually write and how much of it converts | 500–2000 literals from 10–20+ projects |

## Edge cases (S)

- Generated from the reference: at least one case per reference row, plus literal edge cases (quotes, `\n`, `\`,
  `$`, `%s`, backtick, `]`, non-ASCII, empty).
- Each case: id, category, source locator, expected class (exact / close / skip), expected target locator or skip
  reason, the reference rows it cites.
- A check script fails when a reference row has no case, a case cites an unknown row, ids repeat, an expected
  target does not parse, a close case has no warning or a skip has no reason. Run it in CI.
- The expected outputs are confirmed on the oracle before the converter exists ([oracle](oracle.md)).

```js
// One edge case.
module.exports = [
  { id: 'C03', cat: 'C', ref: ['SEL-02'],
    xpath: '//*[contains(@text,"Pay")]',
    expect: { status: 'exact', output: 'new UiSelector().textMatches("(?s).*Pay.*")' } },
];
```

## Real-world locators (R)

- **Mix the sources.** One team's suite reflects one style. Adding projects from other teams dropped R from 96 to
  92 (more per-parent positions) and found eight converter and scanner defects in a converter already on npm.
  Take large organizational suites and weak ones (courses, practice repositories, recorder output), and several
  client languages.
- **Pin and record:** repository, commit, license, language, files taken, literal counts per project, search
  queries and their hit counts. Record the share of the largest project.
- **No clone needed:** search, read the git tree at the pinned commit, download only test files (a few MB in
  total). Get the user's approval of the candidate list before downloading.
- **Anonymize** literal values (names, labels, ids) with a salted mapping to pseudo-words that keep length and
  shape. Keep the salt outside the repository; rebuilding with a new salt is fine.
- **Stable ids** (`L001…` for the first source, `G0001…` for later ones); new fields go on new entries, old ids
  never change.
- **Frequencies:** forms, languages and strategies, also weighted by project, so the plan orders work by what
  is common.

## Public repositories

The corpus, reports and examples are public. Before every commit, check that none of these is in the diff:
device UDIDs, signing team ids, bundle or package ids of a real app, local paths, e-mail addresses, tokens,
un-anonymized literals of a private suite.

```sh
git diff --cached | grep -nEi '[0-9A-F]{8}-[0-9A-F]{4}-|0000[0-9]{4}-|/Users/|/home/|@[a-z0-9-]+\.(com|io)|team ?id|bundle ?id' \
  && echo "review these lines before committing"
```

## Growing the corpus later

- A converter comparison with LLMs on the same inputs, with every disagreement checked on the oracle, is a cheap
  probe: it found a converter bug and eight convertible forms in one project.
- Re-run the oracle on another OS version only when there is a reason; one newer version gave the same verdicts
  as the pinned one.
