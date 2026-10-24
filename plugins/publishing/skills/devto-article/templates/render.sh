#!/bin/sh
# render.sh <svg> <png> <width> <height> — a 2× PNG of an SVG chart or cover, through headless Chrome.
# The SVG path must be absolute (file:// URL). CHROME overrides the browser; otherwise the usual macOS and Linux
# locations are tried.
set -eu
[ $# -eq 4 ] || { echo "usage: render.sh <absolute svg> <png> <width> <height>" >&2; exit 2; }
if [ -z "${CHROME:-}" ]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" google-chrome chromium chromium-browser; do
    if [ -x "$c" ] || command -v "$c" >/dev/null 2>&1; then CHROME=$c; break; fi
  done
fi
[ -n "${CHROME:-}" ] || { echo "render.sh: no Chrome found; set CHROME" >&2; exit 1; }
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size="$3,$4" --screenshot="$2" "file://$1" >/dev/null 2>&1
echo "$2 (${3}×${4} at 2×)"
