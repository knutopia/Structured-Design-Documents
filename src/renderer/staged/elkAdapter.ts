import ElkConstructor, { type ElkEdgeSection, type ElkNode, type ElkPort } from "elkjs/lib/main.js";
import type {
  LayoutDirection,
  MeasuredPort,
  Point,
  PositionedItem
} from "./contracts.js";

export interface ElkAdaptedEdge {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  sourcePortId?: string;
  targetPortId?: string;
}

export interface ElkLayeredAdapterInput {
  containerId: string;
  direction: LayoutDirection;
  gap: number;
  children: PositionedItem[];
  edges: ElkAdaptedEdge[];
}

export interface ElkLayeredAdapterResult {
  contentWidth: number;
  contentHeight: number;
  childPositions: Map<string, Point>;
  edgeRoutes: Map<string, Point[]>;
}

type ElkLike = {
  layout(graph: ElkNode): Promise<ElkNode>;
};

const elk = new (ElkConstructor as unknown as { new(): ElkLike })();

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function resolveElkDirection(direction: LayoutDirection): "RIGHT" | "DOWN" {
  return direction === "vertical" ? "DOWN" : "RIGHT";
}

function toElkPortSide(side: MeasuredPort["side"]): "NORTH" | "SOUTH" | "EAST" | "WEST" {
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

function createElkPort(port: MeasuredPort, itemId: string): ElkPort {
  return {
    id: `${itemId}:${port.id}`,
    x: roundMetric(port.x - 0.5),
    y: roundMetric(port.y - 0.5),
    width: 1,
    height: 1,
    layoutOptions: {
      "elk.port.side": toElkPortSide(port.side)
    }
  };
}

function createElkNode(item: PositionedItem): ElkNode {
  return {
    id: item.id,
    width: item.width,
    height: item.height,
    layoutOptions: item.ports.length > 0
      ? {
        "elk.portConstraints": "FIXED_POS"
      }
      : undefined,
    ports: item.ports.map((port) => createElkPort(port, item.id))
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

export async function runElkLayeredLayout(input: ElkLayeredAdapterInput): Promise<ElkLayeredAdapterResult> {
  const graph = {
    id: input.containerId,
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": resolveElkDirection(input.direction),
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.padding": "[left=0,top=0,right=0,bottom=0]",
      "elk.spacing.nodeNode": String(input.gap),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(input.gap)
    },
    children: input.children.map((child) => createElkNode(child)),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceItemId,
      target: edge.targetItemId,
      sourcePort: edge.sourcePortId ? `${edge.sourceItemId}:${edge.sourcePortId}` : undefined,
      targetPort: edge.targetPortId ? `${edge.targetItemId}:${edge.targetPortId}` : undefined
    }))
  };

  const laidOut = await elk.layout(graph as unknown as ElkNode);
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
