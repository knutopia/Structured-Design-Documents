#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

looks_like_repo_root() {
  local candidate="$1"
  [[ -f "$candidate/package.json" && -f "$candidate/bundle/v0.1/manifest.yaml" ]]
}

find_repo_from() {
  local start_dir="$1"
  local current="$start_dir"

  while [[ "$current" != "/" ]]; do
    if looks_like_repo_root "$current"; then
      printf '%s\n' "$current"
      return 0
    fi
    current="$(dirname "$current")"
  done

  if looks_like_repo_root "/"; then
    printf '/\n'
    return 0
  fi

  return 1
}

repo_root=""
script_candidate="$(cd "$script_dir/../../.." && pwd -P)"

if looks_like_repo_root "$script_candidate"; then
  repo_root="$script_candidate"
elif repo_root="$(find_repo_from "$(pwd -P)")"; then
  :
else
  echo "run_helper.sh could not locate the SDD repo root. Run this skill from inside an SDD repo checkout." >&2
  exit 1
fi

export TMPDIR="/tmp"

if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "$HOME/.nvm/nvm.sh"
  fi
fi

if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  echo "run_helper.sh could not find both node and pnpm, even after sourcing ~/.nvm/nvm.sh." >&2
  exit 1
fi

cd "$repo_root"
exec pnpm --silent sdd-helper "$@"
