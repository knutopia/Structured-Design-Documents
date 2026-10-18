import { describe, expect, it } from "vitest";
import type { MeasuredNode, RendererScene, SceneNode } from "../src/renderer/staged/contracts.js";
import { measureRendererScene, type NodeMinimumExtent } from "../src/renderer/staged/microLayout.js";
import { buildSharedNodeRendererScene } from "../src/renderer/staged/sharedNodeRenderer.js";
import { resolveNodeMinimumExtent } from "../src/renderer/staged/sharedNode.js";

const title = "Book a flight to a chosen destination";
const value = "Provide a longer description with several words that require multiple lines on a standard card";
function scene(dense = false): RendererScene {
  const result = buildSharedNodeRendererScene([{
    nodeId: "semantic", nodeType: "Component", title: dense ? title : "Short title",
    decoratorMode: { id: "type,id", showNodeType: true, showNodeId: true },
    attributes: dense ? [{ groupId: "description", label: "long description attribute label with several extra words", value }] : []
  }], { detailId: "compact" });
  const node = result.root.children[0] as SceneNode;
  node.id = "occurrence-1";
  node.ports = ["north", "south", "east", "west"].map(side => ({ id: side, side: side as "north" | "south" | "east" | "west", role: "flow" }));
  return result;
}
function measure(input: RendererScene, minimum?: NodeMinimumExtent): MeasuredNode {
  return measureRendererScene(input, minimum && { minimumNodeExtents: new Map([["occurrence-1", minimum]]) }).root.children[0] as MeasuredNode;
}
function assertBounds(node: MeasuredNode): void {
  const layout = node.sharedNode!;
  expect(layout.body.x + layout.body.width).toBeLessThanOrEqual(node.width);
  expect(layout.body.y + layout.body.height).toBeLessThanOrEqual(node.height);
  for (const block of node.content) {
    expect(block.x).toBeGreaterThanOrEqual(0);
    expect(block.y).toBeGreaterThanOrEqual(0);
    expect(block.x + block.width).toBeLessThanOrEqual(node.width);
    expect(block.y + block.height).toBeLessThanOrEqual(node.height);
  }
  expect(node.ports).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "north", x: node.width / 2, y: 0 }),
    expect.objectContaining({ id: "south", x: node.width / 2, y: node.height }),
    expect.objectContaining({ id: "east", x: node.width, y: node.height / 2 }),
    expect.objectContaining({ id: "west", x: 0, y: node.height / 2 })
  ]));
}

describe("per-occurrence shared node minimum extents", () => {
  it("resolves width before title and attribute wrapping and updates all body bounds", () => {
    const input = scene(true);
    const original = structuredClone(input);
    const baseline = measure(input);
    const enlarged = measure(input, { width: 480, height: baseline.height });
    expect(baseline.width).toBe(224);
    expect(enlarged.width).toBe(480);
    expect(enlarged.height).toBeGreaterThanOrEqual(baseline.height);
    expect(enlarged.sharedNode!.body.title.lines.length).toBeLessThan(baseline.sharedNode!.body.title.lines.length);
    expect(enlarged.sharedNode!.body.attributeGroups[0]!.values[0]!.lines.length)
      .toBeLessThan(baseline.sharedNode!.body.attributeGroups[0]!.values[0]!.lines.length);
    expect(enlarged.sharedNode!.body.attributeGroups[0]!.label.lines.length)
      .toBeLessThan(baseline.sharedNode!.body.attributeGroups[0]!.label.lines.length);
    expect(enlarged.sharedNode!.body.attributeGroups[0]!.width).toBe(enlarged.sharedNode!.body.width - 28);
    expect(enlarged.sharedNode!.decorator!.width).toBe(enlarged.sharedNode!.body.width);
    assertBounds(enlarged);
    expect(input).toEqual(original);
  });

  it("remeasures the decorator available width while preserving single-line header semantics", () => {
    const input = scene();
    const node = input.root.children[0] as SceneNode;
    node.sharedNode!.nodeType = "A component type with a lengthy decorator name";
    const baseline = measureRendererScene(input);
    expect(baseline.diagnostics.some(d => d.code === "renderer.measure.shared_node_decorator_overflow")).toBe(true);
    const enlarged = measureRendererScene(input, { minimumNodeExtents: new Map([[node.id, { width: 600 }]]) });
    expect(enlarged.diagnostics.some(d => d.code === "renderer.measure.shared_node_decorator_overflow")).toBe(false);
    const measured = enlarged.root.children[0] as MeasuredNode;
    expect(measured.sharedNode!.decorator!.items.every(block => block.lines.length === 1)).toBe(true);
    assertBounds(measured);
  });

  it.each([false, true])("supports height-only growth with plain/dense placement (dense=%s)", dense => {
    const input = scene(dense);
    if (!dense) (input.root.children[0] as SceneNode).sharedNode!.decoratorMode = { id: "none", showNodeType: false, showNodeId: false };
    const baseline = measure(input);
    const enlarged = measure(input, { height: baseline.height + 100 });
    expect(enlarged.height).toBe(baseline.height + 100);
    expect(enlarged.width).toBe(baseline.width);
    expect(enlarged.sharedNode!.body.title.lines).toEqual(baseline.sharedNode!.body.title.lines);
    expect(enlarged.sharedNode!.density).toBe(dense ? "dense" : "plain");
    if (dense) expect(enlarged.sharedNode!.body.title.y).toBe(baseline.sharedNode!.body.title.y);
    else expect(enlarged.sharedNode!.body.title.y).toBe(baseline.sharedNode!.body.title.y + 50);
    assertBounds(enlarged);
  });

  it("addresses an occurrence without changing another depiction of its semantic node", () => {
    const input = scene(true);
    const duplicate = structuredClone(input.root.children[0]) as SceneNode;
    duplicate.id = "occurrence-2";
    input.root.children.push(duplicate);
    const baseline = measureRendererScene(input);
    const enlarged = measureRendererScene(input, { minimumNodeExtents: new Map([["occurrence-1", { width: 480, height: 300 }]]) });
    expect(enlarged.root.children[0]!.width).toBe(480);
    expect(enlarged.root.children[0]!.height).toBe(300);
    expect(enlarged.root.children[1]).toEqual(baseline.root.children[1]);
  });

  it("remeasures shared-width peers before resolving shared heights and ports", () => {
    const input = scene(true);
    const duplicate = structuredClone(input.root.children[0]) as SceneNode;
    duplicate.id = "occurrence-2";
    input.root.children.push(duplicate);
    input.root.children.forEach(child => { child.sharedWidthGroup = "width"; child.sharedHeightGroup = "height"; });
    const measured = measureRendererScene(input, { minimumNodeExtents: new Map([["occurrence-1", { width: 480, height: 200 }]]) });
    const [first, second] = measured.root.children as MeasuredNode[];
    expect(first!.width).toBe(480);
    expect(second!.width).toBe(480);
    expect(first!.height).toBe(200);
    expect(second!.height).toBe(200);
    expect(second!.sharedNode!.body.title.lines).toEqual(first!.sharedNode!.body.title.lines);
    expect(second!.sharedNode!.body.attributeGroups[0]!.values[0]!.lines)
      .toEqual(first!.sharedNode!.body.attributeGroups[0]!.values[0]!.lines);
    for (const node of [first!, second!]) assertBounds(node);
  });

  it("preserves no-minimum measurement and ignores already-satisfied floors", () => {
    const input = scene(true);
    const baseline = measureRendererScene(input);
    expect(measureRendererScene(input, {})).toEqual(baseline);
    expect(measureRendererScene(input, { minimumNodeExtents: new Map() })).toEqual(baseline);
    expect(measure(input, { width: 100, height: 10 })).toEqual(baseline.root.children[0]);
    expect(measure(input, { width: 0, height: 0 })).toEqual(baseline.root.children[0]);
    expect(measureRendererScene(input)).toEqual(baseline);
  });

  it("rounds requested minima upward to renderer precision", () => {
    const measured = measure(scene(), { width: 300.0001, height: 100.0001 });
    expect(measured.width).toBe(300.001);
    expect(measured.height).toBe(100.001);
    expect(measured.ports.find(port => port.id === "south")!.y).toBe(100.001);
    for (const value of [8.007, 257.001, 300.0001]) {
      const once = resolveNodeMinimumExtent({ width: value });
      expect(once.width).toBeGreaterThanOrEqual(value);
      expect(resolveNodeMinimumExtent(once)).toEqual(once);
    }
  });

  it("replaces width-stale peer diagnostics while retaining preparation diagnostics", () => {
    const input = scene();
    const duplicate = structuredClone(input.root.children[0]) as SceneNode;
    duplicate.id = "occurrence-2";
    duplicate.sharedNode!.nodeType = "A component type with a lengthy decorator name";
    input.root.children.push(duplicate);
    input.root.children.forEach(child => { child.sharedWidthGroup = "width"; });
    const preparation = { phase: "scene" as const, severity: "warn" as const, code: "preparation",
      message: "Retained preparation finding", targetId: duplicate.id };
    input.diagnostics.push(preparation);
    const measured = measureRendererScene(input, { minimumNodeExtents: new Map([["occurrence-1", { width: 600 }]]) });
    expect(measured.diagnostics.some(d => d.code === "renderer.measure.shared_node_decorator_overflow")).toBe(false);
    expect(measured.diagnostics).toContainEqual(preparation);
  });

  it.each([NaN, Infinity, -Infinity, -1])("rejects invalid dimensions even for an occurrence absent from a preliminary scene (%s)", value => {
    for (const minimum of [{ width: value }, { height: value }]) {
      expect(() => measureRendererScene(scene(), { minimumNodeExtents: new Map([["unknown-occurrence", minimum]]) })).toThrow(RangeError);
    }
  });
});
