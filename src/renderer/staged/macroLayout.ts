import type {
  ChromeSpec,
  EdgeMarkers,
  LayoutDirection,
  LayoutIntent,
  MeasuredContentBlock,
  LayoutStrategy,
  MeasuredContainer,
  MeasuredEdge,
  MeasuredItem,
  MeasuredNode,
  MeasuredPort,
  MeasuredScene,
  OverflowPolicy,
  Point,
  PositionedContainer,
  PositionedEdge,
  PositionedItem,
  PositionedNode,
  PositionedScene,
  WidthPolicy
} from "./contracts.js";
import { sortRendererDiagnostics, type RendererDiagnostic } from "./diagnostics.js";
import { runElkLayeredLayout, type ElkAdaptedEdge } from "./elkAdapter.js";
import { getContainerPrimitiveTheme } from "./primitives.js";
import {
  buildPositionedIndex,
  buildRouteFromLocalHint,
  buildSharedRoute,
  createRoutingDiagnostic,
  type IndexedPositionedItem,
  positionEdgeLabel,
  resolveEdgeEndpoint,
  resolvePortOnItem
} from "./routing.js";
import { getRendererTheme, type RendererTheme } from "./theme.js";

interface LayoutContext {
  theme: RendererTheme;
  diagnostics: RendererDiagnostic[];
  strategyRegistry: ReadonlyMap<LayoutStrategy, LayoutStrategyHandler>;
}

interface ContainerLayoutResult {
  contentWidth: number;
  contentHeight: number;
  routeHints?: Map<string, Point[]>;
}

interface LayoutItemResult {
  item: PositionedItem;
  routeHints: Map<string, Point[]>;
}

interface MeasuredItemIndexEntry {
  item: MeasuredItem;
  parentContainerId?: string;
  ancestorContainerIds: string[];
}

type LayoutStrategyHandler = (
  container: MeasuredContainer,
  children: PositionedItem[],
  ownedEdges: MeasuredEdge[],
  context: LayoutContext
) => Promise<ContainerLayoutResult>;

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
    offsetPolicy: port.offsetPolicy,
    x: port.x,
    y: port.y
  };
}

function cloneMeasuredContentBlock(block: MeasuredContentBlock): MeasuredContentBlock {
  return {
    ...block,
    lines: [...block.lines]
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
    content: node.content.map((block) => cloneMeasuredContentBlock(block)),
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

function resolveContainerHeaderWidth(headerContent: MeasuredContentBlock[], chrome: ChromeSpec): number {
  if (headerContent.length === 0) {
    return 0;
  }

  const maxRight = Math.max(...headerContent.map((block) => block.x + block.width));
  return roundMetric(maxRight + chrome.padding.right);
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

  switch (port.offsetPolicy) {
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

function resolveContainerPorts(container: PositionedContainer, theme: RendererTheme): MeasuredPort[] {
  const primitiveTheme = getContainerPrimitiveTheme(theme, container.primitive);
  return container.ports.map((port) =>
    resolveLocalPortPosition(port, container.width, container.height, primitiveTheme.portInset, container.chrome)
  );
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

function translatePositionedSubtree(item: PositionedItem, dx: number, dy: number): void {
  item.x = roundMetric(item.x + dx);
  item.y = roundMetric(item.y + dy);

  if (item.kind === "container") {
    for (const child of item.children) {
      translatePositionedSubtree(child, dx, dy);
    }
  }
}

function offsetPositionedItem(item: PositionedItem, dx: number, dy: number): void {
  const originalX = item.x;
  const originalY = item.y;
  item.x = roundMetric(item.x + dx);
  item.y = roundMetric(item.y + dy);

  if (item.kind === "container") {
    const childDx = roundMetric(dx + originalX);
    const childDy = roundMetric(dy + originalY);
    for (const child of item.children) {
      translatePositionedSubtree(child, childDx, childDy);
    }
  }
}

function offsetLocalRouteHints(routeHints: Map<string, Point[]>, dx: number, dy: number): Map<string, Point[]> {
  const shifted = new Map<string, Point[]>();

  for (const [edgeId, points] of routeHints.entries()) {
    shifted.set(
      edgeId,
      points.map((point) => ({
        x: roundMetric(point.x + dx),
        y: roundMetric(point.y + dy)
      }))
    );
  }

  return shifted;
}

function mergeRouteHints(target: Map<string, Point[]>, source: Map<string, Point[]>): void {
  for (const [edgeId, points] of source.entries()) {
    target.set(edgeId, points.map((point) => ({ ...point })));
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

async function layoutStackContainer(
  container: MeasuredContainer,
  children: PositionedItem[],
  _ownedEdges: MeasuredEdge[],
  context: LayoutContext
): Promise<ContainerLayoutResult> {
  return layoutLinearContainer(container, children, context, {
    defaultDirection: "vertical",
    alwaysStretchContainers: false
  });
}

async function layoutLanesContainer(
  container: MeasuredContainer,
  children: PositionedItem[],
  _ownedEdges: MeasuredEdge[],
  context: LayoutContext
): Promise<ContainerLayoutResult> {
  return layoutLinearContainer(container, children, context, {
    defaultDirection: "vertical",
    alwaysStretchContainers: true
  });
}

async function layoutGridContainer(
  container: MeasuredContainer,
  children: PositionedItem[],
  _ownedEdges: MeasuredEdge[],
  context: LayoutContext
): Promise<ContainerLayoutResult> {
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

function buildElkAdaptedEdges(
  children: PositionedItem[],
  ownedEdges: MeasuredEdge[]
): ElkAdaptedEdge[] {
  const childIds = new Set(children.map((child) => child.id));
  const childItems = new Map(children.map((child) => [child.id, child]));

  return ownedEdges.flatMap((edge) => {
    if (!childIds.has(edge.from.itemId) || !childIds.has(edge.to.itemId)) {
      return [];
    }

    const sourceItem = childItems.get(edge.from.itemId);
    const targetItem = childItems.get(edge.to.itemId);
    if (!sourceItem || !targetItem) {
      return [];
    }

    const sourcePort = resolvePortOnItem(sourceItem, edge.from, edge.routing.sourcePortRole);
    const targetPort = resolvePortOnItem(targetItem, edge.to, edge.routing.targetPortRole);

    return [{
      id: edge.id,
      sourceItemId: edge.from.itemId,
      targetItemId: edge.to.itemId,
      sourcePortId: sourcePort?.id,
      targetPortId: targetPort?.id
    }];
  });
}

function resolveElkLayerGap(
  container: MeasuredContainer,
  ownedEdges: MeasuredEdge[]
): number {
  const baseGap = resolveGap(container);
  const direction = container.layout.direction ?? "horizontal";
  const maxLabelSpan = Math.max(
    0,
    ...ownedEdges.map((edge) => {
      if (!edge.label) {
        return 0;
      }

      return direction === "horizontal" ? edge.label.width : edge.label.height;
    })
  );

  return roundMetric(Math.max(baseGap, maxLabelSpan > 0 ? maxLabelSpan + baseGap : 0));
}

async function layoutElkLayeredContainer(
  container: MeasuredContainer,
  children: PositionedItem[],
  ownedEdges: MeasuredEdge[],
  _context: LayoutContext
): Promise<ContainerLayoutResult> {
  if (children.length === 0) {
    return {
      contentWidth: 0,
      contentHeight: 0
    };
  }

  const direction = container.layout.direction ?? "horizontal";
  const adaptedEdges = buildElkAdaptedEdges(children, ownedEdges);
  const elkResult = await runElkLayeredLayout({
    containerId: container.id,
    direction,
    nodeGap: resolveGap(container),
    layerGap: resolveElkLayerGap(container, ownedEdges),
    children,
    edges: adaptedEdges
  });

  for (const child of children) {
    const positioned = elkResult.childPositions.get(child.id);
    if (!positioned) {
      throw new Error(`ELK did not return child coordinates for "${child.id}".`);
    }

    child.x = roundMetric(positioned.x);
    child.y = roundMetric(positioned.y);
  }

  return {
    contentWidth: elkResult.contentWidth,
    contentHeight: elkResult.contentHeight,
    routeHints: elkResult.edgeRoutes
  };
}

const strategyRegistry: ReadonlyMap<LayoutStrategy, LayoutStrategyHandler> = new Map([
  ["stack", layoutStackContainer],
  ["grid", layoutGridContainer],
  ["lanes", layoutLanesContainer],
  ["elk_layered", layoutElkLayeredContainer]
]);

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

function validateContentBounds(contentWidth: number, contentHeight: number): boolean {
  return Number.isFinite(contentWidth)
    && Number.isFinite(contentHeight)
    && contentWidth >= 0
    && contentHeight >= 0;
}

async function layoutItem(
  item: MeasuredItem,
  context: LayoutContext,
  ownedEdgesByContainer: ReadonlyMap<string, MeasuredEdge[]>
): Promise<LayoutItemResult> {
  if (item.kind === "node") {
    return {
      item: clonePositionedNode(item),
      routeHints: new Map()
    };
  }

  return layoutContainer(item, context, ownedEdgesByContainer);
}

async function layoutContainer(
  container: MeasuredContainer,
  context: LayoutContext,
  ownedEdgesByContainer: ReadonlyMap<string, MeasuredEdge[]>
): Promise<LayoutItemResult> {
  const childResults: LayoutItemResult[] = [];
  for (const child of container.children) {
    childResults.push(await layoutItem(child, context, ownedEdgesByContainer));
  }

  const positionedChildren = childResults.map((result) => result.item);
  const descendantRouteHints = new Map<string, Point[]>();
  for (const childResult of childResults) {
    mergeRouteHints(descendantRouteHints, childResult.routeHints);
  }

  const chrome = cloneChromeSpec(container.chrome);
  const contentOrigin = getContentOrigin(chrome);
  const ownedEdges = ownedEdgesByContainer.get(container.id) ?? [];
  const handler = resolveLayoutHandler(container, context);

  let layoutResult: ContainerLayoutResult;
  try {
    layoutResult = await handler(container, positionedChildren, ownedEdges, context);
    if (!validateContentBounds(layoutResult.contentWidth, layoutResult.contentHeight)) {
      throw new Error(`Strategy "${container.layout.strategy}" produced invalid content bounds.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnosticCode = container.layout.strategy === "elk_layered"
      ? "renderer.layout.elk_failure"
      : "renderer.layout.strategy_failure";
    const diagnosticMessage = container.layout.strategy === "elk_layered"
      ? `ELK layout failed for container "${container.id}". Falling back to "stack". ${message}`
      : `Layout strategy "${container.layout.strategy}" failed for container "${container.id}". Falling back to "stack". ${message}`;
    context.diagnostics.push(createLayoutDiagnostic(diagnosticCode, diagnosticMessage, container.id));
    layoutResult = await layoutStackContainer(container, positionedChildren, ownedEdges, context);
  }

  for (const child of positionedChildren) {
    offsetPositionedItem(child, contentOrigin.x, contentOrigin.y);
  }

  const width = roundMetric(chrome.padding.left + layoutResult.contentWidth + chrome.padding.right);
  const headerWidth = resolveContainerHeaderWidth(container.headerContent, chrome);
  const height = roundMetric(chrome.padding.top + (chrome.headerBandHeight ?? 0) + layoutResult.contentHeight + chrome.padding.bottom);
  const positioned: PositionedContainer = {
    kind: "container",
    id: container.id,
    role: container.role,
    primitive: container.primitive,
    classes: [...container.classes],
    layout: cloneLayoutIntent(container.layout),
    chrome,
    headerContent: container.headerContent.map((block) => cloneMeasuredContentBlock(block)),
    children: positionedChildren,
    ports: container.ports.map((port) => cloneMeasuredPort(port)),
    x: 0,
    y: 0,
    width: Math.max(width, headerWidth),
    height
  };

  positioned.ports = resolveContainerPorts(positioned, context.theme);

  if (layoutResult.routeHints) {
    mergeRouteHints(descendantRouteHints, offsetLocalRouteHints(layoutResult.routeHints, contentOrigin.x, contentOrigin.y));
  }

  return {
    item: positioned,
    routeHints: descendantRouteHints
  };
}

function buildMeasuredItemIndex(
  container: MeasuredContainer,
  parentContainerId: string | undefined,
  ancestors: string[],
  index: Map<string, MeasuredItemIndexEntry>
): void {
  const containerAncestors = [...ancestors, container.id];
  index.set(container.id, {
    item: container,
    parentContainerId,
    ancestorContainerIds: containerAncestors
  });

  for (const child of container.children) {
    if (child.kind === "container") {
      buildMeasuredItemIndex(child, container.id, containerAncestors, index);
      continue;
    }

    index.set(child.id, {
      item: child,
      parentContainerId: container.id,
      ancestorContainerIds: containerAncestors
    });
  }
}

function resolveEdgeOwnerContainerId(
  edge: MeasuredEdge,
  index: ReadonlyMap<string, MeasuredItemIndexEntry>,
  rootId: string
): string {
  const fromAncestors = index.get(edge.from.itemId)?.ancestorContainerIds ?? [rootId];
  const toAncestors = index.get(edge.to.itemId)?.ancestorContainerIds ?? [rootId];
  const maxDepth = Math.min(fromAncestors.length, toAncestors.length);
  let ownerId = rootId;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (fromAncestors[depth] !== toAncestors[depth]) {
      break;
    }
    ownerId = fromAncestors[depth];
  }

  return ownerId;
}

function buildOwnedEdgesByContainer(
  edges: MeasuredEdge[],
  index: ReadonlyMap<string, MeasuredItemIndexEntry>,
  rootId: string
): {
  ownedEdgesByContainer: Map<string, MeasuredEdge[]>;
  ownerContainerByEdgeId: Map<string, string>;
} {
  const ownedEdgesByContainer = new Map<string, MeasuredEdge[]>();
  const ownerContainerByEdgeId = new Map<string, string>();

  for (const edge of edges) {
    const ownerId = resolveEdgeOwnerContainerId(edge, index, rootId);
    ownerContainerByEdgeId.set(edge.id, ownerId);
    const existing = ownedEdgesByContainer.get(ownerId);
    if (existing) {
      existing.push(edge);
      continue;
    }
    ownedEdgesByContainer.set(ownerId, [edge]);
  }

  return {
    ownedEdgesByContainer,
    ownerContainerByEdgeId
  };
}

function resolveOwnerContainer(
  edge: MeasuredEdge,
  root: PositionedContainer,
  index: ReadonlyMap<string, IndexedPositionedItem>,
  ownerContainerByEdgeId: ReadonlyMap<string, string>
): PositionedContainer {
  const ownerId = ownerContainerByEdgeId.get(edge.id);
  if (!ownerId) {
    return root;
  }

  const ownerItem = index.get(ownerId)?.item;
  return ownerItem && ownerItem.kind === "container" ? ownerItem : root;
}

function positionMeasuredEdge(
  edge: MeasuredEdge,
  root: PositionedContainer,
  index: ReadonlyMap<string, IndexedPositionedItem>,
  ownerContainerByEdgeId: ReadonlyMap<string, string>,
  routeHints: ReadonlyMap<string, Point[]>,
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

  const owner = resolveOwnerContainer(edge, root, index, ownerContainerByEdgeId);
  const localHint = routeHints.get(edge.id);
  const canUseElkRoute = edge.routing.style === "orthogonal" && Array.isArray(localHint) && localHint.length > 0;

  if (edge.routing.avoidNodeBoxes && !canUseElkRoute) {
    diagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.preference_fallback",
        `Edge "${edge.id}" requested avoidNodeBoxes, but Step 5 currently applies simple deterministic routing only.`,
        edge.id,
        "info"
      )
    );
  }

  const route = canUseElkRoute
    ? buildRouteFromLocalHint(edge, from, to, owner, localHint)
    : buildSharedRoute(edge, from, to);
  const positionedFrom = {
    itemId: from.itemId,
    portId: from.portId,
    x: from.x,
    y: from.y
  };
  const positionedTo = {
    itemId: to.itemId,
    portId: to.portId,
    x: to.x,
    y: to.y
  };

  return {
    id: edge.id,
    role: edge.role,
    classes: [...edge.classes],
    from: positionedFrom,
    to: positionedTo,
    route,
    label: edge.label ? positionEdgeLabel(edge.label, route, diagnostics, edge.id) : undefined,
    markers: cloneEdgeMarkers(edge.markers),
    paintGroup: "edges"
  };
}

export async function positionMeasuredScene(measuredScene: MeasuredScene): Promise<PositionedScene> {
  const diagnostics = measuredScene.diagnostics.filter((diagnostic) => diagnostic.code !== DEFERRED_CONTAINER_PORT_DIAGNOSTIC);
  const context: LayoutContext = {
    theme: getRendererTheme(measuredScene.themeId, "layout"),
    diagnostics: [...diagnostics],
    strategyRegistry
  };

  const measuredItemIndex = new Map<string, MeasuredItemIndexEntry>();
  buildMeasuredItemIndex(measuredScene.root, undefined, [], measuredItemIndex);

  const {
    ownedEdgesByContainer,
    ownerContainerByEdgeId
  } = buildOwnedEdgesByContainer(measuredScene.edges, measuredItemIndex, measuredScene.root.id);

  const rootResult = await layoutContainer(measuredScene.root, context, ownedEdgesByContainer);
  if (rootResult.item.kind !== "container") {
    throw new Error("Root layout result must be a container.");
  }

  const root = rootResult.item;
  const index = buildPositionedIndex(root);
  const edges = measuredScene.edges.map((edge) =>
    positionMeasuredEdge(
      edge,
      root,
      index,
      ownerContainerByEdgeId,
      rootResult.routeHints,
      context.diagnostics
    )
  );

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
