#!/bin/bash
# Fictional package "tallyr": bloated README, bare package.json, bin file without a shebang.
set -e
mkdir -p bin src
cat > package.json <<'EOF'
{
  "name": "tallyr",
  "version": "0.1.0",
  "private": true,
  "description": "tally stuff",
  "main": "src/index.js",
  "bin": { "tallyr": "bin/tallyr.js" },
  "license": "MIT"
}
EOF
cat > bin/tallyr.js <<'EOF'
const { tally } = require("../src/index.js");
const files = process.argv.slice(2);
for (const f of files) console.log(f, tally(require("fs").readFileSync(f, "utf8")));
EOF
cat > src/index.js <<'EOF'
exports.tally = (text) => text.split(/\s+/).filter(Boolean).length;
EOF
{
echo "# tallyr"
echo
echo "Counts words in text files."
echo
echo "## Install"
echo
echo '    npm install -g tallyr'
echo
echo "## Usage"
echo
echo '    tallyr notes.txt'
echo
echo "## Internal design notes"
echo
for i in $(seq 1 40); do echo "- Design note $i: the tokenizer splits on whitespace; decision $i was made on 2023-0$((i % 9 + 1))-1$((i % 10)) after a long discussion that is not relevant to users."; done
echo
echo "## Benchmarks"
echo
echo "| Run | Files | Words | Seconds | Machine |"
echo "| --- | --- | --- | --- | --- |"
for i in $(seq 1 60); do echo "| $i | $((i * 10)) | $((i * 12345)) | 0.$((i % 90 + 10)) | dev-box-$((i % 5)) |"; done
echo
echo "## TODO"
echo
for i in $(seq 1 25); do echo "- [ ] idea $i for later"; done
echo
echo "## Changelog"
echo
for i in $(seq 1 20); do echo "- 0.0.$i: small internal change number $i"; done
echo
echo "## License"
echo
echo "MIT"
} > README.md
