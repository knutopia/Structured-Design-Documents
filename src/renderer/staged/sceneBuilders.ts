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
      title: request.title,
      decoratorMode: { ...request.decoratorMode },
      nodeType: request.nodeType,
      nodeId: request.nodeId,
      attributes: request.attributes.map((attribute) => ({ ...attribute }))
    },
    ports: [...(integration.ports ?? [])]
  };
}
