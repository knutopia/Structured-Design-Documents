import type { ViewSpec } from "../../bundle/types.js";
import type { CompiledGraph } from "../../compiler/types.js";
import type { Projection } from "../../projector/types.js";
import { resolveProfileDisplayPolicy } from "../profileDisplay.js";
import {
  buildServiceBlueprintRenderModel,
  type ServiceBlueprintRenderNode
} from "../serviceBlueprintRenderModel.js";
import type {
  PositionedDecoration,
  PositionedScene,
  RendererScene,
  RoutingIntent,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode,
  WidthPolicy
} from "./contracts.js";
import {
  buildServiceBlueprintMiddleLayer,
  type ServiceBlueprintMiddleEdge,
  type ServiceBlueprintMiddleLaneShell,
  type ServiceBlueprintMiddleSlot
} from "./serviceBlueprintMiddleLayer.js";
import { buildContentBlocksFromLabelLines } from "./labelLines.js";
import { runStagedRendererPipeline, type StagedRendererPipelineResult } from "./pipeline.js";
import { buildCardNode, buildDiagramRootContainer, buildPortSpec } from "./sceneBuilders.js";
import { buildChromeStyleClasses, buildEdgeStyleClasses } from "./styleClasses.js";
import {
  renderPositionedSceneToPng,
  renderPositionedSceneToSvg,
  type StagedPngArtifact,
  type StagedSvgArtifact
} from "./svgBackend.js";

const ROOT_GAP = 24;
const ROOT_LEFT_GUTTER = 132;
const LANE_GAP = 18;
const SLOT_GAP = 24;
const LANE_SHELL_PADDING = 12;
const SLOT_PADDING = 12;
const SLOT_MIN_WIDTH = 224;

interface SceneBuildContext {
  renderNodesById: ReadonlyMap<string, ServiceBlueprintRenderNode>;
}

export interface ServiceBlueprintStagedSvgResult extends StagedRendererPipelineResult, StagedSvgArtifact {}
export interface ServiceBlueprintStagedPngResult extends StagedRendererPipelineResult, StagedPngArtifact {}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unnamed";
}

function buildRootChrome(): SceneContainer["chrome"] {
  return {
    padding: {
      top: 28,
      right: 28,
      bottom: 28,
      left: ROOT_LEFT_GUTTER
    },
    gutter: ROOT_GAP,
    headerBandHeight: 0
  };
}

function buildHelperWidthPolicy(): WidthPolicy {
  return {
    preferred: "chip",
    allowed: ["chip"]
  };
}

function buildServiceBlueprintNodePorts(): SceneNode["ports"] {
  return [
    buildPortSpec("flow_in", "flow_in", "west"),
    buildPortSpec("flow_out", "flow_out", "east"),
    buildPortSpec("support_in", "support_in", "north"),
    buildPortSpec("support_out", "support_out", "south"),
    buildPortSpec("resource_in", "resource_in", "north", {
      offset: 36
    }),
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

function buildNodeClasses(node: ServiceBlueprintRenderNode, extraClasses: string[] = []): string[] {
  return [
    "semantic_node",
    "service_blueprint_node",
    `shape-${sanitizeToken(node.shape)}`,
    `type-${sanitizeToken(node.type)}`,
    ...extraClasses,
    ...buildChromeStyleClasses(node.style)
  ];
}

function buildBlueprintNode(node: ServiceBlueprintRenderNode, extraClasses: string[] = []): SceneNode {
  return buildCardNode({
    id: node.id,
    role: node.type.toLowerCase(),
    classes: buildNodeClasses(node, extraClasses),
    widthPolicy: buildNodeWidthPolicy(node.type),
    content: buildContentBlocksFromLabelLines(`${node.id}__content`, node.labelLines),
    ports: buildServiceBlueprintNodePorts()
  });
}

function buildHelperNode(id: string, extraClasses: string[] = []): SceneNode {
  return {
    kind: "node",
    id,
    role: "helper",
    primitive: "connector_port",
    classes: ["service_blueprint_helper", ...extraClasses],
    widthPolicy: buildHelperWidthPolicy(),
    overflowPolicy: {
      kind: "grow_height"
    },
    content: [],
    ports: [],
    fixedSize: {
      width: 2,
      height: 2
    }
  };
}

function buildSlotSizerNode(id: string, extraClasses: string[] = []): SceneNode {
  return {
    kind: "node",
    id,
    role: "helper",
    primitive: "connector_port",
    classes: ["service_blueprint_helper", "service_blueprint_slot_sizer", ...extraClasses],
    widthPolicy: buildHelperWidthPolicy(),
    overflowPolicy: {
      kind: "grow_height"
    },
    content: [],
    ports: [],
    fixedSize: {
      width: SLOT_MIN_WIDTH,
      height: 2
    }
  };
}

function buildGuideContainer(guideId: string, bandLabel: string, previousGuideContainerId?: string): SceneContainer {
  const elkLayoutOptions: Record<string, string> = {
    "org.eclipse.elk.layered.layering.layerConstraint": "FIRST_SEPARATE"
  };
  if (previousGuideContainerId) {
    elkLayoutOptions["org.eclipse.elk.layered.crossingMinimization.inLayerSuccOf"] = previousGuideContainerId;
  }

  return {
    kind: "container",
    id: `${guideId}__shell`,
    role: "service_blueprint_band_guide",
    primitive: "cluster",
    classes: [
      "service_blueprint_helper",
      "service_blueprint_band_guide_shell",
      `guide-band-${sanitizeToken(bandLabel)}`
    ],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: 0,
      elk: {
        layoutOptions: elkLayoutOptions
      }
    },
    chrome: {
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      },
      gutter: 0,
      headerBandHeight: 0
    },
    children: [
      buildHelperNode(guideId, [
        "service_blueprint_band_guide",
        `guide-band-${sanitizeToken(bandLabel)}`
      ])
    ],
    ports: []
  };
}

function buildLaneStartGuideContainer(): SceneContainer {
  return {
    kind: "container",
    id: "guide__lane_start__shell",
    role: "service_blueprint_lane_start_guide",
    primitive: "cluster",
    classes: [
      "service_blueprint_helper",
      "service_blueprint_lane_start_guide_shell"
    ],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: 0,
      elk: {
        layoutOptions: {
          "org.eclipse.elk.layered.layering.layerConstraint": "FIRST_SEPARATE"
        }
      }
    },
    chrome: {
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      },
      gutter: 0,
      headerBandHeight: 0
    },
    children: [
      buildHelperNode("guide__lane_start", [
        "service_blueprint_lane_start_guide"
      ])
    ],
    ports: []
  };
}

function buildLaneClassToken(laneId: string): string {
  return sanitizeToken(laneId.replace(/^lane:\d+:/, ""));
}

function buildSlotClasses(slot: Pick<ServiceBlueprintMiddleSlot, "laneId" | "bandLabel" | "bandKind" | "shared">): string[] {
  const laneToken = buildLaneClassToken(slot.laneId);
  const bandToken = sanitizeToken(slot.bandLabel);
  return [
    `lane-${laneToken}`,
    `band-${bandToken}`,
    `slot-kind-${sanitizeToken(slot.bandKind)}`,
    slot.shared ? "slot-shared" : "slot-local"
  ];
}

function buildSlotChildItems(
  slot: ServiceBlueprintMiddleSlot,
  context: SceneBuildContext
): SceneNode[] {
  const slotClasses = buildSlotClasses(slot);
  const anchor = buildHelperNode(slot.anchorNodeId, [
    "service_blueprint_slot_anchor",
    ...slotClasses
  ]);
  const sizer = buildSlotSizerNode(`${slot.id}__sizer`, slotClasses);

  const nodes = slot.nodeIds
    .map((nodeId) => context.renderNodesById.get(nodeId))
    .filter((node): node is ServiceBlueprintRenderNode => node !== undefined)
    .sort((left, right) => left.authorOrder - right.authorOrder || left.id.localeCompare(right.id))
    .map((node) => buildBlueprintNode(node, slotClasses));

  return [anchor, sizer, ...nodes];
}

function buildElkLayeredOptions(direction: "RIGHT" | "DOWN", gap: number): Record<string, string> {
  return {
    "org.eclipse.elk.algorithm": "layered",
    "org.eclipse.elk.direction": direction,
    "org.eclipse.elk.edgeRouting": "ORTHOGONAL",
    "org.eclipse.elk.separateConnectedComponents": "false",
    "org.eclipse.elk.considerModelOrder.strategy": "NODES_AND_EDGES",
    "org.eclipse.elk.layered.crossingMinimization.forceNodeModelOrder": "true",
    "org.eclipse.elk.layered.considerModelOrder.portModelOrder": "true",
    "org.eclipse.elk.layered.nodePlacement.favorStraightEdges": "true",
    "org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers": String(gap),
    "org.eclipse.elk.spacing.nodeNode": String(gap),
    "org.eclipse.elk.layered.mergeEdges": "false",
    "org.eclipse.elk.layered.mergeHierarchyEdges": "false"
  };
}

function buildSlotContainer(slot: ServiceBlueprintMiddleSlot, context: SceneBuildContext): SceneContainer {
  return {
    kind: "container",
    id: slot.id,
    role: "service_blueprint_slot",
    primitive: "cluster",
    classes: [
      "service_blueprint_slot",
      ...buildSlotClasses(slot)
    ],
    layout: {
      strategy: "stack",
      direction: "vertical",
      gap: 12
    },
    chrome: {
      padding: {
        top: SLOT_PADDING,
        right: SLOT_PADDING,
        bottom: SLOT_PADDING,
        left: SLOT_PADDING
      },
      gutter: 12,
      headerBandHeight: 0
    },
    children: buildSlotChildItems(slot, context),
    ports: []
  };
}

function buildLaneShellContainer(
  laneShell: ServiceBlueprintMiddleLaneShell,
  slotsById: ReadonlyMap<string, ServiceBlueprintMiddleSlot>,
  context: SceneBuildContext,
  previousLaneShellId?: string
): SceneContainer {
  const laneToken = buildLaneClassToken(laneShell.laneId);
  const elkLayoutOptions: Record<string, string> = {
    "org.eclipse.elk.layered.layering.layerConstraint": "FIRST_SEPARATE"
  };
  if (previousLaneShellId) {
    elkLayoutOptions["org.eclipse.elk.layered.crossingMinimization.inLayerSuccOf"] = previousLaneShellId;
  }

  return {
    kind: "container",
    id: laneShell.id,
    role: "service_blueprint_lane_shell",
    primitive: "lane",
    classes: [
      "service_blueprint_lane_shell",
      `lane-${laneToken}`
    ],
    layout: {
      strategy: "stack",
      direction: "horizontal",
      gap: SLOT_GAP,
      elk: {
        layoutOptions: elkLayoutOptions
      }
    },
    chrome: {
      padding: {
        top: LANE_SHELL_PADDING,
        right: LANE_SHELL_PADDING,
        bottom: LANE_SHELL_PADDING,
        left: LANE_SHELL_PADDING
      },
      gutter: SLOT_GAP,
      headerBandHeight: 0
    },
    children: laneShell.slotIds
      .map((slotId) => slotsById.get(slotId))
      .filter((slot): slot is ServiceBlueprintMiddleSlot => slot !== undefined)
      .map((slot) => buildSlotContainer(slot, context)),
    ports: []
  };
}

function buildRoutingIntent(edge: ServiceBlueprintMiddleEdge): RoutingIntent {
  if (edge.channel === "helper") {
    const helperPriority = edge.type === "HELPER_ALIGN"
      || edge.type === "HELPER_ORDER"
      || edge.type === "HELPER_LANE_START"
      ? "9"
      : edge.type === "HELPER_SLOT_ORDER"
        ? "7"
        : "3";
    return {
      style: "orthogonal",
      preferAxis: "horizontal",
      authority: "flexible",
      elkLayoutOptions: {
        "org.eclipse.elk.priority": helperPriority
      }
    };
  }

  switch (edge.channel) {
    case "flow":
      return {
        style: "orthogonal",
        sourcePortRole: "flow_out",
        targetPortRole: "flow_in",
        labelPlacement: edge.label ? "segment_strict" : undefined,
        authority: "require_elk",
        elkLayoutOptions: {
          "org.eclipse.elk.priority": "10"
        }
      };
    case "support":
      return {
        style: "orthogonal",
        sourcePortRole: "support_out",
        targetPortRole: "support_in",
        labelPlacement: edge.label ? "segment" : undefined,
        authority: "require_elk",
        elkLayoutOptions: {
          "org.eclipse.elk.priority": "3"
        }
      };
    case "resource_policy":
      return {
        style: "orthogonal",
        sourcePortRole: "resource_out",
        targetPortRole: "resource_in",
        labelPlacement: edge.label ? "segment" : undefined,
        authority: "require_elk",
        elkLayoutOptions: {
          "org.eclipse.elk.priority": "2"
        }
      };
  }
}

function buildEdgeClasses(edge: ServiceBlueprintMiddleEdge): string[] {
  return [
    "service_blueprint_edge",
    edge.hidden ? "service_blueprint_helper" : "service_blueprint_semantic_edge",
    `edge-type-${sanitizeToken(edge.type)}`,
    `edge-channel-${sanitizeToken(edge.channel)}`,
    ...buildEdgeStyleClasses(edge.style)
  ];
}

function buildSceneEdge(edge: ServiceBlueprintMiddleEdge): SceneEdge {
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
    routing: buildRoutingIntent(edge),
    label: edge.hidden || !edge.label
      ? undefined
      : {
        text: edge.label,
        textStyleRole: "edge_label"
      },
    markers: edge.hidden || edge.channel === "helper"
      ? undefined
      : {
        end: "arrow"
      }
  };
}

function attachServiceBlueprintDecorations(scene: PositionedScene): PositionedScene {
  const decorations: PositionedDecoration[] = [];
  const labelX = 24;
  const lineStartX = 24;
  const lineEndX = Math.max(lineStartX, scene.root.width - 28);
  const laneOrder = [
    "lane-customer",
    "lane-frontstage",
    "lane-backstage",
    "lane-support",
    "lane-system",
    "lane-policy",
    "lane-ungrouped"
  ];
  const boundaryTargets = new Map<string, string>([
    ["lane-customer", "line_of_interaction"],
    ["lane-frontstage", "line_of_visibility"],
    ["lane-backstage", "line_of_internal_interaction"]
  ]);
  const laneBounds = laneOrder.flatMap((laneClass) => {
    const laneShell = scene.root.children.find((child) =>
      child.kind === "container"
      && child.classes.includes("service_blueprint_lane_shell")
      && child.classes.includes(laneClass)
    );
    if (!laneShell || laneShell.kind !== "container") {
      return [];
    }

    return [{
      laneClass,
      minY: laneShell.y,
      maxY: laneShell.y + laneShell.height
    }];
  });

  laneBounds.forEach((lane) => {
    decorations.push({
      kind: "text",
      id: `${lane.laneClass}__title`,
      classes: ["service_blueprint_lane_title", lane.laneClass],
      paintGroup: "labels",
      x: labelX,
      y: lane.minY + Math.max(10, (lane.maxY - lane.minY) / 2 - 10),
      text: lane.laneClass.replace(/^lane-/, ""),
      textStyleRole: "label"
    });

    const boundaryRole = boundaryTargets.get(lane.laneClass);
    if (boundaryRole) {
      decorations.push({
        kind: "line",
        id: `${lane.laneClass}__separator`,
        classes: ["service_blueprint_separator", boundaryRole, lane.laneClass],
        paintGroup: "chrome",
        from: {
          x: lineStartX,
          y: lane.maxY
        },
        to: {
          x: lineEndX,
          y: lane.maxY
        }
      });
    }
  });

  return {
    ...scene,
    decorations
  };
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
  const middleLayer = buildServiceBlueprintMiddleLayer(model);
  const context: SceneBuildContext = {
    renderNodesById: new Map(model.nodes.map((node) => [node.id, node]))
  };
  const slotsById = new Map(middleLayer.slots.map((slot) => [slot.id, slot]));
  const laneShellChildren = middleLayer.laneShells.map((laneShell, index, laneShells) =>
    buildLaneShellContainer(
      laneShell,
      slotsById,
      context,
      index > 0 ? laneShells[index - 1]?.id : undefined
    )
  );
  const guideNodes = middleLayer.bands
    .filter((band) => band.shared)
    .map((band, index, bands) => buildGuideContainer(
      `guide__${band.id}`,
      band.label,
      index > 0 ? `guide__${bands[index - 1]?.id}__shell` : undefined
    ));
  const rootChildren: SceneItem[] = [
    buildLaneStartGuideContainer(),
    ...guideNodes,
    ...laneShellChildren
  ];
  const laneStartEdges = middleLayer.laneShells.flatMap<ServiceBlueprintMiddleEdge>((laneShell) => {
    const firstSlot = laneShell.slotIds
      .map((slotId) => slotsById.get(slotId))
      .find((slot): slot is ServiceBlueprintMiddleSlot => slot !== undefined);
    if (!firstSlot) {
      return [];
    }

    return [{
      id: `guide__lane_start__helper__${firstSlot.anchorNodeId}`,
      semanticEdgeIds: [],
      channel: "helper",
      type: "HELPER_LANE_START",
      from: "guide__lane_start",
      to: firstSlot.anchorNodeId,
      strictRoute: false,
      hidden: true
    }];
  });

  return {
    viewId: "service_blueprint",
    profileId,
    themeId,
    root: buildDiagramRootContainer({
      viewId: "service_blueprint",
      layout: {
        strategy: "elk_layered",
        direction: "horizontal",
        gap: LANE_GAP,
        elk: {
          hierarchyHandling: "include_children",
          strict: true,
          layoutOptions: {
            "org.eclipse.elk.separateConnectedComponents": "false",
            "org.eclipse.elk.considerModelOrder.strategy": "NODES_AND_EDGES",
            "org.eclipse.elk.layered.crossingMinimization.forceNodeModelOrder": "true",
            "org.eclipse.elk.layered.considerModelOrder.portModelOrder": "true",
            "org.eclipse.elk.layered.nodePlacement.favorStraightEdges": "true",
            "org.eclipse.elk.layered.mergeEdges": "false",
            "org.eclipse.elk.layered.mergeHierarchyEdges": "false"
          }
        }
      },
      chrome: buildRootChrome(),
      children: rootChildren,
      classes: ["service_blueprint"]
    }),
    edges: [...laneStartEdges, ...middleLayer.edges].map((edge) => buildSceneEdge(edge)),
    diagnostics: middleLayer.diagnostics
  };
}

export async function renderServiceBlueprintStagedSvg(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  profileId: string,
  themeId = "default"
): Promise<ServiceBlueprintStagedSvgResult> {
  const rendererScene = buildServiceBlueprintRendererScene(projection, graph, view, profileId, themeId);
  const pipeline = await runStagedRendererPipeline(rendererScene);
  const positionedScene = attachServiceBlueprintDecorations(pipeline.positionedScene);
  const rendered = await renderPositionedSceneToSvg(positionedScene);

  return {
    ...pipeline,
    positionedScene,
    ...rendered
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
  const pipeline = await runStagedRendererPipeline(rendererScene);
  const positionedScene = attachServiceBlueprintDecorations(pipeline.positionedScene);
  const rendered = await renderPositionedSceneToPng(positionedScene);

  return {
    ...pipeline,
    positionedScene,
    ...rendered
  };
}
