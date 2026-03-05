# Readme: Role of Definitions and Spec Bundles

For v0.1 extraction work, the markdown files under `definitions/v0.1/` are the normative input.
After extraction, the bundle files under `bundle/v0.1/` are the machine-readable source of truth for tools.

Both definitions and spec bundles are organized in subfolders per version (like `v0.1/`).

Schema enums should ideally be generated from `core/vocab.yaml` to prevent drift.
Contract enforcement should be generated from `core/contracts.yaml`.

Rule: Markdown explains, bundle governs machine behavior.
