import type {
  ChromeSpec,
  EdgeMarkers,
  LayoutDirection,
  LayoutIntent,
  LayoutStrategy,
  MeasuredContainer,
  MeasuredEdge,
  MeasuredEdgeEndpoint,
  MeasuredItem,
  MeasuredNode,
  MeasuredPort,
  MeasuredScene,
  OverflowPolicy,
  Point,
  PositionedContainer,
  PositionedEdge,
  PositionedEdgeEndpoint,
  PositionedEdgeLabel,
  PositionedItem,
  PositionedNode,
  PositionedRoute,
  PositionedScene,
  WidthPolicy
} from "./contracts.js";
import { sortRendererDiagnostics, type RendererDiagnostic } from "./diagnostics.js";
import { getContainerPrimitiveTheme } from "./primitives.js";
import { getRendererTheme, type RendererTheme } from "./theme.js";

interface LayoutContext {
  theme: RendererTheme;
  diagnostics: RendererDiagnostic[];
  strategyRegistry: ReadonlyMap<LayoutStrategy, LayoutStrategyHandler>;
}

interface ContainerLayoutResult {
  contentWidth: number;
  contentHeight: number;
}

type LayoutStrategyHandler = (
  container: MeasuredContainer,
  children: PositionedItem[],
  context: LayoutContext
) => ContainerLayoutResult;

interface IndexedPositionedItem {
  item: PositionedItem;
  portsById: Map<string, MeasuredPort>;
}

const DEFERRED_CONTAINER_PORT_DIAGNOSTIC = "renderer.measure.container_ports_deferred";
const PAINT_ORDER: PositionedScene["paintOrder"] = ["chrome", "nodes", "labels", "edges", "edge_labels"];

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function cloneLayoutIntent(layout: LayoutIntent): LayoutIntent {
  return {
    ...layout
  };
}

function cloneChromeSpec(chrome: ChromeSpec): ChromeSpec {
  return {
    padding: { ...chrome.padding },
    gutter: chrome.gutter,
    headerBandHeight: chrome.headerBandHeight
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

function cloneEdgeMarkers(markers: EdgeMarkers | undefined): EdgeMarkers | undefined {
  if (!markers) {
    return undefined;
  }

  return {
    start: markers.start,
    end: markers.end
  };
}

function cloneMeasuredPort(port: MeasuredPort): MeasuredPort {
  return {
    id: port.id,
    role: port.role,
    side: port.side,
    offset: port.offset,
    x: port.x,
    y: port.y
  };
}

function clonePositionedNode(node: MeasuredNode): PositionedNode {
  return {
    kind: "node",
    id: node.id,
    role: node.role,
    primitive: node.primitive,
    classes: [...node.classes],
    widthPolicy: cloneWidthPolicy(node.widthPolicy),
    widthBand: node.widthBand,
    overflowPolicy: cloneOverflowPolicy(node.overflowPolicy),
    content: node.content.map((block) => ({
      ...block,
      lines: [...block.lines]
    })),
    ports: node.ports.map((port) => cloneMeasuredPort(port)),
    overflow: {
      ...node.overflow
    },
    x: 0,
    y: 0,
    width: node.width,
    height: node.height
  };
}

function getContentOrigin(chrome: ChromeSpec): Point {
  return {
    x: chrome.padding.left,
    y: chrome.padding.top + (chrome.headerBandHeight ?? 0)
  };
}

function getMainSize(item: PositionedItem, direction: LayoutDirection): number {
  return direction === "horizontal" ? item.width : item.height;
}

function getCrossSize(item: PositionedItem, direction: LayoutDirection): number {
  return direction === "horizontal" ? item.height : item.width;
}

function resolveGap(container: Pick<MeasuredContainer, "layout" | "chrome">): number {
  return roundMetric(container.layout.gap ?? container.chrome.gutter ?? 0);
}

function createLayoutDiagnostic(code: string, message: string, targetId: string): RendererDiagnostic {
  return {
    phase: "layout",
    code,
    severity: "warn",
    message,
    targetId
  };
}

function createRoutingDiagnostic(code: string, message: string, targetId: string, severity: "error" | "warn" | "info" = "warn"): RendererDiagnostic {
  return {
    phase: "routing",
    code,
    severity,
    message,
    targetId
  };
}

function resolveLocalPortPosition(port: MeasuredPort, width: number, height: number, portInset: number): MeasuredPort {
  switch (port.side) {
    case "north":
      return {
        ...cloneMeasuredPort(port),
        x: roundMetric(port.offset ?? width / 2),
        y: 0
      };
    case "south":
      return {
        ...cloneMeasuredPort(port),
        x: roundMetric(port.offset ?? width / 2),
        y: roundMetric(height)
      };
    case "east":
      return {
        ...cloneMeasuredPort(port),
        x: roundMetric(width),
        y: roundMetric(port.offset ?? Math.max(portInset, height / 2))
      };
    case "west":
      return {
        ...cloneMeasuredPort(port),
        x: 0,
        y: roundMetric(port.offset ?? Math.max(portInset, height / 2))
      };
  }
}

function resolveContainerPorts(container: PositionedContainer, theme: RendererTheme): MeasuredPort[] {
  const primitiveTheme = getContainerPrimitiveTheme(theme, container.primitive);
  return container.ports.map((port) => resolveLocalPortPosition(port, container.width, container.height, primitiveTheme.portInset));
}

function resizeContainerCrossAxis(
  item: PositionedItem,
  direction: LayoutDirection,
  newCrossSize: number,
  context: LayoutContext
): void {
  if (item.kind !== "container") {
    return;
  }

  if (direction === "horizontal") {
    item.height = roundMetric(newCrossSize);
  } else {
    item.width = roundMetric(newCrossSize);
  }
  item.ports = resolveContainerPorts(item, context.theme);
}

function resizeContainerToCell(
  item: PositionedItem,
  width: number,
  height: number,
  context: LayoutContext
): void {
  if (item.kind !== "container") {
    return;
  }

  item.width = roundMetric(width);
  item.height = roundMetric(height);
  item.ports = resolveContainerPorts(item, context.theme);
}

function offsetPositionedItem(item: PositionedItem, dx: number, dy: number): void {
  item.x = roundMetric(item.x + dx);
  item.y = roundMetric(item.y + dy);

  if (item.kind === "container") {
    for (const child of item.children) {
      offsetPositionedItem(child, dx, dy);
    }
  }
}

function layoutLinearContainer(
  container: MeasuredContainer,
  children: PositionedItem[],
  context: LayoutContext,
  options: { defaultDirection: LayoutDirection; alwaysStretchContainers: boolean }
): ContainerLayoutResult {
  const direction = container.layout.direction ?? options.defaultDirection;
  const gap = resolveGap(container);
  const crossAlignment = container.layout.crossAlignment ?? "start";

  if (children.length === 0) {
    return {
      contentWidth: 0,
      contentHeight: 0
    };
  }

  const stretchContainers = options.alwaysStretchContainers || crossAlignment === "stretch";
  const maxCross = roundMetric(
    children.reduce((largest, child) => Math.max(largest, getCrossSize(child, direction)), 0)
  );

  let mainOffset = 0;
  let maxResolvedCross = 0;

  for (const child of children) {
    if (stretchContainers && child.kind === "container") {
      resizeContainerCrossAxis(child, direction, maxCross, context);
    }

    const childMain = getMainSize(child, direction);
    const childCross = getCrossSize(child, direction);
    const crossOffset = crossAlignment === "center"
      ? roundMetric((maxCross - childCross) / 2)
      : 0;

    if (direction === "horizontal") {
      child.x = roundMetric(mainOffset);
      child.y = roundMetric(crossOffset);
    } else {
      child.x = roundMetric(crossOffset);
      child.y = roundMetric(mainOffset);
    }

    mainOffset += childMain + gap;
    maxResolvedCross = Math.max(maxResolvedCross, childCross);
  }

  const mainSize = roundMetric(mainOffset - gap);
  const crossSize = roundMetric(maxResolvedCross);

  return direction === "horizontal"
    ? {
      contentWidth: mainSize,
      contentHeight: crossSize
    }
    : {
      contentWidth: crossSize,
      contentHeight: mainSize
    };
}

function layoutStackContainer(
  container: MeasuredContainer,
  children: PositionedItem[],
  context: LayoutContext
): ContainerLayoutResult {
  return layoutLinearContainer(container, children, context, {
    defaultDirection: "vertical",
    alwaysStretchContainers: false
  });
}

function layoutLanesContainer(
  container: MeasuredContainer,
  children: PositionedItem[],
  context: LayoutContext
): ContainerLayoutResult {
  return layoutLinearContainer(container, children, context, {
    defaultDirection: "vertical",
    alwaysStretchContainers: true
  });
}

function layoutGridContainer(
  container: MeasuredContainer,
  children: PositionedItem[],
  context: LayoutContext
): ContainerLayoutResult {
  if (children.length === 0) {
    return {
      contentWidth: 0,
      contentHeight: 0
    };
  }

  let columns = container.layout.columns;
  if (!Number.isInteger(columns) || (columns ?? 0) < 1) {
    context.diagnostics.push(
      createLayoutDiagnostic(
        "renderer.layout.invalid_grid_columns",
        `Grid containers require layout.columns >= 1. Falling back to a single-column grid.`,
        container.id
      )
    );
    columns = 1;
  }

  const columnCount = Math.min(columns ?? 1, children.length);
  const rowCount = Math.ceil(children.length / columnCount);
  const gap = resolveGap(container);
  const crossAlignment = container.layout.crossAlignment ?? "start";
  const columnWidths = Array.from({ length: columnCount }, () => 0);
  const rowHeights = Array.from({ length: rowCount }, () => 0);

  children.forEach((child, index) => {
    const row = Math.floor(index / columnCount);
    const column = index % columnCount;
    columnWidths[column] = Math.max(columnWidths[column], child.width);
    rowHeights[row] = Math.max(rowHeights[row], child.height);
  });

  const columnOffsets = columnWidths.map((_, column) =>
    roundMetric(columnWidths.slice(0, column).reduce((sum, value) => sum + value, 0) + gap * column)
  );
  const rowOffsets = rowHeights.map((_, row) =>
    roundMetric(rowHeights.slice(0, row).reduce((sum, value) => sum + value, 0) + gap * row)
  );

  children.forEach((child, index) => {
    const row = Math.floor(index / columnCount);
    const column = index % columnCount;
    const cellWidth = columnWidths[column];
    const cellHeight = rowHeights[row];

    if (crossAlignment === "stretch" && child.kind === "container") {
      resizeContainerToCell(child, cellWidth, cellHeight, context);
    }

    const xOffset = crossAlignment === "center"
      ? roundMetric((cellWidth - child.width) / 2)
      : 0;
    const yOffset = crossAlignment === "center"
      ? roundMetric((cellHeight - child.height) / 2)
      : 0;

    child.x = roundMetric(columnOffsets[column] + xOffset);
    child.y = roundMetric(rowOffsets[row] + yOffset);
  });

  return {
    contentWidth: roundMetric(columnWidths.reduce((sum, value) => sum + value, 0) + gap * Math.max(columnCount - 1, 0)),
    contentHeight: roundMetric(rowHeights.reduce((sum, value) => sum + value, 0) + gap * Math.max(rowCount - 1, 0))
  };
}

const strategyRegistry: ReadonlyMap<LayoutStrategy, LayoutStrategyHandler> = new Map([
  ["stack", layoutStackContainer],
  ["grid", layoutGridContainer],
  ["lanes", layoutLanesContainer]
]);

function layoutItem(item: MeasuredItem, context: LayoutContext): PositionedItem {
  if (item.kind === "node") {
    return clonePositionedNode(item);
  }

  return layoutContainer(item, context);
}

function resolveLayoutHandler(container: MeasuredContainer, context: LayoutContext): LayoutStrategyHandler {
  const handler = context.strategyRegistry.get(container.layout.strategy);
  if (handler) {
    return handler;
  }

  context.diagnostics.push(
    createLayoutDiagnostic(
      "renderer.layout.strategy_fallback",
      `Layout strategy "${container.layout.strategy}" is not implemented in Step 5. Falling back to "stack".`,
      container.id
    )
  );
  return layoutStackContainer;
}

function layoutContainer(container: MeasuredContainer, context: LayoutContext): PositionedContainer {
  const positionedChildren = container.children.map((child) => layoutItem(child, context));
  const chrome = cloneChromeSpec(container.chrome);
  const contentOrigin = getContentOrigin(chrome);
  const handler = resolveLayoutHandler(container, context);
  let layout = handler(container, positionedChildren, context);

  if (handler !== layoutStackContainer && layout.contentWidth < 0) {
    context.diagnostics.push(
      createLayoutDiagnostic(
        "renderer.layout.strategy_failure",
        `Layout strategy "${container.layout.strategy}" produced an invalid width. Falling back to "stack".`,
        container.id
      )
    );
    layout = layoutStackContainer(container, positionedChildren, context);
  }

  for (const child of positionedChildren) {
    offsetPositionedItem(child, contentOrigin.x, contentOrigin.y);
  }

  const width = roundMetric(chrome.padding.left + layout.contentWidth + chrome.padding.right);
  const height = roundMetric(chrome.padding.top + (chrome.headerBandHeight ?? 0) + layout.contentHeight + chrome.padding.bottom);
  const positioned: PositionedContainer = {
    kind: "container",
    id: container.id,
    role: container.role,
    primitive: container.primitive,
    classes: [...container.classes],
    layout: cloneLayoutIntent(container.layout),
    chrome,
    children: positionedChildren,
    ports: container.ports.map((port) => cloneMeasuredPort(port)),
    x: 0,
    y: 0,
    width,
    height
  };

  positioned.ports = resolveContainerPorts(positioned, context.theme);
  return positioned;
}

function buildPositionedIndex(container: PositionedContainer, index = new Map<string, IndexedPositionedItem>()): Map<string, IndexedPositionedItem> {
  index.set(container.id, {
    item: container,
    portsById: new Map(container.ports.map((port) => [port.id, port]))
  });

  for (const child of container.children) {
    if (child.kind === "container") {
      buildPositionedIndex(child, index);
      continue;
    }

    index.set(child.id, {
      item: child,
      portsById: new Map(child.ports.map((port) => [port.id, port]))
    });
  }

  return index;
}

function getItemCenter(item: PositionedItem): Point {
  return {
    x: roundMetric(item.x + item.width / 2),
    y: roundMetric(item.y + item.height / 2)
  };
}

function getPortAbsolutePoint(item: PositionedItem, port: MeasuredPort): Point {
  return {
    x: roundMetric(item.x + port.x),
    y: roundMetric(item.y + port.y)
  };
}

function chooseFallbackSide(item: PositionedItem, oppositeItem: PositionedItem | undefined, preferAxis: MeasuredEdge["routing"]["preferAxis"]): MeasuredPort["side"] {
  if (!oppositeItem) {
    if (preferAxis === "vertical") {
      return "south";
    }
    return "east";
  }

  const itemCenter = getItemCenter(item);
  const oppositeCenter = getItemCenter(oppositeItem);
  const dx = oppositeCenter.x - itemCenter.x;
  const dy = oppositeCenter.y - itemCenter.y;

  if (preferAxis === "horizontal" || (preferAxis === undefined && Math.abs(dx) >= Math.abs(dy))) {
    return dx >= 0 ? "east" : "west";
  }

  return dy >= 0 ? "south" : "north";
}

function getFallbackAnchor(item: PositionedItem, side: MeasuredPort["side"]): Point {
  switch (side) {
    case "north":
      return {
        x: roundMetric(item.x + item.width / 2),
        y: roundMetric(item.y)
      };
    case "south":
      return {
        x: roundMetric(item.x + item.width / 2),
        y: roundMetric(item.y + item.height)
      };
    case "east":
      return {
        x: roundMetric(item.x + item.width),
        y: roundMetric(item.y + item.height / 2)
      };
    case "west":
      return {
        x: roundMetric(item.x),
        y: roundMetric(item.y + item.height / 2)
      };
  }
}

function findPortByRole(item: PositionedItem, role: string): MeasuredPort | undefined {
  return item.ports.find((port) => port.role === role);
}

function resolveEndpointPort(
  endpoint: MeasuredEdgeEndpoint,
  preferredRole: string | undefined,
  edgeId: string,
  indexedItem: IndexedPositionedItem,
  oppositeItem: PositionedItem | undefined,
  preferAxis: MeasuredEdge["routing"]["preferAxis"],
  diagnostics: RendererDiagnostic[]
): PositionedEdgeEndpoint {
  if (endpoint.portId) {
    const explicitPort = indexedItem.portsById.get(endpoint.portId);
    if (explicitPort) {
      const point = getPortAbsolutePoint(indexedItem.item, explicitPort);
      return {
        itemId: endpoint.itemId,
        portId: explicitPort.id,
        x: point.x,
        y: point.y
      };
    }

    diagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.unresolved_port",
        `Could not resolve port "${endpoint.portId}" on item "${endpoint.itemId}". Falling back to another anchor.`,
        edgeId
      )
    );
  }

  if (preferredRole) {
    const rolePort = findPortByRole(indexedItem.item, preferredRole);
    if (rolePort) {
      const point = getPortAbsolutePoint(indexedItem.item, rolePort);
      return {
        itemId: endpoint.itemId,
        portId: rolePort.id,
        x: point.x,
        y: point.y
      };
    }

    diagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.unresolved_port_role",
        `Could not resolve port role "${preferredRole}" on item "${endpoint.itemId}". Falling back to a box anchor.`,
        edgeId,
        "info"
      )
    );
  }

  const side = chooseFallbackSide(indexedItem.item, oppositeItem, preferAxis);
  const point = getFallbackAnchor(indexedItem.item, side);
  return {
    itemId: endpoint.itemId,
    portId: undefined,
    x: point.x,
    y: point.y
  };
}

function resolveEdgeEndpoint(
  endpoint: MeasuredEdgeEndpoint,
  preferredRole: string | undefined,
  edgeId: string,
  index: Map<string, IndexedPositionedItem>,
  oppositeItem: PositionedItem | undefined,
  preferAxis: MeasuredEdge["routing"]["preferAxis"],
  diagnostics: RendererDiagnostic[]
): PositionedEdgeEndpoint {
  const indexedItem = index.get(endpoint.itemId);
  if (!indexedItem) {
    diagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.unresolved_item",
        `Could not resolve routed item "${endpoint.itemId}". Falling back to the scene origin.`,
        edgeId,
        "error"
      )
    );
    return {
      itemId: endpoint.itemId,
      portId: endpoint.portId,
      x: 0,
      y: 0
    };
  }

  return resolveEndpointPort(
    endpoint,
    preferredRole,
    edgeId,
    indexedItem,
    oppositeItem,
    preferAxis,
    diagnostics
  );
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

  if (collapsed.length === 1) {
    collapsed.push({
      ...collapsed[0]
    });
  }

  return collapsed;
}

function buildEdgeRoutePoints(edge: MeasuredEdge, from: Point, to: Point): Point[] {
  if (edge.routing.style === "straight") {
    return [from, to];
  }

  const preferAxis = edge.routing.preferAxis
    ?? (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? "horizontal" : "vertical");

  if (edge.routing.style === "stepped") {
    return preferAxis === "horizontal"
      ? [from, { x: to.x, y: from.y }, to]
      : [from, { x: from.x, y: to.y }, to];
  }

  const midpoint = preferAxis === "horizontal"
    ? roundMetric((from.x + to.x) / 2)
    : roundMetric((from.y + to.y) / 2);

  return preferAxis === "horizontal"
    ? [from, { x: midpoint, y: from.y }, { x: midpoint, y: to.y }, to]
    : [from, { x: from.x, y: midpoint }, { x: to.x, y: midpoint }, to];
}

function buildRoute(edge: MeasuredEdge, from: PositionedEdgeEndpoint, to: PositionedEdgeEndpoint): PositionedRoute {
  return {
    style: edge.routing.style,
    points: collapseRoutePoints(
      buildEdgeRoutePoints(edge, { x: from.x, y: from.y }, { x: to.x, y: to.y })
    )
  };
}

function getPolylineLength(points: Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    total += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return total;
}

function getPointAtDistance(points: Point[], distance: number): Point {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const segment = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (segment === 0) {
      continue;
    }
    if (traversed + segment >= distance) {
      const ratio = (distance - traversed) / segment;
      return {
        x: roundMetric(previous.x + (current.x - previous.x) * ratio),
        y: roundMetric(previous.y + (current.y - previous.y) * ratio)
      };
    }
    traversed += segment;
  }

  return {
    ...points[points.length - 1]
  };
}

function positionEdgeLabel(label: NonNullable<MeasuredEdge["label"]>, route: PositionedRoute): PositionedEdgeLabel {
  const totalLength = getPolylineLength(route.points);
  const midpoint = getPointAtDistance(route.points, totalLength / 2);

  return {
    lines: [...label.lines],
    width: label.width,
    height: label.height,
    lineHeight: label.lineHeight,
    textStyleRole: label.textStyleRole,
    x: roundMetric(midpoint.x - label.width / 2),
    y: roundMetric(midpoint.y - label.height / 2)
  };
}

function positionMeasuredEdge(
  edge: MeasuredEdge,
  index: Map<string, IndexedPositionedItem>,
  diagnostics: RendererDiagnostic[]
): PositionedEdge {
  const sourceItem = index.get(edge.from.itemId)?.item;
  const targetItem = index.get(edge.to.itemId)?.item;
  const from = resolveEdgeEndpoint(
    edge.from,
    edge.routing.sourcePortRole,
    edge.id,
    index,
    targetItem,
    edge.routing.preferAxis,
    diagnostics
  );
  const to = resolveEdgeEndpoint(
    edge.to,
    edge.routing.targetPortRole,
    edge.id,
    index,
    sourceItem,
    edge.routing.preferAxis,
    diagnostics
  );

  if (edge.routing.avoidNodeBoxes) {
    diagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.preference_fallback",
        `Edge "${edge.id}" requested avoidNodeBoxes, but Step 5 currently applies simple deterministic routing only.`,
        edge.id,
        "info"
      )
    );
  }

  const route = buildRoute(edge, from, to);
  return {
    id: edge.id,
    role: edge.role,
    classes: [...edge.classes],
    from,
    to,
    route,
    label: edge.label ? positionEdgeLabel(edge.label, route) : undefined,
    markers: cloneEdgeMarkers(edge.markers),
    paintGroup: "edges"
  };
}

export function positionMeasuredScene(measuredScene: MeasuredScene): PositionedScene {
  const diagnostics = measuredScene.diagnostics.filter((diagnostic) => diagnostic.code !== DEFERRED_CONTAINER_PORT_DIAGNOSTIC);
  const context: LayoutContext = {
    theme: getRendererTheme(measuredScene.themeId, "layout"),
    diagnostics: [...diagnostics],
    strategyRegistry
  };
  const root = layoutContainer(measuredScene.root, context);
  const index = buildPositionedIndex(root);
  const edges = measuredScene.edges.map((edge) => positionMeasuredEdge(edge, index, context.diagnostics));

  return {
    viewId: measuredScene.viewId,
    profileId: measuredScene.profileId,
    themeId: measuredScene.themeId,
    root,
    edges,
    diagnostics: sortRendererDiagnostics(context.diagnostics),
    paintOrder: [...PAINT_ORDER]
  };
}
