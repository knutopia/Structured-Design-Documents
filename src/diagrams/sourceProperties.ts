import type { Bundle } from "../bundle/types.js";
import type { NodeBlock, ParseDocument } from "../parser/types.js";
import type { Diagnostic } from "../types.js";

/** Inspect source occurrences before ordinary graph assembly collapses property keys. */
export function checkDiagramSourceProperties(document: ParseDocument, bundle: Bundle, path: string): Diagnostic[] {
  const descriptor = bundle.contracts.diagram_membership;
  if (!descriptor) return [];
  const diagnostics: Diagnostic[] = [];
  const visit = (block: NodeBlock): void => {
    const reserved = new Set([descriptor.membership_property]);
    if (block.nodeType === descriptor.declaration_type) reserved.add(descriptor.type_property);
    const seen = new Set<string>();
    for (const item of block.bodyItems) {
      if (item.kind === "NodeBlock") visit(item);
      if (item.kind === "PropertyLine" && reserved.has(item.key)) {
        if (seen.has(item.key)) diagnostics.push({ stage: "compile", code: "compile.duplicate_reserved_property",
          severity: item.key === descriptor.type_property ? descriptor.source_multiplicity.declaration_type : descriptor.source_multiplicity.membership,
          message: `Node '${block.id}' repeats reserved property '${item.key}'`, file: path, span: item.span, relatedIds: [block.id] });
        seen.add(item.key);
      }
      if (item.kind === "EdgeLine") {
        const count = item.props.filter((prop) => prop.key === descriptor.membership_property).length;
        if (count > 1) diagnostics.push({ stage: "compile", code: "compile.duplicate_reserved_property", severity: descriptor.source_multiplicity.membership,
          message: `Edge '${block.id} ${item.relType} ${item.to}' repeats reserved property '${descriptor.membership_property}'`,
          file: path, span: item.span, relatedIds: [block.id, item.to] });
      }
    }
  };
  for (const item of document.items) if (item.kind === "NodeBlock") visit(item);
  return diagnostics;
}
