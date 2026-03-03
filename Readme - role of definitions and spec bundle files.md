# Readme: Role of Definitions and Spec Bundles

The markdown files under definitions/ *are not* the source of truth, but serve as “spec commentary + rationale.” 
The yaml spec bundle files under bundle/ *are* the source of truth.

Both definitions and spec bundles are prganized in subfolders per version (like v0.1/)

Schema enums should ideally be generated from vocab.yaml to prevent drift.
Contract enforcement should be generated from contracts.yaml.

Rule: Markdown explains, Bundle governs.