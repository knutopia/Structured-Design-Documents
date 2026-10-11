# Codex desktop on Windows: fixing WSL tool calls that fail before the shell starts

**Community workaround, documented October 3, 2026.** This addresses a specific failure caused by Windows and WSL sharing temporary Codex helper directories. The affected user confirmed that the workaround restored their desktop workflow. It is not an official OpenAI fix or a general solution to every WSL execution error.

## Symptoms

After a desktop app update, ordinary Codex tool calls inside WSL failed, including `pwd`. The error appeared before Bash or the requested command started:

```text
Failed to create unified exec process: No such file or directory (os error 2)
```

Meanwhile:

- PowerShell could launch WSL and run commands successfully.
- Bash and the workspace existed and were accessible.
- An approved execution outside the Codex sandbox could succeed.
- Restarting or updating the app did not provide a lasting recovery.
- There was no `unified_exec` override in the affected configuration.

The successful outside-sandbox execution was still running as the ordinary Linux user. “Elevated” approval in Codex did not mean that the command needed Linux root privileges. This distinction helped identify a problem in the sandbox launch path.

## What was going wrong

In the affected setup, the desktop's Linux app-server used a Windows-hosted `CODEX_HOME`:

```text
Windows: C:\Users\WINDOWS_USER\.codex
WSL:     /mnt/c/Users/WINDOWS_USER/.codex
```

Codex created temporary helper directories below `CODEX_HOME/tmp/arg0`. The Linux helpers included `codex-linux-sandbox`, `codex-execve-wrapper`, `apply_patch`, and `applypatch`. A running server retained paths to its particular `codex-arg0…` directory.

The decisive finding was that **the running WSL app-server still held its helper lock file open, but that helper directory had disappeared**. Consequently, launching the sandbox failed with a missing-file error before the requested shell command could run.

In a controlled reproduction using the installed Linux and Windows Codex binaries and a disposable shared home:

1. The Linux app-server created and locked its helpers.
2. Starting native Windows Codex against the same home removed the Linux helper directory while the Linux server remained alive.
3. Subsequent launches through the missing Linux helper failed.

This reproduced the deletion mechanism. It did not identify the exact historical Windows invocation that deleted the original user's helpers, or establish which app update introduced the defect.

The reviewed [Codex helper implementation](https://github.com/openai/codex/blob/main/codex-rs/arg0/src/lib.rs) places these temporary directories under the shared home and uses lock-based cleanup. In the reproduced Windows/WSL combination, that lock did not protect the Linux directory from Windows cleanup. [Community issue #25317](https://github.com/openai/codex/issues/25317) describes the same missing active-helper pattern, including cases where `unified_exec=false` and reboots did not resolve it.

## The solution: separate the temporary helpers with a Linux bind mount

Keep persistent Codex state in its existing Windows location. Give WSL its own helper storage on the native Linux filesystem, then bind-mount that directory over the shared helper path **inside WSL**.

```text
Native Windows process
  C:\Users\WINDOWS_USER\.codex\tmp\arg0
    -> existing Windows directory and Windows helpers

WSL process
  /mnt/c/Users/WINDOWS_USER/.codex/tmp/arg0
    -> Linux bind mount
    -> /home/LINUX_USER/.codex-wsl-runtime/arg0
```

The two runtimes now see different helper contents through their respective paths. Windows cleanup cannot remove the WSL helper directory through its ordinary `C:\…` path.

The bind mount hides the underlying Windows directory from Linux while mounted; it does not move or delete that directory. Authentication, configuration, conversations, and installed Codex binaries remain in their existing locations. Normal Codex execution continues with its sandbox enabled and as the ordinary Linux user.

### Why use a bind mount rather than a symlink?

[Community issue #40583](https://github.com/openai/codex/issues/40583) reports success redirecting the helper root to native Linux storage with a symlink. That suggested the isolation strategy. However, in our compatibility test, native Windows Codex could not use the Linux symlink and failed to create its own aliases, reporting access and Windows error 183 failures.

A Linux bind mount supplied the desired WSL storage while preserving Windows access to its original directory. The distinction matters when the desktop also launches Windows-native components. Complete plugin coverage was not tested.

## Check whether this workaround applies

Use it when the evidence points to **missing temporary helpers in a shared Windows-hosted Codex home**, rather than assuming every `os error 2` has this cause.

Useful evidence is:

- The desktop's WSL app-server actually uses `/mnt/c/…/.codex` as `CODEX_HOME`. Your interactive shell's `CODEX_HOME` may differ.
- The active app-server or code-mode host references a particular `tmp/arg0/codex-arg0…` directory that no longer exists.
- A live app-server still has a file descriptor for that directory's `.lock`, sometimes shown as deleted under `/proc/PID/fd`.
- WSL and the requested shell work when invoked outside the failing Codex tool path.

An empty helper directory after all Codex processes have exited is not, by itself, evidence of this defect. Do not reproduce the cleanup race against live sessions merely to confirm it.

The installation example below assumes:

- WSL with systemd already running as PID 1.
- The Windows C: drive mounted at `/mnt/c`.
- One ordinary Linux user consuming this Codex home in this distro.
- That user's home directory resides on native Linux storage.
- Native Windows Codex accesses its home through a drive-letter path, not a WSL UNC path.

The mount affects the whole distro. Multiple Linux users sharing one Codex home require a different ownership design; other distros need their own configuration. Paths containing spaces or systemd-special characters need an adapted unit. The example deliberately accepts only simple paths.

## Installation example

These are manual installation instructions for the tested mount design, not a universal installer. The original machine-specific installer was also tested for repeated installation, rollback, and reinstall.

**First save your work and fully quit the desktop app**, including any background instance. Stop other Codex processes using this same shared home. Perform the installation from an external WSL terminal in the affected distro, logged in as your ordinary Linux user. Only the systemd installation commands use `sudo`.

### 1. Set and check the paths

Replace `WINDOWS_USER` with the actual Windows profile-directory name. If your desktop uses a custom Codex home, adapt the target to the confirmed process configuration.

```bash
codex_target='/mnt/c/Users/WINDOWS_USER/.codex/tmp/arg0'
codex_native="$HOME/.codex-wsl-runtime/arg0"
codex_unit="$(systemd-escape --path --suffix=mount "$codex_target")"

id -un
cat /proc/1/comm
findmnt --target /mnt/c
findmnt --target "$HOME"
ls -ld "$codex_target"
```

Confirm that the account is your normal Linux account, PID 1 is `systemd`, `/mnt/c` is the Windows drive, and your home is on native Linux storage. The target must already be a real directory, not a symlink. See Microsoft's [WSL configuration documentation](https://learn.microsoft.com/en-us/windows/wsl/wsl-config) if systemd is not enabled; enabling it is outside this installation example.

The following preparation block stops on unsupported paths, symlinks, existing mounts, or pre-existing workaround files. Run it in the same Bash terminal after setting the variables above. If it reports an error, resolve that condition before continuing; do not delete existing files to force it through.

```bash
(
  set -eu
  trap 'echo "Preparation failed; stop here and inspect the failed check." >&2' ERR
  test "$(id -u)" -ne 0
  test "$(cat /proc/1/comm)" = systemd
  case "$codex_target:$codex_native" in
    *[!a-zA-Z0-9_./:-]*) echo 'Paths need a separately reviewed unit.' >&2; exit 1 ;;
  esac
  test -d "$codex_target"
  test "$(realpath -e "$codex_target")" = "$codex_target"
  test "$(realpath -e "$HOME")" = "$HOME"
  if mountpoint -q "$codex_target"; then
    echo 'Target is already a mount point; inspect its configuration.' >&2
    exit 1
  fi
  test ! -e "/etc/systemd/system/$codex_unit"
  test ! -L "/etc/systemd/system/$codex_unit"
  test ! -e "$HOME/.codex-wsl-runtime"
  test ! -L "$HOME/.codex-wsl-runtime"
  mkdir -m 700 "$HOME/.codex-wsl-runtime"
  mkdir -m 700 "$codex_native"
)
```

### 2. Prepare and inspect the mount unit

Continue in the same terminal. `systemd-escape` generates the required unit filename from the mount destination. The unit orders the mount after its backing filesystems and before `local-fs.target`; see [systemd.mount](https://man7.org/linux/man-pages/man5/systemd.mount.5.html).

```bash
codex_stage="$(mktemp -d /tmp/codex-wsl-unit.XXXXXX)"
cat > "$codex_stage/$codex_unit" <<EOF
# Managed by codex-wsl-helper-isolation-guide-v1
[Unit]
Description=Keep Codex WSL helpers separate from Windows helpers
RequiresMountsFor=/mnt/c $codex_native
Before=local-fs.target

[Mount]
What=$codex_native
Where=$codex_target
Type=none
Options=bind
TimeoutSec=15

[Install]
WantedBy=local-fs.target
EOF

cat "$codex_stage/$codex_unit"
systemd-analyze verify "$codex_stage/$codex_unit"
```

Check that `What` names your native Linux directory and `Where` names the existing Windows-hosted helper directory. Do not proceed if unit verification fails. This uses an explicit systemd mount unit instead of relying on a bare `/etc/fstab` bind entry or an asynchronous boot command.

### 3. Install and activate

Keep the desktop app closed. Run this block only after both preparation steps succeeded:

```bash
(
  set -eu
  trap 'echo "Installation failed; keep the app closed and inspect the unit status." >&2' ERR
  test ! -e "/etc/systemd/system/$codex_unit"
  test ! -L "/etc/systemd/system/$codex_unit"
  sudo install -m 0644 "$codex_stage/$codex_unit" "/etc/systemd/system/$codex_unit"
  sudo systemctl daemon-reload
  sudo systemctl enable --now "$codex_unit"
  systemctl is-active "$codex_unit"
  findmnt --mountpoint "$codex_target"
  test "$codex_target" -ef "$codex_native"
)
```

Success means the unit is `active`, `findmnt` shows a mount at the exact target, and the final same-file test succeeds. If activation fails, leave the desktop closed, inspect `systemctl status "$codex_unit"`, and use the rollback procedure below. Do not keep adding mounts or deleting helper directories.

## Verify recovery

Reopen the desktop normally. In a WSL task, ask Codex to:

1. Run an ordinary sandboxed `pwd` and `id -un`.
2. Create, read, and remove a uniquely named temporary file inside its permitted workspace.
3. Use `apply_patch` to create and edit a disposable workspace file, then remove it.

These checks should succeed without approving an outside-sandbox execution. Running `pwd` from an external terminal, or getting a successful `codex --version`, is insufficient to verify this particular repair.

If you also use Windows-native desktop tools, exercise those workflows and repeat the WSL test. When comparing filesystem views, use the native `C:\Users\…` path from Windows; a `\\wsl.localhost\…` path goes through WSL and is not the independent Windows view.

Finally, check startup persistence during a planned distro restart. Save all work in that distro and quit the desktop first. From PowerShell, `wsl --terminate YOUR_DISTRO` stops **all processes in that distro**. Start the distro again, check that the mount is active, reopen the app, and repeat the sandboxed tests. A full WSL restart was not explicitly confirmed in the original user's success report, so it remains a verification step for each installation.

## Rollback

Fully quit the desktop and other Codex processes using this home. Open an external WSL terminal as the same ordinary user. Re-create `codex_target`, `codex_native`, and `codex_unit` from installation step 1 if this is a new shell.

Inspect the unit before removing it:

```bash
systemctl cat "$codex_unit"
findmnt --mountpoint "$codex_target"
```

Only continue if the file is the unit created by this guide and its paths match your installation. If another mount or unit has replaced it, investigate that configuration first. An inactive mount makes the second inspection command return no matching entry.

```bash
(
  set -eu
  trap 'echo "Rollback failed; inspect the mount and unit before continuing." >&2' ERR
  sudo systemctl disable --now "$codex_unit"
  if mountpoint -q "$codex_target"; then
    echo 'Mount is still present; unit file retained.' >&2
    exit 1
  fi
  sudo rm -- "/etc/systemd/system/$codex_unit"
  sudo systemctl daemon-reload
)
```

The original Windows helper directory becomes visible to WSL again. The native Linux directory is retained. No authentication, settings, or conversation data needs to be deleted. A future reinstall should deliberately reuse the verified private source directory; the fresh-install preparation block above intentionally refuses existing data.

## Evidence and limits

The controlled evaluation used the installed desktop runtimes on October 2, 2026. The Linux executable reported `codex-cli 0.159.0-alpha.12.1`; that is a runtime version, not an inferred desktop About version.

| Check | Result |
| --- | --- |
| Shared Windows helper directory | Native Windows startup deleted a running Linux server's helpers |
| Linux symlink at the shared helper root | Native Windows alias creation failed |
| Linux bind mount with both runtimes active | Each created helpers; Linux helpers survived Windows startup |
| Repeated Windows startups and another Linux cleanup pass | Active Linux helpers survived |
| Native Windows patch-helper dispatch | Reached the parser and rejected deliberately invalid input; no patch was applied |
| Linux sandbox restrictions | Permitted workspace write succeeded; an outside-root write was denied |
| Mount-unit verification and repeated start/stop | Passed; stopping restored the underlying Windows view |
| Original installer install / rollback / reinstall | Passed with both storage locations retained |
| User's desktop workflow after installation | User confirmed the fix works on October 3, 2026 |

The generic manual instructions in this document preserve the tested mount design, but were not installed on a second machine. Cold WSL startup, every plugin, other distro layouts, and future desktop versions are not covered by the reported success. Future runtime changes may make the workaround unnecessary or require a different helper path.

A separately observed launcher delay before authentication was outside this missing-helper repair and is not claimed to be fixed by it.

For an upstream fix, the reproduction points toward separating temporary helper storage by runtime/platform and recovering when a cached helper disappears. The bind mount supplies that separation locally without requiring a patched Codex binary.
