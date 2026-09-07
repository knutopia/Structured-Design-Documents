import type { Point, PositionedItem, PositionedScene } from "../src/renderer/staged/contracts.js";
import { validatePositionedSceneRouting } from "../src/renderer/staged/routingCore/index.js";

interface Rect { x: number; y: number; width: number; height: number }
const EPSILON = 0.01;

export function flattenUiContractsItems(item: PositionedItem): PositionedItem[] {
  return [item, ...(item.kind === "container" ? item.children.flatMap(flattenUiContractsItems) : [])];
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width - EPSILON && a.x + a.width > b.x + EPSILON
    && a.y < b.y + b.height - EPSILON && a.y + a.height > b.y + EPSILON;
}

function intersects(a: Point, b: Point, box: Rect): boolean {
  if (a.x === b.x) return a.x > box.x + EPSILON && a.x < box.x + box.width - EPSILON
    && Math.max(a.y, b.y) > box.y + EPSILON && Math.min(a.y, b.y) < box.y + box.height - EPSILON;
  if (a.y === b.y) return a.y > box.y + EPSILON && a.y < box.y + box.height - EPSILON
    && Math.max(a.x, b.x) > box.x + EPSILON && Math.min(a.x, b.x) < box.x + box.width - EPSILON;
  return false;
}

function inside(box: Rect, boundary: Rect): boolean {
  return box.x >= boundary.x - EPSILON && box.y >= boundary.y - EPSILON
    && box.x + box.width <= boundary.x + boundary.width + EPSILON
    && box.y + box.height <= boundary.y + boundary.height + EPSILON;
}

/** Independent acceptance checks, including failures the shared router does not diagnose. */
export function assessUiContractsGeometry(scene: PositionedScene): string[] {
  const issues = scene.diagnostics.map(d => `${d.code}: ${d.message}`);
  issues.push(...validatePositionedSceneRouting(scene).map(v => `${v.kind}: ${v.message}`));
  const items = flattenUiContractsItems(scene.root);
  const nodes = items.filter(item => item.kind === "node" && item.sharedNode);
  const labels = scene.edges.flatMap(edge => edge.label ? [{ id: edge.id, ...edge.label }] : []);
  const headers = items.flatMap(item => item.kind === "container"
    ? item.headerContent.map(block => ({ id: block.id, x: item.x + block.x, y: item.y + block.y,
      width: block.width, height: block.height, container: item })) : []);
  for (const node of nodes) {
    if (node.width !== 224) issues.push(`node width: ${node.id}`);
    if (!inside(node, scene.root)) issues.push(`node bounds: ${node.id}`);
  }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (overlaps(nodes[i], nodes[j])) issues.push(`node overlap: ${nodes[i].id}, ${nodes[j].id}`);
  }
  for (const header of headers) {
    if (!inside(header, { ...header.container, height: header.container.chrome.headerBandHeight ?? 0 })) {
      issues.push(`header bounds: ${header.id}`);
    }
    for (const node of nodes) if (overlaps(header, node)) issues.push(`header/node: ${header.id}, ${node.id}`);
  }
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!inside(label, scene.root)) issues.push(`label bounds: ${label.id}`);
    for (const node of nodes) if (overlaps(label, node)) issues.push(`label/node: ${label.id}, ${node.id}`);
    for (const header of headers) if (overlaps(label, header)) issues.push(`label/header: ${label.id}, ${header.id}`);
    for (let j = i + 1; j < labels.length; j++) if (overlaps(label, labels[j])) {
      issues.push(`label overlap: ${label.id}, ${labels[j].id}`);
    }
  }
  for (const edge of scene.edges) {
    for (const point of edge.route.points) if (!inside({ ...point, width: 0, height: 0 }, scene.root)) {
      issues.push(`route bounds: ${edge.id}`);
    }
    for (let i = 1; i < edge.route.points.length; i++) {
      const a = edge.route.points[i - 1], b = edge.route.points[i];
      if (a.x !== b.x && a.y !== b.y) issues.push(`non-orthogonal segment: ${edge.id}`);
      for (const box of [...nodes, ...labels, ...headers]) if (intersects(a, b, box)) {
        issues.push(`route/interior: ${edge.id}, ${box.id}`);
      }
    }
  }
  return issues;
}

/** Coverage counts semantic identities/relationships, never junctions or routed segments. */
export function assessUiContractsCoverage(input: {
  expectedNodeIds: readonly string[];
  occurrences: ReadonlyMap<string, string>;
  expectedRelationshipIds: readonly string[];
  relationshipSegments: ReadonlyMap<string, readonly string[]>;
  scene: PositionedScene;
}): string[] {
  const issues: string[] = [];
  const itemIds = new Set(flattenUiContractsItems(input.scene.root).map(item => item.id));
  const represented = new Set(input.occurrences.values());
  const expected = new Set(input.expectedNodeIds);
  for (const id of expected) if (!represented.has(id)) issues.push(`missing identity: ${id}`);
  for (const [occurrence, id] of input.occurrences) {
    if (!itemIds.has(occurrence)) issues.push(`missing occurrence: ${occurrence}`);
    if (!expected.has(id)) issues.push(`unexpected identity: ${id}`);
  }
  const segmentIds = new Set(input.scene.edges.map(edge => edge.id));
  for (const id of input.expectedRelationshipIds) {
    const segments = input.relationshipSegments.get(id);
    if (!segments?.length) issues.push(`missing relationship: ${id}`);
    for (const segment of segments ?? []) if (!segmentIds.has(segment)) issues.push(`missing segment: ${segment}`);
  }
  const expectedRelationships = new Set(input.expectedRelationshipIds);
  for (const id of input.relationshipSegments.keys()) if (!expectedRelationships.has(id)) {
    issues.push(`unexpected relationship: ${id}`);
  }
  return issues;
}
