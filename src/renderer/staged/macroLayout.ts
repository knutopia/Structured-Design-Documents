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
import {
  createLayoutDiagnostic,
  sortRendererDiagnostics,
  type RendererDiagnostic
} from "./diagnostics.js";
import {
  runElkFixedPositionRouting,
  runElkLayeredLayout,
  runElkLayeredSubtreeLayout,
  type ElkAdaptedEdge
} from "./elkAdapter.js";
import { getContainerPrimitiveTheme } from "./primitives.js";
import {
  buildLocalPatternRoute,
  offsetParallelOrthogonalRoute,
  buildPositionedIndex,
  buildSourceContractLaneRoute,
  buildRouteFromLocalHint,
  buildSharedRoute,
  createRoutingDiagnostic,
  type IndexedPositionedItem,
  positionEdgeLabelInLane,
  positionEdgeLabel,
  tryPositionEdgeLabelOnSegment,
  resolveEdgeEndpoint,
  resolveSourceContractLaneOrigin,
  resolvePortOnItem,
  type SourceContractLaneAssignment
} from "./routing.js";
import { getRendererTheme, type RendererTheme } from "./theme.js";

interface LayoutContext {
  theme: RendererTheme;
  diagnostics: RendererDiagnostic[];
  strategyRegistry: ReadonlyMap<LayoutStrategy, LayoutStrategyHandler>;
}

interface PositionedRootLayoutResult {
  root: PositionedContainer;
  ownerContainerByEdgeId: ReadonlyMap<string, string>;
  routeHints: ReadonlyMap<string, Point[]>;
  diagnostics: RendererDiagnostic[];
}

export interface ServiceBlueprintFixedRoutingNodeDebug {
  id: string;
  expectedFrame: { x: number; y: number; width: number; height: number };
  returnedFrame: { x: number; y: number; width: number; height: number } | null;
  rawReturnedFrame: { x: number; y: number; width: number; height: number } | null;
  dx: number | null;
  dy: number | null;
}

export interface ServiceBlueprintFixedRoutingEdgeDebug {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  hasReturnedRoute: boolean;
  returnedRoutePointCount: number;
  returnedRoute: Point[];
}

export interface ServiceBlueprintFixedRoutingDebugResult {
  inputGraphSnapshot: unknown;
  outputGraphSnapshot: unknown;
  positionTolerance: number;
  positionsPreserved: boolean;
  preservesRelativeGrid: boolean;
  globalDelta: Point;
  firstDriftedChildId?: string;
  nodeDebug: ServiceBlueprintFixedRoutingNodeDebug[];
  edgeDebug: ServiceBlueprintFixedRoutingEdgeDebug[];
  routeHints: Map<string, Point[]>;
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

type ContractLabelLaneAssignments = ReadonlyMap<string, SourceContractLaneAssignment>;

interface ContractLaneCandidate {
  edge: MeasuredEdge;
  label: NonNullable<MeasuredEdge["label"]>;
  sourceItem: PositionedContainer;
  lane: SourceContractLaneAssignment;
  targetX: number;
  targetY: number;
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

const PAINT_ORDER: PositionedScene["paintOrder"] = ["chrome", "nodes", "labels", "edges", "edge_labels"];
const CONTRACT_LABEL_LANE_WIDTH_REDUCTION = 16;
const CONTRACT_LABEL_LANE_TOP_PADDING = 12;

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
    height: node.height,
    fixedSize: node.fixedSize,
    sharedWidthGroup: node.sharedWidthGroup,
    sharedHeightGroup: node.sharedHeightGroup
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
        { targetId: container.id }
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
      { targetId: container.id }
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

function collectSubtreeOwnedEdges(
  container: MeasuredContainer,
  ownedEdgesByContainer: ReadonlyMap<string, MeasuredEdge[]>
): MeasuredEdge[] {
  const collected = [...(ownedEdgesByContainer.get(container.id) ?? [])];

  for (const child of container.children) {
    if (child.kind === "container") {
      collected.push(...collectSubtreeOwnedEdges(child, ownedEdgesByContainer));
    }
  }

  return collected;
}

async function layoutContainer(
  container: MeasuredContainer,
  context: LayoutContext,
  ownedEdgesByContainer: ReadonlyMap<string, MeasuredEdge[]>
): Promise<LayoutItemResult> {
  if (container.layout.strategy === "elk_layered" && container.layout.elk?.hierarchyHandling === "include_children") {
    const subtreeEdges = collectSubtreeOwnedEdges(container, ownedEdgesByContainer);

    try {
      const laidOut = await runElkLayeredSubtreeLayout({
        root: container,
        edges: subtreeEdges
      });

      return {
        item: laidOut.root,
        routeHints: laidOut.edgeRoutes
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.diagnostics.push(createLayoutDiagnostic(
        "renderer.layout.elk_failure",
        `ELK layout failed for container "${container.id}". Falling back to "stack". ${message}`,
        {
          targetId: container.id,
          severity: container.layout.elk?.strict ? "error" : "warn"
        }
      ));
    }
  }

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
    const usesElk = container.layout.strategy === "elk_layered";
    const diagnosticCode = usesElk
      ? "renderer.layout.elk_failure"
      : "renderer.layout.strategy_failure";
    const diagnosticMessage = usesElk
      ? `ELK layout failed for container "${container.id}". Falling back to "stack". ${message}`
      : `Layout strategy "${container.layout.strategy}" failed for container "${container.id}". Falling back to "stack". ${message}`;
    context.diagnostics.push(createLayoutDiagnostic(diagnosticCode, diagnosticMessage, {
      targetId: container.id
    }));
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
    width: Math.max(width, headerWidth, container.width),
    height: Math.max(height, container.height),
    sharedWidthGroup: container.sharedWidthGroup,
    sharedHeightGroup: container.sharedHeightGroup
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
    const ownerId = edge.ownerContainerId ?? resolveEdgeOwnerContainerId(edge, index, rootId);
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

function resolveContractLabelLane(
  sourceContainer: PositionedContainer
): SourceContractLaneAssignment | undefined {
  const gutterContainer = sourceContainer.children.find(
    (child): child is PositionedContainer => child.kind === "container" && child.role === "contract_gutter"
  );
  if (!gutterContainer) {
    return undefined;
  }

  const laneWidth = roundMetric(gutterContainer.chrome.padding.left);
  const usableWidth = roundMetric(laneWidth - CONTRACT_LABEL_LANE_WIDTH_REDUCTION);
  if (usableWidth <= 0) {
    return undefined;
  }

  const routeMinY = roundMetric(
    sourceContainer.y + sourceContainer.chrome.padding.top + (sourceContainer.chrome.headerBandHeight ?? 0)
  );
  const routeMaxY = roundMetric(sourceContainer.y + sourceContainer.height - sourceContainer.chrome.padding.bottom);
  if (routeMaxY < routeMinY) {
    return undefined;
  }

  return {
    labelX: roundMetric(gutterContainer.x),
    labelY: 0,
    routeCenterY: 0,
    routeX: roundMetric(sourceContainer.x),
    routeMinY,
    routeMaxY,
    usableWidth
  };
}

function resolveContractLaneBodyTop(sourceItem: PositionedContainer): number {
  return roundMetric(
    sourceItem.y
    + sourceItem.chrome.padding.top
    + (sourceItem.chrome.headerBandHeight ?? 0)
    + CONTRACT_LABEL_LANE_TOP_PADDING
  );
}

function resolveContractLaneBodyBottom(sourceItem: PositionedContainer): number {
  return roundMetric(sourceItem.y + sourceItem.height - sourceItem.chrome.padding.bottom);
}

function packRouteCenteredLaneLabelTops(
  candidates: readonly ContractLaneCandidate[],
  laneBodyTop: number,
  laneBodyBottom: number
): number[] | undefined {
  if (candidates.length === 0) {
    return [];
  }

  const totalLabelHeight = roundMetric(
    candidates.reduce((sum, candidate) => sum + candidate.label.height, 0)
  );
  const availableHeight = roundMetric(laneBodyBottom - laneBodyTop);
  if (totalLabelHeight > availableHeight) {
    return undefined;
  }

  const placements = candidates.map((candidate) => ({
    height: candidate.label.height,
    top: roundMetric(candidate.targetY - candidate.label.height / 2)
  }));

  let previousBottom = laneBodyTop;
  for (const placement of placements) {
    placement.top = roundMetric(Math.max(placement.top, previousBottom, laneBodyTop));
    previousBottom = roundMetric(placement.top + placement.height);
  }

  let nextBottom = laneBodyBottom;
  for (let index = placements.length - 1; index >= 0; index -= 1) {
    const placement = placements[index];
    if (!placement) {
      continue;
    }
    const maxTop = roundMetric(nextBottom - placement.height);
    placement.top = roundMetric(Math.min(placement.top, maxTop));
    nextBottom = placement.top;
  }

  if (placements[0] && placements[0].top < laneBodyTop) {
    return undefined;
  }

  return placements.map((placement) => placement.top);
}

function buildContractLabelLaneAssignments(
  edges: readonly MeasuredEdge[],
  index: ReadonlyMap<string, IndexedPositionedItem>,
  diagnostics: RendererDiagnostic[]
): Map<string, SourceContractLaneAssignment> {
  const assignments = new Map<string, SourceContractLaneAssignment>();
  const sourceCandidates = new Map<string, ContractLaneCandidate[]>();

  for (const edge of edges) {
    if (edge.routing.labelPlacement !== "source_contract_lane" || !edge.label) {
      continue;
    }

    const sourceItem = index.get(edge.from.itemId)?.item;
    if (!sourceItem || sourceItem.kind !== "container") {
      diagnostics.push(
        createRoutingDiagnostic(
          "renderer.routing.edge_label_lane_fallback",
          `Edge "${edge.id}" requested source-contract-lane label placement, but its source is not a container. Falling back to segment placement.`,
          edge.id,
          "info"
        )
      );
      continue;
    }

    const lane = resolveContractLabelLane(sourceItem);
    if (!lane) {
      diagnostics.push(
        createRoutingDiagnostic(
          "renderer.routing.edge_label_lane_fallback",
          `Edge "${edge.id}" requested source-contract-lane label placement, but the source container has no reserved contract gutter. Falling back to segment placement.`,
          edge.id,
          "info"
        )
      );
      continue;
    }

    if (edge.label.width > lane.usableWidth) {
      diagnostics.push(
        createRoutingDiagnostic(
          "renderer.routing.edge_label_lane_fallback",
          `Edge "${edge.id}" label is wider than the available contract lane. Falling back to segment placement.`,
          edge.id,
          "info"
        )
      );
      continue;
    }

    const target = resolveEdgeEndpoint(
      edge.to,
      edge.routing.targetPortRole,
      edge.id,
      index,
      sourceItem,
      edge.routing.preferAxis,
      diagnostics
    );
    const existing = sourceCandidates.get(sourceItem.id) ?? [];
    existing.push({
      edge,
      label: edge.label,
      sourceItem,
      lane,
      targetX: target.x,
      targetY: target.y
    });
    sourceCandidates.set(sourceItem.id, existing);
  }

  for (const candidates of sourceCandidates.values()) {
    candidates.sort((left, right) =>
      left.targetY - right.targetY
      || left.targetX - right.targetX
      || left.edge.id.localeCompare(right.edge.id)
    );

    const firstCandidate = candidates[0];
    if (!firstCandidate) {
      continue;
    }

    const laneBodyTop = resolveContractLaneBodyTop(firstCandidate.sourceItem);
    const laneBodyBottom = resolveContractLaneBodyBottom(firstCandidate.sourceItem);
    const resolvedLabelTops = packRouteCenteredLaneLabelTops(candidates, laneBodyTop, laneBodyBottom);

    if (!resolvedLabelTops) {
      for (const candidate of candidates) {
        diagnostics.push(
          createRoutingDiagnostic(
            "renderer.routing.edge_label_lane_fallback",
            `Edge "${candidate.edge.id}" label lane rows could not fit within the source container body after route-centered packing. Falling back to segment placement.`,
            candidate.edge.id,
            "info"
          )
        );
      }
      continue;
    }

    for (const [candidateIndex, candidate] of candidates.entries()) {
      const {
        edge,
        lane,
        targetY
      } = candidate;
      const labelTop = resolvedLabelTops[candidateIndex];
      if (labelTop === undefined) {
        continue;
      }
      assignments.set(edge.id, {
        labelX: lane.labelX,
        labelY: labelTop,
        routeCenterY: roundMetric(targetY),
        routeX: lane.routeX,
        routeMinY: lane.routeMinY,
        routeMaxY: lane.routeMaxY,
        usableWidth: lane.usableWidth
      });
    }
  }

  return assignments;
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

function buildSharedRouteOffsets(edges: readonly MeasuredEdge[]): Map<string, number> {
  const groupedEdges = new Map<string, MeasuredEdge[]>();

  edges.forEach((edge) => {
    if (edge.routing.style !== "orthogonal") {
      return;
    }

    const key = [
      edge.from.itemId,
      edge.from.portId ?? "",
      edge.routing.sourcePortRole ?? "",
      edge.to.itemId,
      edge.to.portId ?? "",
      edge.routing.targetPortRole ?? "",
      edge.routing.localPattern ?? "",
      edge.routing.targetApproach ?? ""
    ].join("|");
    const existing = groupedEdges.get(key) ?? [];
    existing.push(edge);
    groupedEdges.set(key, existing);
  });

  const offsets = new Map<string, number>();
  groupedEdges.forEach((group) => {
    if (group.length < 2) {
      return;
    }

    const midpoint = (group.length - 1) / 2;
    [...group]
      .sort((left, right) => left.id.localeCompare(right.id))
      .forEach((edge, index) => {
        offsets.set(edge.id, roundMetric((index - midpoint) * 16));
      });
  });

  return offsets;
}

function isServiceBlueprintCell(item: PositionedItem): item is PositionedContainer {
  return item.kind === "container" && item.classes.includes("service_blueprint_cell");
}

function isSemanticPositionedNode(item: PositionedItem): item is PositionedNode {
  return item.kind === "node" && item.classes.includes("semantic_node");
}

function collectNestedSemanticNodes(children: PositionedItem[]): PositionedNode[] {
  const nodes: PositionedNode[] = [];

  for (const child of children) {
    if (isSemanticPositionedNode(child)) {
      nodes.push(child);
      continue;
    }

    if (child.kind === "container") {
      nodes.push(...collectNestedSemanticNodes(child.children));
    }
  }

  return nodes;
}

function getServiceBlueprintCellContentBounds(cell: PositionedContainer): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  return {
    left: roundMetric(cell.x + cell.chrome.padding.left),
    top: roundMetric(cell.y + cell.chrome.padding.top + (cell.chrome.headerBandHeight ?? 0)),
    right: roundMetric(cell.x + cell.width - cell.chrome.padding.right),
    bottom: roundMetric(cell.y + cell.height - cell.chrome.padding.bottom)
  };
}

function normalizeServiceBlueprintCellContents(root: PositionedContainer): void {
  const laneCells = root.children.filter(isServiceBlueprintCell);

  for (const cell of laneCells) {
    if (cell.children.length === 0) {
      continue;
    }

    const contentOrigin = getContentOrigin(cell.chrome);
    const contentWidth = roundMetric(cell.width - cell.chrome.padding.left - cell.chrome.padding.right);
    const contentHeight = roundMetric(
      cell.height - cell.chrome.padding.top - (cell.chrome.headerBandHeight ?? 0) - cell.chrome.padding.bottom
    );
    const gap = resolveGap(cell);
    const totalHeight = roundMetric(
      cell.children.reduce((sum, child) => sum + child.height, 0) + gap * Math.max(cell.children.length - 1, 0)
    );
    let currentY = roundMetric(cell.y + contentOrigin.y + Math.max(0, (contentHeight - totalHeight) / 2));

    for (const child of cell.children) {
      const targetX = roundMetric(cell.x + contentOrigin.x + Math.max(0, (contentWidth - child.width) / 2));
      const dx = roundMetric(targetX - child.x);
      const dy = roundMetric(currentY - child.y);
      offsetPositionedItem(child, dx, dy);
      currentY = roundMetric(currentY + child.height + gap);
    }
  }
}

function validateServiceBlueprintCellContents(
  root: PositionedContainer,
  diagnostics: RendererDiagnostic[]
): void {
  const laneCells = root.children.filter(isServiceBlueprintCell);

  for (const cell of laneCells) {
    const contentBounds = getServiceBlueprintCellContentBounds(cell);

    for (const node of collectNestedSemanticNodes(cell.children)) {
      const withinBounds = node.x >= contentBounds.left
        && node.y >= contentBounds.top
        && node.x + node.width <= contentBounds.right
        && node.y + node.height <= contentBounds.bottom;

      if (withinBounds) {
        continue;
      }

      const details = [
        `cell="${cell.id}"`,
        `cellContentBounds=(${contentBounds.left}, ${contentBounds.top})-(${contentBounds.right}, ${contentBounds.bottom})`,
        `nodeBounds=(${node.x}, ${node.y})-(${roundMetric(node.x + node.width)}, ${roundMetric(node.y + node.height)})`
      ].join("; ");
      diagnostics.push(
        createLayoutDiagnostic(
          "renderer.layout.service_blueprint_node_outside_cell",
          `Service blueprint node "${node.id}" lies outside its assigned grid cell "${cell.id}".`,
          {
            targetId: node.id,
            severity: "error",
            details
          }
        )
      );
      throw new Error(`Service blueprint node "${node.id}" lies outside its assigned grid cell "${cell.id}". ${details}`);
    }
  }
}

export async function analyzeServiceBlueprintFixedRouting(
  root: PositionedContainer,
  edges: readonly MeasuredEdge[],
  index: ReadonlyMap<string, IndexedPositionedItem>,
  diagnostics: RendererDiagnostic[],
  options: { strict: boolean } = { strict: false }
): Promise<ServiceBlueprintFixedRoutingDebugResult> {
  const semanticEdges = edges.filter((edge) => edge.routing.style === "orthogonal");
  if (semanticEdges.length === 0) {
    return {
      inputGraphSnapshot: { id: `${root.id}__service_blueprint_routes`, children: [], edges: [] },
      outputGraphSnapshot: { id: `${root.id}__service_blueprint_routes`, children: [], edges: [] },
      positionTolerance: 0.5,
      positionsPreserved: true,
      preservesRelativeGrid: true,
      globalDelta: { x: 0, y: 0 },
      nodeDebug: [],
      edgeDebug: [],
      routeHints: new Map()
    };
  }

  const itemIds = [...new Set(semanticEdges.flatMap((edge) => [edge.from.itemId, edge.to.itemId]))];
  const items = itemIds.map((itemId) => {
    const item = index.get(itemId)?.item;
    if (!item) {
      throw new Error(`Could not resolve positioned service blueprint item "${itemId}" for fixed ELK routing.`);
    }
    return item;
  });
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const children = items.map((item) => ({
    id: item.id,
    x: roundMetric(item.x - minX),
    y: roundMetric(item.y - minY),
    width: item.width,
    height: item.height,
    ports: item.ports
  }));

  const adaptedEdges: ElkAdaptedEdge[] = semanticEdges.map((edge) => {
    const sourceItem = index.get(edge.from.itemId)?.item;
    const targetItem = index.get(edge.to.itemId)?.item;
    if (!sourceItem || !targetItem) {
      throw new Error(`Could not resolve endpoints for service blueprint edge "${edge.id}".`);
    }

    const sourcePort = resolvePortOnItem(sourceItem, edge.from, edge.routing.sourcePortRole);
    const targetPort = resolvePortOnItem(targetItem, edge.to, edge.routing.targetPortRole);

    return {
      id: edge.id,
      sourceItemId: edge.from.itemId,
      targetItemId: edge.to.itemId,
      sourcePortId: sourcePort?.id,
      targetPortId: targetPort?.id,
      layoutOptions: edge.routing.elkLayoutOptions
    };
  });

  const positionTolerance = 0.5;
  const result = await runElkFixedPositionRouting({
    containerId: `${root.id}__service_blueprint_routes`,
    direction: "horizontal",
    nodeGap: 24,
    layerGap: 24,
    children,
    edges: adaptedEdges,
    positionTolerance
  });
  const firstChild = children[0];
  const firstResolved = firstChild ? result.childPositions.get(firstChild.id) : undefined;
  const globalDx = firstChild && firstResolved ? roundMetric(firstResolved.x - firstChild.x) : 0;
  const globalDy = firstChild && firstResolved ? roundMetric(firstResolved.y - firstChild.y) : 0;
  const preservesRelativeGrid = children.every((child) => {
    const resolved = result.childPositions.get(child.id);
    if (!resolved) {
      return false;
    }
    return Math.abs((resolved.x - child.x) - globalDx) <= positionTolerance
      && Math.abs((resolved.y - child.y) - globalDy) <= positionTolerance;
  });

  const driftedChild = !result.positionsPreserved && !preservesRelativeGrid
    ? children.find((child) => {
      const resolved = result.childPositions.get(child.id);
      return !resolved
        || Math.abs((resolved.x - child.x) - globalDx) > positionTolerance
        || Math.abs((resolved.y - child.y) - globalDy) > positionTolerance;
    })
    : undefined;
  const routeHints = new Map<string, Point[]>();
  for (const [edgeId, points] of result.edgeRoutes.entries()) {
    routeHints.set(edgeId, points.map((point) => ({
      x: roundMetric(point.x - globalDx + minX),
      y: roundMetric(point.y - globalDy + minY)
    })));
  }

  const nodeDebug = children.map((child) => {
    const sourceItem = itemsById.get(child.id);
    const rawReturnedFrame = result.childFrames.get(child.id);
    const returnedFrame = rawReturnedFrame
      ? {
        x: roundMetric(rawReturnedFrame.x - globalDx + minX),
        y: roundMetric(rawReturnedFrame.y - globalDy + minY),
        width: rawReturnedFrame.width,
        height: rawReturnedFrame.height
      }
      : null;
    return {
      id: child.id,
      expectedFrame: sourceItem
        ? {
          x: sourceItem.x,
          y: sourceItem.y,
          width: sourceItem.width,
          height: sourceItem.height
        }
        : {
          x: roundMetric(child.x + minX),
          y: roundMetric(child.y + minY),
          width: child.width,
          height: child.height
        },
      returnedFrame,
      rawReturnedFrame: rawReturnedFrame ?? null,
      dx: returnedFrame && sourceItem ? roundMetric(returnedFrame.x - sourceItem.x) : null,
      dy: returnedFrame && sourceItem ? roundMetric(returnedFrame.y - sourceItem.y) : null
    };
  });

  const edgeDebug = semanticEdges.map((edge) => ({
    id: edge.id,
    sourceItemId: edge.from.itemId,
    targetItemId: edge.to.itemId,
    hasReturnedRoute: routeHints.has(edge.id),
    returnedRoutePointCount: routeHints.get(edge.id)?.length ?? 0,
    returnedRoute: routeHints.get(edge.id)?.map((point) => ({ ...point })) ?? []
  }));

  if (driftedChild) {
    const resolved = result.childPositions.get(driftedChild.id);
    const driftDetail = resolved
      ? `expected (${driftedChild.x}, ${driftedChild.y}) but ELK returned (${resolved.x}, ${resolved.y}); normalized global delta=(${globalDx}, ${globalDy})`
      : "ELK did not return a positioned child for the fixed-grid item.";
    diagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.elk_fixed_position_drift",
        `ELK moved fixed service blueprint grid item "${driftedChild.id}" during the routing pass. The staged artifact is invalid.`,
        driftedChild.id,
        "error",
        driftDetail
      )
    );
    if (options.strict) {
      throw new Error(`ELK moved fixed service blueprint grid item "${driftedChild.id}" during routing: ${driftDetail}`);
    }
  }

  const missingRequiredRoute = semanticEdges.find((edge) =>
    edge.routing.authority === "require_elk" && !routeHints.has(edge.id)
  );
  if (missingRequiredRoute) {
    diagnostics.push(
      createRoutingDiagnostic(
        "renderer.routing.elk_required_route_missing",
        `ELK did not return a required service blueprint route for "${missingRequiredRoute.id}".`,
        missingRequiredRoute.id,
        "error"
      )
    );
    if (options.strict) {
      throw new Error(`ELK did not return a required service blueprint route for "${missingRequiredRoute.id}".`);
    }
  }

  return {
    inputGraphSnapshot: result.inputGraphSnapshot,
    outputGraphSnapshot: result.outputGraphSnapshot,
    positionTolerance,
    positionsPreserved: result.positionsPreserved,
    preservesRelativeGrid,
    globalDelta: {
      x: globalDx,
      y: globalDy
    },
    firstDriftedChildId: driftedChild?.id,
    nodeDebug,
    edgeDebug,
    routeHints
  };
}

function buildServiceBlueprintFixedRouteHints(
  root: PositionedContainer,
  edges: readonly MeasuredEdge[],
  index: ReadonlyMap<string, IndexedPositionedItem>,
  diagnostics: RendererDiagnostic[]
): Promise<Map<string, Point[]>> {
  return analyzeServiceBlueprintFixedRouting(root, edges, index, diagnostics, { strict: true }).then(
    (result) => result.routeHints
  );
}

function positionMeasuredEdge(
  edge: MeasuredEdge,
  root: PositionedContainer,
  index: ReadonlyMap<string, IndexedPositionedItem>,
  ownerContainerByEdgeId: ReadonlyMap<string, string>,
  routeHints: ReadonlyMap<string, Point[]>,
  sharedRouteOffsets: ReadonlyMap<string, number>,
  contractLabelLanes: ContractLabelLaneAssignments,
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
  const contractLabelLane = contractLabelLanes.get(edge.id);
  const localPatternRoute = buildLocalPatternRoute(edge, from, to, diagnostics);
  const contractLaneOrigin = contractLabelLane
    ? resolveSourceContractLaneOrigin(edge.from.itemId, to, contractLabelLane, edge.id, diagnostics)
    : undefined;
  const contractLaneRoute = contractLaneOrigin
    ? buildSourceContractLaneRoute(edge, contractLaneOrigin, to, diagnostics)
    : undefined;

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

  if (edge.routing.authority === "require_elk" && !canUseElkRoute) {
    throw new Error(
      `Edge "${edge.id}" requires ELK-authored routing geometry, but no ELK route sections were returned.`
    );
  }

  const baseRoute = canUseElkRoute
    ? buildRouteFromLocalHint(edge, from, to, owner, localHint, diagnostics)
    : localPatternRoute
      ? localPatternRoute
    : contractLaneRoute
      ? contractLaneRoute
      : buildSharedRoute(edge, from, to, diagnostics);
  const route = !canUseElkRoute && !localPatternRoute && !contractLaneRoute
    ? offsetParallelOrthogonalRoute(baseRoute, sharedRouteOffsets.get(edge.id) ?? 0)
    : baseRoute;
  const positionedFrom = {
    itemId: contractLaneRoute ? contractLaneOrigin?.itemId ?? from.itemId : from.itemId,
    portId: contractLaneRoute ? contractLaneOrigin?.portId : from.portId,
    x: contractLaneRoute ? contractLaneOrigin?.x ?? from.x : from.x,
    y: contractLaneRoute ? contractLaneOrigin?.y ?? from.y : from.y
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
    label: edge.label
      ? contractLaneRoute && contractLabelLane
        ? positionEdgeLabelInLane(edge.label, contractLabelLane)
        : edge.routing.labelPlacement === "segment_strict"
          ? tryPositionEdgeLabelOnSegment(edge.label, route, diagnostics, edge.id)
          : positionEdgeLabel(edge.label, route, diagnostics, edge.id)
      : undefined,
    markers: cloneEdgeMarkers(edge.markers),
    paintGroup: "edges"
  };
}

async function layoutMeasuredSceneRoot(measuredScene: MeasuredScene): Promise<PositionedRootLayoutResult> {
  const context: LayoutContext = {
    theme: getRendererTheme(measuredScene.themeId, "layout"),
    diagnostics: [...measuredScene.diagnostics],
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
  if (measuredScene.viewId === "service_blueprint") {
    normalizeServiceBlueprintCellContents(root);
    validateServiceBlueprintCellContents(root, context.diagnostics);
  }

  return {
    root,
    ownerContainerByEdgeId,
    routeHints: new Map(rootResult.routeHints ?? []),
    diagnostics: context.diagnostics
  };
}

export async function positionMeasuredSceneBeforeRouting(measuredScene: MeasuredScene): Promise<PositionedScene> {
  const laidOut = await layoutMeasuredSceneRoot(measuredScene);

  return {
    viewId: measuredScene.viewId,
    profileId: measuredScene.profileId,
    themeId: measuredScene.themeId,
    root: laidOut.root,
    edges: [],
    decorations: [],
    diagnostics: sortRendererDiagnostics(laidOut.diagnostics),
    paintOrder: [...PAINT_ORDER]
  };
}

export async function positionMeasuredScene(measuredScene: MeasuredScene): Promise<PositionedScene> {
  const laidOut = await layoutMeasuredSceneRoot(measuredScene);
  const root = laidOut.root;
  const index = buildPositionedIndex(root);
  const serviceBlueprintRouteHints = measuredScene.viewId === "service_blueprint"
    ? await buildServiceBlueprintFixedRouteHints(root, measuredScene.edges, index, laidOut.diagnostics)
    : new Map<string, Point[]>();
  const routeHints = new Map(laidOut.routeHints);
  mergeRouteHints(routeHints, serviceBlueprintRouteHints);
  const sharedRouteOffsets = buildSharedRouteOffsets(measuredScene.edges);
  const contractLabelLanes = buildContractLabelLaneAssignments(measuredScene.edges, index, laidOut.diagnostics);
  const edges = measuredScene.edges.map((edge) =>
    positionMeasuredEdge(
      edge,
      root,
      index,
      laidOut.ownerContainerByEdgeId,
      routeHints,
      sharedRouteOffsets,
      contractLabelLanes,
      laidOut.diagnostics
    )
  );

  return {
    viewId: measuredScene.viewId,
    profileId: measuredScene.profileId,
    themeId: measuredScene.themeId,
    root,
    edges,
    decorations: [],
    diagnostics: sortRendererDiagnostics(laidOut.diagnostics),
    paintOrder: [...PAINT_ORDER]
  };
}
