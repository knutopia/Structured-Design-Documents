# SDD skill bundle-awareness simplification report

Implemented on 2026-09-30 against the acceptance requirements in [the implementation plan](simplify_sdd_skill_bundle_awareness.md), with [AGENTS.md](../AGENTS.md) as the repository guardrails.

The authoritative, 198-word **Bundle Startup Procedure** now lives near the beginning of [SKILL.md](../skills/sdd-skill/SKILL.md#bundle-startup-procedure), after helper discovery and task classification. It distinguishes required initial bundle resolution from conditional later introspection. The [workflow reference](../skills/sdd-skill/references/workflow.md) supplies contract-selection detail and one concise subsection for bundle-selection exceptions.

Duplicate selection instructions were removed from the main skill's creation, editing, rendering, and hard-stop sections, and the workflow's former numbered selection procedure was replaced with a link. The conflicting restriction permitting bundle resolution only for unknown IDs was removed. Recipes now reference the central procedure; published examples retain the selected manifest, and the concrete v0.1 rendering example explicitly selects its manifest. The helper-gap reference was reviewed and remains consistent.

All acceptance gates passed:

- **Instruction coherence:** classification precedes selection; explicit selection takes precedence; the returned absolute manifest remains the authority for later operations and language rules; header protection and authoring/rendering safeguards remain present.
- **Source checks:** all 11 tests in `tests/sddSkillSource.spec.ts` passed, including capability agreement, revisions, handles, assessments, request transport, saved artifacts, and bundle-selection checks. Canonical and installed copies passed the skill validator. The documentation build and `git diff --check` passed.
- **Instruction walkthroughs:** the following expected continuations follow from the final prose.

| Scenario | Expected selection and continuation |
| --- | --- |
| Create without a version request | Initial create-contract resolution uses helper defaults; create and author receive the returned absolute manifest. |
| Edit v0.1 with a saved v0.2 preference | Select `bundle/v0.1/manifest.yaml` explicitly; resolve with it, then inspect, dry-run, and commit with the returned path while retaining the v0.1 declaration. |
| Custom manifest outside version directories | Resolve the supplied manifest and retain its returned absolute path without reconstructing a path from version metadata. |
| Inspect or search without mutation | Use the create-contract fallback with any known selection; it creates no document. Inspect/search receive the returned manifest. Mixed-version searches use separate selections and scopes. |
| Validate, preview, and save a diagram | All operations receive the same retained manifest; persisted-state assessment gates rendering and saving. |

Static help, capabilities, static contracts, and git-only tasks bypass bundle setup. No acceptance invariant remains violated.

The installed copy at `/home/knut/.codex/skills/sdd-skill` matched the original canonical source with no independent customizations. It was backed up to `/tmp/sdd-skill-before-simplification-j_r49_io/sdd-skill`, refreshed through the documented folder-copy installation flow, and verified to match the updated canonical tree. **Reload Codex to discover the refreshed instructions.**

Helper/CLI runtime code, bundles, and public contracts were unchanged. No snapshots or renderer artifacts were refreshed. These checks establish instruction consistency; actual LLM adherence and success rates remain unverified because no model trials were performed.
