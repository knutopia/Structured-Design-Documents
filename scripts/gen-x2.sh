#!/usr/bin/env bash
set -euo pipefail

# Regenerate only the v0.2 corpus, including legacy Graphviz previews.
if (( $# != 0 )); then
  echo "Usage: $0 (no arguments)" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/.." && pwd -P)"

cd "$repo_root"
TMPDIR=/tmp pnpm run generate:rendered-examples bundle/v0.2/manifest.yaml
