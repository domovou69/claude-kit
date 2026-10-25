#!/bin/bash
# Fictional package "pathsift": two bin files, one without a shebang, none executable.
set -e
mkdir -p bin src
cat > package.json <<'EOF'
{
  "name": "pathsift",
  "version": "2.0.1",
  "description": "Filter file paths by glob from the command line",
  "main": "src/index.js",
  "bin": { "pathsift": "bin/pathsift.js", "pathsift-watch": "bin/pathsift-watch.js" },
  "files": ["bin", "src"],
  "license": "MIT"
}
EOF
printf 'const { sift } = require("../src/index.js");\nconsole.log(sift(process.argv.slice(2)).join("\\n"));\n' > bin/pathsift.js
printf '#!/usr/bin/env node\nrequire("fs").watch(process.argv[2] || ".", (e, f) => console.log(e, f));\n' > bin/pathsift-watch.js
printf 'exports.sift = (a) => a.filter((p) => !p.startsWith("."));\n' > src/index.js
chmod 644 bin/*.js
