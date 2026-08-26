# Addressing the Reuse of the Step Node Type

8-26-26

> The scenario flow diagram and the journey map diagram use the same step nodes. That might be problematic - while both types do use "Steps", they tend to not be the same steps, since the application contexts in which these diagrams are used are different from each other. I wonder...
>
> - if we have other unintentional node-type reuse/overloading
> - how to address this in the future.
>
> Or am I mistaken and the "dual use" of Step nodes is a feature, not a bug?
>
> Do not write any code.
>
> Do not ramble.

<details><summary>4 previous messages</summary>

> I’ll use the SDD skill to trace `Step` and other node types from the governing bundle into the diagram projections, then give you a concise judgment. I won’t change any files.
>
> <details><summary>Explored 5 files, 2 searches, ran 2 commands</summary>
>
> <details><summary>Explored a file</summary>
>
> - Read `/mnt/c/Users/Knut/.codex/skills/sdd-skill/SKILL.md`
>
> </details>
>
> - Ran `rg -n -i --glob '!node_modules/**' '\bstep(s)?\b|scenario flow|journey map|node type|node kind|kinds:' bundle/v0.1 definitions/v0.1 src packages apps tests 2>/dev/null`
>
> - Ran `rg -n '^(node_types|relationships|views):|^  - id:|^    (name|description|node_types|relationships|node_scope|edge_scope|primary|question|purpose):|token: [REDACTED_SECRET]' bundle/v0.1/core/{vocab,views,contracts}.yaml`
>
> <details><summary>Explored 8 files, 2 searches</summary>
>
> - Read `./bundle/v0.1/core/vocab.yaml`
> - Read `./bundle/v0.1/core/views.yaml`
> - Read `./bundle/v0.1/core/views.yaml`
> - Read `./bundle/v0.1/core/views.yaml`
> - Searched for `^  - id: (outcome_opportunity_map|journey_map|service_blueprint|ia_place_map|scenario_flow|ui_contracts)$` in `views.yaml`
> - Searched for `^  - id:|^    projection:|^      include_node_types:|^      include_edge_types:` in `views.yaml`
> - Read `./bundle/v0.1/core/contracts.yaml`
> - Read `./bundle/v0.1/core/contracts.yaml`
> - Read `./definitions/v0.1/readme_structured_design_diagrams_sdd_text_v_0_dot_1.md`
> - Read `./definitions/v0.1/endpoint_contracts_semantic_rules_sdd_text_v_0_dot_1.md`
>
> </details>
>
> </details>
>
> The bundle confirms the reuse is intentional at the vocabulary level. I’m checking the more important distinction now: whether SDD can select different `Step` subsets or granularities per view, because that determines whether the design is compositional or genuinely overloaded.
>
> <details><summary>Explored 9 files, 2 searches, ran 3 commands</summary>
>
> - Ran `rg -n -i 'view[-_ ]specific|view scope|scope.*view|slice|subset|filter|include_node_types|projection.*all|same graph|multiple.*views|granular|granularity|journey.*scenario|scenario.*journey' bundle/v0.1 definitions/v0.1 docs src tests --glob '!tests/goldens/**' --glob '!bundle/v0.1/snapshots/**' 2>/dev/null`
>
> <details><summary>Explored 5 files, 2 searches</summary>
>
> - Read `./docs/doc_site/using_sdd/future_ux.md`
> - Searched for `function project|export function project|projectView|include_node_types|includeNodeTypes` in `src`
> - Searched for `interface .*Projection|type .*Projection|projection:` in `bundle`
> - Read `./src/projector/shared.ts`
> - Read `./src/projector/projectView.ts`
> - Read `./src/projector/journeyMap.ts`
> - Read `./src/projector/scenarioFlow.ts`
>
> </details>
>
> - Ran `sed -n '1,150p' bundle/v0.1/examples/outcome_to_ia_trace.sdd
> sed -n '1,120p' bundle/v0.1/examples/scenario_branching.sdd
> sed -n '1,150p' bundle/v0.1/examples/service_blueprint_slice.sdd 2>/dev/null || true
> rg -n -i 'journey|scenario|Step' docs/doc_site/diagram_types docs/doc_site/using_sdd --glob '*.md' 2>/dev/null`
>
> - Ran `sed -n '1,225p' docs/doc_site/diagram_types/index.md
> sed -n '1,260p' docs/doc_site/using_sdd/core_evolution.md 2>/dev/null || true
> rg -n -i 'granular|high-level|ui-level|step subtype|interaction step|journey step|scenario step|focused.*view|view membership|diagram membership|scope_id' docs bundle definitions --glob '*.md' --glob '*.yaml' --glob '!docs/Done/**' --glob '!docs/doc_site/public/**'`
>
> <details><summary>Explored 6 files</summary>
>
> - Read `./bundle/v0.1/core/vocab.yaml`
> - Read `./bundle/v0.1/core/views.yaml`
> - Read `./src/projector/shared.ts`
> - Read `./docs/doc_site/diagram_types/index.md`
> - Read `./docs/doc_site/using_sdd/core_evolution.md`
> - Read `./docs/doc_site/using_sdd/future_ux.md`
>
> </details>
>
> </details>
</details>

You’re not mistaken.

The cleanest judgment is: **reusing the `Step` concept is a feature; forcing every `Step` instance into every Step-based diagram is a bug/limitation.**

The conflict is visible in the documentation:

- Journey Map: “high-level sequence of interactions.”
- Scenario Flow: “UI-level activities.”
  [diagram definitions](./docs/doc_site/diagram_types/index.md:76)

Yet projections currently select **all nodes by type**, so both diagrams receive every `Step` in the document. There is no view-specific membership or granularity filter. [projection logic](./src/projector/shared.ts:83)

Other repeated node types look intentional:

| Reuse | Assessment |
|---|---|
| `Step`: Journey ↔ Service Blueprint | Healthy—the blueprint explicitly elaborates journey steps. |
| `Step`: Journey ↔ Scenario Flow | Problematic when high-level journey steps differ from detailed interaction steps. |
| `Place`: IA ↔ Scenario ↔ UI Contracts | Healthy shared identity. |
| `ViewState`: Scenario ↔ UI Contracts | Healthy shared identity. |
| `SystemAction`, `DataEntity`: Blueprint ↔ UI Contracts | Healthy traceability. |

I found no comparably clear accidental node-type overloading.

For the future:

1. Add bundle-governed named sections/view instances, so each diagram selects part of the graph.
2. Add an explicit Step-to-Step refinement/decomposition relationship: detailed scenario steps can refine a journey step.
3. Keep `Step` as the shared semantic type initially. Introduce `JourneyStep`/`ScenarioStep` subtypes only if their validation contracts genuinely diverge.

The roadmap already identifies “sections” and focused filtered views as missing capabilities. [core evolution](./docs/doc_site/using_sdd/core_evolution.md:23)

So: **shared identity should be optional and meaningful, not an automatic consequence of sharing a node type.**

> Tell me more about your suggestion "Add an explicit Step-to-Step refinement/decomposition relationship: detailed scenario steps can refine a journey step. "

<details><summary>2 previous messages</summary>

> I’ll use the SDD skill again because this proposal must fit the bundle’s existing relationship semantics, especially `PRECEDES`, `CONTAINS`, and `REALIZED_BY`. I’ll keep this conceptual and concise.
>
> <details><summary>Explored 3 files</summary>
>
> - Read `/mnt/c/Users/Knut/.codex/skills/sdd-skill/SKILL.md`
> - Read `./bundle/v0.1/core/contracts.yaml`
> - Read `./bundle/v0.1/core/views.yaml`
>
> </details>
</details>

I should sharpen the proposal: **a refinement relationship is useful, but it does not solve the problem without view-specific selection.**

### Meaning

A relationship such as `REFINED_BY` would connect a coarse Step to the more detailed Steps that explain it:

```text
“Complete purchase”
        │ REFINED_BY
        ├─ “Enter payment details”
        ├─ “Review total”
        └─ “Confirm payment”
```

All four remain `Step` nodes because all express user intent or behavior. They differ in abstraction level, not fundamental type.

### Why it needs a new relationship

Existing relationships mean different things:

- `PRECEDES` orders peer Steps over time.
- `CONTAINS` expresses structural grouping such as Stage → Step.
- `REALIZED_BY` connects a Step to Places, ViewStates, or Processes.

None says “this detailed behavior elaborates that higher-level behavior.” [existing contracts](./bundle/v0.1/core/contracts.yaml:57)

I would prefer `REFINED_BY` from parent to child over extending `CONTAINS`; refinement is semantic traceability, not merely visual nesting.

### Diagram behavior

Given the example:

- Journey Map shows **Complete purchase**.
- Scenario Flow shows **Enter payment details → Review total → Confirm payment**, with their Places and ViewStates.
- Service Blueprint can deliberately anchor at either level, depending on whether it describes the whole purchase or one detailed interaction.

A Step that genuinely works at both levels could still appear in both diagrams without refinement.

### Important constraints

The bundle should establish that:

- Refinement is acyclic.
- A Step cannot refine itself.
- Children are not automatically ordered; use `PRECEDES`.
- One refinement parent is recommended, though controlled reuse might permit several.
- Refinement does not automatically inherit `REALIZED_BY`, properties, or validation obligations.

### The missing companion capability

Current projections include every node of an accepted type. Therefore, adding `REFINED_BY` alone would still make both parent and child Steps appear everywhere.

Named diagram sections or selection rules are also required:

- Journey section: select refinement roots or a specified depth.
- Scenario section: select the descendants of a chosen Step.
- Blueprint section: select the appropriate refinement level.

So the intended model is:

**shared `Step` semantics + explicit refinement + explicit diagram scope**

That preserves traceability without pretending journey and scenario steps are always identical.

> I agree that this new relationship makes sense. I don't see any advantage in *not* introducing a distinction between JourneyStep and ScenarioStep though. The combination of named sections and a new REFINED\_BY relationship seems to simply avoid addressing the actual difference in step types - in a functioning way, but leaving a document format where two different things are called the same. Which obscures readability.
>
> Maybe a more abstract distinction between "Step" and "HighLevelStep" or "AbstractStep" is better since ServiceBlueprint is also a player.

<details><summary>2 previous messages</summary>

> Your objection changes my recommendation: named sections should select content, not carry the semantic distinction between two kinds of step. I’ll use the SDD skill to frame the split against the bundle’s current node and endpoint model; no files will be changed.
>
> <details><summary>Explored a file</summary>
>
> - Read `/mnt/c/Users/Knut/.codex/skills/sdd-skill/SKILL.md`
>
> </details>
</details>

I agree. Your objection exposes a weakness in my earlier recommendation:

**Sections answer “which part of the graph?” They should not answer “what kind of thing is this?”**

If journey and scenario steps have different meanings and validation expectations, they deserve distinct node types.

### Naming

I would avoid `HighLevelStep` and `AbstractStep`:

- “High-level” is relative and becomes unclear once there are three levels.
- “Abstract” can imply hypothetical or non-concrete rather than coarse-grained.

My preference is:

| Type | Meaning |
|---|---|
| `ExperienceStep` | A meaningful user/customer goal, episode, or progression point. |
| `InteractionStep` | A specific user action or decision within a scenario or interface. |

Then:

- Journey Map primarily uses `ExperienceStep`.
- Scenario Flow primarily uses `InteractionStep`.
- Service Blueprint normally anchors work to `ExperienceStep`, but could use `InteractionStep` for a detailed blueprint.
- `ExperienceStep REFINED_BY InteractionStep` connects the levels.

That produces clearer contracts:

- `Stage CONTAINS ExperienceStep`
- `ExperienceStep PRECEDES ExperienceStep`
- `ExperienceStep REFINED_BY InteractionStep`
- `InteractionStep PRECEDES InteractionStep`
- `InteractionStep REALIZED_BY Place | ViewState`
- `ExperienceStep REALIZED_BY Process` for blueprint delivery

### Why not `JourneyStep` and `ScenarioStep`?

They would still be defensible—and very readable—but they bind vocabulary to the current diagram suite. `ExperienceStep` and `InteractionStep` describe the entities independently of which renderer uses them.

### What happens to `Step`?

Ideally, `Step` becomes an abstract conceptual category, not an authorable node token. Both concrete types are “steps,” but documents always state which kind.

If the language does not introduce type inheritance, simply having two concrete node types is enough. A migration from existing `Step` nodes would require classification; it should not automatically reinterpret every old `Step`.

So my revised recommendation is:

**distinct semantic node types + `REFINED_BY` + named sections**

- Types say what a node is.
- `REFINED_BY` connects abstraction levels.
- Sections select the relevant portion of each level.
