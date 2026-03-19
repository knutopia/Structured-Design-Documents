# Indentation in IA Place Map

- `[docs/Specific Layout Concerns per Diagram Type.md]:13` 
says that within an `Area`, consecutive sibling `Place` items in ordered `CONTAINS` source order should render as an author-ordered lower-level place chain, that the same source-order chaining rule applies at top level, and that equal-sibling `Place` runs should not recursively indent one another.    
**add NAVIGATES_TO condition**

- `[docs/renderer_migration_master_plan.md]:308` says `ia_place_map` “carries important hierarchical and indentation concerns,” and its required layout concerns include “rightward indentation for lower-level place hierarchy inside an area” and “rightward indentation for top-level implicit lower-level place sequences.”    
**ambiguous**

- `[docs/toolchain/decisions.md]:141` says top-level rendered nodes follow top-level source declaration order, sibling nodes under a structural parent follow hierarchy-edge source order, nesting `+` blocks do not define structural order, and in `ia_place_map` a consecutive sibling `Place` run becomes a same-source-order lower-level place sequence whose siblings stay aligned at the same rendered lower level.    
**too much**

- `[docs/toolchain/architecture.md]:179` says “IA organizes source-ordered area and place hierarchies,” and later says renderer-facing author order is kept separately from canonical compiled order, with reordering of declarations or hierarchy-edge lines treated as an intentional structural edit.
**fine**

- `[definitions/v0.1/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md]:69` says indentation is optional for parsing and recommended only for readability; the same file also says structural sibling order comes from hierarchy-edge line order, not `+` nesting placement, and specifically that in `ia_place_map` consecutive sibling `Place` items at the same rendered structural level form an author-ordered place chain until a non-`Place` boundary breaks it.
**add NAVIGATES_TO condition**

- `[definitions/v0.1/ebnf_grammar_sdd_text_v_0_dot_1.md]:11` says “Indentation is not semantically meaningful.”
**fine**

- `[definitions/v0.1/readme_structured_design_diagrams_sdd_text_v_0_dot_1.md]:150` says “Leading indentation is allowed for readability and MUST be ignored by parsers.”
**fine**

- `[definitions/v0.1/diffs_to_achieve_consistency_sdd_text_v_0_dot_1.md]:134` repeats the same rule: “Leading indentation is allowed for readability and MUST be ignored by parsers.”
**fine**

- `[bundle/v0.1/core/views.yaml]:112` says `ia_place_map` uses `hierarchy_edges: [CONTAINS]`, `ordering_edges: []`, and that consecutive sibling `Place` nodes at any rendered structural level form an author-ordered lower-level place chain until a non-`Place` sibling boundary breaks it.
**add NAVIGATES_TO condition, add NAVIGATES_TO as ordering edge**

- `[bundle/v0.1/core/syntax.yaml]:7` says `indentation_semantic: false`, and later notes that hierarchy-edge line order may be preserved as author-order metadata for projection/rendering while nesting placement alone does not define structural order.
**fine**