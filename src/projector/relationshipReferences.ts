import { createSemanticRelationshipReader } from "../relationships/semanticRelationships.js";
import type { ProjectionBuilderContext } from "./shared.js";
import type { ProjectionNodeAnnotation, ProjectionOmission } from "./types.js";

export function buildRelationshipReferences(context: ProjectionBuilderContext) {
  const configs = context.view.conventions.renderer_defaults?.relationship_references ?? [];
  const annotations: ProjectionNodeAnnotation[] = [];
  const omissions = new Map<string, ProjectionOmission>();
  if (configs.length === 0) return { annotations, omissions: [] as ProjectionOmission[] };
  const reader = createSemanticRelationshipReader(context.graph, context.bundle);
  for (const node of context.projectedNodes) {
    const references: NonNullable<ProjectionNodeAnnotation["references"]> = [];
    for (const config of configs) {
      if (!config.node_types.includes(node.type)) continue;
      const targets = new Map<string, typeof node>();
      for (const relationship of reader.lookup(node.id, config.direction, config.relationship)) {
        const targetId = relationship.from === node.id ? relationship.to : relationship.from;
        const target = context.graphNodesById.get(targetId);
        if (!target) continue;
        targets.set(target.id, target);
        omissions.set(relationship.identity, {
          kind: "edge", from: relationship.from, type: relationship.type, to: relationship.to,
          reason: "derived_annotation_instead_of_edge",
          detail: `${relationship.type} is represented by relationship references.`
        });
      }
      for (const target of [...targets.values()].sort((a, b) => a.id.localeCompare(b.id))) {
        references.push({
          role: config.role, target_id: target.id, target_type: target.type, target_name: target.name,
          group: config.role, label: config.label, detail_setting: config.detail_setting
        });
      }
    }
    if (references.length > 0) annotations.push({ node_id: node.id, references });
  }
  return { annotations, omissions: [...omissions.values()] };
}
