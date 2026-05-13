# AGENTS.md

This file adds `service_blueprint`-specific discipline on top of the repo-root `AGENTS.md`.

## Authority Order

- `service_blueprint_layout_rules.md` is the normative semantic and middle-layer contract.
- `[Done] Second Service Blueprint Renderer Reset.md` is the architectural guardrail.
- `Service Blueprint Routing Rules.md` is the connector-routing contract for `service_blueprint`. It fills routing detail not specified in the semantic contract, is intentionally derived from and closely aligned with `reference/Service Blueprint Reference Design Notes.md`, and should stay consistent with both the layout rules and the reset.
- `reference/Service Blueprint Reference Design Notes.md` plus the reference SVG and PNG are the visual acceptance exemplars that the routing rules are meant to operationalize, not replace.
- If these sources appear to conflict, do not guess. Report the mismatch explicitly.

## Mandatory Pre-Implementation Extraction

- Before planning or coding, extract and cite:
  - the expected shared band schema for the proof case
  - the node-to-band assignments for the proof case
  - the edge-family expectations that affect routing readability

## Hard Layout Gates

- Do not accept output where semantic bands collapse into node-specific accidental columns.
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
