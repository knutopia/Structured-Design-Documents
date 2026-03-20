import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type {
  PositionedContainer,
  PositionedEdge,
  PositionedItem,
  RendererScene,
  SceneContainer,
  SceneEdge,
  SceneNode
} from "../src/renderer/staged/contracts.js";
import {
  buildUiContractsRendererScene,
  renderUiContractsStagedSvg
} from "../src/renderer/staged/uiContracts.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import {
  expectRendererStageSnapshot,
  expectRendererStageTextSnapshot
} from "./rendererStageSnapshotHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

function findPositionedItem(root: PositionedContainer, id: string): PositionedItem {
  const queue: PositionedItem[] = [...root.children];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.id === id) {
      return current;
    }

    if (current.kind === "container") {
      queue.push(...current.children);
    }
  }

  throw new Error(`Could not find positioned item "${id}".`);
}

function findContainerChildIds(
  scene: RendererScene,
  containerId: string
): string[] {
  const queue: Array<RendererScene["root"] | RendererScene["root"]["children"][number]> = [scene.root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.kind !== "container") {
      continue;
    }

    if (current.id === containerId) {
      return current.children.map((child) => child.id);
    }

    queue.push(...current.children);
  }

  throw new Error(`Could not find renderer-scene container "${containerId}".`);
}

function getTerminalSegmentLength(edge: PositionedEdge): number {
  const points = edge.route.points;
  const end = points[points.length - 1];
  const beforeEnd = points[points.length - 2];
  if (!end || !beforeEnd) {
    throw new Error(`Edge "${edge.id}" is missing route points.`);
  }

  return Math.hypot(end.x - beforeEnd.x, end.y - beforeEnd.y);
}

function getRouteStart(edge: PositionedEdge) {
  const start = edge.route.points[0];
  if (!start) {
    throw new Error(`Edge "${edge.id}" is missing a route start point.`);
  }

  return start;
}

function getTerminalSegment(edge: PositionedEdge) {
  const points = edge.route.points;
  const end = points[points.length - 1];
  const beforeEnd = points[points.length - 2];
  if (!end || !beforeEnd) {
    throw new Error(`Edge "${edge.id}" is missing route points.`);
  }

  return {
    start: beforeEnd,
    end
  };
}

function findEdge(scene: Awaited<ReturnType<typeof buildUiContractsArtifacts>>["rendered"]["positionedScene"], edgeId: string): PositionedEdge {
  const edge = scene.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) {
    throw new Error(`Could not find positioned edge "${edgeId}".`);
  }

  return edge;
}

function expectHorizontalLocalSupportRoute(edge: PositionedEdge, sourceX: number): void {
  const routeStart = getRouteStart(edge);
  const terminalSegment = getTerminalSegment(edge);

  expect(edge.from.x).toBe(sourceX);
  expect(edge.from.y).toBe(edge.to.y);
  expect(routeStart.x).toBe(sourceX);
  expect(routeStart.y).toBe(edge.to.y);
  expect(terminalSegment.start.y).toBe(terminalSegment.end.y);
  expect(terminalSegment.end.y).toBe(edge.to.y);
  expect(terminalSegment.start.x).toBeLessThan(terminalSegment.end.x);
}

function getEdgeLabel(edge: PositionedEdge) {
  if (!edge.label) {
    throw new Error(`Edge "${edge.id}" is missing a positioned label.`);
  }

  return edge.label;
}

function getLabelCenterY(edge: PositionedEdge): number {
  const label = getEdgeLabel(edge);
  return label.y + label.height / 2;
}

function resolveContractLaneBounds(sourceItem: PositionedContainer, gutterItem: PositionedContainer) {
  return {
    left: gutterItem.x,
    top: sourceItem.y + sourceItem.chrome.padding.top + (sourceItem.chrome.headerBandHeight ?? 0) + 12,
    bottom: sourceItem.y + sourceItem.height - sourceItem.chrome.padding.bottom
  };
}

function expectLabelInsideLane(edge: PositionedEdge, laneBounds: ReturnType<typeof resolveContractLaneBounds>): void {
  const label = getEdgeLabel(edge);
  expect(label.x).toBeGreaterThanOrEqual(laneBounds.left);
  expect(label.y).toBeGreaterThanOrEqual(laneBounds.top);
  expect(label.y + label.height).toBeLessThanOrEqual(laneBounds.bottom);
}

async function buildUiContractsArtifactsFromInput(
  input: { path: string; text: string },
  profileId: string
) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "ui_contracts");
  if (!view) {
    throw new Error("Could not resolve the ui_contracts view.");
  }

  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);
  if (!compiled.graph) {
    throw new Error(`Could not compile ${input.path}.`);
  }

  const projected = projectView(compiled.graph, bundle, "ui_contracts");
  expect(projected.diagnostics).toEqual([]);
  if (!projected.projection) {
    throw new Error(`Could not project ${input.path} to ui_contracts.`);
  }

  const rendererScene = buildUiContractsRendererScene(projected.projection, compiled.graph, view, profileId);
  const rendered = await renderUiContractsStagedSvg(projected.projection, compiled.graph, view, profileId);

  return {
    rendererScene,
    rendered
  };
}

async function buildUiContractsArtifacts(examplePath: string, profileId: string) {
  return buildUiContractsArtifactsFromInput({
    path: examplePath,
    text: await readFile(examplePath, "utf8")
  }, profileId);
}

function buildSyntheticCrowdedLaneScene(): RendererScene {
  const buildSupportNode = (id: string, title: string): SceneNode => ({
    kind: "node",
    id,
    role: "dataentity",
    primitive: "card",
    classes: ["semantic_node", "shape-cylinder"],
    widthPolicy: {
      preferred: "standard",
      allowed: ["standard"]
    },
    overflowPolicy: {
      kind: "grow_height"
    },
    content: [
      {
        id: `${id}__content__line_0`,
        kind: "text",
        text: title,
        textStyleRole: "title",
        priority: "primary"
      }
    ],
    ports: [
      {
        id: `${id}__contract_in`,
        role: "contract_in",
        side: "west"
      }
    ]
  });

  const buildAuxiliaryNode = (id: string, title: string): SceneNode => ({
    kind: "node",
    id,
    role: "component",
    primitive: "card",
    classes: ["semantic_node", "shape-box"],
    widthPolicy: {
      preferred: "standard",
      allowed: ["standard"]
    },
    overflowPolicy: {
      kind: "grow_height"
    },
    content: [
      {
        id: `${id}__content__line_0`,
        kind: "text",
        text: title,
        textStyleRole: "title",
        priority: "primary"
      }
    ],
    ports: []
  });

  const contractGutter: SceneContainer = {
    kind: "container",
    id: "C-900__content",
    role: "contract_gutter",
    primitive: "stack",
    classes: ["contract_gutter"],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: 12,
      crossAlignment: "stretch"
    },
    chrome: {
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 128
      },
      gutter: 16,
      headerBandHeight: 0
    },
    headerContent: [],
    children: [
      buildSupportNode("D-901", "Primary Status"),
      buildSupportNode("D-902", "Secondary Status")
    ],
    ports: []
  };

  return {
    viewId: "ui_contracts",
    profileId: "recommended",
    themeId: "default",
    root: {
      kind: "container",
      id: "root",
      role: "diagram_root",
      primitive: "root",
      classes: ["diagram", "ui_contracts"],
      layout: {
        strategy: "stack",
        direction: "vertical",
        gap: 24,
        crossAlignment: "stretch"
      },
      chrome: {
        padding: {
          top: 24,
          right: 24,
          bottom: 24,
          left: 24
        },
        gutter: 24,
        headerBandHeight: 0
      },
      headerContent: [],
      children: [
        {
          kind: "container",
          id: "C-900",
          role: "component",
          primitive: "cluster",
          classes: ["component", "scope"],
          layout: {
            strategy: "stack",
            direction: "vertical",
            gap: 16,
            crossAlignment: "stretch"
          },
          chrome: {
            padding: {
              top: 12,
              right: 12,
              bottom: 12,
              left: 12
            },
            gutter: 16,
            headerBandHeight: 40
          },
          headerContent: [
            {
              id: "C-900__header__line_0",
              kind: "text",
              text: "Component: Billing Form",
              textStyleRole: "title",
              priority: "primary"
            }
          ],
          children: [
            contractGutter,
            buildAuxiliaryNode("C-900__aux", "Audit Panel")
          ],
          ports: [
            {
              id: "C-900__contract_out",
              role: "contract_out",
              side: "west",
              offsetPolicy: "content_start"
            }
          ]
        }
      ],
      ports: []
    },
    edges: [
      {
        id: "binds_to:C-900->D-901",
        role: "binds_to",
        classes: ["constraint_edge"],
        from: {
          itemId: "C-900"
        },
        to: {
          itemId: "D-901"
        },
        routing: {
          style: "orthogonal",
          labelPlacement: "source_contract_lane",
          sourcePortRole: "contract_out",
          targetPortRole: "contract_in"
        },
        label: {
          text: "binds\nalpha\nbeta\ngamma",
          textStyleRole: "edge_label"
        },
        markers: {
          end: "arrow"
        }
      },
      {
        id: "binds_to:C-900->D-902",
        role: "binds_to",
        classes: ["constraint_edge"],
        from: {
          itemId: "C-900"
        },
        to: {
          itemId: "D-902"
        },
        routing: {
          style: "orthogonal",
          labelPlacement: "source_contract_lane",
          sourcePortRole: "contract_out",
          targetPortRole: "contract_in"
        },
        label: {
          text: "binds\ndelta\nepsilon\nzeta",
          textStyleRole: "edge_label"
        },
        markers: {
          end: "arrow"
        }
      }
    ],
    diagnostics: []
  };
}

describe("staged ui_contracts", () => {
  it("matches committed staged snapshots for place_viewstate_transition in recommended profile", async () => {
    const examplePath = path.join(repoRoot, "bundle/v0.1/examples/place_viewstate_transition.sdd");
    const { rendererScene, rendered } = await buildUiContractsArtifacts(examplePath, "recommended");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendererScene.root.children.map((child) => child.id)).toEqual(["P-010", "P-011"]);
    expect(findContainerChildIds(rendererScene, "P-010")).toEqual(["view_state_graph:P-010", "C-010"]);
    expect(rendered.svg).not.toContain('class="scene-port');
    expect(rendered.svg).not.toContain("ViewState: Billing Editing");
    expect(rendered.positionedScene.diagnostics.some((diagnostic) => diagnostic.code === "renderer.routing.edge_label_segment_fallback")).toBe(false);
    expect(rendered.positionedScene.diagnostics.some((diagnostic) => diagnostic.code === "renderer.routing.edge_label_lane_fallback")).toBe(false);
    expect(rendered.positionedScene.edges.every((edge) => getTerminalSegmentLength(edge) >= 12)).toBe(true);

    const billingForm = findPositionedItem(rendered.positionedScene.root, "C-010");
    const billingFormGutter = findPositionedItem(rendered.positionedScene.root, "C-010__content");
    const submitButton = findPositionedItem(rendered.positionedScene.root, "C-011");
    const submitButtonGutter = findPositionedItem(rendered.positionedScene.root, "C-011__content");
    if (
      billingForm.kind !== "container"
      || billingFormGutter.kind !== "container"
      || submitButton.kind !== "container"
      || submitButtonGutter.kind !== "container"
    ) {
      throw new Error("Expected Billing Form to remain a staged container with a contract gutter.");
    }

    const bindsTo = findEdge(rendered.positionedScene, "binds_to:C-010->D-010");
    const dependsOn = findEdge(rendered.positionedScene, "depends_on:C-010->SA-010");
    const emits = findEdge(rendered.positionedScene, "emits:C-011->E-010");
    const billingLaneBounds = resolveContractLaneBounds(billingForm, billingFormGutter);
    const submitLaneBounds = resolveContractLaneBounds(submitButton, submitButtonGutter);

    expectHorizontalLocalSupportRoute(bindsTo, billingForm.x);
    expectHorizontalLocalSupportRoute(dependsOn, billingForm.x);
    expectHorizontalLocalSupportRoute(emits, submitButton.x);
    expect(getRouteStart(bindsTo).x).toBe(billingForm.x);
    expect(getRouteStart(dependsOn).x).toBe(billingForm.x);
    expect(getRouteStart(emits).x).toBe(submitButton.x);
    expect(getEdgeLabel(bindsTo).x).toBe(billingFormGutter.x);
    expect(getEdgeLabel(dependsOn).x).toBe(billingFormGutter.x);
    expect(getEdgeLabel(emits).x).toBe(submitButtonGutter.x);
    expectLabelInsideLane(bindsTo, billingLaneBounds);
    expectLabelInsideLane(dependsOn, billingLaneBounds);
    expectLabelInsideLane(emits, submitLaneBounds);
    expect(getLabelCenterY(dependsOn)).toBe(dependsOn.to.y);
    expect(getLabelCenterY(bindsTo)).toBe(bindsTo.to.y);
    expect(getLabelCenterY(emits)).toBe(emits.to.y);
    expect(dependsOn.to.y).toBeLessThan(bindsTo.to.y);
    expect(dependsOn.from.y).toBeLessThan(bindsTo.from.y);
    expect(getLabelCenterY(dependsOn)).toBeLessThan(getLabelCenterY(bindsTo));

    await expectRendererStageSnapshot("ui-contracts.place-viewstate-transition.renderer-scene.json", rendererScene);
    await expectRendererStageSnapshot("ui-contracts.place-viewstate-transition.measured-scene.json", rendered.measuredScene);
    await expectRendererStageSnapshot("ui-contracts.place-viewstate-transition.positioned-scene.json", rendered.positionedScene);
    await expectRendererStageTextSnapshot("ui-contracts.place-viewstate-transition.svg", rendered.svg);
  });

  it("builds fallback-to-state structure without a synthetic ViewState graph", async () => {
    const examplePath = path.join(repoRoot, "bundle/v0.1/examples/ui_state_fallback.sdd");
    const { rendererScene, rendered } = await buildUiContractsArtifacts(examplePath, "recommended");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendererScene.root.layout).toEqual(expect.objectContaining({
      strategy: "stack",
      direction: "vertical",
      crossAlignment: "stretch"
    }));
    expect(rendered.svg).toContain("State graph: Case Review");
    expect(rendered.svg).toContain("State graph: Review Panel");
    expect(rendered.svg).not.toContain("ViewState Graph");
    expect(rendered.svg).not.toContain('class="scene-port');
    expect(rendered.positionedScene.diagnostics.some((diagnostic) => diagnostic.code === "renderer.routing.edge_label_segment_fallback")).toBe(false);
    expect(rendered.positionedScene.diagnostics.some((diagnostic) => diagnostic.code === "renderer.routing.edge_label_lane_fallback")).toBe(false);
    expect(rendered.positionedScene.edges.every((edge) => getTerminalSegmentLength(edge) >= 12)).toBe(true);

    const placeGraph = findPositionedItem(rendered.positionedScene.root, "secondary_state_group:P-060");
    const componentGraph = findPositionedItem(rendered.positionedScene.root, "secondary_state_group:C-060");
    const reviewPanel = findPositionedItem(rendered.positionedScene.root, "C-060");
    const reviewPanelGutter = findPositionedItem(rendered.positionedScene.root, "C-060__content");
    expect(placeGraph.kind).toBe("container");
    expect(componentGraph.kind).toBe("container");
    if (reviewPanel.kind !== "container" || reviewPanelGutter.kind !== "container") {
      throw new Error("Expected Review Panel to remain a staged container with a contract gutter.");
    }

    const bindsTo = findEdge(rendered.positionedScene, "binds_to:C-060->D-060");
    const dependsOn = findEdge(rendered.positionedScene, "depends_on:C-060->SA-060");
    const emits = findEdge(rendered.positionedScene, "emits:C-060->E-060");
    const laneBounds = resolveContractLaneBounds(reviewPanel, reviewPanelGutter);

    expectHorizontalLocalSupportRoute(bindsTo, reviewPanel.x);
    expectHorizontalLocalSupportRoute(dependsOn, reviewPanel.x);
    expectHorizontalLocalSupportRoute(emits, reviewPanel.x);
    expect(getRouteStart(bindsTo).x).toBe(reviewPanel.x);
    expect(getRouteStart(dependsOn).x).toBe(reviewPanel.x);
    expect(getRouteStart(emits).x).toBe(reviewPanel.x);
    expect(getEdgeLabel(bindsTo).x).toBe(reviewPanelGutter.x);
    expect(getEdgeLabel(dependsOn).x).toBe(reviewPanelGutter.x);
    expect(getEdgeLabel(emits).x).toBe(reviewPanelGutter.x);
    expect(emits.to.y).toBeLessThan(dependsOn.to.y);
    expect(dependsOn.to.y).toBeLessThan(bindsTo.to.y);
    expect(emits.from.y).toBeLessThan(dependsOn.from.y);
    expect(dependsOn.from.y).toBeLessThan(bindsTo.from.y);
    expectLabelInsideLane(emits, laneBounds);
    expectLabelInsideLane(dependsOn, laneBounds);
    expectLabelInsideLane(bindsTo, laneBounds);
    expect(getLabelCenterY(emits)).toBe(emits.to.y);
    expect(getLabelCenterY(dependsOn)).toBe(dependsOn.to.y);
    expect(getLabelCenterY(bindsTo)).toBe(bindsTo.to.y);
    expect(getLabelCenterY(emits)).toBeLessThan(getLabelCenterY(dependsOn));
    expect(getLabelCenterY(dependsOn)).toBeLessThan(getLabelCenterY(bindsTo));

    await expectRendererStageSnapshot("ui-contracts.ui-state-fallback.renderer-scene.json", rendererScene);
    await expectRendererStageSnapshot("ui-contracts.ui-state-fallback.measured-scene.json", rendered.measuredScene);
    await expectRendererStageSnapshot("ui-contracts.ui-state-fallback.positioned-scene.json", rendered.positionedScene);
    await expectRendererStageTextSnapshot("ui-contracts.ui-state-fallback.svg", rendered.svg);
  });

  it("keeps the shared supporting group structural in the staged scene", async () => {
    const { rendererScene, rendered } = await buildUiContractsArtifactsFromInput({
      path: path.join(repoRoot, "tests/fixtures/render/shared_support_group_staged.sdd"),
      text: `SDD-TEXT 0.1

Place P-200 "Claims"
  COMPOSED_OF C-200 "Primary Button"
  COMPOSED_OF C-201 "Secondary Button"
END

Component C-200 "Primary Button"
  EMITS E-200 "Submit"
END

Component C-201 "Secondary Button"
  EMITS E-200 "Submit"
END

Event E-200 "Submit"
END
`
    }, "recommended");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendererScene.root.children.map((child) => child.id)).toEqual(["P-200", "shared_supporting_contracts"]);
    expect(rendered.svg).toContain("Shared Supporting Contracts");
    expect(rendered.svg).not.toContain('class="scene-port');
    expect(findPositionedItem(rendered.positionedScene.root, "shared_supporting_contracts").kind).toBe("container");
    expect(
      rendererScene.edges
        .filter((edge) => edge.role === "emits" && edge.to.itemId === "E-200")
        .map((edge) => edge.routing.labelPlacement)
    ).toEqual(["segment", "segment"]);
    expect(rendered.positionedScene.diagnostics.some((diagnostic) => diagnostic.code === "renderer.routing.edge_label_lane_fallback")).toBe(false);
    expect(
      rendered.positionedScene.edges
        .filter((edge) => edge.role === "emits" && edge.to.itemId === "E-200")
        .map((edge) => edge.from.itemId)
    ).toEqual(["C-200", "C-201"]);
  });

  it("packs crowded contract-lane pills around their routes without overlap", async () => {
    const result = await runStagedRendererPipeline(buildSyntheticCrowdedLaneScene());

    expect(result.positionedScene.diagnostics.some((diagnostic) => diagnostic.code === "renderer.routing.edge_label_lane_fallback")).toBe(false);

    const billingForm = findPositionedItem(result.positionedScene.root, "C-900");
    const billingFormGutter = findPositionedItem(result.positionedScene.root, "C-900__content");
    if (billingForm.kind !== "container" || billingFormGutter.kind !== "container") {
      throw new Error("Expected Billing Form to remain a staged container with a contract gutter.");
    }

    const first = findEdge(result.positionedScene, "binds_to:C-900->D-901");
    const second = findEdge(result.positionedScene, "binds_to:C-900->D-902");
    const firstLabel = getEdgeLabel(first);
    const secondLabel = getEdgeLabel(second);
    const laneBounds = resolveContractLaneBounds(billingForm, billingFormGutter);
    const displacements = [
      getLabelCenterY(first) - first.to.y,
      getLabelCenterY(second) - second.to.y
    ];

    expectHorizontalLocalSupportRoute(first, billingForm.x);
    expectHorizontalLocalSupportRoute(second, billingForm.x);
    expect(firstLabel.x).toBe(billingFormGutter.x);
    expect(secondLabel.x).toBe(billingFormGutter.x);
    expectLabelInsideLane(first, laneBounds);
    expectLabelInsideLane(second, laneBounds);
    expect(first.to.y).toBeLessThan(second.to.y);
    expect(firstLabel.y + firstLabel.height).toBe(secondLabel.y);
    expect(displacements.some((value) => value !== 0)).toBe(true);
    expect(displacements[0]).toBeLessThanOrEqual(displacements[1] ?? Number.POSITIVE_INFINITY);
  });

  it("keeps root places vertically balanced while dense places switch to a place grid", async () => {
    const examplePath = path.join(repoRoot, "tests/fixtures/render/ui_contracts_dense_sparse_staged.sdd");
    const { rendererScene, rendered } = await buildUiContractsArtifacts(examplePath, "recommended");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendererScene.root.layout).toEqual(expect.objectContaining({
      strategy: "stack",
      direction: "vertical",
      crossAlignment: "stretch"
    }));

    const densePlace = findPositionedItem(rendered.positionedScene.root, "P-700");
    const sparsePlace = findPositionedItem(rendered.positionedScene.root, "P-701");
    const summaryPlace = findPositionedItem(rendered.positionedScene.root, "P-702");
    if (densePlace.kind !== "container" || sparsePlace.kind !== "container" || summaryPlace.kind !== "container") {
      throw new Error("Expected dense/sparse staged ui_contracts places to remain containers.");
    }

    expect(densePlace.layout).toEqual(expect.objectContaining({
      strategy: "grid",
      columns: 2,
      crossAlignment: "stretch"
    }));
    expect(sparsePlace.layout).toEqual(expect.objectContaining({
      strategy: "stack",
      direction: "vertical"
    }));
    expect(summaryPlace.layout).toEqual(expect.objectContaining({
      strategy: "stack",
      direction: "vertical"
    }));
    expect(densePlace.x).toBe(sparsePlace.x);
    expect(densePlace.x).toBe(summaryPlace.x);
    expect(densePlace.width).toBe(sparsePlace.width);
    expect(densePlace.width).toBe(summaryPlace.width);
    expect(rendered.svg).not.toContain('class="scene-port');
    expect(rendered.positionedScene.edges.every((edge) => getTerminalSegmentLength(edge) >= 12)).toBe(true);

    await expectRendererStageSnapshot("ui-contracts.dense-sparse.positioned-scene.json", rendered.positionedScene);
    await expectRendererStageTextSnapshot("ui-contracts.dense-sparse.svg", rendered.svg);
  });
});
