import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type { PositionedDecoration, PositionedItem, RendererScene } from "../src/renderer/staged/contracts.js";
import {
  buildServiceBlueprintRendererScene,
  renderServiceBlueprintStagedSvg
} from "../src/renderer/staged/serviceBlueprint.js";
import {
  expectRendererStageSnapshot,
  expectRendererStageTextSnapshot
} from "./rendererStageSnapshotHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function resolveServiceBlueprintContext(
  input: { path: string; text: string },
  profileId: string
) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "service_blueprint");
  if (!view) {
    throw new Error("Could not resolve the service_blueprint view.");
  }

  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);
  if (!compiled.graph) {
    throw new Error(`Could not compile ${input.path}.`);
  }

  const projected = projectView(compiled.graph, bundle, "service_blueprint");
  expect(projected.diagnostics).toEqual([]);
  if (!projected.projection) {
    throw new Error(`Could not project ${input.path} to service_blueprint.`);
  }

  return {
    graph: compiled.graph,
    projection: projected.projection,
    view
  };
}

async function loadExampleInput(fileName: string): Promise<{ path: string; text: string }> {
  const filePath = path.join(repoRoot, "bundle/v0.1/examples", fileName);
  return {
    path: filePath,
    text: await readFile(filePath, "utf8")
  };
}

function findRootItem(scene: { root: { children: PositionedItem[] } }, id: string): PositionedItem {
  const item = scene.root.children.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Could not find root item "${id}".`);
  }

  return item;
}

function findTextDecoration(
  decorations: PositionedDecoration[],
  id: string
): Extract<PositionedDecoration, { kind: "text" }> {
  const decoration = decorations.find((candidate) => candidate.kind === "text" && candidate.id === id);
  if (!decoration || decoration.kind !== "text") {
    throw new Error(`Could not find text decoration "${id}".`);
  }

  return decoration;
}

describe("staged service_blueprint", () => {
  it("matches committed staged snapshots for service_blueprint_slice", async () => {
    const context = await resolveServiceBlueprintContext(
      await loadExampleInput("service_blueprint_slice.sdd"),
      "recommended"
    );

    const rendererScene = buildServiceBlueprintRendererScene(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );
    const rendered = await renderServiceBlueprintStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendererScene.root.layout).toEqual(expect.objectContaining({
      strategy: "elk_layered",
      direction: "horizontal"
    }));
    expect(rendererScene.root.children.slice(0, 4).map((child) => child.id)).toEqual([
      "guide__band:anchor:1",
      "guide__band:interstitial:1",
      "guide__band:anchor:2",
      "guide__band:sidecar:1"
    ]);

    await expectRendererStageSnapshot("service-blueprint.slice.renderer-scene.json", rendererScene);
    await expectRendererStageSnapshot("service-blueprint.slice.measured-scene.json", rendered.measuredScene);
    await expectRendererStageSnapshot("service-blueprint.slice.positioned-scene.json", rendered.positionedScene);
    await expectRendererStageTextSnapshot("service-blueprint.slice.svg", rendered.svg);
  });

  it("renders the sample slice with right-side sidecars, support/resource labels, and semantic separators", async () => {
    const context = await resolveServiceBlueprintContext(
      await loadExampleInput("service_blueprint_slice.sdd"),
      "recommended"
    );
    const rendered = await renderServiceBlueprintStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendered.svg).toContain("Submit Claim");
    expect(rendered.svg).toContain("Retention Policy");
    expect(rendered.svg).toContain("reads, writes");

    const customerTitle = findTextDecoration(rendered.positionedScene.decorations, "lane-customer__title");
    const frontstageTitle = findTextDecoration(rendered.positionedScene.decorations, "lane-frontstage__title");
    const backstageTitle = findTextDecoration(rendered.positionedScene.decorations, "lane-backstage__title");
    const supportTitle = findTextDecoration(rendered.positionedScene.decorations, "lane-support__title");
    const systemTitle = findTextDecoration(rendered.positionedScene.decorations, "lane-system__title");
    const policyTitle = findTextDecoration(rendered.positionedScene.decorations, "lane-policy__title");

    expect([
      customerTitle.text,
      frontstageTitle.text,
      backstageTitle.text,
      supportTitle.text,
      systemTitle.text,
      policyTitle.text
    ]).toEqual([
      "customer",
      "frontstage",
      "backstage",
      "support",
      "system",
      "policy"
    ]);
    const separatorYs = rendered.positionedScene.decorations
      .filter((decoration): decoration is Extract<PositionedDecoration, { kind: "line" }> => decoration.kind === "line")
      .map((decoration) => ({ id: decoration.id, y: decoration.from.y }));
    expect(separatorYs).toEqual([
      { id: "lane-customer__separator", y: expect.any(Number) },
      { id: "lane-frontstage__separator", y: expect.any(Number) },
      { id: "lane-backstage__separator", y: expect.any(Number) }
    ]);
    expect(separatorYs[0]?.y).toBeLessThan(separatorYs[1]?.y ?? 0);
    expect(separatorYs[1]?.y).toBeLessThan(separatorYs[2]?.y ?? 0);

    const submitClaim = findRootItem(rendered.positionedScene, "J-020");
    const finalizeClaim = findRootItem(rendered.positionedScene, "J-021");
    const claimRecord = findRootItem(rendered.positionedScene, "D-020");
    const retentionPolicy = findRootItem(rendered.positionedScene, "PL-020");
    if (
      submitClaim.kind !== "node"
      || finalizeClaim.kind !== "node"
      || claimRecord.kind !== "node"
      || retentionPolicy.kind !== "node"
    ) {
      throw new Error("Expected staged service_blueprint semantic nodes at the root.");
    }

    expect(finalizeClaim.x).toBeGreaterThan(submitClaim.x);
    expect(claimRecord.x).toBeGreaterThan(finalizeClaim.x);
    expect(retentionPolicy.x).toBeGreaterThan(claimRecord.x);

    const precedesEdges = rendered.positionedScene.edges.filter((edge) => edge.id.includes("__precedes__"));
    expect(precedesEdges).not.toHaveLength(0);
    expect(precedesEdges.every((edge) => edge.label === undefined)).toBe(true);

    const edgeLabelTexts = rendered.positionedScene.edges
      .flatMap((edge) => edge.label ? [edge.label.lines.join(" ")] : []);
    expect(edgeLabelTexts).toContain("realized by");
    expect(edgeLabelTexts).toContain("depends on");
    expect(edgeLabelTexts).toContain("reads, writes");

    expect(rendered.positionedScene.decorations.map((decoration) => decoration.id)).toEqual(expect.arrayContaining([
      "lane-customer__separator",
      "lane-frontstage__separator",
      "lane-backstage__separator"
    ]));
  });

  it("appends a synthetic ungrouped lane shell when projection omits derived lane mapping", async () => {
    const source = `
SDD-TEXT 0.1

Step J-100 "Start"
END

Process PR-100 "Investigate"
END
`;
    const context = await resolveServiceBlueprintContext({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_ungrouped__.sdd"),
      text: source.trimStart()
    }, "recommended");

    const rendererScene = buildServiceBlueprintRendererScene(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );

    expect(rendererScene.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "renderer.scene.service_blueprint_ungrouped_lane"
    );
    const ungroupedItems = rendererScene.root.children.filter((child) => child.classes.includes("lane-ungrouped"));
    expect(ungroupedItems.map((child) => child.id)).toEqual(expect.arrayContaining([
      "PR-100",
      "lane:99:ungrouped__shell__slot__band:sidecar:1__anchor"
    ]));
  });

  it("keeps disconnected scene construction deterministic in lane order", async () => {
    const source = `
SDD-TEXT 0.1

Step J-200 "Start"
END

Process PR-200 "Assist"
  visibility=support
END

SystemAction SA-200 "Log"
END
`;
    const firstContext = await resolveServiceBlueprintContext({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_disconnected_a__.sdd"),
      text: source.trimStart()
    }, "recommended");
    const secondContext = await resolveServiceBlueprintContext({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_disconnected_b__.sdd"),
      text: source.trimStart()
    }, "recommended");

    const firstScene = buildServiceBlueprintRendererScene(
      firstContext.projection,
      firstContext.graph,
      firstContext.view,
      "recommended"
    );
    const secondScene = buildServiceBlueprintRendererScene(
      secondContext.projection,
      secondContext.graph,
      secondContext.view,
      "recommended"
    );

    expect(firstScene).toEqual(secondScene);
  });
});
