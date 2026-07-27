# SDD Language Support

Local, declarative VS Code language support for Structured Design Documents (`.sdd`).

The extension provides syntax highlighting, comments, bracket and quote pairs, ID-aware word selection, readable indentation, and node-block folding. It does not provide parsing diagnostics, completion, formatting, snippets, or a language server.

The grammar and language configuration are generated from the machine-readable SDD v0.1 bundle by the repository's `generate:textmate` command. Do not edit the generated JSON files directly.

## Local packaging

From the repository root:

```sh
pnpm run package:vscode-sdd
code --install-extension .local-tools/sdd-language-0.1.0.vsix --force
```

Reload VS Code after installation. Opening a `.sdd` file should select the `SDD` language mode.
