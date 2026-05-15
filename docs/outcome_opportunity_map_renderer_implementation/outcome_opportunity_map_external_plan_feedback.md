# External Feedback on the Implementation Plan

Another LLM analyzed the implementation plan in light of the design document and came up with the following observations. Note that the reviewing LLM did not have access to the project beyond theee two documents, but the LLM is a strong architect, just like you are.

## Feedback Output by External LLM

*The LLM says:*

This is an exceptionally robust, defensive, and methodical implementation plan. It clearly maps out the boundaries of the staged pipeline and provides excellent guardrails for LLM orchestration. The separation of semantic ownership from physical realization—particularly treating outcomes as primary vertical anchors—is a highly effective approach to structuring this kind of structured design document.

However, reviewing the implementation plan against the design document reveals a few discrepancies, edge-case omissions, and architectural risks that warrant your attention before handing this off to the orchestration threads.

Here is a breakdown of the areas that may need tightening:

### Discrepancies Between Plan and Design

* **Synthetic Proof Cases in Snapshots:** The design document explicitly requires synthetic proof cases, such as dense metric fan-out and multiple outcomes, to prove routing mechanics before promotion. The plan successfully introduces these synthetic cases in Gate 2 and Gate 5. However, Gate 7 limits the capture of renderer-stage snapshots to only the "canonical proof cases". The plan omits capturing goldens for the synthetic cases, which creates a regression risk for those complex layouts.
* **Port Contention vs. Coordinate Displacement:** The design states that if same-edge contention becomes high, the implementation should "add type-specific ports in a routing gate". The implementation plan does not instruct the subagent to create type-specific ports. Instead, Gate 5 relies solely on "endpoint coordinate displacement on crowded node edges". The plan should clarify if displacement is the *only* strategy or if new ports must actively be registered.
* **Missing Visual Primitives Fallback:** The design notes that specific visual treatments, like a note-corner for metrics or a hexagon for opportunities, should only be used if supported by shared staged primitive/backend support. Furthermore, the design strictly forbids faking these with raw SVG strings. Gate 3 of the plan simply instructs the subagent to "Build semantic nodes with shared staged card primitives" without defining an explicit fallback shape (like a standard rectangle) if the advanced shapes do not yet exist in the codebase.

### Architectural Risks & Omissions

* **The Bundle Authority vs. Fixed Invariants Paradox:** The plan mandates that the view maintains "fixed semantic columns" from left-to-right: Initiatives, Opportunities, Outcomes, Metrics. Conversely, Gate 1 requires the subagent to encode "semantic column order" in the `views.yaml` bundle. If the pipeline is mathematically hardcoded to expect exactly four specific columns for its routing logic, but the bundle configuration is granted the authority to change the column count or order, the renderer could catastrophically fail. The plan lacks a proof task in Gate 1 or 2 to handle or reject bundle configurations that break the 4-column invariant.
* **Parking Band to Outcome Routing:** The design specifies that nodes without an anchoring path go to deterministic parking bands. The plan implements this in Gate 2 and Gate 4. However, neither document details the routing behavior if a node in a parking band happens to have a secondary, cross-band connection back to an outcome node. The design says parking bands "stay terminal". The plan needs to clarify if connectors are allowed to traverse backward or vertically out of a parking band, or if those edges should simply be dropped and flagged via diagnostics.
* **Subagent State Drift in Gate 5:** The orchestration thread protocol divides routing into Gate 4 (templates) and Gate 5 (gutters and final routes). Because Gate 5 implements complex logic like global gutter expansion and iterative rerouting, there is a high architectural risk that the isolated Gate 5 subagent might rewrite or ignore the foundational template logic established by the Gate 4 subagent. Adding a strict forbidden scope rule to Gate 5 (e.g., "Do not alter the step 2 endpoint/template generation logic") would safeguard the previous step.

YOu might consider to adjust the gate definitions to tighten the snapshot coverage and bundle authority, or you might consider to review the subagent orchestration protocol to mitigate the risk of state drift first.