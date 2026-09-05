import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle, validateGraph } from "../src/index.js";
import type { Bundle, ViewSpec } from "../src/bundle/types.js";
import type { CompiledGraph } from "../src/compiler/types.js";
import { projectView } from "../src/projector/projectView.js";
import type { Projection } from "../src/projector/types.js";
import {
  buildJourneyMapRenderModel,
  journeyReferenceRoleToAttributeLabel,
  type JourneyMapRenderModel,
  type JourneyRenderItem,
  type JourneyRenderStep
} from "../src/renderer/journeyMapRenderModel.js";
import { resolveDetailDisplayPolicy } from "../src/renderer/detailDisplay.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const fixtureRoot = path.join(repoRoot, "tests/fixtures/render");

interface JourneyFixtureBuild {
  bundle: Bundle;
  view: ViewSpec;
  graph: CompiledGraph;
  projection: Projection;
  model: JourneyMapRenderModel;
}

function journeyView(bundle: Bundle): ViewSpec {
  const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
  if (!view) {
    throw new Error("Missing journey_map view in test bundle.");
  }
  return view;
}

function buildModel(
  projection: Projection,
  graph: CompiledGraph,
  bundle: Bundle,
  view: ViewSpec,
  profileId: string
): JourneyMapRenderModel {
  return buildJourneyMapRenderModel(
    projection,
    graph,
    bundle,
    view.projection.hierarchy_edges,
    view.projection.ordering_edges,
    resolveDetailDisplayPolicy(view, profileId === "simple" ? "compact" : "detailed")
  );
}

async function buildFixture(name: string, profileId = "strict", bundleOverride?: Bundle): Promise<JourneyFixtureBuild> {
  const bundle = bundleOverride ?? await loadBundle(manifestPath);
  const fixturePath = path.join(fixtureRoot, `journey_map_staged_${name}.sdd`);
  const compiled = compileSource({ path: fixturePath, text: await readFile(fixturePath, "utf8") }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  expect(compiled.graph).toBeDefined();

  const projected = projectView(compiled.graph!, bundle, "journey_map");
  expect(projected.diagnostics).toEqual([]);
  expect(projected.projection).toBeDefined();
  const view = journeyView(bundle);
  return {
    bundle,
    view,
    graph: compiled.graph!,
    projection: projected.projection!,
    model: buildModel(projected.projection!, compiled.graph!, bundle, view, profileId)
  };
}

function rootIds(items: JourneyRenderItem[]): string[] {
  return items.map((item) => item.id);
}

function stageChildIds(model: JourneyMapRenderModel, stageId: string): string[] {
  const stage = model.rootItems.find((item) => item.kind === "stage" && item.id === stageId);
  expect(stage?.kind).toBe("stage");
  return stage?.kind === "stage" ? stage.items.map((item) => item.id) : [];
}

function findStep(model: JourneyMapRenderModel, stepId: string): JourneyRenderStep {
  for (const item of model.rootItems) {
    if (item.kind === "step" && item.id === stepId) {
      return item;
    }
    if (item.kind === "stage") {
      const step = item.items.find((candidate) => candidate.id === stepId);
      if (step) {
        return step;
      }
    }
  }
  throw new Error(`Missing journey Step ${stepId}.`);
}

describe("journey map render model", () => {
  it("derives raw shared-attribute labels generically from stable reference roles", () => {
    expect(journeyReferenceRoleToAttributeLabel("opportunity_ref")).toBe("opportunity ref");
    expect(journeyReferenceRoleToAttributeLabel("policy_constraint_ref")).toBe("policy constraint ref");
    expect(journeyReferenceRoleToAttributeLabel("api_v2_ref")).toBe("api v2 ref");
  });

  it("preserves first projected parent, structural edge-line order, and interleaved root author order", async () => {
    const { model } = await buildFixture("ordering_ownership");

    expect(rootIds(model.rootItems)).toEqual(["G-600", "J-590", "G-500", "J-591"]);
    expect(stageChildIds(model, "G-600")).toEqual(["J-601", "J-602"]);
    expect(stageChildIds(model, "G-500")).toEqual(["J-503", "J-502", "J-501"]);
    expect(model.siblingOrderChains).toEqual([
      ["G-600__anchor", "J-590", "G-500__anchor", "J-591"],
      ["G-600__anchor", "J-601", "J-602"],
      ["G-500__anchor", "J-503", "J-502", "J-501"]
    ]);
  });

  it("retains empty and single-Step Stages plus uncontained root Steps", async () => {
    const { model } = await buildFixture("primary");

    expect(rootIds(model.rootItems)).toEqual(["G-100", "G-200", "J-250", "J-260", "G-300", "G-400"]);
    expect(stageChildIds(model, "G-300")).toEqual([]);
    expect(stageChildIds(model, "G-400")).toEqual(["J-401"]);
  });

  it("keeps a Step-only journey valid and preserves every projected duplicate occurrence", async () => {
    const { model, projection } = await buildFixture("duplicate");

    expect(rootIds(model.rootItems)).toEqual(["J-801", "J-802"]);
    expect(model.rootItems.every((item) => item.kind === "step")).toBe(true);
    expect(model.edges).toHaveLength(3);
    expect(model.edges).toHaveLength(projection.edges.filter((edge) => edge.type === "PRECEDES").length);
  });

  it("exposes ordered structured references without presentation-formatted label lines", async () => {
    const simple = await buildFixture("primary", "simple");
    const permissive = await buildFixture("primary", "permissive");
    const strict = await buildFixture("primary", "strict");

    expect(findStep(simple.model, "J-201")).toMatchObject({
      title: "Review the recommendation",
      references: []
    });
    const expectedReferences = [
      {
        kind: "reference",
        role: "opportunity_ref",
        targetId: "OP-100",
        targetType: "Opportunity",
        targetName: "Clear total cost",
        sourceProp: "opportunity_refs",
        groupId: "opportunity_ref",
        label: "opportunity ref",
        value: "Clear total cost"
      },
      {
        kind: "reference",
        role: "opportunity_ref",
        targetId: "OP-200",
        targetType: "Opportunity",
        targetName: "Confidence before commitment",
        sourceProp: "opportunity_refs",
        groupId: "opportunity_ref",
        label: "opportunity ref",
        value: "Confidence before commitment"
      }
    ];
    for (const build of [permissive, strict]) {
      expect(findStep(build.model, "J-201")).toMatchObject({
        title: "Review the recommendation",
        references: expectedReferences
      });
      expect(findStep(build.model, "J-201")).not.toHaveProperty("labelLines");
    }
    expect(permissive.model.edges).toEqual(strict.model.edges);
    expect(rootIds(simple.model.rootItems)).toEqual(rootIds(strict.model.rootItems));
  });

  it("uses the resolved target ID when a projection reference has no target name", async () => {
    const base = await buildFixture("primary", "strict");
    const projection = structuredClone(base.projection) as Projection;
    const reference = projection.derived.node_annotations
      .find((annotation) => annotation.node_id === "J-201")
      ?.references?.find((candidate) => candidate.target_id === "OP-100");
    expect(reference).toBeDefined();
    delete reference!.target_name;

    const model = buildModel(projection, base.graph, base.bundle, base.view, "strict");
    expect(findStep(model, "J-201").references[0]).toMatchObject({
      targetId: "OP-100",
      groupId: "opportunity_ref",
      label: "opportunity ref",
      value: "OP-100"
    });
  });

  it("derives stable duplicate identities and occurrence ordinals from authored semantics", async () => {
    const build = await buildFixture("duplicate");
    const repeated = buildModel(build.projection, build.graph, build.bundle, build.view, "strict");
    const edges = build.model.edges;

    expect(edges.map((edge) => edge.authorOrder)).toEqual([0, 1, 2]);
    expect(edges.map((edge) => edge.sameEndpointOrdinal)).toEqual([0, 1, 2]);
    expect(edges.map((edge) => edge.exactIdentityOrdinal)).toEqual([0, 0, 1]);
    expect(edges[0]?.semanticIdentityKey).toBe(edges[2]?.semanticIdentityKey);
    expect(edges[0]?.semanticIdentityKey).not.toBe(edges[1]?.semanticIdentityKey);
    expect(new Set(edges.map((edge) => edge.id)).size).toBe(3);
    expect(repeated.edges).toEqual(edges);
  });

  it("stores authored PRECEDES order independently from projection edge order", async () => {
    const { model } = await buildFixture("primary");
    const authored = [...model.edges]
      .sort((left, right) => left.authorOrder - right.authorOrder)
      .map((edge) => `${edge.from}->${edge.to}`);

    expect(authored).toEqual([
      "J-101->J-102",
      "J-102->J-103",
      "J-103->J-201",
      "J-201->J-202",
      "J-201->J-203",
      "J-202->J-204",
      "J-203->J-204",
      "J-204->J-401",
      "J-250->J-260"
    ]);
  });

  it("changes edge identity when the loaded bundle changes its identity fields", async () => {
    const base = await buildFixture("duplicate");
    const mutatedBundle = structuredClone(base.bundle) as Bundle;
    const identityRule = mutatedBundle.contracts.common_rules.find(
      (rule) => rule.rule_logic?.kind === "duplicate_edge_identity"
    );
    expect(identityRule).toBeDefined();
    identityRule!.rule_logic!.key_fields = [
      ...identityRule!.rule_logic!.key_fields as string[],
      "to_name"
    ];

    const mutated = buildModel(base.projection, base.graph, mutatedBundle, journeyView(mutatedBundle), "strict");
    expect(mutated.edges.map((edge) => edge.exactIdentityOrdinal)).toEqual([0, 0, 0]);
    expect(mutated.edges[0]?.semanticIdentityKey).not.toBe(mutated.edges[2]?.semanticIdentityKey);
    expect(mutated.edges.map((edge) => edge.id)).not.toEqual(base.model.edges.map((edge) => edge.id));
  });

  it("changes typed reference visibility when the loaded profile-display contract changes", async () => {
    const base = await buildFixture("primary", "simple");
    const mutatedBundle = structuredClone(base.bundle) as Bundle;
    const mutatedView = journeyView(mutatedBundle);
    const detailDisplay = mutatedView.conventions.renderer_defaults?.detail_display as Record<
      string,
      Record<string, unknown>
    >;
    detailDisplay.compact!.show_reference_badges = true;

    const mutated = buildModel(base.projection, base.graph, mutatedBundle, mutatedView, "simple");
    expect(findStep(base.model, "J-201").references).toEqual([]);
    expect(findStep(mutated, "J-201").references.map((reference) => reference.targetId)).toEqual(["OP-100", "OP-200"]);
  });

  it("keeps the locked validation diagnostics isolated by fixture and profile", async () => {
    const expectations: Array<[string, string, string[]]> = [
      ["primary", "simple", []],
      ["primary", "permissive", []],
      ["primary", "strict", []],
      ["ordering_ownership", "strict", ["validate.contains_single_parent_recommended"]],
      ["topology", "strict", ["validate.precedes_cycle_policy"]],
      ["duplicate", "strict", ["validate.duplicate_edge_detection"]],
      ["compressed", "strict", []]
    ];

    for (const [name, profileId, expectedCodes] of expectations) {
      const { graph, bundle } = await buildFixture(name, profileId);
      const validation = validateGraph(graph, bundle, profileId);
      expect(validation.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expectedCodes);
    }
  });
});
