import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  computeBundleFingerprint,
  createBundleFingerprintInput,
  createGuidanceCatalog,
  loadBundle,
  stringifyCanonicalJson
} from "../src/index.js";
import type { Bundle } from "../src/bundle/types.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

function cloneBundle(): Bundle {
  return structuredClone(bundle) as Bundle;
}

function reverseRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).reverse());
}

function expectFingerprintChange(mutate: (cloned: Bundle) => void): void {
  const cloned = cloneBundle();
  mutate(cloned);
  expect(computeBundleFingerprint(cloned)).not.toBe(computeBundleFingerprint(bundle));
}

describe("guided addition bundle fingerprint", () => {
  it("is byte-stable and excludes environment paths", () => {
    const first = computeBundleFingerprint(bundle);
    const second = computeBundleFingerprint(bundle);
    expect(first).toMatch(/^bnd_[a-f0-9]{64}$/);
    expect(second).toBe(first);

    const relocated = cloneBundle();
    relocated.rootDir = "/different/root";
    relocated.manifestPath = "/different/root/manifest.yaml";
    expect(computeBundleFingerprint(relocated)).toBe(first);

    const inputJson = stringifyCanonicalJson(createBundleFingerprintInput(bundle));
    expect(inputJson).not.toContain(bundle.rootDir);
    expect(inputJson).not.toContain(bundle.manifestPath);
  });

  it("includes every declared semantic artifact", () => {
    expectFingerprintChange((cloned) => {
      cloned.manifest.bundle_version = "0.1-mutated";
    });
    expectFingerprintChange((cloned) => {
      cloned.vocab.version = "0.1-mutated";
    });
    expectFingerprintChange((cloned) => {
      cloned.syntax.version = "0.1-mutated";
    });
    expectFingerprintChange((cloned) => {
      cloned.schema.fingerprint_proof = true;
    });
    expectFingerprintChange((cloned) => {
      cloned.projectionSchema.fingerprint_proof = true;
    });
    expectFingerprintChange((cloned) => {
      cloned.contracts.version = "0.1-mutated";
    });
    expectFingerprintChange((cloned) => {
      cloned.views.version = "0.1-mutated";
    });
    expectFingerprintChange((cloned) => {
      cloned.profiles.simple.version = "0.1-mutated";
    });
    expectFingerprintChange((cloned) => {
      cloned.authoring!.version = "0.1-mutated";
    });
  });

  it("sorts object keys recursively while preserving array order", () => {
    const reordered = cloneBundle();
    reordered.schema = reverseRecord(reordered.schema);
    reordered.projectionSchema = reverseRecord(reordered.projectionSchema);
    reordered.authoring!.node_id_suggestions.prefix_by_type = reverseRecord(
      reordered.authoring!.node_id_suggestions.prefix_by_type
    );
    expect(computeBundleFingerprint(reordered)).toBe(computeBundleFingerprint(bundle));

    const arrayReordered = cloneBundle();
    [arrayReordered.vocab.node_types[0], arrayReordered.vocab.node_types[1]] = [
      arrayReordered.vocab.node_types[1],
      arrayReordered.vocab.node_types[0]
    ];
    expect(computeBundleFingerprint(arrayReordered)).not.toBe(computeBundleFingerprint(bundle));
  });

  it("represents profiles in manifest order", () => {
    const input = createBundleFingerprintInput(bundle);
    expect(input.profiles).toEqual([
      expect.objectContaining({ id: "simple" }),
      expect.objectContaining({ id: "permissive" }),
      expect.objectContaining({ id: "strict" })
    ]);
  });
});

describe("guided addition catalog", () => {
  it("constructs deterministic immutable indexes in bundle order", () => {
    const first = createGuidanceCatalog(bundle);
    const second = createGuidanceCatalog(bundle);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.bundle_fingerprint).toBe(computeBundleFingerprint(bundle));
    expect(first.node_types).toHaveLength(16);
    expect(first.relationships).toHaveLength(42);
    expect(first.views).toHaveLength(6);
    expect(first.profiles.map((profile) => profile.profile_id)).toEqual(["simple", "permissive", "strict"]);
    expect(first.getNodeType("Place")?.id_suggestion.prefix).toBe("P");
    expect(first.getRelationship({ from: "Area", type: "CONTAINS", to: "Place" })).toMatchObject({
      relationship_order: 0,
      endpoint_order: 1,
      authoring: { graph_role: "structural" }
    });
    expect(first.getView("journey_map")?.view_order).toBe(1);
    expect(first.getProfile("strict")?.profile_order).toBe(2);

    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.node_types)).toBe(true);
    expect(Object.isFrozen(first.node_types[0].form.common_fields)).toBe(true);
    expect(Object.isFrozen(first.views[0].relationships[0].display_by_profile.simple)).toBe(true);
    expect(() => {
      (first.placement_policy as { fallback: string }).fallback = "mutated";
    }).toThrow();
  });

  it("resolves view/profile aliases and conditional display from catalog records", () => {
    const catalog = createGuidanceCatalog(bundle);
    const triple = { from: "State", type: "TRANSITIONS_TO", to: "State" };
    expect(catalog.resolveDisplay("ui_contracts", triple, "simple").rule.presence).toBe("connector");
    expect(
      catalog.resolveDisplay("ui_contracts", triple, "simple", { document_node_types: ["ViewState"] }).rule.presence
    ).toBe("hidden");
    expect(catalog.resolveDisplay("ui_contracts", triple, "permissive")).toMatchObject({
      profile_id: "permissive",
      resolved_profile_id: "strict",
      rule: { presence: "connector", label: "visible" }
    });
  });

  it("changes endpoint catalog records when endpoint bundle data changes", () => {
    const cloned = cloneBundle();
    const endpoint = cloned.contracts.relationships[0].allowed_endpoints[0];
    endpoint.to = "Place";
    for (const view of cloned.views.views) {
      const entry = view.conventions.guided_addition!.relationships.find(
        (candidate) => candidate.from === "Stage" && candidate.type === "CONTAINS" && candidate.to === "Step"
      )!;
      entry.to = "Place";
    }

    const catalog = createGuidanceCatalog(cloned);
    expect(catalog.getRelationship({ from: "Stage", type: "CONTAINS", to: "Step" })).toBeUndefined();
    expect(catalog.getRelationship({ from: "Stage", type: "CONTAINS", to: "Place" })).toBeDefined();
  });

  it("changes role and display catalog records when only view guidance changes", () => {
    const cloned = cloneBundle();
    const entry = cloned.views.views[0].conventions.guided_addition!.relationships.find(
      (candidate) => candidate.from === "Outcome" && candidate.type === "MEASURED_BY" && candidate.to === "Metric"
    )!;
    entry.role = "bridge";
    entry.display_by_profile.simple[0] = { presence: "hidden", label: "not_applicable" };

    const catalog = createGuidanceCatalog(cloned);
    expect(catalog.getViewRelationship("outcome_opportunity_map", entry)).toMatchObject({ role: "bridge" });
    expect(catalog.resolveDisplay("outcome_opportunity_map", entry, "simple").rule).toMatchObject({
      presence: "hidden",
      label: "not_applicable"
    });
  });

  it("changes field support and requiredness when contract rule metadata changes", () => {
    const cloned = cloneBundle();
    const relationship = cloned.contracts.relationships.find((candidate) => candidate.type === "BINDS_TO")!;
    const support = relationship.constraints.find((rule) => rule.rule_logic?.kind === "edge_field_support")!.rule_logic!;
    support.properties = ["field", "format"];
    cloned.authoring!.guided_addition.edge_field_labels.format = "Format";
    const required = relationship.constraints.find((rule) => rule.rule_logic?.kind === "required_edge_property")!.rule_logic!;
    required.property = "format";

    const catalog = createGuidanceCatalog(cloned);
    expect(catalog.getRelationship({ from: "Component", type: "BINDS_TO", to: "DataEntity" })).toMatchObject({
      edge_fields: { annotations: [], properties: ["field", "format"] },
      required_edge_properties: ["format"]
    });
  });

  it("changes node and placement records when authoring data changes", () => {
    const cloned = cloneBundle();
    cloned.authoring!.node_id_suggestions.prefix_by_type.Place = "PX";
    cloned.authoring!.node_id_suggestions.minimum_digits = 4;
    cloned.authoring!.placement_policies.default.fallback = "first" as "last";

    const catalog = createGuidanceCatalog(cloned);
    expect(catalog.getNodeType("Place")?.id_suggestion).toMatchObject({ prefix: "PX", minimum_digits: 4 });
    expect(catalog.placement_policy.fallback).toBe("first");
  });
});
