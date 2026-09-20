#!/usr/bin/env bash

set -euo pipefail

echo "scripts/package-extension.sh is deprecated; building the Chrome package."
node scripts/build-browser.js chrome
