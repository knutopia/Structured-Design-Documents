import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type { PositionedEdge, PositionedItem, RendererScene } from "../src/renderer/staged/contracts.js";
import {
  buildServiceBlueprintRendererScene,
  renderServiceBlueprintStagedSvg
} from "../src/renderer/staged/serviceBlueprint.js";

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

function findNestedPositionedItem(children: PositionedItem[], id: string): PositionedItem | undefined {
  for (const child of children) {
    if (child.id === id) {
      return child;
    }
    if (child.kind === "container") {
      const nested = findNestedPositionedItem(child.children, id);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

function findRootCells(
  scene: { root: { children: PositionedItem[] } }
): Array<Extract<PositionedItem, { kind: "container" }>> {
  return scene.root.children.filter((child): child is Extract<PositionedItem, { kind: "container" }> =>
    child.kind === "container" && child.classes.includes("service_blueprint_cell")
  );
}
function findNestedRendererItem(
  children: RendererScene["root"]["children"],
  id: string
): RendererScene["root"]["children"][number] | undefined {
  for (const child of children) {
    if (child.id === id) {
      return child;
    }
    if (child.kind === "container") {
      const nested = findNestedRendererItem(child.children, id);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

function findSemanticEdge(edges: PositionedEdge[], id: string): PositionedEdge {
  const edge = edges.find((candidate) => candidate.id === id);
  if (!edge) {
    throw new Error(`Could not find routed edge "${id}".`);
  }
  return edge;
}
describe("staged service_blueprint", () => {
  it("builds a fixed root grid for service_blueprint_slice instead of using root ELK placement", async () => {
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
    expect(rendererScene.root.layout).toEqual(expect.objectContaining({
      strategy: "grid",
      columns: 4,
      crossAlignment: "stretch"
    }));
    expect(findRootCells(rendererScene)).toHaveLength(24);
    expect(findRootCells(rendererScene).slice(0, 4).map((child) => child.id)).toEqual([
      "lane:01:customer__shell__cell__band:anchor:1",
      "lane:01:customer__shell__cell__band:interstitial:1",
      "lane:01:customer__shell__cell__band:anchor:2",
      "lane:01:customer__shell__cell__band:sidecar:1"
    ]);
    expect(findRootCells(rendererScene).slice(4, 8).map((child) => child.id)).toEqual([
      "lane:02:frontstage__shell__cell__band:anchor:1",
      "lane:02:frontstage__shell__cell__band:interstitial:1",
      "lane:02:frontstage__shell__cell__band:anchor:2",
      "lane:02:frontstage__shell__cell__band:sidecar:1"
    ]);
  });

  it("renders the proof case with direct straight connectors using the resolved ports", async () => {
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

    for (const edge of rendered.positionedScene.edges.filter((candidate) =>
      candidate.classes.includes("service_blueprint_semantic_edge")
    )) {
      expect(edge.route.style).toBe("straight");
      expect(edge.route.points).toHaveLength(2);
      expect(edge.route.points[0]).toEqual({
        x: edge.from.x,
        y: edge.from.y
      });
      expect(edge.route.points[1]).toEqual({
        x: edge.to.x,
        y: edge.to.y
      });
    }

    const precedesEdge = findSemanticEdge(rendered.positionedScene.edges, "J-020__precedes__J-021");
    expect(precedesEdge.label).toBeUndefined();
    const realizedByEdge = findSemanticEdge(rendered.positionedScene.edges, "J-020__realized_by__PR-020");
    expect(realizedByEdge.label?.lines.join(" ")).toContain("realized by");

    const j020 = findNestedPositionedItem(rendered.positionedScene.root.children, "J-020");
    const j021 = findNestedPositionedItem(rendered.positionedScene.root.children, "J-021");
    if (!j020 || !j021) {
      throw new Error("Could not resolve proof-case nodes.");
    }
    expect(precedesEdge.from.itemId).toBe("J-020");
    expect(precedesEdge.to.itemId).toBe("J-021");
    expect(precedesEdge.from.x).toBe(j020.x + j020.width);
    expect(precedesEdge.from.y).toBe(j020.y + j020.height / 2);
    expect(precedesEdge.to.x).toBe(j021.x);
    expect(precedesEdge.to.y).toBe(j021.y + j021.height / 2);
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
    const ungroupedCells = rendererScene.root.children.filter(
      (child): child is Extract<RendererScene["root"]["children"][number], { kind: "container" }> =>
        child.kind === "container"
        && child.classes.includes("service_blueprint_cell")
        && child.classes.includes("lane-ungrouped")
    );
    expect(ungroupedCells.map((child) => child.id)).toEqual([
      "lane:99:ungrouped__shell__cell__band:anchor:1",
      "lane:99:ungrouped__shell__cell__band:sidecar:1",
      "lane:99:ungrouped__shell__cell__band:parking:lane:99:ungrouped:1"
    ]);
    expect(findNestedRendererItem(rendererScene.root.children, "PR-100")).toBeDefined();
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
