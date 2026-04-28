import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type {
  PositionedContainer,
  PositionedEdge,
  PositionedEdgeLabel,
  PositionedItem,
  PositionedRoute
} from "../src/renderer/staged/contracts.js";
import { buildIaPlaceMapRendererScene } from "../src/renderer/staged/iaPlaceMap.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import { renderServiceBlueprintStagedSvg } from "../src/renderer/staged/serviceBlueprint.js";
import { buildUiContractsRendererScene } from "../src/renderer/staged/uiContracts.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const EPSILON = 0.5;

export interface RenderedStagedArtifacts {
  rendererScene: Awaited<ReturnType<typeof runStagedRendererPipeline>>["rendererScene"];
  measuredScene: Awaited<ReturnType<typeof runStagedRendererPipeline>>["measuredScene"];
  positionedScene: Awaited<ReturnType<typeof runStagedRendererPipeline>>["positionedScene"];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeaderBox extends Rect {
  containerId: string;
  blockId: string;
}

export interface EdgeLabelBox extends Rect {
  edgeId: string;
}

export async function renderStagedArtifacts(
  sourcePath: string,
  viewId: "ia_place_map" | "service_blueprint" | "scenario_flow" | "ui_contracts",
  profileId: string
): Promise<RenderedStagedArtifacts> {
  const bundle = await loadBundle(manifestPath);
  const input = {
    path: sourcePath,
    text: await readFile(sourcePath, "utf8")
  };
  const compiled = compileSource(input, bundle);
  expect(compiled.graph).toBeDefined();
  const projected = projectView(compiled.graph!, bundle, viewId);
  expect(projected.projection).toBeDefined();
  const view = bundle.views.views.find((candidate) => candidate.id === viewId);
  if (!view) {
    throw new Error(`Could not resolve view "${viewId}".`);
  }

  if (viewId === "service_blueprint") {
    const rendered = await renderServiceBlueprintStagedSvg(
      projected.projection!,
      compiled.graph!,
      view,
      profileId
    );

    return {
      rendererScene: rendered.rendererScene,
      measuredScene: rendered.measuredScene,
      positionedScene: rendered.positionedScene
    };
  }

  if (viewId === "scenario_flow") {
    const rendered = await renderScenarioFlowStagedSvg(
      projected.projection!,
      compiled.graph!,
      view,
      profileId
    );

    return {
      rendererScene: rendered.rendererScene,
      measuredScene: rendered.measuredScene,
      positionedScene: rendered.positionedScene
    };
  }

  const rendererScene = viewId === "ia_place_map"
    ? buildIaPlaceMapRendererScene(projected.projection!, compiled.graph!, view, profileId)
    : buildUiContractsRendererScene(projected.projection!, compiled.graph!, view, profileId);

  return runStagedRendererPipeline(rendererScene);
}

export function flattenPositionedItems(root: PositionedContainer): PositionedItem[] {
  const flattened: PositionedItem[] = [root];
  const queue: PositionedItem[] = [...root.children];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    flattened.push(current);
    if (current.kind === "container") {
      queue.push(...current.children);
    }
  }

  return flattened;
}

export function findPositionedItem(root: PositionedContainer, itemId: string): PositionedItem {
  const item = flattenPositionedItems(root).find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`Could not find positioned item "${itemId}".`);
  }
  return item;
}

export function isVisibleContainer(item: PositionedItem): item is PositionedContainer {
  return item.kind === "container" && (item.primitive === "root" || item.primitive === "cluster" || item.primitive === "lane");
}

export function getItemRect(item: PositionedItem): Rect {
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height
  };
}

export function collectVisibleItemBoxes(root: PositionedContainer): Array<Rect & { itemId: string }> {
  return flattenPositionedItems(root)
    .filter((item) => item.kind === "node" || isVisibleContainer(item))
    .map((item) => ({
      itemId: item.id,
      ...getItemRect(item)
    }));
}

export function collectHeaderBoxes(root: PositionedContainer): HeaderBox[] {
  const headers: HeaderBox[] = [];

  for (const item of flattenPositionedItems(root)) {
    if (item.kind !== "container") {
      continue;
    }

    for (const block of item.headerContent) {
      headers.push({
        containerId: item.id,
        blockId: block.id,
        x: item.x + block.x,
        y: item.y + block.y,
        width: block.width,
        height: block.height
      });
    }
  }

  return headers;
}

export function collectEdgeLabelBoxes(edges: readonly PositionedEdge[]): EdgeLabelBox[] {
  return edges.flatMap((edge) => {
    if (!edge.label) {
      return [];
    }

    return [{
      edgeId: edge.id,
      x: edge.label.x,
      y: edge.label.y,
      width: edge.label.width,
      height: edge.label.height
    }];
  });
}

export function rectsOverlap(a: Rect, b: Rect, epsilon = EPSILON): boolean {
  return a.x < b.x + b.width - epsilon
    && a.x + a.width > b.x + epsilon
    && a.y < b.y + b.height - epsilon
    && a.y + a.height > b.y + epsilon;
}

export function rectClearance(a: Rect, b: Rect): number {
  const horizontalGap = Math.max(
    b.x - (a.x + a.width),
    a.x - (b.x + b.width),
    0
  );
  const verticalGap = Math.max(
    b.y - (a.y + a.height),
    a.y - (b.y + b.height),
    0
  );
  return Math.hypot(horizontalGap, verticalGap);
}

export function getTerminalSegment(edge: PositionedEdge): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const points = edge.route.points;
  const end = points[points.length - 1];
  const beforeEnd = points[points.length - 2];
  if (!end || !beforeEnd) {
    throw new Error(`Edge "${edge.id}" is missing terminal route points.`);
  }

  return {
    start: beforeEnd,
    end
  };
}

export function getTerminalSegmentLength(edge: PositionedEdge): number {
  const segment = getTerminalSegment(edge);
  return Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
}

export function getPenultimatePoint(edge: PositionedEdge): { x: number; y: number } {
  const point = edge.route.points[edge.route.points.length - 2];
  if (!point) {
    throw new Error(`Edge "${edge.id}" is missing a penultimate route point.`);
  }

  return point;
}

export function routeIntersectsRect(
  route: PositionedRoute,
  rect: Rect,
  options: { ignoreStart?: boolean; ignoreEnd?: boolean } = {}
): boolean {
  for (let index = 1; index < route.points.length; index += 1) {
    const start = route.points[index - 1]!;
    const end = route.points[index]!;
    const isFirst = index === 1;
    const isLast = index === route.points.length - 1;
    if (segmentIntersectsRect(start, end, rect, {
      ignoreStart: options.ignoreStart && isFirst,
      ignoreEnd: options.ignoreEnd && isLast
    })) {
      return true;
    }
  }

  return false;
}

function segmentIntersectsRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
  rect: Rect,
  options: { ignoreStart?: boolean; ignoreEnd?: boolean }
): boolean {
  if (Math.abs(start.x - end.x) <= EPSILON) {
    const x = start.x;
    if (x <= rect.x + EPSILON || x >= rect.x + rect.width - EPSILON) {
      return false;
    }

    const low = Math.min(start.y, end.y);
    const high = Math.max(start.y, end.y);
    const clippedLow = options.ignoreStart ? low + EPSILON : low;
    const clippedHigh = options.ignoreEnd ? high - EPSILON : high;
    return clippedLow < rect.y + rect.height - EPSILON && clippedHigh > rect.y + EPSILON;
  }

  if (Math.abs(start.y - end.y) <= EPSILON) {
    const y = start.y;
    if (y <= rect.y + EPSILON || y >= rect.y + rect.height - EPSILON) {
      return false;
    }

    const low = Math.min(start.x, end.x);
    const high = Math.max(start.x, end.x);
    const clippedLow = options.ignoreStart ? low + EPSILON : low;
    const clippedHigh = options.ignoreEnd ? high - EPSILON : high;
    return clippedLow < rect.x + rect.width - EPSILON && clippedHigh > rect.x + EPSILON;
  }

  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  return minX < rect.x + rect.width - EPSILON
    && maxX > rect.x + EPSILON
    && minY < rect.y + rect.height - EPSILON
    && maxY > rect.y + EPSILON;
}

export function expectNoForbiddenDiagnostics(
  diagnostics: readonly { code: string }[],
  forbiddenCodes: readonly string[]
): void {
  const present = diagnostics
    .filter((diagnostic) => forbiddenCodes.includes(diagnostic.code))
    .map((diagnostic) => diagnostic.code);
  expect(present).toEqual([]);
}

export function expectNoRouteIntersectionsWithNonEndpointBoxes(
  edges: readonly PositionedEdge[],
  boxes: ReadonlyArray<Rect & { itemId: string }>
): void {
  for (const edge of edges) {
    const blockingBoxes = boxes.filter((box) => box.itemId !== edge.from.itemId && box.itemId !== edge.to.itemId);
    for (const box of blockingBoxes) {
      expect(routeIntersectsRect(edge.route, box)).toBe(false);
    }
  }
}

export function expectRoutesDoNotEnterEndpointBoxes(
  edges: readonly PositionedEdge[],
  boxes: ReadonlyArray<Rect & { itemId: string }>
): void {
  const boxById = new Map(boxes.map((box) => [box.itemId, box] as const));
  for (const edge of edges) {
    const sourceBox = boxById.get(edge.from.itemId);
    const targetBox = boxById.get(edge.to.itemId);
    if (sourceBox) {
      expect(routeIntersectsRect(edge.route, sourceBox, { ignoreStart: true })).toBe(false);
    }
    if (targetBox) {
      expect(routeIntersectsRect(edge.route, targetBox, { ignoreEnd: true })).toBe(false);
    }
  }
}

interface AxisAlignedSegment {
  edgeId: string;
  segmentIndex: number;
  axis: "horizontal" | "vertical";
  coordinate: number;
  spanStart: number;
  spanEnd: number;
}

function collectAxisAlignedSegments(edge: PositionedEdge): AxisAlignedSegment[] {
  const segments: AxisAlignedSegment[] = [];
  for (let index = 1; index < edge.route.points.length; index += 1) {
    const start = edge.route.points[index - 1]!;
    const end = edge.route.points[index]!;
    if (Math.hypot(start.x - end.x, start.y - end.y) <= EPSILON) {
      continue;
    }
    if (Math.abs(start.y - end.y) <= EPSILON) {
      segments.push({
        edgeId: edge.id,
        segmentIndex: index - 1,
        axis: "horizontal",
        coordinate: start.y,
        spanStart: Math.min(start.x, end.x),
        spanEnd: Math.max(start.x, end.x)
      });
    } else if (Math.abs(start.x - end.x) <= EPSILON) {
      segments.push({
        edgeId: edge.id,
        segmentIndex: index - 1,
        axis: "vertical",
        coordinate: start.x,
        spanStart: Math.min(start.y, end.y),
        spanEnd: Math.max(start.y, end.y)
      });
    }
  }
  return segments;
}

export function expectSameOrientationSegmentsSeparated(
  edges: readonly PositionedEdge[],
  minSeparation = 16
): void {
  const segments = edges.flatMap(collectAxisAlignedSegments);
  for (let index = 0; index < segments.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < segments.length; otherIndex += 1) {
      const first = segments[index]!;
      const second = segments[otherIndex]!;
      if (first.edgeId === second.edgeId || first.axis !== second.axis) {
        continue;
      }
      const overlap = Math.min(first.spanEnd, second.spanEnd) - Math.max(first.spanStart, second.spanStart);
      if (overlap <= EPSILON) {
        continue;
      }
      expect(Math.abs(first.coordinate - second.coordinate), [
        first.edgeId,
        `segment ${first.segmentIndex}`,
        second.edgeId,
        `segment ${second.segmentIndex}`,
        first.axis,
        `overlap ${overlap}`
      ].join(" ")).toBeGreaterThanOrEqual(minSeparation - EPSILON);
    }
  }
}

export function expectLabelsDoNotOverlapHeaders(
  labels: readonly EdgeLabelBox[],
  headers: readonly HeaderBox[]
): void {
  for (const label of labels) {
    for (const header of headers) {
      expect(rectsOverlap(label, header)).toBe(false);
    }
  }
}

export function expectLabelsDoNotOverlapBoxes(
  labels: readonly EdgeLabelBox[],
  boxes: ReadonlyArray<Rect & { itemId: string }>,
  allowedItemIds = new Set<string>()
): void {
  for (const label of labels) {
    for (const box of boxes) {
      if (allowedItemIds.has(box.itemId)) {
        continue;
      }
      expect(rectsOverlap(label, box)).toBe(false);
    }
  }
}

export function expectLabelsHaveMinimumBoxClearance(
  labels: readonly EdgeLabelBox[],
  boxes: ReadonlyArray<Rect & { itemId: string }>,
  minClearance: number,
  allowedItemIds = new Set<string>()
): void {
  for (const label of labels) {
    for (const box of boxes) {
      if (allowedItemIds.has(box.itemId)) {
        continue;
      }
      expect(rectClearance(label, box), `${label.edgeId} vs ${box.itemId}`)
        .toBeGreaterThanOrEqual(minClearance - EPSILON);
    }
  }
}

export function expectLabelsDoNotOverlapEachOther(labels: readonly EdgeLabelBox[]): void {
  for (let index = 0; index < labels.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < labels.length; otherIndex += 1) {
      expect(rectsOverlap(labels[index]!, labels[otherIndex]!)).toBe(false);
    }
  }
}

export function expectRoutesDoNotCrossLabels(
  edges: readonly PositionedEdge[],
  labels: readonly EdgeLabelBox[]
): void {
  for (const edge of edges) {
    for (const label of labels) {
      if (label.edgeId === edge.id) {
        continue;
      }
      expect(routeIntersectsRect(edge.route, label)).toBe(false);
    }
  }
}

export function getEdgeLabelBox(edge: PositionedEdge): EdgeLabelBox | undefined {
  if (!edge.label) {
    return undefined;
  }

  return {
    edgeId: edge.id,
    x: edge.label.x,
    y: edge.label.y,
    width: edge.label.width,
    height: edge.label.height
  };
}

export function getEdgeById(edges: readonly PositionedEdge[], edgeId: string): PositionedEdge {
  const edge = edges.find((candidate) => candidate.id === edgeId);
  if (!edge) {
    throw new Error(`Could not find edge "${edgeId}".`);
  }
  return edge;
}

export { repoRoot };
