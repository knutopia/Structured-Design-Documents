import type {
  ContentBlock,
  LayoutIntent,
  OverflowPolicy,
  PortOffsetPolicy,
  PortSide,
  PortSpec,
  SceneContainer,
  SceneItem,
  SceneNode,
  WidthPolicy
} from "./contracts.js";

const DEFAULT_CARD_OVERFLOW_POLICY: OverflowPolicy = {
  kind: "escalate_width_band",
  maxLines: 2
};

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

interface CardNodeOptions {
  id: string;
  role: string;
  classes: string[];
  widthPolicy: WidthPolicy;
  content: ContentBlock[];
  ports?: PortSpec[];
  overflowPolicy?: OverflowPolicy;
}

function cloneWidthPolicy(widthPolicy: WidthPolicy): WidthPolicy {
  return {
    preferred: widthPolicy.preferred,
    allowed: [...widthPolicy.allowed]
  };
}

function cloneOverflowPolicy(overflowPolicy: OverflowPolicy): OverflowPolicy {
  return {
    kind: overflowPolicy.kind,
    maxLines: overflowPolicy.maxLines
  };
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

export function buildCardNode(options: CardNodeOptions): SceneNode {
  return {
    kind: "node",
    id: options.id,
    role: options.role,
    primitive: "card",
    classes: [...options.classes],
    widthPolicy: cloneWidthPolicy(options.widthPolicy),
    overflowPolicy: cloneOverflowPolicy(options.overflowPolicy ?? DEFAULT_CARD_OVERFLOW_POLICY),
    content: [...options.content],
    ports: [...(options.ports ?? [])]
  };
}
