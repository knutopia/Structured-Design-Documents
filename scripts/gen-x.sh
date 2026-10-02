#!/usr/bin/env bash
set -euo pipefail

# Regenerate all bundle corpora, or the supplied manifest, including legacy previews.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/.." && pwd -P)"

cd "$repo_root"
TMPDIR=/tmp pnpm run generate:rendered-examples "$@"
