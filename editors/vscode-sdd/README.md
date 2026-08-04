# SDD Syntax Highlighting Language Support

Local, declarative VS Code language support for Structured Design Documents (`.sdd`).

The extension provides syntax highlighting, comments, bracket and quote pairs, ID-aware word selection, readable indentation, and node-block folding. It does not provide parsing diagnostics, completion, formatting, snippets, or a language server.

The grammar and language configuration are generated from the machine-readable SDD v0.1 bundle by the repository's `generate:textmate` command. Do not edit the generated JSON files directly.

## Prerequisites

Install [Git](https://github.com/git/git), [Node.js 22 LTS](https://nodejs.org/), and [Visual Studio Code](https://code.visualstudio.com/), then clone this repository. The setup commands below activate the repository-pinned `pnpm` version through Corepack.

The extension is not published to the VS Code Marketplace. It is packaged locally as `.local-tools/sdd-language-0.1.0.vsix`; `.local-tools/` is ignored by Git, so the generated VSIX is not committed.

## Package the VSIX

Run the commands for your environment from the repository root.

### macOS, Linux, or WSL2

```bash
scripts/setup-corepack.sh
pnpm install
pnpm run package:vscode-sdd
```

### Native Windows using PowerShell

```powershell
.\scripts\setup-corepack.ps1
pnpm install
pnpm run package:vscode-sdd
```

Both commands produce the same local VSIX under `.local-tools/`.

## Install the VSIX

### Linux

Run this from the repository root with the VS Code `code` command available on `PATH`:

```bash
code --install-extension .local-tools/sdd-language-0.1.0.vsix --force
```

### WSL2

Open the repository in a VS Code Remote - WSL window, then run the following command inside the WSL terminal:

```bash
code --install-extension .local-tools/sdd-language-0.1.0.vsix --force
```

Running the command inside WSL installs the extension into the WSL extension host. Running the equivalent command from Windows instead installs it into the Windows extension host, which does not provide language support to the Remote - WSL workspace.

### macOS

If `code` is not available in the terminal, open the VS Code Command Palette and run **Shell Command: Install 'code' command in PATH**. Then run:

```bash
code --install-extension .local-tools/sdd-language-0.1.0.vsix --force
```

### Native Windows using PowerShell

Run:

```powershell
code --install-extension .\.local-tools\sdd-language-0.1.0.vsix --force
```

If PowerShell cannot find `code`, restart the terminal after installing VS Code or use the graphical installation method below.

### Install through the VS Code interface

On any platform, open the VS Code Command Palette, run **Extensions: Install from VSIX...**, and select `.local-tools/sdd-language-0.1.0.vsix` from the repository. For WSL2, perform this action in the Remote - WSL window so VS Code targets the WSL extension host.

## Verify the installation

Reload VS Code after installation. Open a `.sdd` file and confirm that the language mode shown in the status bar is **SDD**. If necessary, select the status-bar language mode and choose **SDD** from the language list.
