#!/usr/bin/env bash
set -euo pipefail

PORT="${CHROME_DEBUG_PORT:-9222}"

# Detect Chrome/Chromium binary
if command -v google-chrome &>/dev/null; then
  CHROME="google-chrome"
elif command -v chromium &>/dev/null; then
  CHROME="chromium"
elif command -v chromium-browser &>/dev/null; then
  CHROME="chromium-browser"
elif [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
else
  echo "Error: Chrome/Chromium not found. Please install Chrome or set the path manually."
  exit 1
fi

echo "Starting Chrome with remote debugging on port $PORT..."
echo "Binary: $CHROME"

exec "$CHROME" \
  --remote-debugging-port="$PORT" \
  --remote-allow-origins=* \
  --headless=new \
  --no-first-run \
  --disable-gpu \
  --disable-extensions \
  --disable-default-apps \
  --disable-translate \
  --no-default-browser-check \
  --window-size=1280,720 \
  --user-data-dir="/tmp/gaia-chrome-profile" \
  about:blank
