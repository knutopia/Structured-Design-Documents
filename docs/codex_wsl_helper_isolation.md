# Codex WSL helper isolation: evaluation and recovery

This is a copy of /mnt/c/Users/Knut/.codex/visualizations/2026/10/02/01a0fe0d-fb4d-7a40-8409-8187b23f21d7/codex-wsl-recovery/README.md

Evaluated October 2, 2026. This package has NOT been installed on the live app.

## Decision

Reject the shared-directory symlink from community issue #40583 on this machine. In a disposable home, native Windows Codex could not access the symlinked directory (EACCES) and reported that it could not create PATH aliases (Windows error 183).

Use a Linux-only bind mount instead. It gives WSL native Linux helper storage while Windows retains its ordinary, independent directory at the same Windows path. The updated desktop binaries passed the isolated acceptance tests below. This is a local workaround, not an upstream product fix.

## What passed

| Test | Result |
| --- | --- |
| Baseline shared Windows directory | Reproduced deletion of a running Linux server's sandbox helper by native Windows Codex |
| Proposed shared-directory symlink | Rejected: native Windows aliases could not be created |
| Bind mount, real Linux + Windows app servers | Both created helpers; Windows startup preserved Linux helpers |
| Native Windows patch-helper dispatch | Reached the patch parser and rejected deliberately invalid input, proving the .bat helper dispatched correctly; no file was patched |
| Linux sandbox | A write in its test workspace succeeded; a write outside the allowed roots was rejected with a read-only-filesystem error |
| Repeated Windows app-server startup | Linux helper survived all tested startups |
| Additional Linux cleanup pass | Active Linux helper survived |
| systemd unit verification | Passed without diagnostics |
| systemd start/stop, twice | Mounted native Linux directory; stopping restored the untouched underlying Windows directory |
| Installer repeated install | Passed |
| Installer rollback | Restored original directory and retained native helper data |
| Install → rollback → reinstall → rollback | Passed with both original and native data retained |

Tests used disposable Codex homes and runtime-only systemd units. Those processes, mounts and units were removed. Source scripts and JSON evidence are in `evidence/`. The live app, persistent systemd configuration, shell profiles, authentication, conversations and repository files have not been changed.

The tested desktop Linux runtime reported `codex-cli 0.159.0-alpha.12.1` at `/mnt/c/Users/Knut/.codex/bin/wsl/3ac368078cf7546b/codex`. The tested Windows executable was `/mnt/c/Users/Knut/AppData/Local/OpenAI/Codex/bin/be3fd7e5c1969ff6/codex.exe`. These are the executable paths observed during this evaluation; this report does not infer an app About version from them.

## What remains unverified

- The actual desktop chat after installing the mount and relaunching the app.
- Automatic mount restoration across a full WSL shutdown/restart. Unit dependency ordering and start/stop behavior passed; that is not a cold-boot test.
- Complete browser/computer-use/plugin workflows. Windows helper creation and dispatch were tested, not every plugin.

The diagnosis still applies to the live updated app: its WSL app server was holding `/mnt/c/Users/Knut/.codex/tmp/arg0/codex-arg019hEp8/.lock`, while the directory was absent and normal `pwd` failed with ENOENT.

## Exactly what installation changes

The installer creates:

- `/home/knut/.codex-wsl-runtime/arg0` with private permissions and ownership by `knut`.
- An ownership marker in its parent so rollback and reinstall are safe.
- `/etc/systemd/system/mnt-c-Users-Knut-.codex-tmp-arg0.mount`, enabled for `local-fs.target`.

The unit bind-mounts the native directory onto `/mnt/c/Users/Knut/.codex/tmp/arg0` only in Linux's view. Windows continues using `C:\Users\Knut\.codex\tmp\arg0`. Existing Windows helper contents are hidden from Linux by the mount; they are neither moved nor deleted.

Authentication, settings, sessions, binaries, `.profile`, `.bashrc`, `/etc/wsl.conf`, `/etc/fstab`, permissions policies and the SDD repository are not edited. No persistent background repair process is installed.

The distro already uses systemd. The mount is ordered after its containing Windows drive mount and before `local-fs.target`. A bare fstab bind entry was not selected because WSL's own drive-mount ordering needs care.

## Install

1. Open an external Windows PowerShell window and keep these instructions available.
2. Fully quit the ChatGPT/Codex desktop app. This avoids changing the helper paths underneath the running app-server. The installer refuses to proceed while it detects the desktop's WSL app-server or code-mode host.
3. Run this command in PowerShell:

```powershell
wsl.exe -d Ubuntu -u root -- /usr/bin/python3 "/mnt/c/Users/Knut/.codex/visualizations/2026/10/02/01a0fe0d-fb4d-7a40-8409-8187b23f21d7/codex-wsl-recovery/codex_wsl_helpers.py" install
```

The command runs only the prepared installer as root inside Ubuntu. The desktop app continues running as the ordinary user when reopened.

4. Confirm `mountedAsExpected: true` and `active: active`, then reopen the desktop app.
5. Ask for an ordinary sandboxed `pwd`, a small permitted file write/read/delete, and an `apply_patch` probe. Do not use an approved outside-sandbox call as proof of recovery.
6. Once the desktop tests pass, verify persistence during a planned WSL restart: save running Ubuntu work, quit the desktop app, terminate Ubuntu from PowerShell, and reopen the app. Then repeat the status and ordinary sandboxed execution checks. Terminating Ubuntu stops all its processes, so it is intentionally not part of this installer.

For a read-only status check in PowerShell:

```powershell
wsl.exe -d Ubuntu -u root -- /usr/bin/python3 "/mnt/c/Users/Knut/.codex/visualizations/2026/10/02/01a0fe0d-fb4d-7a40-8409-8187b23f21d7/codex-wsl-recovery/codex_wsl_helpers.py" status
```

## Roll back

Fully quit the desktop app, then run:

```powershell
wsl.exe -d Ubuntu -u root -- /usr/bin/python3 "/mnt/c/Users/Knut/.codex/visualizations/2026/10/02/01a0fe0d-fb4d-7a40-8409-8187b23f21d7/codex-wsl-recovery/codex_wsl_helpers.py" rollback
```

Rollback disables and removes this mount unit and exposes the original Windows helper directory again. It retains the native runtime directory and ownership marker; a later reinstall accepts that retained state. It does not delete any authentication, settings or session data.

## Sources

- Community symlink workaround and its reported tests: https://github.com/openai/codex/issues/40583
- Cross-platform helper lifecycle report: https://github.com/openai/codex/issues/25317
- WSL configuration: https://learn.microsoft.com/en-us/windows/wsl/wsl-config
- systemd mount ordering: https://man7.org/linux/man-pages/man5/systemd.mount.5.html

A separate agent reviewed the workaround and installer. Its review identified the Windows-alias compatibility gap and a rollback/reinstall defect in the first installer draft. Both were addressed; the final repeat-cycle test passed.
