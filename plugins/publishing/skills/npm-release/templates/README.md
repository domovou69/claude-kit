<!--
The npm page. Keep it at about 60–100 lines; everything else goes to docs/ and is linked.
Slots: PACKAGE, OWNER/REPO, the sentences in CAPS. Delete this comment.
-->
# PACKAGE

[![npm](https://img.shields.io/npm/v/PACKAGE)](https://www.npmjs.com/package/PACKAGE)

ONE SENTENCE: WHAT GOES IN, WHAT COMES OUT, FOR WHOM.

## Try it

```bash
npx PACKAGE ./tests          # preview: what would change
npx PACKAGE ./tests --write  # apply it
```

Or online, no install: [OWNER.github.io/REPO](https://OWNER.github.io/REPO/).

ONE SHORT EXAMPLE, COPIED FROM THE TOOL'S REAL OUTPUT:

```diff
- BEFORE
+ AFTER
```

## Results

- **WRONG RESULTS: 0** on N REAL INPUTS ([results](docs/results.md)).
- **COVERAGE: X %** converted, the rest skipped with a reason.
- Checked with: DEPENDENCY A.B.C, PLATFORM X. Older versions were not checked.

## Library

```js
const { convert } = require('PACKAGE');
convert('INPUT'); // → { status, output, warning }
```

## Documentation

- [Reference](docs/reference.md): every option, what is converted and skipped, the JSON report
- [Results](docs/results.md): full tables and how they were measured
- [Articles](docs/articles/README.md)

## License

[MIT](LICENSE)
