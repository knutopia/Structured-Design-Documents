import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BundleValidationError,
  collectBundleDiagnostics,
  compileSource,
  getNodeIdSuggestionInputs,
  getPlacementPolicyInputs,
  getRelationshipAuthoringSemantics,
  getRelationshipEdgeFieldSupport,
  GuidedAdditionUnsupportedBundleError,
  hasGuidedAdditionSupport,
  listAllowedEndpointTriples,
  listGuidedViewRelationships,
  loadBundle,
  resolveGuidedRelationshipDisplay,
  resolveProfileRuleField,
  validateGraph,
  validateLoadedBundle
} from "../src/index.js";
import type { Bundle, GuidedDisplayPredicate } from "../src/bundle/types.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

function cloneBundle(): Bundle {
  return structuredClone(bundle) as Bundle;
}

function diagnosticsAfter(mutate: (cloned: Bundle) => void): ReturnType<typeof collectBundleDiagnostics> {
  const cloned = cloneBundle();
  mutate(cloned);
  return collectBundleDiagnostics(cloned);
}

function expectInvalid(code: string, mutate: (cloned: Bundle) => void): void {
  const cloned = cloneBundle();
  mutate(cloned);
  expect(() => validateLoadedBundle(cloned)).toThrow(BundleValidationError);
  expect(collectBundleDiagnostics(cloned).map((diagnostic) => diagnostic.code)).toContain(code);
}

function relationshipEntry(inputBundle: Bundle, viewId: string, from: string, type: string, to: string) {
  const entry = inputBundle.views.views
    .find((view) => view.id === viewId)
    ?.conventions.guided_addition?.relationships.find(
      (candidate) => candidate.from === from && candidate.type === type && candidate.to === to
    );
  if (!entry) {
    throw new Error(`Missing guided relationship ${viewId}: ${from} ${type} ${to}`);
  }
  return entry;
}

describe("guided addition bundle contract", () => {
  it("loads complete current-bundle authoring coverage", () => {
    expect(bundle.authoring).toBeDefined();
    expect(bundle.vocab.node_types).toHaveLength(16);
    expect(Object.keys(bundle.authoring!.node_id_suggestions.prefix_by_type)).toHaveLength(16);
    expect(Object.keys(bundle.authoring!.node_forms.by_type)).toHaveLength(16);
    expect(bundle.contracts.relationships).toHaveLength(17);
    expect(bundle.contracts.relationships.every((relationship) => relationship.authoring)).toBe(true);
    expect(bundle.contracts.relationships.every((relationship) => getRelationshipEdgeFieldSupport(bundle, relationship.type))).toBe(
      true
    );
    expect(listAllowedEndpointTriples(bundle)).toHaveLength(42);
    expect(
      bundle.views.views.reduce(
        (count, view) => count + (view.conventions.guided_addition?.relationships.length ?? 0),
        0
      )
    ).toBe(252);
    expect(collectBundleDiagnostics(bundle)).toEqual([]);
  });

  it("encodes the accepted relationship roles for all six views", () => {
    const expectedPrimary: Record<string, string[]> = {
      ia_place_map: ["Area CONTAINS Place", "Place CONTAINS Place", "Place NAVIGATES_TO Place"],
      journey_map: ["Stage CONTAINS Step", "Step PRECEDES Step"],
      scenario_flow: [
        "Step PRECEDES Step",
        "Step REALIZED_BY Place",
        "Step REALIZED_BY ViewState",
        "Place NAVIGATES_TO Place",
        "ViewState TRANSITIONS_TO ViewState"
      ],
      outcome_opportunity_map: [
        "Outcome MEASURED_BY Metric",
        "Opportunity SUPPORTS Outcome",
        "Initiative ADDRESSES Opportunity"
      ],
      service_blueprint: [
        "Step PRECEDES Step",
        "Process PRECEDES Process",
        "Step REALIZED_BY Process",
        "Process DEPENDS_ON Process",
        "Process DEPENDS_ON SystemAction",
        "Process CONSTRAINED_BY Policy",
        "SystemAction CONSTRAINED_BY Policy",
        "SystemAction READS DataEntity",
        "SystemAction WRITES DataEntity"
      ],
      ui_contracts: [
        "Place CONTAINS ViewState",
        "Place COMPOSED_OF Component",
        "ViewState COMPOSED_OF Component",
        "ViewState TRANSITIONS_TO ViewState"
      ]
    };
    const expectedSupporting: Record<string, string[]> = {
      ia_place_map: [],
      journey_map: [],
      scenario_flow: [],
      outcome_opportunity_map: [],
      service_blueprint: [],
      ui_contracts: [
        "Place CONTAINS Place",
        "Component CONTAINS Component",
        "State TRANSITIONS_TO State",
        "Component EMITS Event",
        "ViewState EMITS Event",
        "SystemAction EMITS Event",
        "ViewState DEPENDS_ON SystemAction",
        "Component DEPENDS_ON SystemAction",
        "Component BINDS_TO DataEntity"
      ]
    };

    for (const view of bundle.views.views) {
      const relationships = view.conventions.guided_addition!.relationships;
      const byRole = (role: "primary" | "supporting") =>
        relationships
          .filter((relationship) => relationship.role === role)
          .map((relationship) => `${relationship.from} ${relationship.type} ${relationship.to}`);
      expect(new Set(byRole("primary"))).toEqual(new Set(expectedPrimary[view.id]));
      expect(new Set(byRole("supporting"))).toEqual(new Set(expectedSupporting[view.id]));
      expect(relationships.filter((relationship) => relationship.role === "bridge")).toHaveLength(
        42 - expectedPrimary[view.id].length - expectedSupporting[view.id].length
      );
    }
  });

  it("encodes complete edge-field support without changing requiredness ownership", () => {
    const expectedAnnotations: Record<string, string[]> = {
      PRECEDES: ["event", "guard", "effect"],
      NAVIGATES_TO: ["event", "guard"],
      TRANSITIONS_TO: ["event", "guard", "effect"]
    };
    for (const relationship of bundle.contracts.relationships) {
      expect(getRelationshipEdgeFieldSupport(bundle, relationship.type)).toEqual({
        annotations: expectedAnnotations[relationship.type] ?? [],
        properties: relationship.type === "BINDS_TO" ? ["field"] : []
      });
    }
    const bindsTo = bundle.contracts.relationships.find((relationship) => relationship.type === "BINDS_TO")!;
    expect(bindsTo.constraints.filter((rule) => rule.rule_logic?.kind === "required_edge_property")).toHaveLength(1);
    expect(
      bundle.contracts.relationships
        .filter((relationship) => relationship.type !== "BINDS_TO")
        .flatMap((relationship) => relationship.constraints)
        .filter((rule) => rule.rule_logic?.kind === "required_edge_property")
    ).toEqual([]);
  });

  it("uses one canonical bundle prefix map for strict and permissive validation", () => {
    for (const profileId of ["strict", "permissive"]) {
      const rule = bundle.profiles[profileId].rules.find((candidate) => candidate.rule_logic?.kind === "id_prefix_type_coupling");
      expect(rule).toBeDefined();
      expect(rule?.prefix_map).toBeUndefined();
      expect(rule?.bundle_refs?.prefix_map).toEqual({
        artifact: "authoring",
        selector: "node_id_suggestions.prefix_by_type"
      });
      expect(resolveProfileRuleField(bundle, rule!, "prefix_map")).toBe(bundle.authoring!.node_id_suggestions.prefix_by_type);
    }
  });

  it("changes allowed endpoint access when only the endpoint contract changes", () => {
    const cloned = cloneBundle();
    const before = listAllowedEndpointTriples(cloned);
    cloned.contracts.relationships[0].allowed_endpoints[0].to = "Place";
    const after = listAllowedEndpointTriples(cloned);

    expect(after).not.toEqual(before);
    expect(after[0]).toEqual({ from: "Stage", type: "CONTAINS", to: "Place" });
  });

  it("changes prefix diagnostics when only the canonical authoring prefix changes", () => {
    const input = {
      path: "/virtual/prefix-proof.sdd",
      text: 'Place P-001 "Proof"\nEND\n'
    };
    const compiled = compileSource(input, bundle);
    expect(compiled.graph).toBeDefined();
    expect(validateGraph(compiled.graph!, bundle, "strict").diagnostics).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "validate.id_prefix_type_coupling" })])
    );

    const cloned = cloneBundle();
    cloned.authoring!.node_id_suggestions.prefix_by_type.Place = "PX";
    const diagnostics = validateGraph(compiled.graph!, cloned, "strict").diagnostics;
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "validate.id_prefix_type_coupling",
          message: expect.stringContaining("expected 'PX'")
        })
      ])
    );
  });

  it("changes display resolution when only bundle display metadata changes", () => {
    const triple = { from: "Outcome", type: "MEASURED_BY", to: "Metric" };
    expect(resolveGuidedRelationshipDisplay(bundle, "outcome_opportunity_map", triple, "simple").rule).toMatchObject({
      presence: "connector",
      label: "visible"
    });

    const cloned = cloneBundle();
    relationshipEntry(cloned, "outcome_opportunity_map", triple.from, triple.type, triple.to).display_by_profile.simple[0] = {
      presence: "hidden",
      label: "not_applicable"
    };
    expect(resolveGuidedRelationshipDisplay(cloned, "outcome_opportunity_map", triple, "simple").rule).toMatchObject({
      presence: "hidden",
      label: "not_applicable"
    });
  });

  it("resolves profile aliases and conditional display rules without missing-entry fallback", () => {
    const triple = { from: "State", type: "TRANSITIONS_TO", to: "State" };
    expect(resolveGuidedRelationshipDisplay(bundle, "ui_contracts", triple, "simple").rule.presence).toBe("connector");
    expect(
      resolveGuidedRelationshipDisplay(bundle, "ui_contracts", triple, "simple", {
        document_node_types: ["ViewState"]
      }).rule.presence
    ).toBe("hidden");
    expect(resolveGuidedRelationshipDisplay(bundle, "ui_contracts", triple, "permissive")).toMatchObject({
      profile_id: "permissive",
      resolved_profile_id: "strict",
      rule: { presence: "connector", label: "visible" }
    });

    const cloned = cloneBundle();
    cloned.views.views.find((view) => view.id === "ui_contracts")!.conventions.guided_addition!.relationships = [];
    expect(() => resolveGuidedRelationshipDisplay(cloned, "ui_contracts", triple, "simple")).toThrow(
      /does not declare guided display/
    );
  });

  it("changes placement inputs when only the placement policy changes", () => {
    const cloned = cloneBundle();
    expect(getPlacementPolicyInputs(cloned).edge_in_source_body).toBe("after_relationships_before_nested_nodes");
    expect(getPlacementPolicyInputs(cloned).fallback).toBe("last");
    cloned.authoring!.placement_policies.default.fallback = "first" as "last";
    expect(getPlacementPolicyInputs(cloned).fallback).toBe("first");
  });

  it("accepts semantic and legacy edge placement policies and rejects unknown values", () => {
    const semantic = cloneBundle();
    semantic.authoring!.placement_policies.default.edge_in_source_body = "after_relationships_before_nested_nodes";
    expect(() => validateLoadedBundle(semantic)).not.toThrow();

    const legacy = cloneBundle();
    legacy.authoring!.placement_policies.default.edge_in_source_body = "last";
    expect(() => validateLoadedBundle(legacy)).not.toThrow();
    expect(getPlacementPolicyInputs(legacy).edge_in_source_body).toBe("last");

    expectInvalid("bundle.authoring.unknown_placement_policy_value", (cloned) => {
      cloned.authoring!.placement_policies.default.edge_in_source_body = "unknown" as "last";
    });
  });

  it("exposes relationship semantics, edge fields, forms, and view records as read-only copies", () => {
    expect(getNodeIdSuggestionInputs(bundle, "ViewState")).toEqual({
      node_type: "ViewState",
      prefix: "VS",
      sequence_policy: "max_numeric_plus_one",
      minimum_digits: 3
    });
    expect(getRelationshipAuthoringSemantics(bundle, "CONTAINS")).toEqual({
      graph_role: "structural",
      source_representation: "edge_line",
      source_organization: "nest_target_under_source"
    });
    expect(getRelationshipEdgeFieldSupport(bundle, "PRECEDES")).toEqual({
      annotations: ["event", "guard", "effect"],
      properties: []
    });
    expect(getRelationshipEdgeFieldSupport(bundle, "BINDS_TO")).toEqual({ annotations: [], properties: ["field"] });

    const entries = listGuidedViewRelationships(bundle, "journey_map")!;
    entries[0].role = "bridge";
    expect(listGuidedViewRelationships(bundle, "journey_map")![0].role).not.toBe("bridge");
  });

  it("keeps ordinary consumers usable when authoring metadata is absent", () => {
    const cloned = cloneBundle();
    const legacyPrefixMap = { ...cloned.authoring!.node_id_suggestions.prefix_by_type };
    for (const profile of Object.values(cloned.profiles)) {
      const prefixRule = profile.rules.find((candidate) => candidate.rule_logic?.kind === "id_prefix_type_coupling");
      if (prefixRule) {
        delete prefixRule.bundle_refs;
        prefixRule.prefix_map = legacyPrefixMap;
      }
    }
    delete cloned.manifest.core.authoring;
    delete cloned.authoring;

    expect(hasGuidedAdditionSupport(cloned)).toBe(false);
    const compiled = compileSource({ path: "/virtual/older-bundle.sdd", text: 'Place P-001 "Older"\nEND\n' }, cloned);
    expect(compiled.graph).toBeDefined();
    expect(validateGraph(compiled.graph!, cloned, "simple").errorCount).toBe(0);
    expect(() => getPlacementPolicyInputs(cloned)).toThrow(GuidedAdditionUnsupportedBundleError);
    expect(() => validateLoadedBundle(cloned)).not.toThrow();
  });

  it("rejects invalid references, tokens, coverage, aliases, predicates, and edge-field rules", () => {
    expectInvalid("bundle.reference.inline_conflict", (cloned) => {
      const rule = cloned.profiles.strict.rules.find((candidate) => candidate.rule_logic?.kind === "id_prefix_type_coupling")!;
      rule.prefix_map = { ...cloned.authoring!.node_id_suggestions.prefix_by_type };
    });
    expectInvalid("bundle.contracts.unknown_endpoint_node_type", (cloned) => {
      cloned.contracts.relationships[0].allowed_endpoints[0].from = "UnknownNode";
    });
    expectInvalid("bundle.authoring.prefix_coverage", (cloned) => {
      delete cloned.authoring!.node_id_suggestions.prefix_by_type.Place;
    });
    expectInvalid("bundle.authoring.form_coverage", (cloned) => {
      delete cloned.authoring!.node_forms.by_type.Place;
    });
    expectInvalid("bundle.authoring.missing_relationship_semantics", (cloned) => {
      delete cloned.contracts.relationships[0].authoring;
    });
    expectInvalid("bundle.authoring.edge_field_support_coverage", (cloned) => {
      cloned.contracts.relationships[0].constraints = cloned.contracts.relationships[0].constraints.filter(
        (rule) => rule.rule_logic?.kind !== "edge_field_support"
      );
    });
    expectInvalid("bundle.guided_view.alias_cycle", (cloned) => {
      cloned.views.views[0].conventions.guided_addition!.profile_aliases!.strict = "permissive";
    });
    expectInvalid("bundle.guided_view.unknown_alias_target", (cloned) => {
      cloned.views.views[0].conventions.guided_addition!.profile_aliases!.permissive = "missing";
    });
    expectInvalid("bundle.guided_view.unknown_predicate", (cloned) => {
      const rule = relationshipEntry(cloned, "ui_contracts", "State", "TRANSITIONS_TO", "State").display_by_profile.simple[0];
      rule.when = { kind: "unknown_predicate", node_type: "ViewState" } as unknown as GuidedDisplayPredicate;
    });
    expectInvalid("bundle.guided_view.duplicate_triple", (cloned) => {
      const relationships = cloned.views.views[0].conventions.guided_addition!.relationships;
      relationships.push(structuredClone(relationships[0]));
    });
    expectInvalid("bundle.guided_view.profile_coverage", (cloned) => {
      delete cloned.views.views[0].conventions.guided_addition!.relationships[0].display_by_profile.strict;
    });
  });

  it("sorts bundle diagnostics deterministically", () => {
    const diagnostics = diagnosticsAfter((cloned) => {
      delete cloned.authoring!.node_forms.by_type.Place;
      delete cloned.authoring!.node_id_suggestions.prefix_by_type.Outcome;
    });
    expect(diagnostics).toEqual(
      [...diagnostics].sort((left, right) => {
        const code = left.code.localeCompare(right.code);
        return code !== 0 ? code : left.message.localeCompare(right.message);
      })
    );
  });
});
