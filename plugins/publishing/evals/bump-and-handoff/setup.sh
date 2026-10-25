#!/bin/bash
# Fictional released package "tallyr" 1.3.2.
set -e
mkdir -p bin src
cat > package.json <<'EOF'
{
  "name": "tallyr",
  "version": "1.3.2",
  "description": "Count words in text files from the command line",
  "main": "src/index.js",
  "bin": { "tallyr": "bin/tallyr.js" },
  "files": ["bin", "src"],
  "repository": "github:acme-labs/tallyr",
  "homepage": "https://github.com/acme-labs/tallyr#readme",
  "keywords": ["words", "count", "text", "cli", "wc", "tally", "files", "statistics", "node", "tool"],
  "license": "MIT"
}
EOF
printf '#!/usr/bin/env node\nconst { tally } = require("../src/index.js");\nfor (const f of process.argv.slice(2)) console.log(f, tally(require("fs").readFileSync(f, "utf8")));\n' > bin/tallyr.js
printf 'exports.tally = (text) => text.split(/\\s+/).filter(Boolean).length;\n' > src/index.js
printf '# tallyr\n\nCount words in text files.\n\n    npx tallyr notes.txt\n\nMIT\n' > README.md
