import ElkConstructor, { type ElkEdgeSection, type ElkNode, type ElkPort } from "elkjs/lib/main.js";
import type {
  LayoutDirection,
  MeasuredPort,
  Point,
  PortSide,
  PositionedItem
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
  children: PositionedItem[];
  edges: ElkAdaptedEdge[];
  rootLayoutOptions?: ElkLayoutOptions;
  nodeLayoutOptions?: Record<string, ElkLayoutOptions>;
  portLayoutOptions?: Record<string, Record<string, ElkPortLayoutOverride>>;
}

export interface ElkLayeredAdapterResult {
  contentWidth: number;
  contentHeight: number;
  childPositions: Map<string, Point>;
  edgeRoutes: Map<string, Point[]>;
}

export interface ElkFixedPositionRoutingInput extends ElkLayeredAdapterInput {
  positionTolerance?: number;
}

export interface ElkFixedPositionRoutingResult extends ElkLayeredAdapterResult {
  positionsPreserved: boolean;
}

type ElkLike = {
  layout(graph: ElkNode): Promise<ElkNode>;
};

const elk = new (ElkConstructor as unknown as { new(): ElkLike })();

const ROOT_COORD_LAYOUT_OPTIONS = {
  "org.eclipse.elk.json.shapeCoords": "ROOT",
  "org.eclipse.elk.json.edgeCoords": "ROOT"
} satisfies ElkLayoutOptions;

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function resolveElkDirection(direction: LayoutDirection): "RIGHT" | "DOWN" {
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

  throw new Error(`Unsupported ELK port side "${String(side)}".`);
}

function mergeLayoutOptions(...options: Array<ElkLayoutOptions | undefined>): ElkLayoutOptions | undefined {
  const merged = Object.assign({}, ...options.filter((option) => option !== undefined));
  return Object.keys(merged).length > 0 ? merged : undefined;
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

function createElkNode(
  item: PositionedItem,
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
    ports: item.ports.map((port) => createElkPort(port, item.id, portLayoutOptions?.[port.id]))
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

function createElkGraph(
  input: ElkLayeredAdapterInput,
  layoutOptions: ElkLayoutOptions
): ElkNode {
  return {
    id: input.containerId,
    layoutOptions: mergeLayoutOptions(layoutOptions, ROOT_COORD_LAYOUT_OPTIONS, input.rootLayoutOptions),
    children: input.children.map((child) => createElkNode(child, input)),
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

function collectElkLayoutResult(
  input: ElkLayeredAdapterInput,
  laidOut: ElkNode
): ElkLayeredAdapterResult {
  const childPositions = new Map<string, Point>();

  for (const child of input.children) {
    const laidOutChild = laidOut.children?.find((candidate: ElkNode) => candidate.id === child.id);
    if (!laidOutChild || !Number.isFinite(laidOutChild.x) || !Number.isFinite(laidOutChild.y)) {
      throw new Error(`ELK did not return finite coordinates for child "${child.id}".`);
    }
    const childX = laidOutChild.x ?? 0;
    const childY = laidOutChild.y ?? 0;

    childPositions.set(child.id, {
      x: roundMetric(childX),
      y: roundMetric(childY)
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
  const contentWidth = laidOut.width ?? 0;
  const contentHeight = laidOut.height ?? 0;

  return {
    contentWidth: roundMetric(contentWidth),
    contentHeight: roundMetric(contentHeight),
    childPositions,
    edgeRoutes
  };
}

export async function runElkLayeredLayout(input: ElkLayeredAdapterInput): Promise<ElkLayeredAdapterResult> {
  const graph = createElkGraph(input, {
    "org.eclipse.elk.algorithm": "layered",
    "org.eclipse.elk.direction": resolveElkDirection(input.direction),
    "org.eclipse.elk.edgeRouting": "ORTHOGONAL",
    "org.eclipse.elk.padding": "[left=0,top=0,right=0,bottom=0]",
    "org.eclipse.elk.spacing.nodeNode": String(input.nodeGap),
    "org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers": String(input.layerGap)
  });

  const laidOut = await elk.layout(graph as unknown as ElkNode);
  return collectElkLayoutResult(input, laidOut);
}

export async function runElkFixedPositionRouting(
  input: ElkFixedPositionRoutingInput
): Promise<ElkFixedPositionRoutingResult> {
  const graph = createElkGraph(input, {
    "org.eclipse.elk.algorithm": "layered",
    "org.eclipse.elk.direction": resolveElkDirection(input.direction),
    "org.eclipse.elk.edgeRouting": "ORTHOGONAL",
    "org.eclipse.elk.interactive": "true",
    "org.eclipse.elk.padding": "[left=0,top=0,right=0,bottom=0]",
    "org.eclipse.elk.spacing.nodeNode": String(input.nodeGap),
    "org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers": String(input.layerGap)
  });

  const laidOut = await elk.layout(graph as unknown as ElkNode);
  const result = collectElkLayoutResult(input, laidOut);
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
    positionsPreserved
  };
}
