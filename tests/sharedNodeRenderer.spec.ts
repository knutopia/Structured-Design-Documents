import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";
import type { MeasuredNode, NodeDecoratorMode } from "../src/renderer/staged/contracts.js";
import { buildSharedNode } from "../src/renderer/staged/sceneBuilders.js";
import {
  buildSharedNodeRendererScene,
  renderSharedNodesStagedSvg
} from "../src/renderer/staged/sharedNodeRenderer.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import {
  getRendererTheme,
  registerRendererTheme
} from "../src/renderer/staged/theme.js";
import { expectRendererStageTextSnapshot } from "./rendererStageSnapshotHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const none: NodeDecoratorMode = { id: "none", showNodeType: false, showNodeId: false };
const typeOnly: NodeDecoratorMode = { id: "type", showNodeType: true, showNodeId: false };
const typeAndId: NodeDecoratorMode = { id: "type,id", showNodeType: true, showNodeId: true };
const acceptanceAttributes = [
  { groupId: "description", label: "description", value: "First value" },
  { groupId: "owner", label: "owner", value: "Design" },
  { groupId: "description", label: "description", value: "Second value" }
];
const acceptanceRequests = [
  { title: "Node Title", decoratorMode: typeAndId, nodeType: "Component", nodeId: "C-010a", attributes: [] },
  { title: "Node Title", decoratorMode: none, nodeType: "Component", nodeId: "C-010b", attributes: [] },
  { title: "Book a flight to a chosen destination", decoratorMode: typeAndId, nodeType: "Component", nodeId: "C-020a", attributes: [] },
  { title: "Book a flight to a chosen destination", decoratorMode: none, nodeType: "Component", nodeId: "C-020b", attributes: [] },
  { title: "Node Title", decoratorMode: typeAndId, nodeType: "Component", nodeId: "C-030a", attributes: acceptanceAttributes },
  { title: "Node Title", decoratorMode: none, nodeType: "Component", nodeId: "C-030b", attributes: acceptanceAttributes },
  { title: "Book a flight to a chosen destination", decoratorMode: typeAndId, nodeType: "Component", nodeId: "C-040a", attributes: acceptanceAttributes },
  { title: "Book a flight to a chosen destination", decoratorMode: none, nodeType: "Component", nodeId: "C-040b", attributes: acceptanceAttributes }
];

function firstMeasuredNode(result: Awaited<ReturnType<typeof renderSharedNodesStagedSvg>>): MeasuredNode {
  const node = result.measuredScene.root.children[0];
  if (!node || node.kind !== "node" || !node.sharedNode) {
    throw new Error("Expected a measured shared node.");
  }
  return node;
}

describe("shared node renderer", () => {
  it("accepts semantic content without caller-selected visual variants", () => {
    const node = buildSharedNode({
      title: "Node Title",
      decoratorMode: none,
      nodeType: "Component",
      nodeId: "C-010",
      attributes: []
    });

    expect(node).toMatchObject({
      id: "C-010",
      role: "component",
      widthPolicy: { preferred: "standard", allowed: ["standard"] },
      overflowPolicy: { kind: "grow_height" },
      content: [],
      sharedNode: {
        title: "Node Title",
        nodeType: "Component",
        nodeId: "C-010",
        attributes: []
      }
    });
  });

  it("infers plain centering and dense flow from measured content", async () => {
    const plain = firstMeasuredNode(await renderSharedNodesStagedSvg([{
      title: "Node Title",
      decoratorMode: none,
      nodeType: "Component",
      nodeId: "C-010",
      attributes: []
    }], { detailId: "detailed" }));
    expect(plain).toMatchObject({ width: 224, height: 48 });
    expect(plain.sharedNode).toMatchObject({
      density: "plain",
      body: {
        x: 1.5,
        y: 1.5,
        width: 221,
        height: 45,
        title: { x: 15.5, y: 14.5, height: 19, lineHeight: 19 }
      }
    });

    const dense = firstMeasuredNode(await renderSharedNodesStagedSvg([{
      title: "Book a flight to a chosen destination",
      decoratorMode: typeOnly,
      nodeType: "Component",
      nodeId: "C-010",
      attributes: []
    }], { detailId: "detailed" }));
    expect(dense.height).toBe(72);
    expect(dense.sharedNode).toMatchObject({
      density: "dense",
      decorator: { x: 1.5, y: 1.5, width: 221, height: 19 },
      body: {
        x: 1.5,
        y: 20.5,
        width: 221,
        height: 50,
        title: {
          x: 15.5,
          y: 26.5,
          lines: ["Book a flight to a chosen", "destination"],
          height: 38,
          lineHeight: 19
        }
      }
    });
    expect(dense.sharedNode?.decorator?.items.map((item) => item.lines)).toEqual([["Component"]]);
  });

  it("groups repeated attributes in first-occurrence and value order", async () => {
    const measured = firstMeasuredNode(await renderSharedNodesStagedSvg([{
      title: "Book a flight to a chosen destination",
      decoratorMode: typeAndId,
      nodeType: "Component",
      nodeId: "C-010",
      attributes: [
        { groupId: "description", label: "description", value: "First value" },
        { groupId: "owner", label: "owner", value: "Design" },
        { groupId: "description", label: "description", value: "Second value" }
      ]
    }], { detailId: "detailed" }));

    expect(measured.height).toBe(152);
    expect(measured.sharedNode?.decorator?.items.map((item) => item.lines[0])).toEqual([
      "Component",
      "C-010"
    ]);
    expect(measured.sharedNode?.body.attributeGroups.map((group) => ({
      id: group.id,
      label: group.label.lines,
      values: group.values.map((value) => value.lines)
    }))).toEqual([
      {
        id: "description",
        label: ["description"],
        values: [["First value"], ["Second value"]]
      },
      {
        id: "owner",
        label: ["owner"],
        values: [["Design"]]
      }
    ]);
  });

  it("emits stable structural SVG and exposes all canonical line heights as CSS values", async () => {
    const rendered = await renderSharedNodesStagedSvg([{
      title: "Book a flight to a chosen destination",
      decoratorMode: typeAndId,
      nodeType: "Component",
      nodeId: "C-010",
      attributes: [
        { groupId: "description", label: "description", value: "First value" },
        { groupId: "description", label: "description", value: "Second value" }
      ]
    }], { detailId: "detailed" });

    expect(rendered.svg).toContain('class="shared-node__decorator-header"');
    expect(rendered.svg).toContain('class="shared-node__body"');
    expect(rendered.svg).toContain('class="shared-node__attribute-group" data-attribute-group="description"');
    expect(rendered.svg).toContain("--sdd-shared-node-decorator-line-height: 12px");
    expect(rendered.svg).toContain("--sdd-shared-node-title-line-height: 19px");
    expect(rendered.svg).toContain("--sdd-shared-node-attribute-label-line-height: 12px");
    expect(rendered.svg).toContain("--sdd-shared-node-attribute-value-line-height: 14px");
    expect(rendered.svg).toContain("--sdd-shared-node-title-letter-spacing: -0.32px");
    expect(rendered.svg).toContain('<tspan x="31.5" dy="19">destination</tspan>');
  });

  it("matches the committed standalone Figma acceptance matrix", async () => {
    const rendered = await renderSharedNodesStagedSvg(acceptanceRequests, {
      detailId: "detailed",
      columns: 2,
      gap: 24
    });

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    await expectRendererStageTextSnapshot("shared-node.acceptance.svg", rendered.svg);
  });

  it("uses one effective theme for both geometry and emitted CSS", async () => {
    const overridden = structuredClone(getRendererTheme("default"));
    overridden.id = "shared-node-test-line-height";
    overridden.textStyles.shared_node_title.lineHeight = 20;
    registerRendererTheme(overridden);

    const measured = firstMeasuredNode(await renderSharedNodesStagedSvg([{
      title: "Book a flight to a chosen destination",
      decoratorMode: typeOnly,
      nodeType: "Component",
      nodeId: "C-010",
      attributes: []
    }], { detailId: "detailed", themeId: overridden.id }));
    const rendered = await renderSharedNodesStagedSvg([{
      title: "Book a flight to a chosen destination",
      decoratorMode: typeOnly,
      nodeType: "Component",
      nodeId: "C-010",
      attributes: []
    }], { detailId: "detailed", themeId: overridden.id });

    expect(measured.height).toBe(74);
    expect(measured.sharedNode?.body.title.lineHeight).toBe(20);
    expect(rendered.svg).toContain("--sdd-shared-node-title-line-height: 20px");
  });

  it("wraps unbroken Unicode text by grapheme without losing content", async () => {
    const title = "Design👩🏽‍💻SystemDesign👩🏽‍💻SystemDesign👩🏽‍💻System";
    const measured = firstMeasuredNode(await renderSharedNodesStagedSvg([{
      title,
      decoratorMode: none,
      nodeType: "Component",
      nodeId: "C-UNICODE",
      attributes: []
    }], { detailId: "detailed" }));

    expect(measured.sharedNode!.body.title.lines.length).toBeGreaterThan(1);
    expect(measured.sharedNode!.body.title.lines.join("")).toBe(title);
  });

  it("recenters an inferred plain title when a shared-height allocation enlarges it", async () => {
    const scene = buildSharedNodeRendererScene([
      {
        title: "Short title",
        decoratorMode: none,
        nodeType: "Component",
        nodeId: "C-SHORT",
        attributes: []
      },
      {
        title: "Book a flight to a chosen destination",
        decoratorMode: typeAndId,
        nodeType: "Component",
        nodeId: "C-TALL",
        attributes: []
      }
    ], { detailId: "detailed" });
    scene.root.children.forEach((node) => {
      node.sharedHeightGroup = "comparison";
    });

    const result = await runStagedRendererPipeline(scene);
    const short = result.measuredScene.root.children[0];
    const tall = result.measuredScene.root.children[1];
    if (short?.kind !== "node" || tall?.kind !== "node" || !short.sharedNode || !tall.sharedNode) {
      throw new Error("Expected shared nodes.");
    }

    expect(short.height).toBe(72);
    expect(tall.height).toBe(72);
    expect(short.sharedNode.density).toBe("plain");
    expect(short.sharedNode.body.title.y).toBe(26.5);
  });

  it("carries the CLI decorator selection through the staged preview request", async () => {
    const bundle = await loadBundle(path.join(repoRoot, "bundle/v0.1/manifest.yaml"));
    const sourcePath = path.join(repoRoot, "docs/good_node_rendering/unified_node.sdd");
    const result = await renderSourcePreview({
      path: sourcePath,
      text: await readFile(sourcePath, "utf8")
    }, bundle, {
      viewId: "ui_contracts",
      format: "svg",
      profileId: "simple",
      detailId: "compact",
      nodeDecoratorModeId: "type,id"
    });

    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.artifact?.format).toBe("svg");
    if (result.artifact?.format !== "svg") throw new Error("Expected an SVG artifact.");
    expect(result.artifact.text).toContain("Component");
    expect(result.artifact.text).toContain("C-030");
    expect(result.artifact.text).toContain("shared-node__decorator-item");
  });
});
