import { describe, expect, it } from "vitest";
import type { PositionedContainer, RendererScene, SceneContainer, SceneNode } from "../src/renderer/staged/contracts.js";
import { measureScene, positionSceneBeforeRouting } from "../src/renderer/staged/pipeline.js";

function node(id: string, height: number): SceneNode {
  return {
    kind: "node", id, role: "test", primitive: "card", classes: [],
    fixedSize: { width: 100, height },
    widthPolicy: { preferred: "standard", allowed: ["standard"] },
    overflowPolicy: { kind: "grow_height" }, content: [], ports: []
  };
}

function cell(id: string, row: number, children: SceneNode[], alignment: "start" | "center"): SceneContainer {
  return {
    kind: "container", id, role: "test", primitive: "stack", classes: [],
    layout: { strategy: "stack", direction: "vertical", gap: 10, crossAlignment: "center",
      slots: { heightGroup: "tiers", minimumCount: 1, minimumHeightPrimitive: "card", alignment } },
    chrome: { padding: { top: 12, right: 12, bottom: 12, left: 12 } },
    sharedHeightGroup: `row:${row}`, children, ports: []
  };
}

function scene(alignment: "start" | "center"): RendererScene {
  return {
    viewId: "slots_test", detailId: "compact", themeId: "default", diagnostics: [], edges: [],
    root: {
      kind: "container", id: "root", role: "diagram_root", primitive: "root", classes: [],
      layout: { strategy: "grid", columns: 2, gap: 20, crossAlignment: "stretch" },
      chrome: { padding: { top: 0, right: 0, bottom: 0, left: 0 } }, ports: [],
      children: [cell("stack", 0, [node("short", 48), node("tall", 80)], alignment),
        cell("single", 0, [node("sibling", 48)], alignment),
        cell("empty", 1, [], alignment), cell("other-row", 1, [node("other", 48)], alignment)]
    }
  };
}

describe("shared vertical node tiers", () => {
  it.each(["start", "center"] as const)("reserves individual tiers with %s alignment without resizing nodes or unrelated rows", async alignment => {
    const source = scene(alignment);
    const measured = measureScene(source);
    const result = await positionSceneBeforeRouting(measured);
    const [stack, single, empty, otherRow] = result.root.children as PositionedContainer[];
    expect(stack.resolvedSlotHeight).toBe(80);
    expect(stack.height).toBe(194); // 2 * 80 + 10 + 24
    expect(single.height).toBe(194);
    expect(empty.height).toBe(104); // one empty tier, not the two-node stack
    expect(otherRow.height).toBe(104);
    expect(stack.children.map(child => child.height)).toEqual([48, 80]);
    expect(stack.children.map(child => child.y - stack.y)).toEqual(alignment === "start" ? [12, 102] : [28, 102]);
    expect(single.children[0]!.y - single.y).toBe(alignment === "start" ? 12 : 73);
    expect(otherRow.children[0]!.y - otherRow.y).toBe(alignment === "start" ? 12 : 28);
    expect(JSON.stringify(source)).not.toContain("resolvedSlotHeight");
    expect(measured.root.children[0]).not.toHaveProperty("x");
    expect(result).toEqual(await positionSceneBeforeRouting(measured));
  });

  it("uses the theme minimum for entirely empty tier groups", () => {
    const source = scene("start");
    for (const child of source.root.children) (child as SceneContainer).children = [];
    const measured = measureScene(source);
    for (const child of measured.root.children) {
      expect(child).toMatchObject({ resolvedSlotHeight: 48, height: 72 });
    }
  });

  it("deep-clones slot intent and leaves containers without slots on their natural sizing path", async () => {
    const source = scene("start");
    const measured = measureScene(source);
    const first = source.root.children[0] as SceneContainer;
    first.layout.slots!.alignment = "center";
    expect((measured.root.children[0] as SceneContainer).layout.slots!.alignment).toBe("start");
    const positioned = await positionSceneBeforeRouting(measured);
    (measured.root.children[0] as SceneContainer).layout.slots!.alignment = "center";
    expect((positioned.root.children[0] as PositionedContainer).layout.slots!.alignment).toBe("start");
    for (const child of source.root.children) delete (child as SceneContainer).layout.slots;
    const natural = measureScene(source);
    expect(natural.root.children[0]!.height).toBe(162); // 48 + 80 + 10 + 24
    expect(natural.root.children[2]!.height).toBe(72);
    expect(natural.root.children[0]).not.toHaveProperty("resolvedSlotHeight");
  });
});
