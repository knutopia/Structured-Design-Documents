import { mkdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { RendererScene, SceneItem } from "../src/renderer/staged/contracts.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { renderPositionedSceneToPng, renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import { assessUiContractsGeometry, flattenUiContractsItems } from "./uiContractsB5Acceptance.js";
import { proofStack } from "./uiContractsFanoutProof.js";

describe("native B5 container headers", () => {
  it("measures one line before sizing ancestors and paints the interior before the outline", async () => {
    const title = 'Component scope · A deliberately long title with <escaped> characters & a repeated hierarchy reference';
    const box = proofStack("long-title", [], "vertical");
    box.primitive = "cluster";
    box.chrome.padding = { top: 16, right: 16, bottom: 16, left: 16 };
    box.viewMetadata = { uiContracts: { kind: "enclosure", title } };
    const untitled = { ...structuredClone(box), id: "untitled", viewMetadata: { uiContracts: { kind: "enclosure" as const } } };
    const scene: RendererScene = { viewId: "ui_contracts", detailId: "compact", themeId: "default", diagnostics: [], edges: [], root: proofStack("root", [box, untitled], "vertical", 16) };
    scene.root.chrome.padding = { top: 16, right: 16, bottom: 16, left: 16 };
    const result = await runStagedRendererPipeline(scene);
    expect(assessUiContractsGeometry(result.positionedScene)).toEqual([]);
    const child = result.positionedScene.root.children[0];
    expect(child.kind).toBe("container");
    if (child.kind !== "container") throw new Error("Expected container");
    expect(child.headerContent[0].lines).toEqual([title]);
    expect(child.chrome.headerBandHeight).toBe(19);
    expect(child.width).toBeGreaterThan(500);
    expect(child.headerContent[0].x).toBe(14);
    const rendered = await renderPositionedSceneToPng(result.positionedScene);
    expect(rendered.diagnostics).toEqual([]);
    expect(rendered.svg.indexOf('<rect class="ui-contracts-container__body"')).toBeLessThan(rendered.svg.indexOf('<path class="ui-contracts-container__title-band"'));
    expect(rendered.svg.indexOf('<path class="ui-contracts-container__title-band"')).toBeLessThan(rendered.svg.indexOf('<rect class="ui-contracts-container__outline"'));
    expect(rendered.svg).toContain('&lt;escaped&gt; characters &amp;');
    expect(rendered.svg.match(/<path class="ui-contracts-container__title-band"/g)).toHaveLength(1);
    expect(rendered.svg).not.toContain('class="scene-container__header-band"');
    expect(rendered.svg).toContain("font-size: 10px; font-weight: 600");
    expect(rendered.png.subarray(1, 4).toString()).toBe("PNG");
    await mkdir("/tmp/sdd-b5-headers", { recursive: true });
    await writeFile("/tmp/sdd-b5-headers/long-title.svg", rendered.svg);
    await writeFile("/tmp/sdd-b5-headers/long-title.png", rendered.png);
  });

  it("adds native titles to all twelve B5 inputs without moving nodes, connectors, or labels", async () => {
    const evidence = JSON.parse(await readFile("docs/hierarchical_ui_contracts/b5_pipeline_evidence.json", "utf8"));
    for (const proof of evidence.proofs) {
      const scene: RendererScene = structuredClone(proof.rendererScene);
      const mark = (item: SceneItem): void => {
        if (item.kind !== "container") return;
        const title = proof.containerTitles[item.id];
        if (title) item.viewMetadata = { uiContracts: { kind: "enclosure", title } };
        item.children.forEach(mark);
      };
      mark(scene.root);
      const result = await runStagedRendererPipeline(scene);
      expect(assessUiContractsGeometry(result.positionedScene), proof.file).toEqual([]);
      const nodes = (root: typeof result.positionedScene.root) => flattenUiContractsItems(root).filter(item => item.kind === "node");
      expect(nodes(result.positionedScene.root)).toEqual(nodes(proof.positionedScene.root));
      expect(JSON.parse(JSON.stringify(result.positionedScene.edges))).toEqual(proof.positionedScene.edges);
      const rendered = await renderPositionedSceneToSvg(result.positionedScene);
      expect(rendered.diagnostics).toEqual([]);
      await mkdir("/tmp/sdd-b5-headers", { recursive: true });
      await writeFile(`/tmp/sdd-b5-headers/${proof.file}.svg`, rendered.svg);
    }
  });
});
