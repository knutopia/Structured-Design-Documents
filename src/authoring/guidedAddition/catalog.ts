import { computeBundleFingerprint, type BundleFingerprint } from "../../bundle/fingerprint.js";
import {
  getNodeAuthoringForm,
  getNodeIdSuggestionInputs,
  getPlacementPolicyInputs,
  getRelationshipAuthoringSemantics,
  getRelationshipEdgeFieldSupport,
  getRelationshipRequiredEdgeProperties,
  listAllowedEndpointTriples,
  listGuidedViewDefinitions,
  type AllowedEndpointTriple,
  type EdgeFieldSupport,
  type NodeAuthoringForm,
  type NodeIdSuggestionInputs,
  type ResolvedGuidedRelationshipDisplay
} from "../../bundle/guidedAuthoring.js";
import type {
  AuthoringConfig,
  Bundle,
  GuidedDisplayRule,
  GuidedViewRelationship,
  JsonSchema,
  ProfileRule,
  RelationshipAuthoringConfig,
  SyntaxQuotedStringConfig
} from "../../bundle/types.js";
import { deepFreeze } from "./immutability.js";

export interface GuidanceSyntaxMetadata {
  identifier_pattern: string;
  id_pattern: string;
  bare_value_pattern: string;
  quoted_string: SyntaxQuotedStringConfig;
}

export interface GuidanceProfileRecord {
  profile_id: string;
  profile_order: number;
  intent: string;
  rules: ProfileRule[];
}

export interface GuidanceNodeTypeRecord {
  node_type: string;
  node_type_order: number;
  description?: string;
  id_suggestion: NodeIdSuggestionInputs;
  form: NodeAuthoringForm;
}

export interface GuidanceRelationshipRecord extends AllowedEndpointTriple {
  relationship_order: number;
  endpoint_order: number;
  meaning?: string;
  authoring: RelationshipAuthoringConfig;
  edge_fields: EdgeFieldSupport;
  required_edge_properties: string[];
}

export interface GuidanceViewRelationshipRecord extends GuidedViewRelationship {
  relationship_order: number;
  endpoint_order: number;
}

export interface GuidanceViewRecord {
  view_id: string;
  view_order: number;
  name: string;
  profile_aliases: Record<string, string>;
  relationships: GuidanceViewRelationshipRecord[];
}

export interface GuidanceDisplayContext {
  document_node_types?: Iterable<string>;
}

function endpointTripleKey(triple: AllowedEndpointTriple): string {
  return `${triple.from}\u0000${triple.type}\u0000${triple.to}`;
}

function viewTripleKey(viewId: string, triple: AllowedEndpointTriple): string {
  return `${viewId}\u0000${endpointTripleKey(triple)}`;
}

function cloneDisplayRule(rule: GuidedDisplayRule): GuidedDisplayRule {
  return {
    ...rule,
    when: rule.when ? { ...rule.when } : undefined
  };
}

function cloneViewRelationship(relationship: GuidedViewRelationship): GuidedViewRelationship {
  return {
    ...relationship,
    display_by_profile: Object.fromEntries(
      Object.entries(relationship.display_by_profile).map(([profileId, rules]) => [
        profileId,
        rules.map(cloneDisplayRule)
      ])
    )
  };
}

function predicateMatches(rule: GuidedDisplayRule, documentNodeTypes: Set<string>): boolean {
  if (!rule.when) {
    return true;
  }
  return rule.when.kind === "document_has_node_type" && documentNodeTypes.has(rule.when.node_type);
}

export class GuidanceCatalog {
  readonly kind = "sdd-guidance-catalog" as const;
  readonly bundle_fingerprint: BundleFingerprint;
  readonly syntax: GuidanceSyntaxMetadata;
  readonly schema: JsonSchema;
  readonly profiles: GuidanceProfileRecord[];
  readonly node_types: GuidanceNodeTypeRecord[];
  readonly relationships: GuidanceRelationshipRecord[];
  readonly views: GuidanceViewRecord[];
  readonly placement_policy: AuthoringConfig["placement_policies"]["default"];

  readonly #profilesById: Map<string, GuidanceProfileRecord>;
  readonly #nodesByType: Map<string, GuidanceNodeTypeRecord>;
  readonly #relationshipsByTriple: Map<string, GuidanceRelationshipRecord>;
  readonly #viewsById: Map<string, GuidanceViewRecord>;
  readonly #viewRelationshipsByTriple: Map<string, GuidanceViewRelationshipRecord>;

  constructor(args: {
    bundle_fingerprint: BundleFingerprint;
    syntax: GuidanceSyntaxMetadata;
    schema: JsonSchema;
    profiles: GuidanceProfileRecord[];
    node_types: GuidanceNodeTypeRecord[];
    relationships: GuidanceRelationshipRecord[];
    views: GuidanceViewRecord[];
    placement_policy: AuthoringConfig["placement_policies"]["default"];
  }) {
    this.bundle_fingerprint = args.bundle_fingerprint;
    this.syntax = deepFreeze(args.syntax);
    this.schema = deepFreeze(args.schema);
    this.profiles = deepFreeze(args.profiles);
    this.node_types = deepFreeze(args.node_types);
    this.relationships = deepFreeze(args.relationships);
    this.views = deepFreeze(args.views);
    this.placement_policy = deepFreeze(args.placement_policy);
    this.#profilesById = new Map(this.profiles.map((profile) => [profile.profile_id, profile]));
    this.#nodesByType = new Map(this.node_types.map((nodeType) => [nodeType.node_type, nodeType]));
    this.#relationshipsByTriple = new Map(
      this.relationships.map((relationship) => [endpointTripleKey(relationship), relationship])
    );
    this.#viewsById = new Map(this.views.map((view) => [view.view_id, view]));
    this.#viewRelationshipsByTriple = new Map(
      this.views.flatMap((view) =>
        view.relationships.map((relationship) => [viewTripleKey(view.view_id, relationship), relationship] as const)
      )
    );
    Object.freeze(this);
  }

  getProfile(profileId: string): GuidanceProfileRecord | undefined {
    return this.#profilesById.get(profileId);
  }

  getNodeType(nodeType: string): GuidanceNodeTypeRecord | undefined {
    return this.#nodesByType.get(nodeType);
  }

  getRelationship(triple: AllowedEndpointTriple): GuidanceRelationshipRecord | undefined {
    return this.#relationshipsByTriple.get(endpointTripleKey(triple));
  }

  getView(viewId: string): GuidanceViewRecord | undefined {
    return this.#viewsById.get(viewId);
  }

  getViewRelationship(viewId: string, triple: AllowedEndpointTriple): GuidanceViewRelationshipRecord | undefined {
    return this.#viewRelationshipsByTriple.get(viewTripleKey(viewId, triple));
  }

  resolveDisplay(
    viewId: string,
    triple: AllowedEndpointTriple,
    profileId: string,
    context: GuidanceDisplayContext = {}
  ): ResolvedGuidedRelationshipDisplay {
    const view = this.#viewsById.get(viewId);
    const relationship = this.#viewRelationshipsByTriple.get(viewTripleKey(viewId, triple));
    if (!view || !relationship) {
      throw new Error(`Unknown guided view/triple '${viewId}: ${triple.from} ${triple.type} ${triple.to}'`);
    }

    let resolvedProfileId = profileId;
    const visited = new Set<string>();
    while (view.profile_aliases[resolvedProfileId]) {
      if (visited.has(resolvedProfileId)) {
        throw new Error(`Guided display profile alias cycle at '${resolvedProfileId}'`);
      }
      visited.add(resolvedProfileId);
      resolvedProfileId = view.profile_aliases[resolvedProfileId];
    }

    const rules = relationship.display_by_profile[resolvedProfileId];
    if (!rules) {
      throw new Error(`Unknown guided display profile '${profileId}' for view '${viewId}'`);
    }
    const documentNodeTypes = new Set(context.document_node_types ?? []);
    const rule = rules.find((candidate) => predicateMatches(candidate, documentNodeTypes));
    if (!rule) {
      throw new Error(`No guided display rule matched profile '${profileId}' for view '${viewId}'`);
    }
    return {
      profile_id: profileId,
      resolved_profile_id: resolvedProfileId,
      rule
    };
  }
}

export function createGuidanceCatalog(bundle: Bundle): GuidanceCatalog {
  const triples = listAllowedEndpointTriples(bundle);
  const relationshipOrderByType = new Map(
    bundle.contracts.relationships.map((relationship, index) => [relationship.type, index])
  );
  const endpointOrderByTriple = new Map<string, number>();
  for (const relationship of bundle.contracts.relationships) {
    relationship.allowed_endpoints.forEach((endpoint, index) => {
      endpointOrderByTriple.set(endpointTripleKey({ from: endpoint.from, type: relationship.type, to: endpoint.to }), index);
    });
  }

  const relationships: GuidanceRelationshipRecord[] = triples.map((triple) => {
    const contract = bundle.contracts.relationships.find((relationship) => relationship.type === triple.type);
    const authoring = getRelationshipAuthoringSemantics(bundle, triple.type);
    const edgeFields = getRelationshipEdgeFieldSupport(bundle, triple.type);
    const requiredProperties = getRelationshipRequiredEdgeProperties(bundle, triple.type);
    if (!contract || !authoring || !edgeFields || !requiredProperties) {
      throw new Error(`Incomplete guidance catalog relationship '${triple.from} ${triple.type} ${triple.to}'`);
    }
    return {
      ...triple,
      relationship_order: relationshipOrderByType.get(triple.type)!,
      endpoint_order: endpointOrderByTriple.get(endpointTripleKey(triple))!,
      meaning: contract.meaning,
      authoring,
      edge_fields: edgeFields,
      required_edge_properties: [...requiredProperties]
    };
  });
  const relationshipByTriple = new Map(relationships.map((relationship) => [endpointTripleKey(relationship), relationship]));

  const nodeTypes: GuidanceNodeTypeRecord[] = bundle.vocab.node_types.map((token, index) => {
    const idSuggestion = getNodeIdSuggestionInputs(bundle, token.token);
    const form = getNodeAuthoringForm(bundle, token.token);
    if (!idSuggestion || !form) {
      throw new Error(`Incomplete guidance catalog node type '${token.token}'`);
    }
    return {
      node_type: token.token,
      node_type_order: index,
      description: token.description,
      id_suggestion: idSuggestion,
      form
    };
  });

  const views: GuidanceViewRecord[] = listGuidedViewDefinitions(bundle).map((view, viewOrder) => ({
    view_id: view.view_id,
    view_order: viewOrder,
    name: view.name,
    profile_aliases: { ...view.profile_aliases },
    relationships: view.relationships.map((relationship) => {
      const indexed = relationshipByTriple.get(endpointTripleKey(relationship));
      if (!indexed) {
        throw new Error(
          `Incomplete guidance catalog view relationship '${view.view_id}: ${relationship.from} ${relationship.type} ${relationship.to}'`
        );
      }
      return {
        ...cloneViewRelationship(relationship),
        relationship_order: indexed.relationship_order,
        endpoint_order: indexed.endpoint_order
      };
    })
  }));

  const profiles: GuidanceProfileRecord[] = bundle.manifest.profiles.map((entry, profileOrder) => ({
    profile_id: entry.id,
    profile_order: profileOrder,
    intent: entry.intent,
    rules: structuredClone(bundle.profiles[entry.id].rules)
  }));

  return new GuidanceCatalog({
    bundle_fingerprint: computeBundleFingerprint(bundle),
    syntax: {
      identifier_pattern: bundle.syntax.lexical.identifier_pattern,
      id_pattern: bundle.syntax.lexical.id_pattern,
      bare_value_pattern: bundle.syntax.lexical.bare_value_pattern,
      quoted_string: structuredClone(bundle.syntax.lexical.quoted_string)
    },
    schema: structuredClone(bundle.schema),
    profiles,
    node_types: nodeTypes,
    relationships,
    views,
    placement_policy: getPlacementPolicyInputs(bundle)
  });
}
