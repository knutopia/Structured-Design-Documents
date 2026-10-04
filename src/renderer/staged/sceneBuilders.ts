import type {
  LayoutIntent,
  PortOffsetPolicy,
  PortSide,
  PortSpec,
  SceneContainer,
  SceneItem,
  SceneNode,
  SharedNodeAttribute,
  NodeDecoratorMode
} from "./contracts.js";

interface PortSpecOptions {
  offset?: number;
  offsetPolicy?: PortOffsetPolicy;
}

interface DiagramRootContainerOptions {
  viewId: string;
  layout: LayoutIntent;
  chrome: SceneContainer["chrome"];
  children: SceneItem[];
  ports?: PortSpec[];
  classes?: string[];
}

export interface SharedNodeRequest {
  emphasized?: boolean;
  title: string;
  decoratorMode: NodeDecoratorMode;
  nodeType: string;
  nodeId: string;
  attributes: SharedNodeAttribute[];
}

interface SharedNodeIntegrationOptions {
  classes?: string[];
  ports?: PortSpec[];
}

export function buildPortSpec(
  id: string,
  role: string,
  side: PortSide,
  options: PortSpecOptions = {}
): PortSpec {
  return {
    id,
    role,
    side,
    offset: options.offset,
    offsetPolicy: options.offsetPolicy
  };
}

export function buildCardinalPorts(): SceneNode["ports"] {
  return [
    buildPortSpec("north", "north", "north"),
    buildPortSpec("south", "south", "south"),
    buildPortSpec("east", "east", "east"),
    buildPortSpec("west", "west", "west")
  ];
}

export function buildIaPlaceMapPorts(chainPortOffset = 24): SceneNode["ports"] {
  return [
    buildPortSpec("north_chain", "north_chain", "north", {
      offset: chainPortOffset
    }),
    buildPortSpec("south_chain", "south_chain", "south", {
      offset: chainPortOffset
    }),
    buildPortSpec("east", "east", "east"),
    buildPortSpec("west", "west", "west")
  ];
}

export function buildTransitionPorts(itemId: string): PortSpec[] {
  return [
    buildPortSpec(`${itemId}__transition_in`, "transition_in", "west"),
    buildPortSpec(`${itemId}__transition_out`, "transition_out", "east")
  ];
}

export function buildContainerContractPorts(itemId: string): PortSpec[] {
  return [
    buildPortSpec(`${itemId}__contract_out`, "contract_out", "west", {
      offsetPolicy: "content_start"
    })
  ];
}

export function buildContractTargetPorts(itemId: string): PortSpec[] {
  return [
    buildPortSpec(`${itemId}__contract_in`, "contract_in", "west")
  ];
}

export function buildDiagramRootContainer(options: DiagramRootContainerOptions): SceneContainer {
  return {
    kind: "container",
    id: "root",
    role: "diagram_root",
    primitive: "root",
    classes: ["diagram", options.viewId, ...(options.classes ?? [])],
    layout: {
      ...options.layout
    },
    chrome: {
      padding: { ...options.chrome.padding },
      gutter: options.chrome.gutter,
      headerBandHeight: options.chrome.headerBandHeight
    },
    children: [...options.children],
    ports: [...(options.ports ?? [])]
  };
}

export function buildSharedNode(
  request: SharedNodeRequest,
  integration: SharedNodeIntegrationOptions = {}
): SceneNode {
  return {
    kind: "node",
    id: request.nodeId,
    role: request.nodeType.toLowerCase(),
    primitive: "card",
    classes: ["semantic_node", ...(integration.classes ?? [])],
    widthPolicy: {
      preferred: "standard",
      allowed: ["standard"]
    },
    overflowPolicy: {
      kind: "grow_height"
    },
    content: [],
    sharedNode: {
      ...(request.emphasized ? { emphasized: true } : {}),
      title: request.title,
      decoratorMode: { ...request.decoratorMode },
      nodeType: request.nodeType,
      nodeId: request.nodeId,
      attributes: request.attributes.map((attribute) => ({ ...attribute }))
    },
    ports: [...(integration.ports ?? [])]
  };
}

export function applyDiagramMetadata<T extends import("./contracts.js").RendererScene>(scene: T, projection: import("../../projector/types.js").Projection): T {
  if (projection.diagram_id && projection.diagram_name) {
    scene.root.viewMetadata = { ...scene.root.viewMetadata, diagram: { id: projection.diagram_id, name: projection.diagram_name } };
  }
  return scene;
}

/** Complete explicitly identified connectors that a specialized local planner did not represent. */
export function completeExactSceneConnections(
  edges: import("./contracts.js").SceneEdge[],
  expected: Array<{ from: string; to: string; source_edge_id?: string; role: string }>
): import("./diagnostics.js").RendererDiagnostic[] {
  const diagnostics: import("./diagnostics.js").RendererDiagnostic[] = [];
  for (const connection of expected) {
    if (!connection.source_edge_id) continue;
    const parallels = expected.filter(candidate => candidate.from === connection.from && candidate.to === connection.to && candidate.role === connection.role);
    if (parallels.length > 1) {
      diagnostics.push({ phase: "scene", code: "renderer.scene.unsupported_parallel_occurrences", severity: "error",
        message: `This scene connector planner cannot represent parallel ${connection.role} occurrences without loss.`, targetId: connection.source_edge_id });
      continue;
    }
    if (edges.some(edge => edge.viewMetadata?.sourceEdgeIds?.includes(connection.source_edge_id!))) continue;
    edges.push({ id: `${connection.from}__${connection.role}__${connection.to}__${connection.source_edge_id}`,
      role: connection.role, classes: ["exact_connector"], viewMetadata: { sourceEdgeIds: [connection.source_edge_id] },
      from: { itemId: connection.from, portId: "east" }, to: { itemId: connection.to, portId: "west" },
      routing: { style: "orthogonal", preferAxis: "horizontal" }, markers: { end: "arrow" } });
  }
  return diagnostics;
}
