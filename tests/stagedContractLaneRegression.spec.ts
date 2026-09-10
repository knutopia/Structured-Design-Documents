import { describe, expect, it } from "vitest";
import type { PositionedContainer, PositionedEdge, PositionedItem, PositionedScene, RendererScene, SceneContainer, SceneNode } from "../src/renderer/staged/contracts.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";

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

function findEdge(scene: PositionedScene, edgeId: string): PositionedEdge {
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
    detailId: "detailed",
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

describe("preserved shared container contract lanes", () => {
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

});
