import ElkConstructor, { type ElkEdgeSection, type ElkNode, type ElkPort } from "elkjs/lib/main.js";
import { cloneViewMetadata } from "./contracts.js";
import type {
  ChromeSpec,
  LayoutDirection,
  MeasuredContainer,
  MeasuredContentBlock,
  MeasuredEdge,
  MeasuredEdgeEndpoint,
  MeasuredItem,
  MeasuredNode,
  MeasuredPort,
  OverflowPolicy,
  Point,
  PortOffsetPolicy,
  PortSide,
  PositionedContainer,
  PositionedNode,
  WidthPolicy
} from "./contracts.js";

export type ElkLayoutOptions = Record<string, string>;

export interface ElkPortLayoutOverride {
  side?: PortSide;
  index?: number;
  layoutOptions?: ElkLayoutOptions;
}

export interface ElkAdaptedEdge {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  sourcePortId?: string;
  targetPortId?: string;
  layoutOptions?: ElkLayoutOptions;
}

export interface ElkLayeredAdapterInput {
  containerId: string;
  direction: LayoutDirection;
  nodeGap: number;
  layerGap: number;
  children: Array<Pick<PositionedNode | PositionedContainer, "id" | "x" | "y" | "width" | "height" | "ports">>;
  edges: ElkAdaptedEdge[];
  rootLayoutOptions?: ElkLayoutOptions;
  nodeLayoutOptions?: Record<string, ElkLayoutOptions>;
  portLayoutOptions?: Record<string, Record<string, ElkPortLayoutOverride>>;
}

export interface ElkLayeredAdapterResult {
  contentWidth: number;
  contentHeight: number;
  childFrames: Map<string, { x: number; y: number; width: number; height: number }>;
  childPositions: Map<string, Point>;
  edgeRoutes: Map<string, Point[]>;
}

export interface ElkFixedPositionRoutingInput extends ElkLayeredAdapterInput {
  positionTolerance?: number;
}

export interface ElkFixedPositionRoutingResult extends ElkLayeredAdapterResult {
  inputGraphSnapshot: unknown;
  outputGraphSnapshot: unknown;
  positionsPreserved: boolean;
}

export interface ElkHierarchicalLayoutInput {
  root: MeasuredContainer;
  edges: MeasuredEdge[];
}

export interface ElkHierarchicalLayoutResult {
  root: PositionedContainer;
  edgeRoutes: Map<string, Point[]>;
}

type ElkLike = {
  layout(graph: ElkNode): Promise<ElkNode>;
};

type MeasuredItemIndex = ReadonlyMap<string, MeasuredItem>;

const elk = new (ElkConstructor as unknown as { new(): ElkLike })();

const ROOT_COORD_LAYOUT_OPTIONS = {
  "org.eclipse.elk.json.shapeCoords": "ROOT",
  "org.eclipse.elk.json.edgeCoords": "ROOT"
} satisfies ElkLayoutOptions;

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function resolveElkDirection(direction: LayoutDirection | undefined): "RIGHT" | "DOWN" {
  return direction === "vertical" ? "DOWN" : "RIGHT";
}

function toElkPortSide(side: PortSide): "NORTH" | "SOUTH" | "EAST" | "WEST" {
  switch (side) {
    case "north":
      return "NORTH";
    case "south":
      return "SOUTH";
    case "east":
      return "EAST";
    case "west":
      return "WEST";
  }
}

function mergeLayoutOptions(...options: Array<ElkLayoutOptions | undefined>): ElkLayoutOptions | undefined {
  const merged = Object.assign({}, ...options.filter((option) => option !== undefined));
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function formatElkPadding(chrome: ChromeSpec): string {
  const top = roundMetric(chrome.padding.top + (chrome.headerBandHeight ?? 0));
  return `[left=${roundMetric(chrome.padding.left)},top=${top},right=${roundMetric(chrome.padding.right)},bottom=${roundMetric(chrome.padding.bottom)}]`;
}

function createElkPort(
  port: MeasuredPort,
  itemId: string,
  override: ElkPortLayoutOverride | undefined
): ElkPort {
  const side = override?.side ?? port.side;
  const layoutOptions = mergeLayoutOptions(
    {
      "org.eclipse.elk.port.side": toElkPortSide(side)
    },
    override?.index === undefined
      ? undefined
      : {
        "org.eclipse.elk.port.index": String(override.index)
      },
    override?.layoutOptions
  );

  return {
    id: `${itemId}:${port.id}`,
    x: roundMetric(port.x - 0.5),
    y: roundMetric(port.y - 0.5),
    width: 1,
    height: 1,
    layoutOptions
  };
}

function createFlatElkNode(
  item: Pick<PositionedNode | PositionedContainer, "id" | "x" | "y" | "width" | "height" | "ports">,
  input: ElkLayeredAdapterInput
): ElkNode {
  const portLayoutOptions = input.portLayoutOptions?.[item.id];
  const layoutOptions = mergeLayoutOptions(
    item.ports.length > 0
      ? {
        "org.eclipse.elk.portConstraints": "FIXED_POS"
      }
      : undefined,
    input.nodeLayoutOptions?.[item.id]
  );

  return {
    id: item.id,
    x: roundMetric(item.x),
    y: roundMetric(item.y),
    width: item.width,
    height: item.height,
    layoutOptions,
    ports: item.ports.map((port, index) => createElkPort(port, item.id, {
      index,
      ...portLayoutOptions?.[port.id]
    }))
  };
}

function collapseRoutePoints(points: Point[]): Point[] {
  const collapsed: Point[] = [];

  for (const point of points) {
    const rounded = {
      x: roundMetric(point.x),
      y: roundMetric(point.y)
    };
    const last = collapsed[collapsed.length - 1];
    if (!last || last.x !== rounded.x || last.y !== rounded.y) {
      collapsed.push(rounded);
    }
  }

  return collapsed;
}

function flattenSectionPoints(sections: ElkEdgeSection[] | undefined): Point[] {
  if (!sections || sections.length === 0) {
    return [];
  }

  const points: Point[] = [];
  for (const section of sections) {
    points.push({
      x: roundMetric(section.startPoint.x),
      y: roundMetric(section.startPoint.y)
    });

    for (const bendPoint of section.bendPoints ?? []) {
      points.push({
        x: roundMetric(bendPoint.x),
        y: roundMetric(bendPoint.y)
      });
    }

    points.push({
      x: roundMetric(section.endPoint.x),
      y: roundMetric(section.endPoint.y)
    });
  }

  return collapseRoutePoints(points);
}

function createFlatElkGraph(
  input: ElkLayeredAdapterInput,
  layoutOptions: ElkLayoutOptions
): ElkNode {
  return {
    id: input.containerId,
    layoutOptions: mergeLayoutOptions(layoutOptions, ROOT_COORD_LAYOUT_OPTIONS, input.rootLayoutOptions),
    children: input.children.map((child) => createFlatElkNode(child, input)),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceItemId,
      target: edge.targetItemId,
      sourcePort: edge.sourcePortId ? `${edge.sourceItemId}:${edge.sourcePortId}` : undefined,
      targetPort: edge.targetPortId ? `${edge.targetItemId}:${edge.targetPortId}` : undefined,
      layoutOptions: edge.layoutOptions
    }))
  } as unknown as ElkNode;
}

function cloneElkGraphSnapshot(graph: ElkNode): unknown {
  return structuredClone(graph);
}

function collectFlatElkLayoutResult(
  input: ElkLayeredAdapterInput,
  laidOut: ElkNode
): ElkLayeredAdapterResult {
  const childFrames = new Map<string, { x: number; y: number; width: number; height: number }>();
  const childPositions = new Map<string, Point>();

  for (const child of input.children) {
    const laidOutChild = laidOut.children?.find((candidate: ElkNode) => candidate.id === child.id);
    if (!laidOutChild || !Number.isFinite(laidOutChild.x) || !Number.isFinite(laidOutChild.y)) {
      throw new Error(`ELK did not return finite coordinates for child "${child.id}".`);
    }
    childFrames.set(child.id, {
      x: roundMetric(laidOutChild.x ?? 0),
      y: roundMetric(laidOutChild.y ?? 0),
      width: roundMetric(laidOutChild.width ?? child.width),
      height: roundMetric(laidOutChild.height ?? child.height)
    });
    childPositions.set(child.id, {
      x: roundMetric(laidOutChild.x ?? 0),
      y: roundMetric(laidOutChild.y ?? 0)
    });
  }

  const edgeRoutes = new Map<string, Point[]>();
  for (const edge of laidOut.edges ?? []) {
    const flattened = flattenSectionPoints(edge.sections);
    if (flattened.length > 0 && edge.id) {
      edgeRoutes.set(edge.id, flattened);
    }
  }

  if (!Number.isFinite(laidOut.width) || !Number.isFinite(laidOut.height)) {
    throw new Error(`ELK returned a non-finite graph size for "${input.containerId}".`);
  }

  return {
    contentWidth: roundMetric(laidOut.width ?? 0),
    contentHeight: roundMetric(laidOut.height ?? 0),
    childFrames,
    childPositions,
    edgeRoutes
  };
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

function cloneMeasuredContentBlock(block: MeasuredContentBlock): MeasuredContentBlock {
  return {
    ...block,
    lines: [...block.lines]
  };
}

function cloneMeasuredPort(port: MeasuredPort): MeasuredPort {
  return {
    id: port.id,
    role: port.role,
    side: port.side,
    offset: port.offset,
    offsetPolicy: port.offsetPolicy,
    x: port.x,
    y: port.y
  };
}

function resolvePortOffset(
  port: MeasuredPort,
  chrome: ChromeSpec | undefined,
  width: number,
  height: number,
  portInset: number
): number {
  if (port.offset !== undefined) {
    return roundMetric(port.offset);
  }

  switch (port.offsetPolicy as PortOffsetPolicy | undefined) {
    case "header_center":
      if (chrome && (port.side === "east" || port.side === "west")) {
        return roundMetric(chrome.padding.top + (chrome.headerBandHeight ?? 0) / 2);
      }
      if (chrome && (port.side === "north" || port.side === "south")) {
        return roundMetric(chrome.padding.left + width / 2);
      }
      break;
    case "content_start":
      if (chrome && (port.side === "east" || port.side === "west")) {
        return roundMetric(chrome.padding.top + (chrome.headerBandHeight ?? 0));
      }
      if (chrome && (port.side === "north" || port.side === "south")) {
        return roundMetric(chrome.padding.left);
      }
      break;
    case "center":
    case undefined:
      break;
  }

  return port.side === "north" || port.side === "south"
    ? roundMetric(width / 2)
    : roundMetric(Math.max(portInset, height / 2));
}

function resolveLocalPortPosition(
  port: MeasuredPort,
  width: number,
  height: number,
  portInset: number,
  chrome?: ChromeSpec
): MeasuredPort {
  const resolvedOffset = resolvePortOffset(port, chrome, width, height, portInset);

  switch (port.side) {
    case "north":
      return {
        ...cloneMeasuredPort(port),
        x: resolvedOffset,
        y: 0
      };
    case "south":
      return {
        ...cloneMeasuredPort(port),
        x: resolvedOffset,
        y: roundMetric(height)
      };
    case "east":
      return {
        ...cloneMeasuredPort(port),
        x: roundMetric(width),
        y: resolvedOffset
      };
    case "west":
      return {
        ...cloneMeasuredPort(port),
        x: 0,
        y: resolvedOffset
      };
  }
}

function buildMeasuredIndex(item: MeasuredItem, index = new Map<string, MeasuredItem>()): Map<string, MeasuredItem> {
  index.set(item.id, item);
  if (item.kind === "container") {
    for (const child of item.children) {
      buildMeasuredIndex(child, index);
    }
  }
  return index;
}

function findMeasuredPortByRole(
  item: Pick<MeasuredItem, "ports">,
  endpoint: Pick<MeasuredEdgeEndpoint, "portId">,
  preferredRole: string | undefined
): MeasuredPort | undefined {
  if (endpoint.portId) {
    return item.ports.find((port) => port.id === endpoint.portId);
  }

  if (!preferredRole) {
    return undefined;
  }

  return item.ports.find((port) => port.role === preferredRole);
}

function createHierarchicalElkPort(port: MeasuredPort, itemId: string, index: number): ElkPort {
  return createElkPort(port, itemId, {
    index
  });
}

function resolveContainerLayoutOptions(container: MeasuredContainer, isRoot: boolean): ElkLayoutOptions {
  const gap = roundMetric(container.layout.gap ?? container.chrome.gutter ?? 12);
  const layeredDefaults: ElkLayoutOptions = container.layout.strategy === "elk_layered"
    ? {
      "org.eclipse.elk.algorithm": "layered",
      "org.eclipse.elk.direction": resolveElkDirection(container.layout.direction),
      "org.eclipse.elk.edgeRouting": "ORTHOGONAL",
      "org.eclipse.elk.padding": formatElkPadding(container.chrome),
      "org.eclipse.elk.spacing.nodeNode": String(gap),
      "org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers": String(gap),
      "org.eclipse.elk.considerModelOrder.strategy": "NODES_AND_EDGES",
      "org.eclipse.elk.layered.crossingMinimization.forceNodeModelOrder": "true",
      "org.eclipse.elk.layered.considerModelOrder.portModelOrder": "true",
      "org.eclipse.elk.layered.mergeEdges": "false",
      "org.eclipse.elk.layered.mergeHierarchyEdges": "false"
    }
    : {
      "org.eclipse.elk.padding": formatElkPadding(container.chrome)
    };

  const hierarchyOptions = container.layout.elk?.hierarchyHandling === "include_children"
    ? {
      "org.eclipse.elk.hierarchyHandling": "INCLUDE_CHILDREN"
    }
    : undefined;

  return mergeLayoutOptions(
    layeredDefaults,
    hierarchyOptions,
    isRoot ? ROOT_COORD_LAYOUT_OPTIONS : undefined,
    container.layout.elk?.layoutOptions
  ) ?? {};
}

function createHierarchicalElkNode(item: MeasuredItem, isRoot = false): ElkNode {
  if (item.kind === "node") {
    const ports = item.ports.map((port, index) => createHierarchicalElkPort(port, item.id, index));
    return {
      id: item.id,
      width: item.width,
      height: item.height,
      layoutOptions: ports.length > 0
        ? {
          "org.eclipse.elk.portConstraints": "FIXED_POS"
        }
        : undefined,
      ...(ports.length > 0 ? { ports } : {})
    } as unknown as ElkNode;
  }

  const ports = item.ports.map((port, index) => createHierarchicalElkPort(port, item.id, index));

  return {
    id: item.id,
    ...(isRoot ? {} : {
      width: item.width,
      height: item.height
    }),
    layoutOptions: resolveContainerLayoutOptions(item, isRoot),
    ...(ports.length > 0 ? { ports } : {}),
    children: item.children.map((child) => createHierarchicalElkNode(child)),
  } as unknown as ElkNode;
}

function createHierarchicalElkGraph(input: ElkHierarchicalLayoutInput): ElkNode {
  const index = buildMeasuredIndex(input.root);

  return {
    ...createHierarchicalElkNode(input.root, true),
    ...(input.edges.length > 0
      ? {
        edges: input.edges.map((edge) => {
          const sourceItem = index.get(edge.from.itemId);
          const targetItem = index.get(edge.to.itemId);
          const sourcePort = sourceItem
            ? findMeasuredPortByRole(sourceItem, edge.from, edge.routing.sourcePortRole)
            : undefined;
          const targetPort = targetItem
            ? findMeasuredPortByRole(targetItem, edge.to, edge.routing.targetPortRole)
            : undefined;

          return {
            id: edge.id,
            sources: [edge.from.itemId],
            targets: [edge.to.itemId],
            sourcePort: sourcePort ? `${edge.from.itemId}:${sourcePort.id}` : undefined,
            targetPort: targetPort ? `${edge.to.itemId}:${targetPort.id}` : undefined,
            layoutOptions: edge.routing.elkLayoutOptions
          };
        })
      }
      : {})
  } as unknown as ElkNode;
}

function collectAbsoluteNodeFrames(
  node: ElkNode,
  frames: Map<string, { x: number; y: number; width: number; height: number }>
): void {
  // Hierarchical ELK runs use ROOT-relative JSON coordinates, so descendants
  // already come back positioned in the root coordinate space.
  const absoluteX = roundMetric(node.x ?? 0);
  const absoluteY = roundMetric(node.y ?? 0);
  const width = roundMetric(node.width ?? 0);
  const height = roundMetric(node.height ?? 0);
  frames.set(node.id, {
    x: absoluteX,
    y: absoluteY,
    width,
    height
  });

  for (const child of node.children ?? []) {
    collectAbsoluteNodeFrames(child as ElkNode, frames);
  }
}

function buildPositionedSubtree(
  item: MeasuredItem,
  frames: ReadonlyMap<string, { x: number; y: number; width: number; height: number }>
): PositionedNode | PositionedContainer {
  const frame = frames.get(item.id);
  if (!frame) {
    throw new Error(`ELK did not return a frame for "${item.id}".`);
  }

  if (item.kind === "node") {
    return {
      kind: "node",
      id: item.id,
      role: item.role,
      primitive: item.primitive,
      classes: [...item.classes],
      viewMetadata: cloneViewMetadata(item.viewMetadata),
      widthPolicy: cloneWidthPolicy(item.widthPolicy),
      widthBand: item.widthBand,
      overflowPolicy: cloneOverflowPolicy(item.overflowPolicy),
      content: item.content.map((block) => cloneMeasuredContentBlock(block)),
      ports: item.ports.map((port) => cloneMeasuredPort(port)),
      overflow: {
        ...item.overflow
      },
      x: frame.x,
      y: frame.y,
      width: frame.width || item.width,
      height: frame.height || item.height,
      fixedSize: item.fixedSize,
      sharedWidthGroup: item.sharedWidthGroup,
      sharedHeightGroup: item.sharedHeightGroup
    };
  }

  return {
    kind: "container",
    id: item.id,
    role: item.role,
    primitive: item.primitive,
    classes: [...item.classes],
    viewMetadata: cloneViewMetadata(item.viewMetadata),
    layout: {
      ...item.layout,
      elk: item.layout.elk
        ? {
          ...item.layout.elk,
          layoutOptions: item.layout.elk.layoutOptions ? { ...item.layout.elk.layoutOptions } : undefined
        }
        : undefined
    },
    chrome: {
      padding: { ...item.chrome.padding },
      gutter: item.chrome.gutter,
      headerBandHeight: item.chrome.headerBandHeight
    },
    headerContent: item.headerContent.map((block) => cloneMeasuredContentBlock(block)),
    children: item.children.map((child) => buildPositionedSubtree(child, frames)),
    ports: item.ports.map((port) => resolveLocalPortPosition(
      port,
      frame.width,
      frame.height,
      8,
      item.chrome
    )),
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    sharedWidthGroup: item.sharedWidthGroup,
    sharedHeightGroup: item.sharedHeightGroup
  };
}

export async function runElkLayeredLayout(input: ElkLayeredAdapterInput): Promise<ElkLayeredAdapterResult> {
  const graph = createFlatElkGraph(input, {
    "org.eclipse.elk.algorithm": "layered",
    "org.eclipse.elk.direction": resolveElkDirection(input.direction),
    "org.eclipse.elk.edgeRouting": "ORTHOGONAL",
    "org.eclipse.elk.padding": "[left=0,top=0,right=0,bottom=0]",
    "org.eclipse.elk.spacing.nodeNode": String(input.nodeGap),
    "org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers": String(input.layerGap)
  });

  const laidOut = await elk.layout(graph as unknown as ElkNode);
  return collectFlatElkLayoutResult(input, laidOut);
}

export async function runElkFixedPositionRouting(
  input: ElkFixedPositionRoutingInput
): Promise<ElkFixedPositionRoutingResult> {
  const graph = createFlatElkGraph(input, {
    "org.eclipse.elk.algorithm": "layered",
    "org.eclipse.elk.direction": resolveElkDirection(input.direction),
    "org.eclipse.elk.edgeRouting": "ORTHOGONAL",
    "org.eclipse.elk.interactive": "true",
    "org.eclipse.elk.separateConnectedComponents": "false",
    "org.eclipse.elk.considerModelOrder.strategy": "NODES_AND_EDGES",
    "org.eclipse.elk.layered.crossingMinimization.forceNodeModelOrder": "true",
    "org.eclipse.elk.layered.considerModelOrder.portModelOrder": "true",
    "org.eclipse.elk.layered.nodePlacement.favorStraightEdges": "true",
    "org.eclipse.elk.layered.layering.strategy": "INTERACTIVE",
    "org.eclipse.elk.layered.cycleBreaking.strategy": "INTERACTIVE",
    "org.eclipse.elk.layered.crossingMinimization.strategy": "INTERACTIVE",
    "org.eclipse.elk.layered.interactiveReferencePoint": "TOP_LEFT",
    "org.eclipse.elk.padding": "[left=0,top=0,right=0,bottom=0]",
    "org.eclipse.elk.spacing.nodeNode": String(input.nodeGap),
    "org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers": String(input.layerGap)
  });
  const inputGraphSnapshot = cloneElkGraphSnapshot(graph);

  const laidOut = await elk.layout(graph as unknown as ElkNode);
  const outputGraphSnapshot = cloneElkGraphSnapshot(laidOut);
  const result = collectFlatElkLayoutResult(input, laidOut);
  const tolerance = input.positionTolerance ?? 0.5;
  const positionsPreserved = input.children.every((child) => {
    const resolved = result.childPositions.get(child.id);
    if (!resolved) {
      return false;
    }

    return Math.abs(resolved.x - child.x) <= tolerance
      && Math.abs(resolved.y - child.y) <= tolerance;
  });

  return {
    ...result,
    inputGraphSnapshot,
    outputGraphSnapshot,
    positionsPreserved
  };
}

export async function runElkLayeredSubtreeLayout(
  input: ElkHierarchicalLayoutInput
): Promise<ElkHierarchicalLayoutResult> {
  const graph = createHierarchicalElkGraph(input);
  const laidOut = await elk.layout(graph as unknown as ElkNode);
  const frames = new Map<string, { x: number; y: number; width: number; height: number }>();
  collectAbsoluteNodeFrames(laidOut, frames);

  const root = buildPositionedSubtree(input.root, frames);
  if (root.kind !== "container") {
    throw new Error("Hierarchical ELK layout must return a container root.");
  }

  const edgeRoutes = new Map<string, Point[]>();
  for (const edge of laidOut.edges ?? []) {
    const flattened = flattenSectionPoints(edge.sections);
    if (flattened.length > 0 && edge.id) {
      edgeRoutes.set(edge.id, flattened);
    }
  }

  return {
    root,
    edgeRoutes
  };
}
