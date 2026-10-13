/** Bundle-shaped presentation contract used by relationship label formatters. */
export interface RelationshipLabelPresentation {
  separator: string;
  parts: Array<{
    field: string;
    template: string;
    resolve_node_name: boolean;
  }>;
  detail_display: Record<string, boolean>;
}

export type RelationshipLabelSource = object;

/**
 * Prepare authored relationship labels from bundle-selected fields. Node-name
 * resolution uses the supplied complete node inventory; it does not add graph
 * topology. Duplicate display names are qualified with their source IDs.
 */
export function formatRelationshipLabels<T extends RelationshipLabelSource>(
  relationships: readonly T[],
  nodeNamesById: ReadonlyMap<string, string>,
  presentation: RelationshipLabelPresentation,
  detailId: string,
  ambiguityRelationships: readonly T[] = relationships
): Array<string | undefined> {
  if (typeof presentation.detail_display[detailId] !== "boolean") {
    throw new Error(`Relationship label presentation does not define detail '${detailId}'.`);
  }
  if (!presentation.detail_display[detailId]) {
    return relationships.map(() => undefined);
  }

  const duplicateNameIds = new Set<string>();
  for (const part of presentation.parts) {
    if (!part.resolve_node_name) continue;
    const idsByName = new Map<string, Set<string>>();
    for (const relationship of ambiguityRelationships) {
      const value = (relationship as Record<string, unknown>)[part.field];
      if (typeof value !== "string" || value.length === 0) continue;
      const name = nodeNamesById.get(value);
      if (!name) continue;
      const ids = idsByName.get(name) ?? new Set<string>();
      ids.add(value);
      idsByName.set(name, ids);
    }
    for (const ids of idsByName.values()) {
      if (ids.size > 1) ids.forEach((id) => duplicateNameIds.add(id));
    }
  }

  return relationships.map((relationship) => {
    const parts = presentation.parts.flatMap((part) => {
      const rawValue = (relationship as Record<string, unknown>)[part.field];
      if (typeof rawValue !== "string" || rawValue.length === 0) return [];
      const value = part.resolve_node_name
        ? (() => {
          const name = nodeNamesById.get(rawValue);
          if (!name || !name.trim()) return rawValue;
          return duplicateNameIds.has(rawValue) ? `${name} (${rawValue})` : name;
        })()
        : rawValue;
      return [part.template.replace("{value}", value)];
    });
    const label = parts.join(presentation.separator).trim();
    return label || undefined;
  });
}
