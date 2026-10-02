import type { Bundle, ViewSpec } from "./types.js";

/** Resolve hierarchy roles from legal endpoints within the selected view. */
export function resolveHierarchyRoles(bundle: Bundle, view: ViewSpec) {
  const included = new Set(view.projection.include_node_types);
  const hierarchy = new Set(view.projection.hierarchy_edges);
  const endpoints = bundle.contracts.relationships
    .filter((contract) => hierarchy.has(contract.type))
    .flatMap((contract) => contract.allowed_endpoints)
    .filter((pair) => included.has(pair.from) && included.has(pair.to));
  return {
    parentTypes: new Set(endpoints.map((pair) => pair.from)),
    childTypes: new Set(endpoints.map((pair) => pair.to))
  };
}
