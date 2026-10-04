import { createHash } from "node:crypto";
import { resolveBundleFieldReference } from "../bundle/bundleReferences.js";
import type { Bundle, BundleFieldReference } from "../bundle/types.js";
import type { CompiledEdge, CompiledGraph } from "../compiler/types.js";

function identityLogic(bundle: Bundle) {
  const logic = bundle.contracts.common_rules.find((rule) => rule.rule_logic?.kind === "duplicate_edge_identity")?.rule_logic;
  if (!logic || !Array.isArray(logic.key_fields) || !logic.key_fields.every((value) => typeof value === "string")) {
    throw new Error("Edge identity requires bundle duplicate-edge identity key_fields.");
  }
  return logic;
}

export function semanticEdgeProperties(edge: CompiledEdge, bundle: Bundle): Record<string, string> {
  const logic = identityLogic(bundle);
  const ignored = new Set<string>(Array.isArray(logic.ignored_properties) ? logic.ignored_properties as string[] : []);
  for (const reference of Array.isArray(logic.property_exclusion_refs) ? logic.property_exclusion_refs : []) {
    const value = resolveBundleFieldReference(bundle, reference as BundleFieldReference);
    for (const property of typeof value === "string" ? [value] : Array.isArray(value) ? value : []) {
      if (typeof property === "string") ignored.add(property);
    }
  }
  return Object.fromEntries(Object.entries(edge.props).filter(([key]) => !ignored.has(key)).sort(([a], [b]) => a.localeCompare(b)));
}

/** Canonical directed declaration key; symmetric readers may request normalized endpoints. */
export function semanticEdgeIdentity(edge: CompiledEdge, bundle: Bundle, options: {
  canonicalEndpoints?: boolean;
  keyFields?: string[];
} = {}): string {
  const fields = options.keyFields ?? identityLogic(bundle).key_fields as string[];
  const ignoredFields = new Set(identityLogic(bundle).ignored_fields as string[] | undefined);
  const [from, to] = options.canonicalEndpoints ? [edge.from, edge.to].sort((a, b) => a.localeCompare(b)) : [edge.from, edge.to];
  return JSON.stringify(fields.filter((field) => !ignoredFields.has(field)).map((field) => [field,
    field === "from" ? from : field === "to" ? to : field === "props" ? semanticEdgeProperties(edge, bundle)
      : edge[field as keyof CompiledEdge] ?? null
  ]));
}

export interface SourceEdgeIndex {
  byId: ReadonlyMap<string, CompiledEdge>;
  idFor(edge: CompiledEdge): string | undefined;
  resolve(id: string, association?: { from?: string; type?: string; to?: string }): CompiledEdge | undefined;
}

/** Exact occurrence references are revision scoped. Never resolves by endpoint triples. */
export function createSourceEdgeIndex(graph: CompiledGraph, bundle: Bundle): SourceEdgeIndex {
  const byId = new Map<string, CompiledEdge>();
  const byEdge = new Map<CompiledEdge, string>();
  const counts = new Map<string, number>();
  for (const edge of graph.edges) {
    const key = semanticEdgeIdentity(edge, bundle);
    const ordinal = counts.get(key) ?? 0;
    counts.set(key, ordinal + 1);
    const id = `source-edge-${createHash("sha256").update(key).digest("hex")}-${ordinal}`;
    byId.set(id, edge);
    byEdge.set(edge, id);
  }
  return {
    byId,
    idFor: (edge) => byEdge.get(edge),
    resolve(id, association) {
      const edge = byId.get(id);
      return edge && (!association || Object.entries(association).every(([key, value]) => edge[key as keyof CompiledEdge] === value))
        ? edge : undefined;
    }
  };
}
