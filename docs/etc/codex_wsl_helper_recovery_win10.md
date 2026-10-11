# Codex WSL helper recovery — Windows 10 copy

Prepared October 7, 2026 from the final corrected installer in the supplied Windows 11 troubleshooting chat. This is a fresh copy of that installer, including the rollback/reinstall correction.

This machine uses Ubuntu under WSL2 with systemd enabled. Its desktop WSL server holds an open lock for a missing helper directory, matching the prior diagnosis. No helper bind mount is currently installed.

## Install from Windows PowerShell

1. Open an external PowerShell window and copy the command below.
2. Fully quit the ChatGPT/Codex desktop app. The installer refuses installation while its WSL server or code-mode host is running.
3. Run:

```powershell
wsl.exe -d Ubuntu -u root -- /usr/bin/python3 "/mnt/c/Users/Knut/.codex/visualizations/2026/10/07/01a11806-9823-7d92-bf2a-7d08b36032dc/codex-wsl-recovery/codex_wsl_helpers.py" install
```

Expect `mountedAsExpected: true`, `active: active`, and `enabled: enabled`. Reopen the desktop app and verify an ordinary sandboxed `pwd`. Approved execution outside the sandbox does not demonstrate recovery.

If the installer reports remaining desktop process IDs, make sure the app is fully closed and retry. It does not terminate processes automatically.

## Status

This command can run with the app open and makes no changes:

```powershell
wsl.exe -d Ubuntu -u root -- /usr/bin/python3 "/mnt/c/Users/Knut/.codex/visualizations/2026/10/07/01a11806-9823-7d92-bf2a-7d08b36032dc/codex-wsl-recovery/codex_wsl_helpers.py" status
```

## Rollback

Fully quit the desktop app, then run:

```powershell
wsl.exe -d Ubuntu -u root -- /usr/bin/python3 "/mnt/c/Users/Knut/.codex/visualizations/2026/10/07/01a11806-9823-7d92-bf2a-7d08b36032dc/codex-wsl-recovery/codex_wsl_helpers.py" rollback
```

## Changes made by installation

- Creates private helper storage at `/home/knut/.codex-wsl-runtime/arg0` and an ownership marker for reinstall.
- Creates and enables `/etc/systemd/system/mnt-c-Users-Knut-.codex-tmp-arg0.mount`.
- Bind-mounts that Linux storage onto `/mnt/c/Users/Knut/.codex/tmp/arg0` in WSL. Windows keeps its separate underlying helper directory.

Rollback removes the mount and unit and retains native helper data for a later reinstall. Settings, authentication, conversations, and application binaries are not migrated or edited.

## Verification of this copy

The restored Python source passes syntax compilation. Its read-only status command was run on this machine. Installation, mount activation, desktop recovery, and persistence after a WSL restart have not been tested on this machine. The supplied chat records successful use of this installer and workaround on the other machine.

After ordinary desktop execution works, verify persistence during a planned Ubuntu restart, after saving work and closing the app. Do not shut down WSL while work is running.
