import type { ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection } from "../../projector/types.js";
import { resolveProfileDisplayPolicy } from "../profileDisplay.js";
import {
  buildServiceBlueprintRenderModel,
  type ServiceBlueprintEdgeFamily,
  type ServiceBlueprintRenderEdge,
  type ServiceBlueprintRenderLane,
  type ServiceBlueprintRenderModel,
  type ServiceBlueprintRenderNode
} from "../serviceBlueprintRenderModel.js";
import type {
  RendererScene,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode,
  LayoutIntent,
  WidthPolicy
} from "./contracts.js";
import {
  createBackendDiagnostic,
  createSceneDiagnostic,
  sortRendererDiagnostics,
  type RendererDiagnostic
} from "./diagnostics.js";
import { buildContentBlocksFromLabelLines } from "./labelLines.js";
import { buildCardNode, buildDiagramRootContainer, buildPortSpec } from "./sceneBuilders.js";
import { buildChromeStyleClasses, buildEdgeStyleClasses } from "./styleClasses.js";
import type { StagedPngArtifact, StagedSvgArtifact } from "./svgBackend.js";

const ROOT_GAP = 18;
const LANE_STACK_GAP = 12;
const SERVICE_BLUEPRINT_FAIL_CLOSED_MESSAGE = "Staged service_blueprint preview is temporarily disabled while the broken two-pass ELK lane renderer is removed. service_blueprint requires ELK-authoritative final geometry; use --backend legacy_graphviz_preview for preview output until the replacement lands.";

interface SceneBuildContext {
  diagnostics: RendererDiagnostic[];
  renderNodesById: ReadonlyMap<string, ServiceBlueprintRenderNode>;
}

export const SERVICE_BLUEPRINT_STAGED_DISABLED_DIAGNOSTIC_CODE = "renderer.backend.service_blueprint_staged_disabled";

export interface ServiceBlueprintStagedSvgResult extends StagedSvgArtifact {}
export interface ServiceBlueprintStagedPngResult extends StagedPngArtifact {}

function buildRootChrome(): SceneContainer["chrome"] {
  return {
    padding: {
      top: 24,
      right: 24,
      bottom: 24,
      left: 24
    },
    gutter: ROOT_GAP,
    headerBandHeight: 0
  };
}

function buildDisabledRootLayout(): LayoutIntent {
  return {
    strategy: "stack",
    direction: "vertical",
    gap: ROOT_GAP
  };
}

function buildLaneChrome(): SceneContainer["chrome"] {
  return {
    padding: {
      top: 12,
      right: 16,
      bottom: 12,
      left: 16
    },
    gutter: LANE_STACK_GAP,
    headerBandHeight: 28
  };
}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unnamed";
}

function buildServiceBlueprintNodePorts(): SceneNode["ports"] {
  return [
    buildPortSpec("flow_in", "flow_in", "west"),
    buildPortSpec("flow_out", "flow_out", "east"),
    buildPortSpec("support_in", "support_in", "north"),
    buildPortSpec("resource_in", "resource_in", "north", {
      offset: 36
    }),
    buildPortSpec("support_out", "support_out", "south"),
    buildPortSpec("resource_out", "resource_out", "south", {
      offset: 36
    })
  ];
}

function buildNodeWidthPolicy(nodeType: string): WidthPolicy {
  switch (nodeType) {
    case "Step":
      return {
        preferred: "narrow",
        allowed: ["narrow", "standard", "wide"]
      };
    case "SystemAction":
    case "DataEntity":
      return {
        preferred: "standard",
        allowed: ["narrow", "standard", "wide"]
      };
    default:
      return {
        preferred: "standard",
        allowed: ["standard", "wide"]
      };
  }
}

function buildNodeClasses(node: ServiceBlueprintRenderNode): string[] {
  return [
    "semantic_node",
    "service_blueprint_node",
    `shape-${node.shape.toLowerCase()}`,
    `type-${sanitizeToken(node.type)}`,
    ...buildChromeStyleClasses(node.style)
  ];
}

function buildBlueprintNode(node: ServiceBlueprintRenderNode): SceneNode {
  return buildCardNode({
    id: node.id,
    role: node.type.toLowerCase(),
    classes: buildNodeClasses(node),
    widthPolicy: buildNodeWidthPolicy(node.type),
    content: buildContentBlocksFromLabelLines(`${node.id}__content`, node.labelLines),
    ports: buildServiceBlueprintNodePorts()
  });
}

function buildLaneContainer(
  lane: Pick<ServiceBlueprintRenderLane, "id" | "label">,
  children: SceneItem[]
): SceneContainer {
  return {
    kind: "container",
    id: lane.id,
    role: "lane",
    primitive: "lane",
    classes: [
      "service_blueprint_lane",
      `lane-${sanitizeToken(lane.label)}`
    ],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: LANE_STACK_GAP
    },
    chrome: buildLaneChrome(),
    headerContent: buildContentBlocksFromLabelLines(`${lane.id}__header`, [lane.label], {
      titleTextStyleRole: "label",
      defaultTextStyleRole: "label"
    }),
    children,
    ports: []
  };
}

function resolveFamilyPorts(family: ServiceBlueprintEdgeFamily): { sourcePortRole: string; targetPortRole: string } {
  switch (family) {
    case "flow":
      return {
        sourcePortRole: "flow_out",
        targetPortRole: "flow_in"
      };
    case "support":
      return {
        sourcePortRole: "support_out",
        targetPortRole: "support_in"
      };
    case "resource":
      return {
        sourcePortRole: "resource_out",
        targetPortRole: "resource_in"
      };
  }
}

function buildEdgeClasses(edge: ServiceBlueprintRenderEdge): string[] {
  return [
    "service_blueprint_edge",
    `edge-type-${sanitizeToken(edge.type)}`,
    `edge-family-${sanitizeToken(edge.family)}`,
    ...buildEdgeStyleClasses(edge.style)
  ];
}

function buildSceneEdge(edge: ServiceBlueprintRenderEdge): SceneEdge {
  const ports = resolveFamilyPorts(edge.family);
  return {
    id: edge.id,
    role: edge.type.toLowerCase(),
    classes: buildEdgeClasses(edge),
    from: {
      itemId: edge.from
    },
    to: {
      itemId: edge.to
    },
    routing: {
      style: "orthogonal",
      sourcePortRole: ports.sourcePortRole,
      targetPortRole: ports.targetPortRole,
      labelPlacement: edge.label ? "segment_strict" : undefined
    },
    label: edge.label
      ? {
        text: edge.label,
        textStyleRole: "edge_label"
      }
      : undefined,
    markers: {
      end: "arrow"
    }
  };
}

function buildRenderableLanes(
  model: ServiceBlueprintRenderModel,
  context: SceneBuildContext
): SceneContainer[] {
  const lanes = model.lanes.map((lane) => buildLaneContainer(
    lane,
    lane.nodeIds.map((nodeId) => {
      const node = context.renderNodesById.get(nodeId);
      if (!node) {
        context.diagnostics.push(
          createSceneDiagnostic(
            "renderer.scene.service_blueprint_missing_render_node",
            `Could not resolve render metadata for "${nodeId}". Skipping the node from staged service blueprint output.`,
            { targetId: nodeId }
          )
        );
        return undefined;
      }

      return buildBlueprintNode(node);
    }).filter((laneChild): laneChild is SceneNode => laneChild !== undefined)
  ));

  if (model.ungroupedNodeIds.length === 0) {
    return lanes;
  }

  context.diagnostics.push(
    createSceneDiagnostic(
      "renderer.scene.service_blueprint_ungrouped_lane",
      `Service blueprint projection produced ${model.ungroupedNodeIds.length} ungrouped node(s). Appending a synthetic "ungrouped" lane for staged rendering.`
    )
  );

  const ungroupedChildren = model.ungroupedNodeIds
    .map((nodeId) => context.renderNodesById.get(nodeId))
    .filter((node): node is ServiceBlueprintRenderNode => node !== undefined)
    .map((node) => buildBlueprintNode(node));

  return [
    ...lanes,
    buildLaneContainer(
      {
        id: "lane:99:ungrouped",
        label: "ungrouped"
      },
      ungroupedChildren
    )
  ];
}

function buildSceneEdges(model: ServiceBlueprintRenderModel): SceneEdge[] {
  return model.edges.map((edge) => buildSceneEdge(edge));
}

export function buildServiceBlueprintRendererScene(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): RendererScene {
  const displayPolicy = resolveProfileDisplayPolicy(view, profileId);
  const model = buildServiceBlueprintRenderModel(projection, graph, displayPolicy);
  const context: SceneBuildContext = {
    diagnostics: [],
    renderNodesById: new Map(model.nodes.map((node) => [node.id, node]))
  };
  const rootChildren = buildRenderableLanes(model, context);

  return {
    viewId: "service_blueprint",
    profileId,
    themeId,
    root: buildDiagramRootContainer({
      viewId: "service_blueprint",
      layout: buildDisabledRootLayout(),
      chrome: buildRootChrome(),
      children: rootChildren,
      classes: ["service_blueprint"]
    }),
    edges: buildSceneEdges(model),
    diagnostics: context.diagnostics
  };
}

function buildFailClosedDiagnostics(sceneDiagnostics: readonly RendererDiagnostic[]): RendererDiagnostic[] {
  return sortRendererDiagnostics([
    ...sceneDiagnostics,
    createBackendDiagnostic(
      SERVICE_BLUEPRINT_STAGED_DISABLED_DIAGNOSTIC_CODE,
      SERVICE_BLUEPRINT_FAIL_CLOSED_MESSAGE,
      { severity: "error", targetId: "root" }
    )
  ]);
}

export async function renderServiceBlueprintStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ServiceBlueprintStagedSvgResult> {
  const rendererScene = buildServiceBlueprintRendererScene(projection, graph, view, profileId, themeId);
  return {
    svg: "",
    diagnostics: buildFailClosedDiagnostics(rendererScene.diagnostics)
  };
}

export async function renderServiceBlueprintStagedPng(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ServiceBlueprintStagedPngResult> {
  const rendererScene = buildServiceBlueprintRendererScene(projection, graph, view, profileId, themeId);
  return {
    svg: "",
    png: new Uint8Array(),
    diagnostics: buildFailClosedDiagnostics(rendererScene.diagnostics)
  };
}
