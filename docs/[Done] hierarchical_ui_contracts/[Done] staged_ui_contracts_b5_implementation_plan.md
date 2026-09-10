# [Done] Staged `ui_contracts`: B5 implementation plan

**Destination:** `/home/knut/projects/sdd/docs/hierarchical_ui_contracts/staged_ui_contracts_b5_implementation_plan.md`

**Status:** Accepted for implementation. Stage results are recorded in the implementation evidence alongside this plan.

## 1. Objective, authority, and fixed decisions

Port the staged SVG/PNG renderer to the complete enclosure-overview and local-context design, incorporating B5’s spacing, connectors, container headers, and independent decorator selection.

The implementation must cover the complete sheet, including sections omitted from B5’s focused proofs: hierarchy overview, repeated-hierarchy references, composition references, outgoing contracts, and referenced targets.

Use these sources according to their role:

| Role | Source |
| --- | --- |
| Machine-readable behavior | [View bundle](/home/knut/projects/sdd/bundle/v0.1/core/views.yaml) and [manifest](/home/knut/projects/sdd/bundle/v0.1/manifest.yaml) |
| Architectural constraints | [AGENTS.md](/home/knut/projects/sdd/AGENTS.md) and [staged-renderer guide](/home/knut/projects/sdd/docs/toolchain/adding_staged_renderers.md) |
| Final focused visual treatment | [B5 refinements](/home/knut/projects/sdd/docs/hierarchical_ui_contracts/b5_visual_refinements.md) and its SVGs |
| Accepted spacing evidence | [B4 shared-pipeline spacing](/home/knut/projects/sdd/docs/hierarchical_ui_contracts/b4_shared_pipeline_spacing.md) |
| Complete-sheet organization and content | [B2 detail policy](/home/knut/projects/sdd/docs/hierarchical_ui_contracts/b2_detail_policy.md), complete sheets, and overview |
| Semantic-node appearance | [Shared-node acceptance reference](/home/knut/projects/sdd/docs/good_node_rendering/shared_node_renderer_acceptance.md) |

B3’s spacing recommendations are withdrawn. Do not implement its per-connector gaps, narrower label wrapping, or manually positioned routes.

### Decisions confirmed with the user

- Implement the complete design and the documented additions to detailed content.
- Use existing shared rendering for semantic nodes and their decorator headers.
- Implement container title bars as custom, view-owned code. Extraction into a shared container capability is future work.
- Preserve the earlier **single-source outgoing-contract fan-out**. Repeating the source once per contract is not an approved fallback.
- Leave shared placement and routing code untouched.

### Non-negotiable acceptance invariants

1. **Preserve semantics.** Containment, composition, State ownership, transition use of Events, and explicit emission remain distinct.
2. **Preserve shared placement and routing.** No algorithm changes, copied replacement algorithms, post-layout coordinate edits, route rewriting, or relaxed validation.
3. **Preserve semantic nodes.** Every semantic occurrence uses the existing 224px shared node, with native typography, wrapping, and content-driven height.
4. **Preserve hierarchy across detail settings.** Both modes show the overview and all immediate Component parents and children.
5. **Separate identities from occurrences.** Repeated references retain their original semantic identity while receiving distinct scene identities.
6. **Separate detail from decorators.** Detailed content never enables type/ID headers; compact never disables explicitly selected decorators.
7. **Keep local relationships local.** Wider sequences may widen their scope, but must not stretch its composition or contract groups.
8. **Accept only verified output.** Geometry tests, routing validation, and visual review must pass before snapshots or public artifacts are refreshed.

### Verified planning baseline

- All twelve saved B5 scenes reproduce their saved positioned output exactly with the current pipeline.
- All twelve pass independent shared routing validation.
- The eight shared-source hashes recorded by B5 match the current files.
- The focused baseline comprises 36 passing tests across render-model, staged renderer, preparation, bundle-detail, and SVG-backend tests.
- `departure_desk.sdd` compiles and projects to 51 nodes and 45 edges without compilation or projection diagnostics.
- Its SHA-256 is `fec1fc5b356be868944b67eb2d6134bd6d70f0ca2f290fc515662f061f45fbff`.

The working tree already contains modified and untracked design artifacts. Preserve them; do not reset, regenerate, or commit them incidentally.

## 2. Target behavior and architecture

### Complete-sheet organization

Build sections in this order, preserving author order within each section:

1. Component hierarchy overview.
2. Place scopes, including their transition sequences and composition references.
3. Component scopes, one focal scope per semantic identity.
4. Referenced-target register when supporting content is visible.

Retain projected content whose owner does not fit those ordinary cases through an explicitly labeled standalone scope or register entry. Do not silently discard it.

The sheet contains diagram content and necessary relationship/reference labels. Proof-version names, editorial explanations, and implementation notes belong in accompanying documentation.

### Hierarchy overview

- Derive hierarchy exclusively from the bundle-declared Component-containment relationship.
- Composition into a Place or ViewState does not create a Component parent.
- Use nested enclosures to communicate containment; do not introduce containment arrows into the overview.
- Match B2’s enclosure topology, including the explicit inset enclosure around C-431 inside the expanded H1 region.
- Keep overview nodes name-only in both detail modes, subject to independent decorators.
- Show standalone Component roots, including components used only through composition.

Determine expansion before layout:

- Traverse roots in author order and outgoing containment relationships in authored order.
- Use depth-first occurrence-path order to select the earliest displayed occurrence.
- Expand a repeated Component subtree at its first occurrence; later occurrences retain the Component reference and point to the expansion.
- Assign `H1`, `H2`, and subsequent locators in expansion order.
- Repeated leaves without descendants need no subtree locator.
- Never deduplicate different semantic IDs because their names or structures match.
- Detail, decorators, node dimensions, and eventual coordinates must not affect expansion selection.

Use the existing author-order helpers and original compiled graph metadata. For graphs lacking that metadata, use their existing deterministic array-order fallback.

A reference such as `H1 · See Cargo Sheet` uses H1 as the unique locator; the parent name provides orientation. Duplicate names must not make reference resolution depend on text matching.

Containment cycles must produce an explicit renderer error and terminate traversal. Do not silently cut a cycle and present the result as a valid hierarchy.

### Local Component scopes

Each scope contains:

- All immediate Component parents.
- The focal Component.
- All immediate Component children.
- Its visible State sequences.
- Its explicit outgoing contracts.

Parents and children are lightweight references. Only the focal occurrence receives the selected detailed Component attributes.

Use the B5 neighborhood:

- Centered vertical stack for the neighborhood.
- Horizontal sibling rows.
- One `Contains` label on each incoming or outgoing common stem.
- Arrowheads communicating parent-to-child direction.
- Distinct routed bar segments, without overpainting the same segment.
- Invisible, zero-extent stack containers with typed ports for junctions.

Junctions carry no semantic identity, count as no Component, and paint no circle.

Keep a structure-only Component scope in compact mode even when its States and contracts are hidden.

### Detail and decorator matrix

| Content | Compact | Detailed |
| --- | --- | --- |
| Overview, locators, immediate parent/child context | Present | Present |
| Primary ViewState sequences and complete transition labels | Present | Present |
| Secondary State sequences when ViewStates are present | Hidden | Present |
| Supporting contracts and target register when ViewStates are present | Hidden | Present |
| State sequences and supporting contracts in State-only fallback | Present | Present |
| Place route/key, access, entry points | Hidden | Present |
| Place primary navigation | Present when supplied | Present when supplied |
| ViewState data required | Hidden | Present when supplied |
| Focal Component description, inputs, outputs | Hidden | Present when supplied |
| Place description below its node, constrained to 224px | Hidden | Present when supplied |
| Overview, neighbor, composition, and contract references | Name only | Name only |
| Empty Place scopes | Omitted with coverage feedback | Retained |

Retain the current projection-wide transition-priority decision. Do not introduce per-component State fallback when some other part of the projection contains ViewStates.

Do not add responsibilities, arbitrary properties, State invariants, or target payload descriptions beyond the agreed content selections.

Exercise all eight explicit combinations:

| `--detail` | `--decorators` |
| --- | --- |
| `compact` | `none`, `type`, `id`, `type,id` |
| `detailed` | `none`, `type`, `id`, `type,id` |

Omitted decorators continue to resolve through the existing user preference and bundle fallback. Container titles and H locators remain visible regardless of decorators.

### Ownership of implementation

Keep the main path:

`Projection → presentation model → RendererScene → MeasuredScene → PositionedScene → SVG → PNG`

Introduce a staged presentation model separate from the legacy render model. It owns:

- Semantic node and relationship identity.
- Visual occurrences and their roles.
- Overview expansion/reference decisions.
- Local scope membership.
- Detail-based visibility and coverage.
- Relationship provenance, including mappings from segmented connectors back to semantic relationships.

An occurrence needs a deterministic scene ID, semantic node ID, role, scope, and occurrence path. Keep the semantic ID in shared-node decorator content; never display the occurrence ID as the SDD ID.

Relationships need explicit source/target occurrence references. Replace positional pairing of independently filtered edge arrays in the new staged path with identity-based mapping. Preserve distinct authored relationships sharing the same endpoint triple, including different binding fields or transition annotations.

### Bundle contract

Extend `ui_contracts.conventions.renderer_defaults` with a typed `ui_contracts_presentation` configuration.

It must declare:

- Node-role and relationship endpoint selectors.
- Containment, composition, transition, and supporting-contract presentation.
- Overview visibility, expansion order, and reference policy.
- Focal/reference content selection.
- Attribute property keys, labels, ordering, and detail visibility.
- Scope and locator label templates.

Extend the existing boolean `detail_display` policies for the new visibility switches. Keep geometry and paint values in renderer-owned presentation tokens.

Consume this configuration through a validated resolver reached from `loadBundle(...)`. Add bundle types and validation before implementing its behavior. Required configuration must fail clearly when missing or invalid.

Use `resolveDetailDisplayPolicy` for detail selection. Do not introduce profile-based rendering decisions.

Add mutation tests proving that changing bundle relationship labels, selected attributes, and hierarchy visibility changes staged output without TypeScript changes. Update explanatory and generated relationship documentation where it would otherwise describe containment as hidden.

### Shared-code boundary

Freeze shared placement, routing, repair, validation, and spacing algorithms, including:

- `macroLayout`, `gridLayout`, and `stackSlots`.
- `routing`, `connectorLabelPlacement`, and all `routingCore` modules.
- The existing pipeline’s routing orchestration.

Also preserve shared semantic-node measurement, fonts, theme values, and node painting.

Permit only narrowly scoped integration for custom container headers:

- Typed UI-contract metadata and its cloning.
- Dispatch from container-header measurement to a view-owned header measurer.
- Dispatch from container-chrome painting to a view-owned painter.

Keep the actual header behavior in UI-contract modules. Do not introduce a general shared container-header framework during this port. Existing unmarked containers must retain their current behavior.

### Native container title bars

The custom implementation must reproduce B5:

- 14px outer radius.
- 1.5px inside outline.
- 19px title band.
- `#dbe4f0` title-band fill.
- Public Sans SemiBold, 10px, with 12px line height.
- 14px horizontal title inset.
- Distinct container body and outline colors.

Paint the body, then the inset title band clipped to the interior, then the complete outline. Only the top corners follow the outer rounding; the band’s lower edge stays flat.

Measure title text with the existing font-backed service. Keep titles on one line and allow their container to grow to the measured title width. Do not clip, truncate, reduce the font, or widen semantic nodes.

Store title text and header intent before measurement; store measured text blocks afterward. The painter consumes positioned geometry. Do not patch completed SVG strings or add unmeasured title overlays.

## 3. Staged execution

Complete stages sequentially. Each stage must include implementation, relevant tests, and an evidence note stating satisfied invariants, violations, and whether its output is acceptable.

Do not broaden implementation past a failed gate.

### Stage 0 — Establish the acceptance harness and edit boundary

- Record the starting revision, existing working-tree changes, protected-file hashes, and fixture checksum.
- Preserve B5 evidence as immutable reference material.
- Add a replay harness for the twelve saved scene inputs.
- Establish independent checks for semantic coverage, node and label bounds, header bounds, overlaps, route intersections, and shared routing violations.
- Distinguish unique semantic identities from visual occurrences and connector segments in coverage reports.
- Retain the existing legacy and other-view outputs as regression baselines.

**Exit gate:** B5 replay passes unchanged; baseline failures, if any appear in the execution environment, are recorded before implementation begins.

### Stage 1 — Prove single-source contract fan-out

This is an early feasibility gate because outgoing contracts were outside B5’s proofs.

A planning probe using a simple horizontal layered fan-out for C-430 produced shared collinear-overlap errors. That arrangement is not an accepted implementation.

Build a focused proof using:

- One shared source-reference node.
- Its actual outgoing relationships and lightweight target references.
- Distinct typed exits and invisible intermediate anchors where required.
- Measured label clearance and explicit scene-level channel reservations.
- Existing shared placement and routing for every segment.

Keep independent contract relationships independently traceable, with their correct styles and labels. Do not merge different contracts into an unlabeled common relationship or duplicate the source per row.

Exercise C-430’s emission, dependency, and binding together; then C-420, shared targets, long binding labels, and a higher-degree source. Include both decorated and undecorated source nodes.

**Exit gate:** The single-source appearance is readable, all relationships remain present, and geometry checks plus independent shared routing validation pass without exemptions.

If this cannot be achieved through supported scene inputs, stop and report the concrete blocker. Do not change shared code, relax checks, or substitute the rejected repeated-source layout.

### Stage 2 — Implement bundle policy and the presentation model

- Add and validate the presentation configuration and new detail switches.
- Implement a staged-only presentation-model builder consuming projection data, bundle policy, and existing compiled-graph lookup support.
- Build occurrence-aware references and relationship provenance.
- Implement deterministic overview expansion and locator assignment.
- Implement scope membership and the detail matrix.
- Supply Place entry-point and primary-navigation metadata through the staged path, resolving the documented delivery gap.
- Preserve raw projection data and the legacy render model.

Add backend-aware preparation so staged applicability and coverage use the new model while legacy text and Graphviz paths retain their existing preparation behavior. An internal target discriminator is sufficient; no new CLI option is needed.

**Exit gate:** Semantic tests and bundle mutation tests pass. Detail/decorator changes leave hierarchy selection and semantic identity unchanged.

### Stage 3 — Implement custom container headers

- Add the view-owned title specification, measurement, and painting modules.
- Add only the integration dispatch described above.
- Preserve standard shared-node headers unchanged.
- Exercise titled scope containers, hierarchy roots, H expansion/reference containers, and untitled nested enclosures.
- Ensure ancestor bounds include measured titles before positioning.
- Verify SVG and PNG from the same native output.

**Exit gate:** B5 header appearance passes visual review at normal size and enlarged inspection. No pill-shaped bands, obscured outlines, clipped titles, duplicate title paint, or changes to unrelated containers.

### Stage 4 — Port the focused B5 scopes

Rebuild the Component and Place proof excerpts through the new model and production scene builders.

For spacing:

- Retain horizontal `layered` transition groups with the existing 24px base gap.
- Let the existing widest measured connector label determine the common layer gap.
- Keep disconnected sequences in the same owner’s layered group.
- Retain horizontal five-step sequences.
- Reserve measured label outset plus the B4/B5 breathing room.
- Use the proven vertical stem and branch inputs: 34px labeled stems and 12px branch legs for the default proof typography, with stems derived from measured labels.
- Use measured local typed-port offsets for unequal-height Place/reference pairs.

Use view-owned preparation with shared measurements to supply gap, padding, and port inputs. Do not add absolute coordinates or routes to scene construction.

Retain the native excess right-edge width documented by B5. Do not crop it, shrink positioned containers, or regroup sequences to conceal it.

**Exit gate:** All twelve B5 configurations pass. Matching excerpts preserve semantic-node, connector, and connector-label geometry after accounting for occurrence IDs. The 33px-stem and 11px-branch negative controls remain rejected.

### Stage 5 — Assemble the complete design

- Add the source-ordered enclosure overview and H references.
- Add every Component focal scope.
- Add Place and ViewState composition groups.
- Integrate the accepted single-source contract group from Stage 1.
- Add the target register, including visible support identities used only in transition annotations.
- Preserve contracts owned by ViewStates or supporting nodes at their actual sources.
- Keep references lightweight and detailed focal content present once per identity.
- Use intrinsic-width local groups and start alignment so long sequences do not stretch composition, descriptions, or contracts.

The full-sheet B2 artifacts establish content and organization; their manually chosen geometry is not a production layout requirement.

**Exit gate:** The unchanged Departure Desk fixture represents the expected 51 identities and 45 relationships in detailed output. Compact represents the documented 17 identities and 24 relationships. Compare identity and relationship sets, not counts alone.

The expanded overview must show C-430 under C-420, its C-431 descendant, the later C-430 reference under C-470, and both parents in C-430’s local scope.

### Stage 6 — Harden topology, content, and option variations

Add focused cases for:

- Multiple roots, disconnected components, and deeper containment.
- Nested reuse and reuse across roots.
- Duplicate names and different IDs with identical structures.
- Source-order edits that intentionally change the first expansion.
- Missing author-order metadata.
- Single, absent, and multiple parents/children.
- Structure-only Component scopes.
- State-only fallback, mixed transition types, and multiple disconnected sequences.
- Branches, merges, cycles, and self-loops in transition graphs.
- Multiple composition targets and a Component composed into multiple ViewStates.
- Parallel binding relationships with different fields.
- Long names, IDs, descriptions, inputs, outputs, and transition annotations.
- Empty Places and otherwise empty diagrams.
- All eight detail/decorator combinations.

Preserve valid topology under the shared pipeline. When a case exposes an inherited limitation, report explicit diagnostics and the failed acceptance condition; do not silently omit content or normalize it into a golden.

**Exit gate:** Required cases pass or expose a concrete blocking limitation. No unresolved core visual invariant may be described as complete.

### Stage 7 — Integrate public preview paths and capture evidence

- Switch the staged `ui_contracts` SVG/PNG entrypoints to the accepted implementation.
- Preserve their public invocation and artifact naming conventions.
- Exercise CLI render/show, helper preview, and batch applicability.
- Test explicit decorator overrides and preference fallback with isolated test configuration.
- Rasterize the final SVG for PNG, including custom container paint.
- Update user documentation for hierarchy, reference locators, content selection, and legacy differences.
- Update the hierarchical-design directory index to point to implementation and acceptance evidence.

Only now refresh affected stage snapshots, SVG goldens, and staged rendered examples. Leave legacy and unrelated-view artifacts unchanged.

**Exit gate:** Production entrypoints produce the accepted complete design; compatibility tests pass; the protected-file audit is clean.

## 4. Verification and completion criteria

### Required evidence

For the main proof and representative topology cases, retain:

- Presentation-model output with occurrence and relationship provenance.
- `RendererScene`, `MeasuredScene`, and final `PositionedScene`.
- Native SVG and derived PNG.
- Detail and decorator settings.
- Semantic visibility and omission reports.
- Independent routing and geometry results.
- Visual-review findings.
- Protected-file comparison.

Header checks must include the band interior, complete outline, title bounds, corner shape, paint order, and containment within the viewport. An absence of renderer diagnostics alone is insufficient.

For horizontal-growth acceptance, compare two-step and five-step variants while holding local content constant. Local composition and contract positions must remain unchanged relative to their scope origin.

### Test execution

Run commands from the repository root with `TMPDIR=/tmp`.

During stages, run the new focused tests and the existing suites relevant to the changed subsystem. Before completion, run the full repository test command:

```bash
TMPDIR=/tmp pnpm test
```

Explicitly include coverage for legacy DOT/Mermaid, preview workflows, artifact paths, decorator defaults, shared nodes, shared routing, other staged views, and projection snapshots.

Build the documentation site after documentation integration and inspect generated examples after their acceptance-gated refresh.

### Stop conditions

Stop the affected stage when:

- Single-source contract fan-out cannot satisfy the frozen routing contract.
- A proposed fix requires changing shared placement or routing.
- A new display convention exists only in TypeScript.
- A relationship or identity disappears without an approved detail rule.
- A title, label, node, or connector violates the cited visual invariants.
- Snapshot updates would hide a regression.
- Further tuning has no contract-backed explanation.

Record the failing fixture, option combination, diagnostic or geometry evidence, and the boundary preventing progress.

### Definition of done

The port is complete only when the complete design works through public staged preview paths, all required detail/decorator variations pass, container title bars render natively and cleanly, the single-source contract requirement passes, and shared placement/routing plus legacy behavior remain unchanged.

The final handoff must identify what changed, the evidence reviewed, tests run, and any retained limitations. B5’s documented native right-edge excess may remain; unresolved semantic, routing, or title-bar failures may not.

