#!/usr/bin/env bash

set -euo pipefail

surfmind_version="$(node -e '
  const manifest = require("./public/manifest.json");
  process.stdout.write(manifest.version_name || manifest.version);
')"

case "$surfmind_version" in
  *[!0-9A-Za-z._-]* | "")
    echo "Invalid extension version: $surfmind_version" >&2
    exit 1
    ;;
esac

surfmind_archive="surfmind-${surfmind_version}.zip"

npm run build:ext
rm -f "$surfmind_archive"

(
  cd build
  zip -qr "../$surfmind_archive" . \
    -x '.DS_Store' '*/.DS_Store' '*.map'
)

if ! zipinfo -1 "$surfmind_archive" | grep -qx 'manifest.json'; then
  echo "Packaging failed: manifest.json is not at the archive root." >&2
  exit 1
fi

if zipinfo -1 "$surfmind_archive" | grep -Eq '(^|/)\.DS_Store$|\.map$'; then
  echo "Packaging failed: archive contains .DS_Store or source maps." >&2
  exit 1
fi

unzip -tq "$surfmind_archive"
echo "Created $surfmind_archive"
