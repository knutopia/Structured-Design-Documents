import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import type { Bundle, ViewSpec } from "../src/bundle/types.js";
import type { CompiledGraph } from "../src/compiler/types.js";
import { projectView } from "../src/projector/projectView.js";
import type { Projection } from "../src/projector/types.js";
import type {
  MeasuredContainer,
  MeasuredItem,
  MeasuredNode,
  MeasuredScene,
  PositionedContainer,
  PositionedItem,
  PositionedNode,
  PositionedScene,
  RendererScene
} from "../src/renderer/staged/contracts.js";
import {
  buildJourneyMapRendererScene,
  positionJourneyMapMeasuredSceneBeforeRouting,
  renderJourneyMapPreRoutingArtifacts,
  type JourneyMapPreRoutingArtifactsResult
} from "../src/renderer/staged/journeyMap.js";
import { measureScene } from "../src/renderer/staged/pipeline.js";
import {
  renderPositionedSceneToPng,
  renderPositionedSceneToSvg
} from "../src/renderer/staged/svgBackend.js";
import { expectRendererStageSnapshot } from "./rendererStageSnapshotHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const fixtureRoot = path.join(repoRoot, "tests/fixtures/render");

interface JourneyFixtureStages {
  bundle: Bundle;
  view: ViewSpec;
  graph: CompiledGraph;
  projection: Projection;
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  preRoutingPositionedScene: PositionedScene;
}

function journeyView(bundle: Bundle): ViewSpec {
  const view = bundle.views.views.find((candidate) => candidate.id === "journey_map");
  if (!view) {
    throw new Error("Missing journey_map view in test bundle.");
  }
  return view;
}

async function buildFixtureStages(name: string, profileId = "strict"): Promise<JourneyFixtureStages> {
  const bundle = await loadBundle(manifestPath);
  const fixturePath = path.join(fixtureRoot, `journey_map_staged_${name}.sdd`);
  const compiled = compileSource({ path: fixturePath, text: await readFile(fixturePath, "utf8") }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  expect(compiled.graph).toBeDefined();
  const projected = projectView(compiled.graph!, bundle, "journey_map");
  expect(projected.diagnostics).toEqual([]);
  expect(projected.projection).toBeDefined();
  const view = journeyView(bundle);
  const rendererScene = buildJourneyMapRendererScene(
    projected.projection!,
    compiled.graph!,
    bundle,
    view,
    { detailId: profileId === "simple" ? "compact" : "detailed" }
  );
  const measuredScene = measureScene(rendererScene);
  const preRoutingPositionedScene = await positionJourneyMapMeasuredSceneBeforeRouting(measuredScene);
  return {
    bundle,
    view,
    graph: compiled.graph!,
    projection: projected.projection!,
    rendererScene,
    measuredScene,
    preRoutingPositionedScene
  };
}

async function buildFixtureArtifacts(name: string, profileId = "strict"): Promise<JourneyMapPreRoutingArtifactsResult> {
  const stages = await buildFixtureStages(name, profileId);
  return renderJourneyMapPreRoutingArtifacts(
    stages.projection,
    stages.graph,
    stages.bundle,
    stages.view,
    { detailId: profileId === "simple" ? "compact" : "detailed" }
  );
}

function flattenMeasuredItems(container: MeasuredContainer): MeasuredItem[] {
  return container.children.flatMap((item) =>
    item.kind === "container" ? [item, ...flattenMeasuredItems(item)] : [item]
  );
}

function flattenPositionedItems(container: PositionedContainer): PositionedItem[] {
  return container.children.flatMap((item) =>
    item.kind === "container" ? [item, ...flattenPositionedItems(item)] : [item]
  );
}

function findMeasuredNode(scene: MeasuredScene, id: string): MeasuredNode {
  const item = flattenMeasuredItems(scene.root).find((candidate) => candidate.id === id);
  expect(item?.kind).toBe("node");
  return item as MeasuredNode;
}

function findPositionedNode(scene: PositionedScene, id: string): PositionedNode {
  const item = flattenPositionedItems(scene.root).find((candidate) => candidate.id === id);
  expect(item?.kind).toBe("node");
  return item as PositionedNode;
}

function findPositionedContainer(scene: PositionedScene, id: string): PositionedContainer {
  const item = flattenPositionedItems(scene.root).find((candidate) => candidate.id === id);
  expect(item?.kind).toBe("container");
  return item as PositionedContainer;
}

function expectStrictlyIncreasingX(items: readonly PositionedItem[]): void {
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1]!;
    const current = items[index]!;
    expect(current.x).toBeGreaterThan(previous.x);
    expect(current.x).toBeGreaterThanOrEqual(previous.x + previous.width);
  }
}

function expectProgressionColumnPlacement(items: readonly PositionedItem[]): void {
  const byColumn = new Map<number, PositionedItem[]>();
  for (const item of items) {
    const metadata = item.viewMetadata?.journeyMap;
    expect(metadata?.kind).toBe("step");
    if (metadata?.kind !== "step") {
      continue;
    }
    const progressionColumn = metadata.progressionColumn ?? metadata.stepOrder;
    expect(progressionColumn).toBeDefined();
    const columnItems = byColumn.get(progressionColumn!) ?? [];
    columnItems.push(item);
    byColumn.set(progressionColumn!, columnItems);
  }
  const orderedColumns = [...byColumn].sort(([left], [right]) => left - right);
  for (let columnIndex = 1; columnIndex < orderedColumns.length; columnIndex += 1) {
    const previousItems = orderedColumns[columnIndex - 1]![1];
    const currentItems = orderedColumns[columnIndex]![1];
    expect(Math.min(...currentItems.map((item) => item.x))).toBeGreaterThanOrEqual(
      Math.max(...previousItems.map((item) => item.x + item.width))
    );
  }
  for (const [, columnItems] of orderedColumns) {
    expect(new Set(columnItems.map((item) => item.x)).size).toBe(1);
    const laneOrdered = [...columnItems].sort((left, right) => {
      const leftMetadata = left.viewMetadata?.journeyMap;
      const rightMetadata = right.viewMetadata?.journeyMap;
      return (leftMetadata?.kind === "step" ? leftMetadata.laneOrder ?? 0 : 0)
        - (rightMetadata?.kind === "step" ? rightMetadata.laneOrder ?? 0 : 0);
    });
    for (let laneIndex = 1; laneIndex < laneOrdered.length; laneIndex += 1) {
      expect(laneOrdered[laneIndex]!.y).toBeGreaterThanOrEqual(
        laneOrdered[laneIndex - 1]!.y + laneOrdered[laneIndex - 1]!.height
      );
    }
  }
}

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("journey map measurement and pre-routing placement", () => {
  it("uses vendored shared-node measurement, fixed width, height growth, and grouped references", async () => {
    const { measuredScene } = await buildFixtureStages("primary");
    const longStep = findMeasuredNode(measuredScene, "J-102");
    expect(longStep.widthPolicy).toEqual({
      preferred: "standard",
      allowed: ["standard"]
    });
    expect(longStep.widthBand).toBe("standard");
    expect(longStep.width).toBe(224);
    expect(longStep.overflow).toEqual({ status: "fits" });
    expect(longStep.content[0]?.lines).toEqual([
      "Compare plans, eligibility",
      "details, and expected total",
      "cost before choosing"
    ]);
    expect(longStep.sharedNode?.body.title.lines).toEqual(longStep.content[0]?.lines);

    const badgedStep = findMeasuredNode(measuredScene, "J-201");
    expect(badgedStep.widthBand).toBe("standard");
    expect(badgedStep.content.map(({ id, region }) => ({ id, region }))).toEqual([
      { id: "J-201__title", region: "primary" },
      { id: "J-201__attribute_0_label", region: "primary" },
      { id: "J-201__attribute_0_value_0", region: "primary" },
      { id: "J-201__attribute_0_value_1", region: "primary" }
    ]);
    expect(badgedStep.sharedNode?.body.attributeGroups.map((group) => ({
      id: group.id,
      label: group.label.lines,
      values: group.values.map((value) => value.lines)
    }))).toEqual([{
      id: "opportunity_ref",
      label: ["Opportunity Ref"],
      values: [["Clear total cost"], ["Confidence before commitment"]]
    }]);
    for (const block of badgedStep.content) {
      expect(block.x).toBeGreaterThanOrEqual(0);
      expect(block.y).toBeGreaterThanOrEqual(0);
      expect(block.x + block.width).toBeLessThanOrEqual(badgedStep.width);
      expect(block.y + block.height).toBeLessThanOrEqual(badgedStep.height);
      expect(block.wasClamped).toBeUndefined();
    }
    for (let left = 0; left < badgedStep.content.length; left += 1) {
      for (let right = left + 1; right < badgedStep.content.length; right += 1) {
        expect(rectanglesOverlap(badgedStep.content[left]!, badgedStep.content[right]!)).toBe(false);
      }
    }

    const measuredNodes = flattenMeasuredItems(measuredScene.root)
      .filter((item): item is MeasuredNode => item.kind === "node");
    expect(measuredNodes.every((node) =>
      node.overflow.status === "fits"
    )).toBe(true);
    expect(measuredScene.diagnostics.some((diagnostic) =>
      (diagnostic.phase === "measure" || diagnostic.phase === "layout")
      && diagnostic.severity !== "info"
    )).toBe(false);
  });

  it("keeps headers and every Step inside natural-height, common-top Stage chrome", async () => {
    const { preRoutingPositionedScene } = await buildFixtureStages("primary");
    const stages = preRoutingPositionedScene.root.children
      .filter((item): item is PositionedContainer => item.kind === "container");
    expect(new Set(stages.map((stage) => stage.y))).toEqual(new Set([32]));

    for (const stage of stages) {
      for (const block of stage.headerContent) {
        expect(block.x).toBeGreaterThanOrEqual(0);
        expect(block.y).toBeGreaterThanOrEqual(0);
        expect(block.x + block.width).toBeLessThanOrEqual(stage.width);
        expect(block.y + block.height).toBeLessThanOrEqual(stage.chrome.headerBandHeight ?? 0);
      }
      const contentTop = stage.y + stage.chrome.padding.top + (stage.chrome.headerBandHeight ?? 0);
      for (const child of stage.children) {
        expect(child.x).toBeGreaterThanOrEqual(stage.x + stage.chrome.padding.left);
        expect(child.y).toBeGreaterThanOrEqual(contentTop);
        expect(child.x + child.width).toBeLessThanOrEqual(stage.x + stage.width - stage.chrome.padding.right);
        expect(child.y + child.height).toBeLessThanOrEqual(stage.y + stage.height - stage.chrome.padding.bottom);
      }
    }

    const emptyStage = findPositionedContainer(preRoutingPositionedScene, "G-300");
    const singleStage = findPositionedContainer(preRoutingPositionedScene, "G-400");
    expect(emptyStage.children).toEqual([]);
    expect(emptyStage.width).toBeGreaterThan(0);
    expect(emptyStage.height).toBeGreaterThan(emptyStage.chrome.headerBandHeight ?? 0);
    expect(singleStage.children.map((item) => item.id)).toEqual(["J-401"]);
    expect(singleStage.height).toBeGreaterThan(emptyStage.height);
    expect(findPositionedContainer(preRoutingPositionedScene, "G-200").height).toBeGreaterThan(
      findPositionedContainer(preRoutingPositionedScene, "G-100").height
    );
  });

  it("preserves source order for every fixture and aligns root Steps with the Stage content row", async () => {
    const cases = [
      ["primary", "simple"],
      ["primary", "permissive"],
      ["primary", "strict"],
      ["ordering_ownership", "strict"],
      ["topology", "strict"],
      ["duplicate", "strict"],
      ["compressed", "strict"]
    ] as const;

    for (const [fixture, profileId] of cases) {
      const { rendererScene, measuredScene, preRoutingPositionedScene } = await buildFixtureStages(
        fixture,
        profileId
      );
      expect(measuredScene.edges.map((edge) => edge.id)).toEqual(
        rendererScene.edges.map((edge) => edge.id)
      );
      expect(measuredScene.edges.map((edge) => edge.viewMetadata)).toEqual(
        rendererScene.edges.map((edge) => edge.viewMetadata)
      );
      for (let edgeIndex = 0; edgeIndex < measuredScene.edges.length; edgeIndex += 1) {
        expect(measuredScene.edges[edgeIndex]?.viewMetadata).not.toBe(
          rendererScene.edges[edgeIndex]?.viewMetadata
        );
      }

      for (const node of flattenMeasuredItems(measuredScene.root)
        .filter((item): item is MeasuredNode => item.kind === "node")) {
        for (const block of node.content) {
          expect(block.x).toBeGreaterThanOrEqual(0);
          expect(block.y).toBeGreaterThanOrEqual(0);
          expect(block.x + block.width).toBeLessThanOrEqual(node.width);
          expect(block.y + block.height).toBeLessThanOrEqual(node.height);
        }
        for (let left = 0; left < node.content.length; left += 1) {
          for (let right = left + 1; right < node.content.length; right += 1) {
            expect(rectanglesOverlap(node.content[left]!, node.content[right]!)).toBe(false);
          }
        }
      }

      expect(preRoutingPositionedScene.root.children.map((item) => item.id)).toEqual(
        rendererScene.root.children.map((item) => item.id)
      );
      expectStrictlyIncreasingX(preRoutingPositionedScene.root.children);

      const stageContentTops: number[] = [];
      for (const positionedItem of preRoutingPositionedScene.root.children) {
        if (positionedItem.kind !== "container") {
          continue;
        }
        const sceneStage = rendererScene.root.children.find((item) => item.id === positionedItem.id);
        expect(sceneStage?.kind).toBe("container");
        expect(positionedItem.children.map((item) => item.id)).toEqual(
          sceneStage?.kind === "container" ? sceneStage.children.map((item) => item.id) : []
        );
        expectProgressionColumnPlacement(positionedItem.children);
        stageContentTops.push(
          positionedItem.y
          + positionedItem.chrome.padding.top
          + (positionedItem.chrome.headerBandHeight ?? 0)
        );
      }

      if (stageContentTops.length > 0) {
        const alignedContentTop = Math.max(...stageContentTops);
        for (const item of preRoutingPositionedScene.root.children) {
          if (item.kind === "node") {
            expect(item.y).toBe(alignedContentTop);
          }
        }
      }
      expect(preRoutingPositionedScene.root.height).toBeLessThanOrEqual(1050);
    }
  });

  it("exposes deterministic adjacent, Stage-local, inter-item, and root-outer whitespace", async () => {
    const first = await buildFixtureStages("primary");
    const second = await buildFixtureStages("primary");
    const scene = first.preRoutingPositionedScene;
    const stage = findPositionedContainer(scene, "G-200");

    const split = stage.children.find((item) => item.id === "J-201")!;
    const firstOption = stage.children.find((item) => item.id === "J-202")!;
    const secondOption = stage.children.find((item) => item.id === "J-203")!;
    const join = stage.children.find((item) => item.id === "J-204")!;
    expect(firstOption.x - (split.x + split.width)).toBe(24);
    expect(secondOption.x).toBe(firstOption.x);
    const mainLaneHeight = Math.max(
      split.height,
      firstOption.height,
      join.height
    );
    expect(secondOption.y - firstOption.y).toBe(mainLaneHeight + 24);
    expect(join.x - Math.max(
      firstOption.x + firstOption.width,
      secondOption.x + secondOption.width
    )).toBe(24);
    const stageContentBottom = Math.max(...stage.children.map((item) => item.y + item.height));
    expect(stage.y + stage.height - stageContentBottom).toBe(20);

    for (let index = 1; index < scene.root.children.length; index += 1) {
      const previous = scene.root.children[index - 1]!;
      const current = scene.root.children[index]!;
      expect(current.x - (previous.x + previous.width)).toBe(40);
    }
    const rootContentBottom = Math.max(...scene.root.children.map((item) => item.y + item.height));
    expect(scene.root.y + scene.root.height - rootContentBottom).toBe(32);
    expect(second.preRoutingPositionedScene.root).toEqual(scene.root);
  });

  it("keeps placement independent from PRECEDES edge presence and array order", async () => {
    const { rendererScene } = await buildFixtureStages("ordering_ownership");
    const reversed = structuredClone(rendererScene) as RendererScene;
    reversed.edges.reverse();
    const removed = structuredClone(rendererScene) as RendererScene;
    removed.edges = [];

    const baselineMeasured = measureScene(rendererScene);
    const reversedMeasured = measureScene(reversed);
    const removedMeasured = measureScene(removed);
    expect(reversedMeasured.root).toEqual(baselineMeasured.root);
    expect(removedMeasured.root).toEqual(baselineMeasured.root);

    const [baseline, reversedPositioned, removedPositioned] = await Promise.all([
      positionJourneyMapMeasuredSceneBeforeRouting(baselineMeasured),
      positionJourneyMapMeasuredSceneBeforeRouting(reversedMeasured),
      positionJourneyMapMeasuredSceneBeforeRouting(removedMeasured)
    ]);
    expect(reversedPositioned.root).toEqual(baseline.root);
    expect(removedPositioned.root).toEqual(baseline.root);
  });

  it("retains every unrouted occurrence in measurement and emits a connector-free positioned proof", async () => {
    const artifacts = await buildFixtureArtifacts("duplicate");
    expect(artifacts.measuredScene.edges.map((edge) => edge.id)).toEqual(
      artifacts.rendererScene.edges.map((edge) => edge.id)
    );
    expect(artifacts.measuredScene.edges).toHaveLength(3);
    expect(artifacts.measuredScene.edges.map((edge) => edge.viewMetadata)).toEqual(
      artifacts.rendererScene.edges.map((edge) => edge.viewMetadata)
    );
    expect(artifacts.measuredScene.edges[0]?.viewMetadata).not.toBe(
      artifacts.rendererScene.edges[0]?.viewMetadata
    );
    expect(JSON.stringify(artifacts.measuredScene)).not.toContain('"route":');
    expect(artifacts.preRoutingPositionedScene.edges).toEqual([]);
    expect(artifacts.preRoutingPositionedScene.decorations).toEqual([]);
    expect(artifacts.preRoutingSvg).not.toContain('<g id="scene-edge-');
    expect(artifacts.preRoutingSvg).not.toContain("data-edge-id=");
    expect(artifacts.preRoutingSvg).not.toContain("journey_flow_in");
  });

  it("renders deterministic no-edge SVG and a PNG derived from the exact same SVG", async () => {
    const first = await buildFixtureArtifacts("primary");
    const second = await buildFixtureArtifacts("primary");
    const directSvg = await renderPositionedSceneToSvg(first.preRoutingPositionedScene);
    const derivedPng = await renderPositionedSceneToPng(first.preRoutingPositionedScene);

    expect(first.preRoutingSvg).toBe(directSvg.svg);
    expect(derivedPng.svg).toBe(first.preRoutingSvg);
    expect(first.diagnostics).toEqual(derivedPng.diagnostics);
    expect(first.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warn" || diagnostic.severity === "error"
    )).toBe(false);
    expect([...first.preRoutingPng.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(first.preRoutingPng.byteLength).toBeGreaterThan(0);
    expect(first.preRoutingSvg).toContain("scene-container__header-band");
    expect(first.preRoutingSvg).toContain("scene-badge__chrome");
    expect(first.preRoutingSvg).not.toContain('<g id="scene-edge-');
    expect(JSON.stringify(first.measuredScene)).toBe(JSON.stringify(second.measuredScene));
    expect(JSON.stringify(first.preRoutingPositionedScene)).toBe(JSON.stringify(second.preRoutingPositionedScene));
    expect(sha256(first.preRoutingSvg)).toBe(sha256(second.preRoutingSvg));
    expect(sha256(first.preRoutingPng)).toBe(sha256(second.preRoutingPng));
  });

  it("applies the accepted horizontal-scroll contract while retaining vertical fit and clean diagnostics", async () => {
    const cases = [
      ["primary", "simple"],
      ["primary", "permissive"],
      ["primary", "strict"],
      ["ordering_ownership", "strict"],
      ["topology", "strict"],
      ["duplicate", "strict"],
      ["compressed", "strict"]
    ] as const;
    for (const [fixture, profileId] of cases) {
      const { measuredScene, preRoutingPositionedScene } = await buildFixtureStages(fixture, profileId);
      expect(preRoutingPositionedScene.root.height).toBeLessThanOrEqual(1050);
      expect(measuredScene.diagnostics.some((diagnostic) =>
        diagnostic.severity === "warn" || diagnostic.severity === "error"
      )).toBe(false);
      expect(preRoutingPositionedScene.diagnostics.some((diagnostic) =>
        diagnostic.severity === "warn" || diagnostic.severity === "error"
      )).toBe(false);
    }
    const primary = await buildFixtureStages("primary");
    expect(primary.preRoutingPositionedScene.root.width).toBeGreaterThan(1680);
  });

  it("matches the accepted Gate 4 measurement and pre-routing evidence", async () => {
    const cases = [
      ["primary", "strict", "measuredScene", "journey-map.primary.measured-scene.json"],
      ["primary", "strict", "preRoutingPositionedScene", "journey-map.primary.pre-routing.positioned-scene.json"],
      ["primary", "simple", "measuredScene", "journey-map.badges.compact.measured-scene.json"],
      ["primary", "permissive", "measuredScene", "journey-map.badges.detailed.measured-scene.json"],
      ["ordering_ownership", "strict", "preRoutingPositionedScene", "journey-map.ordering-ownership.pre-routing.positioned-scene.json"],
      ["topology", "strict", "preRoutingPositionedScene", "journey-map.topology.pre-routing.positioned-scene.json"],
      ["duplicate", "strict", "preRoutingPositionedScene", "journey-map.duplicate.pre-routing.positioned-scene.json"]
    ] as const;

    for (const [fixture, profileId, stage, snapshotFileName] of cases) {
      const artifacts = await buildFixtureStages(fixture, profileId);
      await expectRendererStageSnapshot(snapshotFileName, artifacts[stage]);
    }
  });
});
