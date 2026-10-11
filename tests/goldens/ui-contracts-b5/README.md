# Historical B5 acceptance evidence

These 49 reference files were copied byte-for-byte from
`docs/Done/[Done] hierarchical_ui_contracts/` at repository commit
`567ebf0b69e8544282e2deed7f857d24529b336b`. Every reference matched its existing
SHA-256 value before relocation. No rendering, geometry, or hash was regenerated.

`b5_pipeline_evidence.json` supplies the original renderer scenes, positioned
scenes, and container titles for the B5 replay, scope, and header tests.

`b5_implementation_baseline.json` retains the historical hashes and metadata.
Only its `fixture` path and `referenceHashes` path keys were relocated:

- The fixture is the identical canonical
  `bundle/v0.1/examples/departure_desk.sdd`.
- Reference paths point to the frozen copies in this directory.
- Protected runtime source paths still point to the actual source files being
  checked. The replay test retains its existing authorized-change exceptions.

Historical paths inside explanatory documents, `startingStatus`, and other
provenance fields describe the original work. Tests do not follow those paths
to load fixtures. The archived documentation can move without changing these
acceptance inputs.

Keep the geometry assertions and hash checks intact. A new accepted rendering
requires an explicit behavioral change and review, not a blanket refresh of
these historical references.
