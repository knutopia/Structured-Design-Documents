# Guided Addition Phase 7 Acceptance Report

Phase decision: **ACCEPT**

Human approval: **ACCEPTED on 2026-08-15**

Phase 7 aligns current public and maintainer documentation with the accepted Guided Addition v1 runtime, verifies the published machine-readable surface, and closes the technical remediation sequence. It changes no Guided Addition runtime behavior, adds no adapter, and performs no deployment, publication, merge, or release action.

## UX Invariants In Scope

- Current user documentation presents the four relationship routes as outgoing/incoming direction plus relationship-first/existing-node-first choice order.
- Diagram filtering is described as an in-flow select/change/clear action, not an `sdd add --view` option.
- Node organization is described through contextual nesting, staying, moving, and meaningful sibling order rather than generic placement recommendations.
- Relationship-line placement is internal and absent from ordinary user choices.
- The client owns one ordinary Save or Cancel decision.
- Cancel performs no verification and no write; warning-free Save commits after dry-run verification; a concrete warning offers `Save anyway` or `Go back`.
- Current documentation does not expose rejected workflow vocabulary or claim that a guided helper, MCP, or app adapter exists.

## UX Result

Satisfied:

- The CLI guide documents standalone addition, no-anchor relationship launch, all four known-node routes, and choice-to-choice constraint propagation.
- Diagram filters are documented as human-readable contextual choices that can be selected, changed, or cleared without leaving the browse step.
- Structural organization is described in user language: nest or remain top-level for a new node, and move or remain for an existing node.
- The CLI guide states that relationship-line placement is handled internally.
- The exact delivery flow is documented: one Save/Cancel review, immediate commit after warning-free verification, and only `Save anyway`/`Go back` after a concrete warning.
- The root and docs-site README status sections describe Guided Addition v1 as working while retaining the terminal-only interface limitation.
- The helper guide identifies the library boundary without implying that `sdd-helper`, MCP, or an app exposes Guided Addition.

Violated: **none within the Phase 7 scope**.

## Technical Invariants In Scope

- `createContractIndex()`, the bundle-resolved contract accessors, and emitted root declarations are the published machine-readable surface.
- The shared contract index remains version `0.1`; Guided Addition workflow and proposal values remain version `1.0`.
- Static and bundle-resolved metadata serialize and validate as real v1 contract values.
- Emitted declarations expose `createGuidedAdditionRuntimeV1`, `applyAdditionProposalV1`, and `GuidedAdditionV1DomainError`, with no removed unversioned exports.
- No checked-in JSON metadata cache or generator is introduced.
- TypeScript, documentation-site, and serialized metadata outputs are verification artifacts only when they are already ignored or held in memory.
- Rejected historical architecture, implementation-plan, and acceptance-transcript documents remain unchanged.

## Technical Result

Satisfied:

- The toolchain architecture now describes the v1 runtime, caller-carried state, four-route graph, display-ready pages, semantic organization, v1 executor, bundle-owned warnings and relationship placement, pre-write consent guard, CLI delivery, and metadata boundary.
- The live static and bundle-resolved metadata are serialized in tests and scanned for rejected `0.1` workflow vocabulary.
- The emitted `dist/index.d.ts` surface is checked for exact versioned Guided Addition exports and absence of legacy exports.
- A documentation-conformance suite prevents stale CLI options, unversioned symbols, rejected route/placement vocabulary, routine final commit confirmation, and false adapter claims from returning.
- `sdd add --help` exposes only `--node`, `--bundle`, and help, with examples matching the CLI guide.
- The VitePress site builds from the corrected documentation. Its ignored `dist` output is not added to the tracked change set.
- Production-source scans find no dependency on the deleted legacy workflow. Rejected terms remaining in tests occur only in negative assertions that enforce their absence.

Violated: **none within the Phase 7 gate**.

## Documentation Corrections By Surface

| Surface | Corrected current contract |
| --- | --- |
| Root README | Guided Addition v1 is working through `sdd add`; the status summary names four routes, contextual filters, semantic organization, and one ordinary Save/Cancel decision. |
| Tracked docs-site README | Guided Addition v1 is listed as working; terminal-only interaction remains the limitation. |
| Public CLI guide | `sdd add` documents `--node` and `--bundle`, contextual diagram filters, four routes, semantic nesting/movement, one Save decision, warnings, and zero-write Cancel. |
| Toolchain architecture | All rejected runtime, placement, executor, CLI, and metadata descriptions are replaced with the accepted v1 boundary. |
| Helper guide | Guided v1 metadata and public library entry points are named while helper/MCP non-exposure remains explicit. |

## Machine-Readable Surfaces And Generated Outputs

| Surface | Phase 7 disposition |
| --- | --- |
| `createContractIndex()` | Serialized and schema-validated as the static published contract index. |
| Bundle-resolved contract accessors | Serialized with a loaded bundle and verified to expose current diagram, profile, node, and relationship values. |
| Root TypeScript declarations | Regenerated by the build and checked for v1-only Guided Addition exports. |
| VitePress output | Regenerated for verification; ignored output remains untracked and undeployed. |
| Checked-in JSON metadata | Not created; the shared contract design intentionally has no generated cache artifact. |

## Test And Audit Evidence

- Focused Phase 7 gate: **183/183 passed** across **12/12 files**, covering bundle authority, catalog, snapshots, v1 planner/executor, CLI transcripts, static and bundle-resolved metadata, public exports, architecture boundaries, helper boundaries, skill/document alignment, and publication documentation.
- Documentation-conformance and serialized-contract subset: **10/10 passed** across **2/2 files**.
- `TMPDIR=/tmp pnpm sdd add --help`: passed with no `--view` option and with current examples.
- `TMPDIR=/tmp pnpm run docs:build`: passed; VitePress completed client/server bundling and page rendering.
- Full serial repository gate: **799/799 passed** across **89/89 files** with `TMPDIR=/tmp pnpm test --no-file-parallelism`.
- Current-document scan found no rejected workflow claim. The only `sdd add`/`--view` occurrence states explicitly that the option does not exist.
- Production-source scan found no legacy Guided Addition imports or unversioned runtime/executor/error use.
- Test-source scan found rejected terms only inside negative conformance assertions.
- `git diff --check` passed.
- No snapshot, golden, rendered example, checked-in generated metadata, or public-site build output was refreshed or added.

## Residual Risks And Boundary

- Phase 7 documentation changes exist only on the current branch; the public site has not been deployed.
- Phase 7 human approval is recorded; the Guided Addition remediation is human-closed.
- Guided Addition remains terminal-based; a graphical non-technical client is future work.
- No helper, MCP, app, deployment, publication, merge, or release work is authorized by this report.
- Future adapters must consume the accepted v1 runtime and executor through a separate architecture and implementation plan.

## Decision

Phase decision: **ACCEPT**

Human approval: **ACCEPTED on 2026-08-15**. The Guided Addition remediation is complete.
