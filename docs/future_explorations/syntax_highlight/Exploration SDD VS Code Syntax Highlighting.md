# Exploration: SDD VS Code Syntax Highlighting

6-27-26

# SDD VS Code Syntax Highlight Exploration

> This is an exploration thread. Do not write aby code.
>
> What features could we offer the user of SDD if we created a syntax highlight plugin for SDD in Visual Studio Code?

<details><summary>6 previous messages</summary>

> I’ll keep this exploratory and avoid edits. I’m going to ground the feature list in the current SDD syntax and renderer boundaries rather than treating it like a generic VS Code extension.
>
> I’m using the SDD skill only for orientation, not mutation. Next I’m checking the bundle and existing docs so the suggestions can distinguish plain highlighting from deeper bundle-aware language tooling.
>
> The bundle confirms SDD is a line-oriented typed graph DSL with closed node and relationship vocabularies. That means a VS Code plugin can be much more useful than colorization: it can expose the bundle itself as authoring assistance.
>
> I also checked the contracts and strict profile. They give us concrete editor affordances: endpoint-aware completions, profile-specific required properties, diagnostics, and view-aware guidance are all derivable from bundle data instead of extension-only lists.
>
> I’ll look at a few real `.sdd` examples as authoring exemplars. That helps separate features that fit the language from features that would encourage misleading source layout.
>
> The examples show a useful pattern: source order and nesting help readability, but graph meaning comes from explicit IDs, properties, and relationship lines. A plugin should reinforce that distinction instead of making indentation feel semantically binding.
</details>

A VS Code “syntax highlight plugin” could grow into a strong SDD authoring surface if it stays bundle-driven.

Relevant invariants I’d keep front and center:

- Source of truth: [bundle/v0.1/](./bundle/v0.1)
- Syntax contract: [bundle/v0.1/core/syntax.yaml](./bundle/v0.1/core/syntax.yaml)
- Closed node/relationship vocab: [bundle/v0.1/core/vocab.yaml](./bundle/v0.1/core/vocab.yaml)
- Validation contracts and profiles: [bundle/v0.1/core/contracts.yaml](./bundle/v0.1/core/contracts.yaml), [strict.yaml](./bundle/v0.1/profiles/strict.yaml)
- Views and renderer defaults: [bundle/v0.1/core/views.yaml](./bundle/v0.1/core/views.yaml)

**Tier 1: Highlighting MVP**

- `.sdd` file association and SDD language mode.
- Colorization for `SDD-TEXT`, node headers, nested `+` node headers, `END`, properties, comments, IDs, quoted names, and relationship lines.
- Distinct highlighting for node groups: product intent, experience, structure, UI behavior, service delivery.
- Distinct highlighting for relationship groups: structure, ordering, navigation, traceability, behavior, data, measurement.
- Edge annotation highlighting:
  - target ID
  - human `to_name` hint
  - event `[E-001]`
  - guard `{condition}`
  - effect `/ effect`
  - edge props such as `field=...`
- Folding from node header to `END`.
- Bracket/quote matching for quoted strings, event brackets, guards, and effects.
- Comment toggling with `#`.
- Indentation support that helps readability but does not imply semantic nesting, since SDD semantics come from explicit edges/properties.

**Tier 2: Bundle-Aware Editing**

- Completions for node types and relationship types from the active bundle.
- Relationship completions scoped to the current node type. For example, inside `Outcome`, suggest `MEASURED_BY`; inside `Step`, suggest `PRECEDES` and `REALIZED_BY`.
- Target ID completions filtered by allowed endpoint type, inserting `ID "Name"` when useful.
- Property key completions by node type and selected profile.
- Required-property prompts for permissive/strict profiles.
- Enum/pattern value completions, such as `Process.visibility`, `Place.access`, `primary_nav`, and `Step.kind=decision`.
- Hover docs from bundle descriptions: node type meaning, relationship meaning, endpoint rules, profile rule explanations.
- Diagnostics for parse errors, unknown tokens, invalid IDs, unresolved references, invalid endpoint pairs, missing required props, duplicate edges, bad enum values, and profile-specific violations.
- Status bar selector for active profile: `simple`, `permissive`, `strict`.

**Tier 3: Graph Navigation**

- Go to definition from edge target IDs to the target node block.
- Find references for node IDs across edges, `place_id`, `scope_id`, `opportunity_refs`, event annotations, etc.
- Rename node ID safely across relationship targets and reference properties.
- Outline tree of node blocks by type, ID, and name.
- Workspace symbol search for SDD nodes.
- CodeLens-style summaries above nodes: incoming/outgoing edge counts, views this node participates in, strict-profile readiness.
- Stale `to_name` hint warning when the target node name changed but the edge hint did not.

**Tier 4: Code Actions**

- Add missing required properties for the selected profile.
- Create missing target node from an unresolved edge.
- Insert canonical relationship target hint from the referenced node name.
- Convert informative aliases to canonical relationship names where recoverable.
- Fix ID prefix/type mismatch, if conflict-free.
- Add `kind=decision` when a `Step` branches through multiple `PRECEDES` edges.
- Add missing `field=...` prop on `BINDS_TO`.
- Add or reconcile `CONTAINS` for `ViewState.place_id` parentage.
- Scaffold common node blocks for each node type.

**Tier 5: View And Preview Features**

- Command palette: “SDD: Preview View”.
- Side-by-side SVG preview using `sdd show`.
- View/profile picker: `ia_place_map`, `ui_contracts`, `service_blueprint`, `scenario_flow`, `outcome_opportunity_map`, `journey_map`.
- Auto-refresh preview on save.
- Export SVG/PNG from the editor.
- Gutter decorations showing whether a node or edge appears in the selected view.
- Hover explaining why something is excluded from a view, for example “endpoint not included by this view’s node filter.”
- Click preview node to jump to source, if preview metadata supports it later.
- Graphviz health check only for legacy preview backends; staged SVG paths should not make Graphviz feel mandatory.

**Tier 6: Authoring Workbench**

- New SDD document wizard: choose view goal, profile, and starter scaffold.
- View-specific scaffolds:
  - outcome/opportunity/initiative/metric
  - stage/step journey
  - IA area/place map
  - scenario flow with branch decisions
  - UI contracts with place/viewstate/component/event/data
  - service blueprint with step/process/system/data/policy
- “Profile readiness” panel showing what blocks strict validation.
- “View coverage” panel showing which nodes and edges each diagram will include.
- Traceability panel: outcome to metric to instrumentation, initiative to opportunity to implemented artifact, step to realized UI/process.

**LLM-Integration Angle**

A VS Code extension could also become the local authoring context provider for LLM workflows:

- Send current node, referenced nodes, diagnostics, active profile, and selected view as structured context.
- Ask for changes as SDD authoring intents rather than raw text edits.
- Dry-run generated changes through the helper/compiler/validator before applying.
- Show validation diagnostics and rendered preview before accepting the change.

The key design rule: even for syntax highlighting, do not hardcode SDD tokens in the extension as a parallel truth. The best version reads or generates from the bundle, so adding a node type, relationship type, profile rule, or view convention in `bundle/v0.1/` naturally changes the editor experience.

> What would be the software production parameters for such a plugin?
> 1. What language (typescript?), what resources are needed?
> 2. Should we integrate the plugin into the existing SDD repo, or handle it separately?
> 3. How to deploy? (Any steps to take besides having a local file ready? Stores to integrate with?)

<details><summary>2 previous messages</summary>

> I’ll keep this to production planning, not implementation. I’m going to verify the repo’s current runtime shape and check current official VS Code publishing guidance so the deployment answer is not stale.
>
> <details><summary>Searched the web</summary>
>
> <details><summary>Searched the web</summary>
>
> - Searched the web for `site:code.visualstudio.com/api language extensions syntax highlighting TextMate grammars semantic tokens VS Code official`
> - Searched the web for `https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide`
> - Searched the web for `'vsce' in https://code.visualstudio.com/api/working-with-extensions/publishing-extension`
> - Searched the web for `'contributes' in https://code.visualstudio.com/api/references/extension-manifest`
> - Searched the web for `https://code.visualstudio.com/api/language-extensions/language-server-extension-guide`
> - Searched the web for `https://code.visualstudio.com/api/working-with-extensions/testing-extension`
> - Searched the web for `site:code.visualstudio.com/docs/editor/extension-marketplace install from VSIX Visual Studio Code official`
> - Searched the web for `https://code.visualstudio.com/docs/editor/extension-marketplace`
>
> </details>
>
> </details>
</details>

For SDD, I would treat this as a **TypeScript VS Code extension plus a bundle-driven SDD language service**, not just a hand-written highlighter.

**1. Language And Resources**

Use **TypeScript**. The current repo is already TypeScript/Node 22/pnpm, and VS Code’s extension host is JavaScript/TypeScript-oriented. VS Code syntax highlighting itself is normally a TextMate grammar contributed through `package.json`, while richer semantic behavior can come from semantic token providers or a language server. Official docs distinguish TextMate tokenization from semantic tokens and language-server-backed features like diagnostics, autocomplete, and go-to-definition. Sources: [Syntax Highlight Guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide), [Semantic Highlight Guide](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide), [Language Server Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide).

Minimum production pieces:

- Extension package: `package.json`, `src/extension.ts`, `language-configuration.json`, grammar JSON, snippets, README, CHANGELOG, LICENSE, icon.
- Grammar: generated or checked from `bundle/v0.1/core/syntax.yaml` and `vocab.yaml`, not manually duplicated.
- Language service: reuse existing SDD bundle/parser/compiler/validator/projector code where possible.
- Build: `tsc` plus likely `esbuild` for packaging. VS Code documents `esbuild` as a standard bundling path and recommends type-checking separately because esbuild does not type-check. Source: [Bundling Extensions](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
- Tests: grammar fixture tests, unit tests for bundle-derived completions/diagnostics, and VS Code integration tests with `@vscode/test-cli` / `@vscode/test-electron`. Source: [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension).
- Optional runtime dependencies: Graphviz only for legacy preview backends; staged SVG preview should avoid making Graphviz mandatory.

I’d phase it like this:

1. Syntax-only MVP: `.sdd` association, grammar, folding, comments, snippets.
2. Bundle-aware editor: completions, hovers, diagnostics, go-to-definition.
3. Preview/workbench: view/profile selector, SVG preview via `sdd show`, code actions.
4. LSP extraction: only when we want other editors or heavier analysis isolation.

**2. Same Repo Or Separate**

I’d start **inside the existing SDD repo**, probably as a workspace package such as `packages/vscode-sdd`, and later split only if release ownership diverges.

Reason: the core risk is bundle drift. The plugin must not carry a second private copy of node types, relationship types, profiles, view IDs, or validation rules. Keeping it in this repo makes it easier to prove that editor behavior is derived from [bundle/v0.1/](./bundle/v0.1) and existing runtime paths.

A good structure would be:

- root remains the SDD toolchain
- `packages/vscode-sdd`: VS Code extension
- possibly `packages/sdd-language-service`: editor-neutral language service shared by VS Code, future MCP, and maybe other editors

A separate repo becomes attractive only after we have versioned npm packages for `sdd-core`/`sdd-language-service` and the bundle. Without that, a separate extension repo will probably copy conventions and drift.

**3. Deployment**

For local/private use, a `.vsix` file is enough. Build/package it, then install through VS Code’s “Install from VSIX” command or:

```bash
code --install-extension sdd-vscode-0.1.0.vsix
```

VS Code documents both the UI and CLI install paths for `.vsix` files. Source: [Install from a VSIX](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace#_install-from-a-vsix).

For public VS Code users, publish to the **Visual Studio Marketplace**:

- choose stable extension name and publisher ID
- create Marketplace publisher
- provide `publisher` in extension `package.json`
- package/publish with `vsce`
- set up CI publishing with secure auth; Microsoft now recommends Entra ID/workload identity for automation over long-lived PATs
- maintain README, changelog, icon, license, categories, repository links

VS Code’s official publishing docs show `vsce package` and `vsce publish`, and require a publisher identity in `package.json`. Source: [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension), [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest).

For VSCodium/Theia/Gitpod-style ecosystems, also publish to **Open VSX**:

- create Open VSX account/token
- create or claim namespace matching the `publisher`
- publish with `ovsx`

Source: [Open VSX Publishing Extensions](https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions).

My recommendation: **in-repo VS Code extension, TypeScript, bundle-generated grammar/data, local VSIX first, Marketplace once diagnostics/preview are stable, Open VSX once we care about non-Microsoft VS Code distributions.**

> Tell me more about "possibly packages/sdd-language-service: editor-neutral language service shared by VS Code, future MCP, and maybe other editors" and "A VS Code extension could also become the local authoring context provider for LLM workflows" ...???
>
> Rationalize your approach with / compare your approach to ...our EXISTING plans for an MCP server. Remember that we built SDD-helper to support SDD-Skill, on top of a shared foundation that was meant to serve BOTH SDD-helper and the future MCP server ...let's keep our roadmaps straight.

<details><summary>6 previous messages</summary>

> I’ll keep this as roadmap alignment only. I’m going to read the existing helper/MCP/shared-authoring references so the answer respects the architecture already in motion.
>
> <details><summary>Explored 3 searches, a list</summary>
>
> - Listed files in `docs`
> - Searched for `(helper|authoring|mcp|skill|toolchain|workflow|contract|roadmap|design|development)`
> - Searched for `*mcp*` in `.`
> - Searched for `MCP|model context|helper|SDD-helper|language service|authoring|skill|shared foundation|shared authoring|server` in `docs`
>
> </details>
>
> The initial search confirms the roadmap already says “shared authoring core first, helper and MCP as adapters.” I’m narrowing in on the MCP design and the shared authoring capability notes, because those are the authority for keeping the VS Code idea in its lane.
>
> <details><summary>Explored 4 files</summary>
>
> - Read `./docs/future_explorations/mcp_server/sdd_machine_readable_contract_layer_design.md`
> - Read `./docs/future_explorations/mcp_server/sdd_mcp_server_design.md`
> - Read `./docs/Done/[Done]`
> - Read `./docs/Done/[Done]`
>
> </details>
>
> The key correction is: a standalone `packages/sdd-language-service` should not become a third product surface with its own semantics. If it exists, it should be an internal/shared library extraction from `src/authoring`, parser, validator, projector, and contract metadata so VS Code and MCP consume the same substrate.
>
> <details><summary>Explored 11 files, a search</summary>
>
> - Read `./docs/future_explorations/mcp_server/sdd_machine_readable_contract_layer_design.md`
> - Read `./docs/future_explorations/mcp_server/sdd_machine_readable_contract_layer_implementation_plan.md`
> - Read `./docs/Done/[Done]`
> - Read `./docs/future_explorations/mcp_server/sdd_mcp_server_design.md`
> - Searched for `sdd\.|MCP Tools|Tools|Prompts|apply_authoring|author_new_document|resources|inspect|create_document|apply_change_set|preview` in `sdd_mcp_server_design.md`
> - Read `./docs/readme_support_docs/sdd-helper/README.md`
> - Read `./docs/future_explorations/mcp_server/sdd_mcp_server_design.md`
> - Read `./docs/readme_support_docs/sdd-skill/README.md`
> - Read `./docs/future_explorations/mcp_server/sdd_mcp_server_design.md`
> - Read `./docs/future_explorations/mcp_server/sdd_mcp_server_design.md`
> - Read `./docs/readme_support_docs/sdd-skill/README.md`
> - Read `./docs/readme_support_docs/sdd-helper/README.md`
>
> </details>
</details>

You’re right to call this out. The clean roadmap is:

`bundle + shared domain core` -> adapters:
- `sdd-helper`: JSON CLI for skills/automation
- future `sdd-mcp-server`: MCP resources/tools/prompts
- possible VS Code extension: editor UX adapter

So my earlier “`packages/sdd-language-service`” idea should be understood as a **shared editor/domain service library**, not a new authority and not a replacement for MCP.

**What It Should Be**

A package like `packages/sdd-language-service` would expose editor-friendly APIs over the existing foundations:

- parse/token classification for highlighting and semantic tokens
- diagnostics from parse/compile/validate
- completions from bundle vocab/contracts/profiles/views
- hover docs from bundle + shared contract metadata
- outline, definition, references, rename planning
- code-action planning that emits `author`/`apply`-style structured requests
- preview request planning for selected view/profile

It should not own:

- SDD syntax semantics
- node/relationship vocab
- validation rules
- write semantics
- preview backend rules
- LLM workflow policy

Those stay where the current docs already put them: bundle files, `src/authoring/*`, parser/compiler/validator/projector/renderer, and the shared contract layer.

A better name might even be `sdd-editor-services` or `sdd-client-services`, because “language service” can sound like a new language authority. It is not.

**Comparison To The MCP Plan**

The existing MCP design already says the important thing: MCP and helper are sibling surfaces over the same shared SDD domain services, and MCP must not shell out to helper. See [sdd_mcp_server_design.md](./docs/future_explorations/mcp_server/sdd_mcp_server_design.md).

So the correct comparison is:

| Surface | Primary User | Protocol | Role |
|---|---|---|---|
| `sdd-helper` | skills/automation | JSON CLI | machine-facing helper adapter |
| `sdd-mcp-server` | LLM hosts | MCP | canonical LLM/tool integration |
| VS Code extension | human author in editor | VS Code API/LSP optional | editor UX adapter |
| `sdd-editor-services` | internal consumers | TS library | shared non-protocol logic |

The MCP server remains the right center of gravity for LLM workflows. The VS Code extension should not become “the LLM integration platform” unless we intentionally decide to make it an MCP server too, which I would avoid for v0.1.

**Where VS Code Helps LLM Workflows**

The extension can still be useful to LLM workflows without competing with MCP:

- Show the same diagnostics an agent would see.
- Let a user preview the same projection/render result an agent would request.
- Surface “copy/share context” commands based on MCP-shaped resources: inspect, validation, projection.
- Provide commands like “Prepare SDD context for assistant” that package current document, selected node, diagnostics, profile, and view.
- If an editor-integrated assistant is present, provide context from the same shared service outputs, not raw ad hoc source scraping.
- Eventually help configure/start the local MCP server, but not replace its resource/tool contract.

So: VS Code can be a **human-facing context workbench**. MCP should be the **agent-facing capability contract**.

**Implementation Posture**

For a quick prototype, the VS Code extension could call `sdd-helper` for `inspect`, `validate`, `project`, and `preview`. That is pragmatic, but it makes the extension a helper consumer and ties it to repo-local CLI availability.

For production, I’d prefer:

1. Keep improving `src/authoring/*` and shared contracts as the core.
2. Implement the MCP adapter against that core, per the existing roadmap.
3. Add an editor-services library only when VS Code needs reusable in-process behavior.
4. Make the VS Code extension a thin adapter over editor-services plus the existing renderer/preview paths.

That keeps the roadmaps straight: helper-first work remains valid, MCP remains the future LLM integration surface, and VS Code becomes an editor client, not a third semantic system.

> So you envision the VS Code extension to be fully dependent on the local presence of the SDD repo?

No. I’d split it into two phases.

For **internal dogfooding**, yes: the first VS Code extension can reasonably assume it is running inside this SDD repo and call `pnpm sdd-helper ...`. That keeps prototype scope low and proves the UX against the real shared authoring core.

For a **real user-facing extension**, no: it should not require a checkout of `/home/knut/projects/sdd`.

The production shape I’d prefer:

- Extension ships a default `v0.1` SDD language bundle and grammar.
- Extension depends on packaged SDD runtime/editor services, not a local source checkout.
- If the opened workspace contains an SDD toolchain repo or configured bundle, the extension can prefer that workspace-local bundle.
- If no repo/toolchain exists, syntax highlighting, folding, snippets, hovers, basic completions, and many diagnostics still work from the packaged bundle.
- Preview, authoring intents, and structured mutation can either use packaged services or connect to a local MCP/helper/toolchain when available.

So the dependency model should be:

```text
VS Code extension
  -> packaged default SDD bundle/runtime for normal editing
  -> optional workspace-local SDD bundle/toolchain for active development
  -> optional MCP/helper integration for richer local automation
```

The helper-first dependency is a good **prototype path**, not the final distribution contract.

The important architectural rule remains: the extension must not maintain its own hand-written SDD truth. It can package the truth, load the workspace truth, or consume MCP/helper truth. It should not invent a fourth semantic source.
