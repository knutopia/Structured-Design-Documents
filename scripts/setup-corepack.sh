#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/setup-corepack.sh [--corepack-home <path>] [--write-profile]

Prepare the package manager pinned in package.json through Corepack.

Options:
  --corepack-home <path>  Use this Corepack cache/state directory.
  --write-profile        Persist COREPACK_HOME in ~/.profile with a guarded block.
  -h, --help             Show this help.
USAGE
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/.." && pwd -P)"

corepack_home_was_set=false
if [[ -n "${COREPACK_HOME:-}" ]]; then
  corepack_home_was_set=true
fi

corepack_home="${COREPACK_HOME:-$HOME/.cache/corepack}"
corepack_home_from_arg=false
write_profile=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --corepack-home)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "setup-corepack.sh: --corepack-home requires a path." >&2
        exit 2
      fi
      corepack_home="$2"
      corepack_home_from_arg=true
      shift 2
      ;;
    --write-profile)
      write_profile=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "setup-corepack.sh: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "setup-corepack.sh: Node.js 22 must be installed before running this script." >&2
  exit 1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "setup-corepack.sh: corepack must be available from the active Node.js installation." >&2
  exit 1
fi

package_manager="$(
  cd "$repo_root"
  node -e 'const pkg = require("./package.json"); process.stdout.write(pkg.packageManager || "");'
)"

if [[ ! "$package_manager" =~ ^pnpm@[^[:space:]]+$ ]]; then
  echo "setup-corepack.sh: package.json must declare packageManager as pnpm@<version>; got '$package_manager'." >&2
  exit 1
fi

export COREPACK_HOME="$corepack_home"
mkdir -p "$COREPACK_HOME"

corepack enable
corepack prepare "$package_manager" --activate
pnpm --version

write_profile_block() {
  local profile_path="$1"
  local temp_path
  temp_path="$(mktemp)"

  if [[ -f "$profile_path" ]]; then
    awk '
      $0 == "# >>> sdd corepack setup >>>" { skip = 1; next }
      $0 == "# <<< sdd corepack setup <<<" { skip = 0; next }
      skip != 1 { print }
    ' "$profile_path" > "$temp_path"
  fi

  {
    if [[ -s "$temp_path" ]]; then
      tail -c 1 "$temp_path" | read -r _ || printf '\n' >> "$temp_path"
      cat "$temp_path"
    fi
    printf '%s\n' '# >>> sdd corepack setup >>>'
    printf 'export COREPACK_HOME=%q\n' "$COREPACK_HOME"
    printf '%s\n' '# <<< sdd corepack setup <<<'
  } > "$profile_path"

  rm -f "$temp_path"
}

if [[ "$write_profile" == true ]]; then
  write_profile_block "$HOME/.profile"
  echo "Persisted COREPACK_HOME in $HOME/.profile."
else
  os_release="$(cat /proc/sys/kernel/osrelease 2>/dev/null || true)"
  if [[ "$corepack_home_was_set" == false && "$corepack_home_from_arg" == false && "$os_release" =~ [Mm]icrosoft|WSL|wsl ]]; then
    cat <<EOF
WSL note: if future shells route Corepack through /mnt/c/..., persist the WSL-side Corepack home with:
  scripts/setup-corepack.sh --write-profile
or add this to ~/.profile:
  export COREPACK_HOME="$COREPACK_HOME"
EOF
  fi
fi
