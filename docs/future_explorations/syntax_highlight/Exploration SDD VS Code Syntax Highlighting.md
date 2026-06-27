# Exploration: SDD VS Code Syntax Highlighting

6-26-26

> This is an exploration thread. Do not write aby code.
>
> What features could we offer the user of SDD if we created a syntax highlight plugin for SDD in Visual Studio Code?

<details><summary>12 previous messages</summary>

> I’ll keep this exploratory and avoid edits. I’m going to ground the feature list in the current SDD syntax and renderer boundaries rather than treating it like a generic VS Code extension.
>
> <details><summary>Explored a file</summary>
>
> - Read `/mnt/c/Users/Knut/.codex/skills/sdd-skill/SKILL.md`
>
> </details>
>
> I’m using the SDD skill only for orientation, not mutation. Next I’m checking the bundle and existing docs so the suggestions can distinguish plain highlighting from deeper bundle-aware language tooling.
>
> <details><summary>Explored 4 files</summary>
>
> - Read `./bundle/v0.1/core/views.yaml`
> - Read `./bundle/v0.1/manifest.yaml`
> - Read `./bundle/v0.1/core/syntax.yaml`
> - Read `./bundle/v0.1/core/vocab.yaml`
>
> </details>
>
> The bundle confirms SDD is a line-oriented typed graph DSL with closed node and relationship vocabularies. That means a VS Code plugin can be much more useful than colorization: it can expose the bundle itself as authoring assistance.
>
> <details><summary>Explored 3 files, a search</summary>
>
> - Read `./bundle/v0.1/core/views.yaml`
> - Searched for `syntax highlight|VS Code|vscode|language server|semantic token|TextMate|highlight` in `docs`
> - Read `./bundle/v0.1/profiles/strict.yaml`
> - Read `./bundle/v0.1/core/contracts.yaml`
>
> </details>
>
> I also checked the contracts and strict profile. They give us concrete editor affordances: endpoint-aware completions, profile-specific required properties, diagnostics, and view-aware guidance are all derivable from bundle data instead of extension-only lists.
>
> I’ll look at a few real `.sdd` examples as authoring exemplars. That helps separate features that fit the language from features that would encourage misleading source layout.
>
> <details><summary>Explored 4 files</summary>
>
> - Read `./bundle/v0.1/examples/outcome_to_ia_trace.sdd`
> - Read `./bundle/v0.1/examples/service_blueprint_slice.sdd`
> - Read `./bundle/v0.1/examples/scenario_branching.sdd`
> - Read `./docs/toolchain/development.md`
>
> </details>
>
> The examples show a useful pattern: source order and nesting help readability, but graph meaning comes from explicit IDs, properties, and relationship lines. A plugin should reinforce that distinction instead of making indentation feel semantically binding.
>
> <details><summary>Explored 3 files, a search</summary>
>
> - Read `./bundle/v0.1/profiles/simple.yaml`
> - Read `./bundle/v0.1/core/contracts.yaml`
> - Searched for `createParserSyntaxRuntime|loadBundle|validate|project\(|sdd show|Language` in `src`
> - Read `./bundle/v0.1/profiles/permissive.yaml`
>
> </details>
>
> A VS Code “syntax highlight plugin” could grow into a strong SDD authoring surface if it stays bundle-driven.
>
> Relevant invariants I’d keep front and center:
>
> - Source of truth: [bundle/v0.1/](./bundle/v0.1)
> - Syntax contract: [bundle/v0.1/core/syntax.yaml](./bundle/v0.1/core/syntax.yaml)
> - Closed node/relationship vocab: [bundle/v0.1/core/vocab.yaml](./bundle/v0.1/core/vocab.yaml)
> - Validation contracts and profiles: [bundle/v0.1/core/contracts.yaml](./bundle/v0.1/core/contracts.yaml), [strict.yaml](./bundle/v0.1/profiles/strict.yaml)
> - Views and renderer defaults: [bundle/v0.1/core/views.yaml](./bundle/v0.1/core/views.yaml)
>
> **Tier 1: Highlighting MVP**
>
> - `.sdd` file association and SDD language mode.
> - Colorization for `SDD-TEXT`, node headers, nested `+` node headers, `END`, properties, comments, IDs, quoted names, and relationship lines.
> - Distinct highlighting for node groups: product intent, experience, structure, UI behavior, service delivery.
> - Distinct highlighting for relationship groups: structure, ordering, navigation, traceability, behavior, data, measurement.
> - Edge annotation highlighting:
>   - target ID
>   - human `to_name` hint
>   - event `[E-001]`
>   - guard `{condition}`
>   - effect `/ effect`
>   - edge props such as `field=...`
> - Folding from node header to `END`.
> - Bracket/quote matching for quoted strings, event brackets, guards, and effects.
> - Comment toggling with `#`.
> - Indentation support that helps readability but does not imply semantic nesting, since SDD semantics come from explicit edges/properties.
>
> **Tier 2: Bundle-Aware Editing**
>
> - Completions for node types and relationship types from the active bundle.
> - Relationship completions scoped to the current node type. For example, inside `Outcome`, suggest `MEASURED_BY`; inside `Step`, suggest `PRECEDES` and `REALIZED_BY`.
> - Target ID completions filtered by allowed endpoint type, inserting `ID "Name"` when useful.
> - Property key completions by node type and selected profile.
> - Required-property prompts for permissive/strict profiles.
> - Enum/pattern value completions, such as `Process.visibility`, `Place.access`, `primary_nav`, and `Step.kind=decision`.
> - Hover docs from bundle descriptions: node type meaning, relationship meaning, endpoint rules, profile rule explanations.
> - Diagnostics for parse errors, unknown tokens, invalid IDs, unresolved references, invalid endpoint pairs, missing required props, duplicate edges, bad enum values, and profile-specific violations.
> - Status bar selector for active profile: `simple`, `permissive`, `strict`.
>
> **Tier 3: Graph Navigation**
>
> - Go to definition from edge target IDs to the target node block.
> - Find references for node IDs across edges, `place_id`, `scope_id`, `opportunity_refs`, event annotations, etc.
> - Rename node ID safely across relationship targets and reference properties.
> - Outline tree of node blocks by type, ID, and name.
> - Workspace symbol search for SDD nodes.
> - CodeLens-style summaries above nodes: incoming/outgoing edge counts, views this node participates in, strict-profile readiness.
> - Stale `to_name` hint warning when the target node name changed but the edge hint did not.
>
> **Tier 4: Code Actions**
>
> - Add missing required properties for the selected profile.
> - Create missing target node from an unresolved edge.
> - Insert canonical relationship target hint from the referenced node name.
> - Convert informative aliases to canonical relationship names where recoverable.
> - Fix ID prefix/type mismatch, if conflict-free.
> - Add `kind=decision` when a `Step` branches through multiple `PRECEDES` edges.
> - Add missing `field=...` prop on `BINDS_TO`.
> - Add or reconcile `CONTAINS` for `ViewState.place_id` parentage.
> - Scaffold common node blocks for each node type.
>
> **Tier 5: View And Preview Features**
>
> - Command palette: “SDD: Preview View”.
> - Side-by-side SVG preview using `sdd show`.
> - View/profile picker: `ia_place_map`, `ui_contracts`, `service_blueprint`, `scenario_flow`, `outcome_opportunity_map`, `journey_map`.
> - Auto-refresh preview on save.
> - Export SVG/PNG from the editor.
> - Gutter decorations showing whether a node or edge appears in the selected view.
> - Hover explaining why something is excluded from a view, for example “endpoint not included by this view’s node filter.”
> - Click preview node to jump to source, if preview metadata supports it later.
> - Graphviz health check only for legacy preview backends; staged SVG paths should not make Graphviz feel mandatory.
>
> **Tier 6: Authoring Workbench**
>
> - New SDD document wizard: choose view goal, profile, and starter scaffold.
> - View-specific scaffolds:
>   - outcome/opportunity/initiative/metric
>   - stage/step journey
>   - IA area/place map
>   - scenario flow with branch decisions
>   - UI contracts with place/viewstate/component/event/data
>   - service blueprint with step/process/system/data/policy
> - “Profile readiness” panel showing what blocks strict validation.
> - “View coverage” panel showing which nodes and edges each diagram will include.
> - Traceability panel: outcome to metric to instrumentation, initiative to opportunity to implemented artifact, step to realized UI/process.
>
> **LLM-Integration Angle**
>
> A VS Code extension could also become the local authoring context provider for LLM workflows:
>
> - Send current node, referenced nodes, diagnostics, active profile, and selected view as structured context.
> - Ask for changes as SDD authoring intents rather than raw text edits.
> - Dry-run generated changes through the helper/compiler/validator before applying.
> - Show validation diagnostics and rendered preview before accepting the change.
>
> The key design rule: even for syntax highlighting, do not hardcode SDD tokens in the extension as a parallel truth. The best version reads or generates from the bundle, so adding a node type, relationship type, profile rule, or view convention in `bundle/v0.1/` naturally changes the editor experience.
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

<details><summary>3 previous messages</summary>

> I’ll keep this to production planning, not implementation. I’m going to verify the repo’s current runtime shape and check current official VS Code publishing guidance so the deployment answer is not stale.
>
> <details><summary>Explored 2 files, a search, a list, searched the web</summary>
>
> <details><summary>Explored 2 files, a search, a list</summary>
>
> - Read `./package.json`
> - Read `./tsconfig.json`
> - Listed files
> - Searched for `(^|/)package.json$|pnpm-workspace|tsconfig|vite|vitest|src/index.ts|bundle/v0.1`
>
> </details>
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
>
> For SDD, I would treat this as a **TypeScript VS Code extension plus a bundle-driven SDD language service**, not just a hand-written highlighter.
>
> **1. Language And Resources**
>
> Use **TypeScript**. The current repo is already TypeScript/Node 22/pnpm, and VS Code’s extension host is JavaScript/TypeScript-oriented. VS Code syntax highlighting itself is normally a TextMate grammar contributed through `package.json`, while richer semantic behavior can come from semantic token providers or a language server. Official docs distinguish TextMate tokenization from semantic tokens and language-server-backed features like diagnostics, autocomplete, and go-to-definition. Sources: [Syntax Highlight Guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide), [Semantic Highlight Guide](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide), [Language Server Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide).
>
> Minimum production pieces:
>
> - Extension package: `package.json`, `src/extension.ts`, `language-configuration.json`, grammar JSON, snippets, README, CHANGELOG, LICENSE, icon.
> - Grammar: generated or checked from `bundle/v0.1/core/syntax.yaml` and `vocab.yaml`, not manually duplicated.
> - Language service: reuse existing SDD bundle/parser/compiler/validator/projector code where possible.
> - Build: `tsc` plus likely `esbuild` for packaging. VS Code documents `esbuild` as a standard bundling path and recommends type-checking separately because esbuild does not type-check. Source: [Bundling Extensions](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
> - Tests: grammar fixture tests, unit tests for bundle-derived completions/diagnostics, and VS Code integration tests with `@vscode/test-cli` / `@vscode/test-electron`. Source: [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension).
> - Optional runtime dependencies: Graphviz only for legacy preview backends; staged SVG preview should avoid making Graphviz mandatory.
>
> I’d phase it like this:
>
> 1. Syntax-only MVP: `.sdd` association, grammar, folding, comments, snippets.
> 2. Bundle-aware editor: completions, hovers, diagnostics, go-to-definition.
> 3. Preview/workbench: view/profile selector, SVG preview via `sdd show`, code actions.
> 4. LSP extraction: only when we want other editors or heavier analysis isolation.
>
> **2. Same Repo Or Separate**
>
> I’d start **inside the existing SDD repo**, probably as a workspace package such as `packages/vscode-sdd`, and later split only if release ownership diverges.
>
> Reason: the core risk is bundle drift. The plugin must not carry a second private copy of node types, relationship types, profiles, view IDs, or validation rules. Keeping it in this repo makes it easier to prove that editor behavior is derived from [bundle/v0.1/](./bundle/v0.1) and existing runtime paths.
>
> A good structure would be:
>
> - root remains the SDD toolchain
> - `packages/vscode-sdd`: VS Code extension
> - possibly `packages/sdd-language-service`: editor-neutral language service shared by VS Code, future MCP, and maybe other editors
>
> A separate repo becomes attractive only after we have versioned npm packages for `sdd-core`/`sdd-language-service` and the bundle. Without that, a separate extension repo will probably copy conventions and drift.
>
> **3. Deployment**
>
> For local/private use, a `.vsix` file is enough. Build/package it, then install through VS Code’s “Install from VSIX” command or:
>
> ```bash
> code --install-extension sdd-vscode-0.1.0.vsix
> ```
>
> VS Code documents both the UI and CLI install paths for `.vsix` files. Source: [Install from a VSIX](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace#_install-from-a-vsix).
>
> For public VS Code users, publish to the **Visual Studio Marketplace**:
>
> - choose stable extension name and publisher ID
> - create Marketplace publisher
> - provide `publisher` in extension `package.json`
> - package/publish with `vsce`
> - set up CI publishing with secure auth; Microsoft now recommends Entra ID/workload identity for automation over long-lived PATs
> - maintain README, changelog, icon, license, categories, repository links
>
> VS Code’s official publishing docs show `vsce package` and `vsce publish`, and require a publisher identity in `package.json`. Source: [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension), [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest).
>
> For VSCodium/Theia/Gitpod-style ecosystems, also publish to **Open VSX**:
>
> - create Open VSX account/token
> - create or claim namespace matching the `publisher`
> - publish with `ovsx`
>
> Source: [Open VSX Publishing Extensions](https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions).
>
> My recommendation: **in-repo VS Code extension, TypeScript, bundle-generated grammar/data, local VSIX first, Marketplace once diagnostics/preview are stable, Open VSX once we care about non-Microsoft VS Code distributions.**
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
