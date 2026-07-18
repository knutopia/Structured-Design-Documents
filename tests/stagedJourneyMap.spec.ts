import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import type { Bundle, ViewSpec } from "../src/bundle/types.js";
import type { CompiledGraph } from "../src/compiler/types.js";
import { projectView } from "../src/projector/projectView.js";
import type { Projection } from "../src/projector/types.js";
import {
  buildJourneyMapRenderModel,
  type JourneyMapRenderModel
} from "../src/renderer/journeyMapRenderModel.js";
import { resolveProfileDisplayPolicy } from "../src/renderer/profileDisplay.js";
import type {
  JourneyMapItemMetadata,
  RendererScene,
  SceneContainer,
  SceneItem,
  SceneNode
} from "../src/renderer/staged/contracts.js";
import { cloneViewMetadata } from "../src/renderer/staged/contracts.js";
import {
  buildJourneyMapRendererScene,
  buildJourneyMapRendererSceneFromModel
} from "../src/renderer/staged/journeyMap.js";
import { expectRendererStageSnapshot } from "./rendererStageSnapshotHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const fixtureRoot = path.join(repoRoot, "tests/fixtures/render");

interface JourneyFixtureBuild {
  bundle: Bundle;
  view: ViewSpec;
  graph: CompiledGraph;
  projection: Projection;
  model: JourneyMapRenderModel;
  scene: RendererScene;
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
    resolveProfileDisplayPolicy(view, profileId)
  );
}

async function buildFixture(name: string, profileId = "strict"): Promise<JourneyFixtureBuild> {
  const bundle = await loadBundle(manifestPath);
  const fixturePath = path.join(fixtureRoot, `journey_map_staged_${name}.sdd`);
  const compiled = compileSource({ path: fixturePath, text: await readFile(fixturePath, "utf8") }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  expect(compiled.graph).toBeDefined();
  const projected = projectView(compiled.graph!, bundle, "journey_map");
  expect(projected.diagnostics).toEqual([]);
  expect(projected.projection).toBeDefined();
  const view = journeyView(bundle);
  const model = buildModel(projected.projection!, compiled.graph!, bundle, view, profileId);
  return {
    bundle,
    view,
    graph: compiled.graph!,
    projection: projected.projection!,
    model,
    scene: buildJourneyMapRendererScene(
      projected.projection!,
      compiled.graph!,
      bundle,
      view,
      profileId
    )
  };
}

function flattenItems(container: SceneContainer): SceneItem[] {
  return container.children.flatMap((item) =>
    item.kind === "container" ? [item, ...flattenItems(item)] : [item]
  );
}

function findContainer(scene: RendererScene, id: string): SceneContainer {
  const item = flattenItems(scene.root).find((candidate) => candidate.id === id);
  expect(item?.kind).toBe("container");
  return item as SceneContainer;
}

function findNode(scene: RendererScene, id: string): SceneNode {
  const item = flattenItems(scene.root).find((candidate) => candidate.id === id);
  expect(item?.kind).toBe("node");
  return item as SceneNode;
}

function journeyMetadata(item: SceneItem): JourneyMapItemMetadata {
  const metadata = item.viewMetadata?.journeyMap;
  expect(metadata).toBeDefined();
  return metadata!;
}

function diagnosticSummary(scene: RendererScene): Array<{
  code: string;
  severity: string;
  targetId?: string;
  details?: string;
}> {
  return scene.diagnostics.map(({ code, severity, targetId, details }) => ({
    code,
    severity,
    targetId,
    details
  }));
}

describe("staged journey map RendererScene", () => {
  it("preserves the exact source-ordered root and Stage hierarchy, including empty, single, and root Steps", async () => {
    const { scene } = await buildFixture("primary");

    expect(scene).toMatchObject({
      viewId: "journey_map",
      profileId: "strict",
      themeId: "default"
    });
    expect(scene.root).toMatchObject({
      id: "root",
      role: "diagram_root",
      primitive: "root",
      layout: {
        strategy: "stack",
        direction: "horizontal",
        crossAlignment: "start"
      }
    });
    expect(scene.root.children.map((item) => item.id)).toEqual([
      "G-100",
      "G-200",
      "J-250",
      "J-260",
      "G-300",
      "G-400"
    ]);
    expect(findContainer(scene, "G-100").children.map((item) => item.id)).toEqual([
      "J-101",
      "J-102",
      "J-103"
    ]);
    expect(findContainer(scene, "G-200").children.map((item) => item.id)).toEqual([
      "J-201",
      "J-202",
      "J-203",
      "J-204"
    ]);
    expect(findContainer(scene, "G-300").children).toEqual([]);
    expect(findContainer(scene, "G-400").children.map((item) => item.id)).toEqual(["J-401"]);
    expect(findContainer(scene, "G-300").headerContent?.map((block) => block.text)).toEqual([
      "Pause and reconsider"
    ]);
    expect(findNode(scene, "J-250").role).toBe("journey_step");
    expect(findNode(scene, "J-101").classes).toContain("journey_step_contained");
    expect(findNode(scene, "J-101").classes).not.toContain("journey_step_root");
    expect(findNode(scene, "J-250").classes).toContain("journey_step_root");
    expect(findNode(scene, "J-250").classes).not.toContain("journey_step_contained");
    expect(scene.root.children.some((item) => item.id.includes("synthetic"))).toBe(false);
  });

  it("records root, Stage, local Step, and flattened Step order without class parsing", async () => {
    const { scene } = await buildFixture("ordering_ownership");
    expect(scene.root.viewMetadata?.journeyMap).toEqual({
      kind: "root",
      rootItemIds: ["G-600", "J-590", "G-500", "J-591"],
      stageIds: ["G-600", "G-500"],
      globalStepIds: ["J-601", "J-602", "J-590", "J-503", "J-502", "J-501", "J-591"]
    });
    expect(journeyMetadata(findContainer(scene, "G-600"))).toEqual({
      kind: "stage",
      rootOrder: 0,
      stageOrder: 0
    });
    expect(journeyMetadata(findNode(scene, "J-503"))).toEqual({
      kind: "step",
      rootOrder: 2,
      stageId: "G-500",
      stageOrder: 1,
      stepOrder: 0,
      globalStepOrder: 3,
      uncontained: false,
      progressionColumn: 0,
      laneOrder: 0,
      placementRole: "linear"
    });
    expect(journeyMetadata(findNode(scene, "J-590"))).toEqual({
      kind: "step",
      rootOrder: 1,
      globalStepOrder: 2,
      uncontained: true
    });
    expect(flattenItems(scene.root).filter((item) => item.id === "J-503")).toHaveLength(1);
  });

  it("builds unboxed metadata only from typed references and preserves profile-controlled ordering", async () => {
    const simple = await buildFixture("primary", "simple");
    const permissive = await buildFixture("primary", "permissive");
    const strict = await buildFixture("primary", "strict");

    expect(findNode(simple.scene, "J-201").content).toEqual([
      {
        id: "J-201__title",
        kind: "text",
        text: "Review the recommendation",
        textStyleRole: "title",
        priority: "primary"
      }
    ]);
    for (const build of [permissive, strict]) {
      expect(findNode(build.scene, "J-201").content).toEqual([
        {
          id: "J-201__title",
          kind: "text",
          text: "Review the recommendation",
          textStyleRole: "title",
          priority: "primary"
        },
        {
          id: "J-201__badge__OP-100__0",
          kind: "metadata",
          text: "Clear total cost",
          textStyleRole: "metadata",
          region: "secondary",
          priority: "secondary"
        },
        {
          id: "J-201__badge__OP-200__0",
          kind: "metadata",
          text: "Confidence before commitment",
          textStyleRole: "metadata",
          region: "secondary",
          priority: "secondary"
        }
      ]);
    }
    expect(simple.scene.edges).toEqual(strict.scene.edges);
    expect(permissive.scene.edges).toEqual(strict.scene.edges);
    expect(simple.scene.root.children.map((item) => item.id)).toEqual(
      strict.scene.root.children.map((item) => item.id)
    );
    expect(JSON.stringify(strict.scene)).not.toContain("[Clear total cost]");
  });

  it("uses target IDs for nameless typed badges and gives duplicate target badges stable occurrence IDs", async () => {
    const build = await buildFixture("primary");
    const model = structuredClone(build.model) as JourneyMapRenderModel;
    const stage = model.rootItems.find((item) => item.kind === "stage" && item.id === "G-200");
    expect(stage?.kind).toBe("stage");
    const step = stage?.kind === "stage" ? stage.items.find((candidate) => candidate.id === "J-201") : undefined;
    expect(step).toBeDefined();
    delete step!.badges[0]!.targetName;
    step!.badges.push({ ...step!.badges[0]! });

    const scene = buildJourneyMapRendererSceneFromModel(model, "strict");
    expect(findNode(scene, "J-201").content.slice(1).map(({ id, text }) => ({ id, text }))).toEqual([
      { id: "J-201__badge__OP-100__0", text: "OP-100" },
      { id: "J-201__badge__OP-200__0", text: "Confidence before commitment" },
      { id: "J-201__badge__OP-100__1", text: "OP-100" }
    ]);
  });

  it("declares the four journey ports on every Step without north ports or coordinates", async () => {
    const { scene } = await buildFixture("primary");
    for (const node of flattenItems(scene.root).filter((item): item is SceneNode => item.kind === "node")) {
      expect(node.ports).toEqual([
        { id: `${node.id}__flow_in`, role: "journey_flow_in", side: "west" },
        { id: `${node.id}__flow_out`, role: "journey_flow_out", side: "east" },
        { id: `${node.id}__escape_in`, role: "journey_escape_in", side: "south" },
        { id: `${node.id}__escape_out`, role: "journey_escape_out", side: "south" }
      ]);
      expect(node.ports.some((port) => port.side === "north")).toBe(false);
    }
  });

  it("copies every render-model edge identity exactly once with semantic intent, ownership, and author order", async () => {
    for (const fixture of ["primary", "ordering_ownership", "topology", "duplicate", "compressed"]) {
      const { model, scene } = await buildFixture(fixture);
      expect(scene.edges.map((edge) => edge.id)).toEqual(model.edges.map((edge) => edge.id));
      expect(scene.edges).toHaveLength(model.edges.length);
      for (const [index, edge] of scene.edges.entries()) {
        const modelEdge = model.edges[index]!;
        expect(edge).toMatchObject({
          id: modelEdge.id,
          role: "precedes",
          from: { itemId: modelEdge.from },
          to: { itemId: modelEdge.to },
          routing: {
            style: "orthogonal",
            avoidNodeBoxes: true,
            preferAxis: "horizontal",
            sourcePortRole: "journey_flow_out",
            targetPortRole: "journey_flow_in"
          },
          markers: { end: "arrow" },
          viewMetadata: {
            journeyMap: {
              kind: "precedes",
              authorOrder: modelEdge.authorOrder,
              sameEndpointOrdinal: modelEdge.sameEndpointOrdinal,
              exactIdentityOrdinal: modelEdge.exactIdentityOrdinal
            }
          }
        });
        expect(edge.from.portId).toBeUndefined();
        expect(edge.to.portId).toBeUndefined();
        expect(edge.label).toBeUndefined();
      }
      expect(JSON.stringify(scene.edges)).not.toContain("semanticIdentityKey");
    }

    const duplicate = await buildFixture("duplicate");
    expect(duplicate.scene.edges).toHaveLength(3);
    expect(new Set(duplicate.scene.edges.map((edge) => edge.id)).size).toBe(3);
  });

  it("assigns the locked lowest common semantic owner to every proof-corpus edge", async () => {
    const expectedOwners: Record<string, Record<string, string>> = {
      primary: {
        "J-101->J-102": "G-100",
        "J-102->J-103": "G-100",
        "J-103->J-201": "root",
        "J-201->J-202": "G-200",
        "J-201->J-203": "G-200",
        "J-202->J-204": "G-200",
        "J-203->J-204": "G-200",
        "J-204->J-401": "root",
        "J-250->J-260": "root"
      },
      ordering_ownership: {
        "J-503->J-501": "G-500",
        "J-501->J-502": "G-500",
        "J-591->J-590": "root"
      },
      topology: {
        "J-790->J-701": "root",
        "J-790->J-791": "root",
        "J-701->J-702": "G-700",
        "J-702->J-701": "G-700",
        "J-711->J-712": "G-700",
        "J-712->J-711": "G-700",
        "J-713->J-713": "G-700",
        "J-714->J-713": "G-700",
        "J-714->J-791": "root"
      },
      duplicate: {
        "J-801->J-802": "root"
      },
      compressed: {
        "J-901->J-902": "G-900",
        "J-901->J-903": "G-900",
        "J-901->J-950": "root",
        "J-901->J-911": "root",
        "J-901->J-912": "root",
        "J-901->J-913": "root",
        "J-902->J-903": "G-900",
        "J-902->J-950": "root",
        "J-902->J-913": "root",
        "J-903->J-950": "root",
        "J-903->J-913": "root",
        "J-950->J-911": "root",
        "J-950->J-912": "root",
        "J-950->J-913": "root",
        "J-911->J-913": "G-910",
        "J-912->J-913": "G-910",
        "J-912->J-902": "root",
        "J-913->J-901": "root"
      }
    };

    for (const [fixture, ownerByEndpoints] of Object.entries(expectedOwners)) {
      const { scene } = await buildFixture(fixture);
      for (const edge of scene.edges) {
        const endpoints = `${edge.from.itemId}->${edge.to.itemId}`;
        expect(ownerByEndpoints[endpoints], `${fixture} ${endpoints}`).toBeDefined();
        expect(edge.ownerContainerId, `${fixture} ${endpoints}`).toBe(ownerByEndpoints[endpoints]);
      }
      expect(new Set(scene.edges.map((edge) => `${edge.from.itemId}->${edge.to.itemId}`))).toEqual(
        new Set(Object.keys(ownerByEndpoints))
      );
    }
  });

  it("never infers adjacency, hierarchy, or sibling-chain edges", async () => {
    const { model, scene } = await buildFixture("ordering_ownership");
    expect(scene.edges.map((edge) => `${edge.from.itemId}->${edge.to.itemId}`)).toEqual(
      model.edges.map((edge) => `${edge.from}->${edge.to}`)
    );
    expect(scene.edges.some((edge) => edge.from.itemId === "G-500" || edge.to.itemId === "G-500")).toBe(false);
    expect(scene.edges.some((edge) => edge.from.itemId === "J-503" && edge.to.itemId === "J-502")).toBe(false);
  });

  it("emits only the locked generic scene diagnostics for the proof corpus", async () => {
    for (const profileId of ["simple", "permissive", "strict"]) {
      const { scene } = await buildFixture("primary", profileId);
      expect(diagnosticSummary(scene)).toEqual([
        {
          code: "renderer.scene.journey_map_disconnected_chain",
          severity: "info",
          targetId: "J-250",
          details: JSON.stringify({ relatedIds: ["J-250", "J-260"] })
        }
      ]);
    }

    const ordering = await buildFixture("ordering_ownership");
    expect(diagnosticSummary(ordering.scene)).toEqual([
      {
        code: "renderer.scene.journey_map_first_parent_selected",
        severity: "info",
        targetId: "J-503",
        details: JSON.stringify({
          relatedIds: ["J-503", "G-500", "G-600"],
          selectedStageId: "G-500"
        })
      }
    ]);

    const duplicate = await buildFixture("duplicate");
    expect(diagnosticSummary(duplicate.scene)).toEqual([
      {
        code: "renderer.scene.journey_map_step_only",
        severity: "info",
        targetId: "J-801",
        details: JSON.stringify({ relatedIds: ["J-801", "J-802"] })
      }
    ]);

    for (const fixture of ["topology", "compressed"]) {
      expect((await buildFixture(fixture)).scene.diagnostics).toEqual([]);
    }
  });

  it("treats repeated hierarchy occurrences from one Stage as one parent", async () => {
    const build = await buildFixture("primary");
    const projection = structuredClone(build.projection) as Projection;
    const hierarchyEdge = projection.edges.find((edge) =>
      edge.from === "G-100" && edge.to === "J-101"
    );
    expect(hierarchyEdge).toBeDefined();
    projection.edges.push({ ...hierarchyEdge! });

    const scene = buildJourneyMapRendererScene(
      projection,
      build.graph,
      build.bundle,
      build.view,
      "strict"
    );
    expect(scene.diagnostics.some((diagnostic) =>
      diagnostic.code === "renderer.scene.journey_map_first_parent_selected"
    )).toBe(false);
  });

  it("retains duplicate scene edge occurrences and diagnoses a constructed ID collision", async () => {
    const build = await buildFixture("duplicate");
    const model = structuredClone(build.model) as JourneyMapRenderModel;
    model.edges[1]!.id = model.edges[0]!.id;
    const scene = buildJourneyMapRendererSceneFromModel(model, "strict");

    expect(scene.edges).toHaveLength(3);
    expect(scene.edges.filter((edge) => edge.id === model.edges[0]!.id)).toHaveLength(2);
    expect(diagnosticSummary(scene)).toEqual([
      {
        code: "renderer.scene.journey_map_duplicate_edge_id",
        severity: "error",
        targetId: model.edges[0]!.id,
        details: JSON.stringify({ relatedIds: [model.edges[0]!.id] })
      }
    ]);
  });

  it("contains no measured, positioned, backend, legacy, or external-engine payload", async () => {
    const forbiddenKeys = new Set([
      "x",
      "y",
      "width",
      "height",
      "widthBand",
      "lines",
      "lineHeight",
      "overflow",
      "route",
      "points",
      "paintGroup",
      "decorations",
      "fixedSize",
      "svg",
      "png",
      "dot",
      "mermaid"
    ]);
    const { scene } = await buildFixture("primary");
    const visit = (value: unknown, pathParts: string[]): string[] => {
      if (Array.isArray(value)) {
        return value.flatMap((entry, index) => visit(entry, [...pathParts, String(index)]));
      }
      if (value === null || typeof value !== "object") {
        return [];
      }
      return Object.entries(value).flatMap(([key, child]) => [
        ...(forbiddenKeys.has(key) ? [[...pathParts, key].join(".")] : []),
        ...visit(child, [...pathParts, key])
      ]);
    };

    expect(visit(scene, [])).toEqual([]);
    expect(JSON.stringify(scene)).not.toMatch(/elk_layered|require_elk|ELK JSON/);
  });

  it("is deterministic, isolated across builds, and uses unique item and content IDs", async () => {
    const first = await buildFixture("primary");
    const second = await buildFixture("primary");
    expect(JSON.stringify(first.scene)).toBe(JSON.stringify(second.scene));

    first.scene.root.classes.push("mutated");
    const firstRootMetadata = first.scene.root.viewMetadata?.journeyMap;
    expect(firstRootMetadata?.kind).toBe("root");
    if (firstRootMetadata?.kind === "root") {
      firstRootMetadata.rootItemIds.push("mutated");
    }
    first.scene.edges[0]!.viewMetadata!.journeyMap!.authorOrder = 999;
    expect(second.scene.root.classes).not.toContain("mutated");
    expect(second.scene.root.viewMetadata?.journeyMap).toMatchObject({
      kind: "root",
      rootItemIds: ["G-100", "G-200", "J-250", "J-260", "G-300", "G-400"]
    });
    expect(second.scene.edges[0]!.viewMetadata?.journeyMap?.authorOrder).not.toBe(999);

    const items = [second.scene.root, ...flattenItems(second.scene.root)];
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    const contentIds = items.flatMap((item) => item.kind === "container"
      ? (item.headerContent ?? []).map((block) => block.id)
      : item.content.map((block) => block.id));
    expect(new Set(contentIds).size).toBe(contentIds.length);
  });

  it("matches the accepted Gate 3 RendererScene evidence", async () => {
    const cases = [
      ["primary", "strict", "journey-map.primary.renderer-scene.json"],
      ["primary", "simple", "journey-map.badges.simple.renderer-scene.json"],
      ["primary", "permissive", "journey-map.badges.permissive.renderer-scene.json"],
      ["ordering_ownership", "strict", "journey-map.ordering-ownership.renderer-scene.json"],
      ["topology", "strict", "journey-map.topology.renderer-scene.json"],
      ["duplicate", "strict", "journey-map.duplicate.renderer-scene.json"]
    ] as const;

    for (const [fixture, profileId, snapshotFileName] of cases) {
      const { scene } = await buildFixture(fixture, profileId);
      await expectRendererStageSnapshot(snapshotFileName, scene);
    }
  });

  it("deep-clones journey root metadata without aliasing its ordered arrays", async () => {
    const { scene } = await buildFixture("primary");
    const clonedRootMetadata = cloneViewMetadata(scene.root.viewMetadata);
    expect(clonedRootMetadata).toEqual(scene.root.viewMetadata);
    expect(clonedRootMetadata).not.toBe(scene.root.viewMetadata);
    const original = scene.root.viewMetadata?.journeyMap;
    const cloned = clonedRootMetadata?.journeyMap;
    expect(original?.kind).toBe("root");
    expect(cloned?.kind).toBe("root");
    if (original?.kind === "root" && cloned?.kind === "root") {
      expect(cloned.rootItemIds).not.toBe(original.rootItemIds);
      expect(cloned.stageIds).not.toBe(original.stageIds);
      expect(cloned.globalStepIds).not.toBe(original.globalStepIds);
    }
  });
});
