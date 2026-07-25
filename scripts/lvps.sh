#!/usr/bin/env bash
# Launch the VitePress development server in a separate terminal window.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/.." && pwd -P)"

if [[ "${1:-}" == "--run-server" ]]; then
  cd "$repo_root"

  export COREPACK_HOME="${COREPACK_HOME:-$HOME/.cache/corepack}"
  if ! command -v pnpm >/dev/null 2>&1 && [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # New WSL windows are non-login shells, so load the repo's Node toolchain.
    source "$HOME/.nvm/nvm.sh"
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    echo "lvps.sh: pnpm was not found after loading nvm." >&2
    echo "Press Enter to close this window."
    read -r
    exit 127
  fi

  if pnpm run docs:dev; then
    exit_code=0
  else
    exit_code=$?
  fi
  echo
  echo "VitePress exited with status $exit_code. Press Enter to close this window."
  read -r
  exit "$exit_code"
fi

if grep -qiE '(microsoft|wsl)' /proc/sys/kernel/osrelease 2>/dev/null; then
  if ! command -v powershell.exe >/dev/null 2>&1; then
    echo "lvps.sh: Windows PowerShell was not found." >&2
    exit 1
  fi

  # Pass values through the environment so neither Bash nor PowerShell needs
  # to interpolate them into the other shell's source text.
  export LVPS_REPO_ROOT="$repo_root"
  export LVPS_DISTRO_NAME="${WSL_DISTRO_NAME:-}"
  export WSLENV="${WSLENV:+$WSLENV:}LVPS_REPO_ROOT:LVPS_DISTRO_NAME"
  (
    cd /mnt/c
    powershell.exe -NoLogo -NoProfile -NonInteractive -Command '
      $wslArguments = @()
      if ($env:LVPS_DISTRO_NAME) {
        $wslArguments += "--distribution"
        $wslArguments += $env:LVPS_DISTRO_NAME
      }
      $wslArguments += "--cd"
      $wslArguments += $env:LVPS_REPO_ROOT
      $wslArguments += "bash"
      $wslArguments += "scripts/lvps.sh"
      $wslArguments += "--run-server"

      try {
        $process = Start-Process -FilePath "wsl.exe" `
        -ArgumentList $wslArguments `
        -WorkingDirectory "C:\" `
        -WindowStyle Normal `
        -PassThru `
        -ErrorAction Stop
        Start-Sleep -Milliseconds 1000
        $process.Refresh()
        if ($process.HasExited) {
          Write-Error "The VitePress window exited during startup (status $($process.ExitCode))."
          exit 1
        }
        Write-Output "VitePress is running in WSL process $($process.Id)."
      } catch {
        Write-Error "Could not launch VitePress: $($_.Exception.Message)"
        exit 1
      }
    '
  )
elif command -v gnome-terminal >/dev/null 2>&1; then
  gnome-terminal --title="VitePress" -- "$script_dir/lvps.sh" --run-server
elif command -v x-terminal-emulator >/dev/null 2>&1; then
  x-terminal-emulator -e "$script_dir/lvps.sh" --run-server
else
  echo "lvps.sh: no supported terminal launcher was found." >&2
  exit 1
fi
