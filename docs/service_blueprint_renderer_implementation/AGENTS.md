# AGENTS.md

This file adds `service_blueprint`-specific discipline on top of the repo-root `AGENTS.md`.

## Authority Order

- `../service_blueprint_layout_rules.md` is the normative semantic and middle-layer contract.
- `Service Blueprint Renderer Reset.md` is the architectural guardrail.
- `reference/Service Blueprint Reference Design Notes.md` plus the reference SVG and PNG are visual acceptance exemplars, not solver specs.
- If these sources appear to conflict, do not guess. Report the mismatch explicitly.

## Mandatory Pre-Implementation Extraction

- Before planning or coding, extract and cite:
  - the expected shared band schema for the proof case
  - the node-to-band assignments for the proof case
  - the sidecar-placement justification for each `DataEntity` and `Policy`
  - the edge-family expectations that affect routing readability
- For `service_blueprint_slice`, explicitly ground `A1`, `I1`, `A2`, and sidecar placement from the docs before implementation starts.

## Hard Layout Gates

- Do not accept output where semantic bands collapse into node-specific accidental columns.
- Do not accept sidecar placement that cannot be justified by first write, first read, first constrained occurrence, or the local sidecar exception.
- Do not claim progress based only on ELK ownership, green tests, or successful artifact generation.

## Snapshot And Golden Discipline

- Do not refresh `service_blueprint` goldens until the proof-case layout satisfies the extracted invariants.
- If the sample render is structurally wrong, keep the failing goldens and report why.

## Status Language

- Use blunt status reporting for `service_blueprint` work:
  - `structurally correct`
  - `architecturally improved but visually unacceptable`
  - `acceptance-ready`
- Do not use vague success language when the proof case still fails.
