import { describe, expect, it } from "vitest";
import type { MeasuredNode } from "../src/renderer/staged/contracts.js";
import { buildSharedNode } from "../src/renderer/staged/sceneBuilders.js";
import { buildSharedNodeRendererScene, renderSharedNodesStagedPng, renderSharedNodesStagedSvg } from "../src/renderer/staged/sharedNodeRenderer.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { createTextMeasurementService } from "../src/renderer/staged/textMeasurement.js";
import { getRendererTheme, registerRendererTheme, resolveRendererTheme, resolveSharedNodeTheme } from "../src/renderer/staged/theme.js";

const request = {
  title: "Parent 0", nodeType: "Component", nodeId: "C-100", attributes: [],
  decoratorMode: { id: "none", showNodeType: false, showNodeId: false }
};
const options = { detailId: "detailed" };
const decorated = { id: "type,id", showNodeType: true, showNodeId: true };
const nodes = (result: Awaited<ReturnType<typeof renderSharedNodesStagedSvg>>) =>
  result.measuredScene.root.children as MeasuredNode[];

describe("shared node emphasis", () => {
  it("keeps omitted and false emphasis identical, including regular SVG output", async () => {
    const regular = await renderSharedNodesStagedSvg([request], options);
    const explicit = await renderSharedNodesStagedSvg([{ ...request, emphasized: false }], options);
    expect(explicit.svg).toBe(regular.svg);
    expect(buildSharedNode({ ...request, emphasized: false })).toEqual(buildSharedNode(request));
    expect(regular.svg).not.toContain("shared-node--emphasized");
    expect(regular.svg).not.toContain("font-weight: 700");
  });

  it("uses Bold metrics and a 2px inside outline only for selected nodes", async () => {
    const result = await renderSharedNodesStagedSvg([
      request, { ...request, nodeId: "C-101", emphasized: true }
    ], options);
    const [regular, emphasized] = nodes(result);
    expect(regular).toMatchObject({ width: 224, height: 48 });
    expect(emphasized).toMatchObject({ width: 224, height: 48, sharedNode: {
      emphasized: true, body: { x: 2, y: 2, width: 220, height: 44 }
    } });
    const theme = resolveSharedNodeTheme(getRendererTheme("default"), true);
    const title = theme.textStyles[theme.sharedNode.titleTextStyleRole];
    expect(title.fontWeight).toBe(700);
    expect(emphasized.sharedNode!.body.title.width).toBe(
      createTextMeasurementService(theme.fontFaces).measureText(request.title, title)
    );
    expect(emphasized.sharedNode!.body.title.width).toBeGreaterThan(regular.sharedNode!.body.title.width);
    expect(result.positionedScene.root.children[1]).toMatchObject({ sharedNode: { emphasized: true } });
    expect(result.svg.match(/<g[^>]*class="[^"]*shared-node--emphasized[^>]*>/g)).toHaveLength(2);
    expect(result.svg).toContain('.shared-node--emphasized .shared-node__outline { fill: none; stroke: #387575; stroke-width: 2; }');
    expect(result.svg).toContain('--sdd-shared-node-emphasized-title-font-weight: 700;');
    expect(result.svg).toContain('width="222" height="46" rx="13"');
    expect(result.svg).toContain('font-weight: 700');
    expect(result.diagnostics).toEqual([]);
  });

  it("wraps at the Bold boundary before selecting density and height", async () => {
    const theme = structuredClone(getRendererTheme("default"));
    theme.id = "emphasis-wrap-boundary";
    const text = "Checkout Area";
    const measurement = createTextMeasurementService(theme.fontFaces);
    theme.sharedNode.width = measurement.measureText(text, theme.textStyles.shared_node_title) + 31;
    registerRendererTheme(theme);
    const result = await renderSharedNodesStagedSvg([
      { ...request, title: text },
      { ...request, nodeId: "bold", title: text, emphasized: true }
    ], { ...options, themeId: theme.id });
    const [regular, emphasized] = nodes(result);
    expect(regular.sharedNode!.body.title.lines).toEqual([text]);
    expect(emphasized.sharedNode!.body.title.lines).toEqual(["Checkout", "Area"]);
    expect(emphasized.sharedNode!.density).toBe("dense");
    expect(emphasized.height).toBe(54);
  });

  it("inherits regular style roles and merges nested global deltas without mutation", async () => {
    const theme = structuredClone(getRendererTheme("default"));
    theme.id = "emphasis-custom";
    theme.sharedNode.fill = "#faf0db";
    theme.sharedNode.titleTextStyleRole = "custom_title";
    theme.textStyles.custom_title = { ...theme.textStyles.shared_node_title, fontSize: 18, lineHeight: 24, letterSpacing: 0.25 };
    theme.sharedNodeEmphasis = {
      strokeWidth: 3, body: { padding: { left: 20 } }, decorator: { fill: "#ccddee" },
      textStyles: { title: { fontWeight: 400 }, attributeValue: { fontSize: 14, lineHeight: 17 } }
    };
    const original = structuredClone(theme);
    registerRendererTheme(theme);
    const effective = resolveSharedNodeTheme(theme, true);
    expect(effective.sharedNode.body.padding).toEqual({ top: 6, right: 14, bottom: 6, left: 20 });
    expect(effective.sharedNode.fill).toBe("#faf0db");
    expect(effective.textStyles[effective.sharedNode.titleTextStyleRole]).toEqual({
      ...theme.textStyles.custom_title, fontWeight: 400
    });
    expect(theme).toEqual(original);
    const result = await renderSharedNodesStagedSvg([
      { ...request, decoratorMode: decorated, emphasized: true,
        attributes: [{ groupId: "event", label: "event", value: "Alert emitted" }] },
      { ...request, nodeId: "regular", decoratorMode: decorated }
    ], { ...options, themeId: theme.id });
    expect(nodes(result)[0].sharedNode!.body.title).toMatchObject({ x: 23, lineHeight: 24 });
    expect(nodes(result)[0].sharedNode!.body.attributeGroups[0].values[0].lineHeight).toBe(17);
    expect(nodes(result)[1].sharedNode!.body.title.x).toBe(15.5);
    expect(result.svg).toContain('.shared-node--emphasized .shared-node__decorator-header { fill: #ccddee; }');
    expect(result.svg).toContain('--sdd-shared-node-emphasized-title-font-size: 18px;');
    theme.sharedNodeEmphasis.strokeWidth = 9;
    expect(resolveSharedNodeTheme(getRendererTheme(theme.id), true).sharedNode.strokeWidth).toBe(3);
    expect(resolveSharedNodeTheme(getRendererTheme("default"), true).sharedNode.strokeWidth).toBe(2);
  });

  it("measures wrapping, decorated content, and shared-height reflow with effective enclosure spacing", async () => {
    const theme = structuredClone(getRendererTheme("default"));
    theme.id = "emphasis-spacing";
    theme.sharedNodeEmphasis = { container: { padding: { left: 3, bottom: 8 } } };
    registerRendererTheme(theme);
    const scene = buildSharedNodeRendererScene([
      { ...request, emphasized: true },
      { ...request, nodeId: "dense", emphasized: true, decoratorMode: decorated,
        title: "Book a flight to a chosen destination",
        attributes: [{ groupId: "event", label: "event", value: "Alert emitted" }] }
    ], { ...options, themeId: theme.id });
    scene.root.children.forEach((node) => { node.sharedHeightGroup = "equal"; });
    scene.root.children[0].classes.push("chrome-dashed");
    const result = await runStagedRendererPipeline(scene);
    const [plain, dense] = result.measuredScene.root.children as MeasuredNode[];
    expect(plain.height).toBe(dense.height);
    expect(plain.sharedNode!.body.height).toBe(plain.height - plain.sharedNode!.body.y - 10);
    expect(plain.sharedNode!.body.title.y).toBe(
      plain.sharedNode!.body.y + (plain.sharedNode!.body.height - 19) / 2
    );
    expect(dense.sharedNode!.body.title.lines.length).toBeGreaterThan(1);
    expect(dense.sharedNode!.decorator!.items).toHaveLength(2);
    const svg = await renderPositionedSceneToSvg(result.positionedScene);
    expect(svg.svg).toContain('.scene-node.chrome-dashed .shared-node__outline { stroke-dasharray: 8 6; }');
    expect(svg.svg).toContain('stroke-width: 2;');
  });

  it("tracks font weights introduced only by emphasis deltas", () => {
    const theme = structuredClone(getRendererTheme("default"));
    theme.id = "emphasis-missing-face";
    theme.sharedNodeEmphasis = { textStyles: { decorator: { fontWeight: 800 } } };
    registerRendererTheme(theme);
    expect(resolveRendererTheme(theme.id).diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "renderer.measure.incomplete_font_weight" })
    ]));
  });

  it("renders deterministic SVG and PNG from the same emphasized scene", async () => {
    const input = [{ ...request, emphasized: true, decoratorMode: decorated }];
    const first = await renderSharedNodesStagedPng(input, options);
    const second = await renderSharedNodesStagedPng(input, options);
    expect(second.svg).toBe(first.svg);
    expect(second.png).toEqual(first.png);
    expect([...first.png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(nodes(first)[0].height).toBe(54);
  });
});
