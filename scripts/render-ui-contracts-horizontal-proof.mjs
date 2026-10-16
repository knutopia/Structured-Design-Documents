import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { compileSource, loadBundle } from "../dist/index.js";
import { projectView } from "../dist/projector/projectView.js";
import { buildUiContractsRendererScene, renderUiContractsStagedPng } from "../dist/renderer/staged/uiContracts.js";
import { runStagedRendererPipeline } from "../dist/renderer/staged/pipeline.js";
import { renderSvgToPng } from "../dist/renderer/svgArtifacts.js";
import { resolveRendererTheme } from "../dist/renderer/staged/theme.js";

// Run from the repository root after pnpm run build. These are renderer proofs,
// not bundle examples or snapshot inputs.
const path = "tests/fixtures/render/ui_contracts_horizontal.sdd";
const output = "docs/toolchain/ui_contracts_horizontal_proof";
const bundle = await loadBundle("bundle/v0.2/manifest.yaml");
const compiled = compileSource({ path, text: await readFile(path, "utf8") }, bundle);
assert.deepEqual(compiled.diagnostics, []);
const graph = compiled.graph;
const projection = projectView(graph, bundle, "ui_contracts").projection;
const theme = resolveRendererTheme("default", "backend").theme;
const evidence = [];
await mkdir(output, { recursive: true });
for (const name of ["compact", "detailed", "wide-title"]) {
  const detailId = name === "compact" ? "compact" : "detailed";
  const view = structuredClone(bundle.views.views.find(view => view.id === "ui_contracts"));
  if (name === "wide-title") view.conventions.renderer_defaults.ui_contracts_presentation.labels.target_register =
    "Referenced targets · Help Center search, article delivery, feedback collection, and external service contracts used across all supported regions, including follow-up notifications and asynchronous search indexing";
  const result = await renderUiContractsStagedPng(projection, graph, view, { detailId });
  assert.deepEqual(result.diagnostics, []);
  await writeFile(`${output}/${name}.svg`, `${result.svg}\n`);
  await writeFile(`${output}/${name}.png`, result.png);
  const groups = result.positionedScene.root.children.filter(item => item.kind === "container" && item.layout.pack?.fitContent);
  const scene = buildUiContractsRendererScene(projection, graph, view, { detailId });
  if (name !== "wide-title") {
    for (const child of scene.root.children) if (child.kind === "container" && child.layout.pack?.fitContent) child.layout.pack.fitContent = false;
    const before = await runStagedRendererPipeline(scene);
    for (const group of groups) {
      const original = before.positionedScene.root.children.find(child => child.id === group.id);
      assert.deepEqual(group.children, original.children);
      assert.equal(group.height, original.height);
      assert.ok(group.width < original.width);
    }
  }
  for (const group of groups) {
    // Crop the SVG viewport for inspection; scene geometry and routes stay intact.
    const cropped = result.svg.replace(/<svg\b[^>]*>/, tag => tag
      .replace(/width="[^"]*"/, `width="${group.width}"`)
      .replace(/height="[^"]*"/, `height="${group.height}"`)
      .replace(/viewBox="[^"]*"/, `viewBox="${group.x} ${group.y} ${group.width} ${group.height}"`));
    await writeFile(`${output}/${name}.${group.id}.png`, await renderSvgToPng(cropped, {
      dpi: theme.dpi, fontFamily: theme.fontFamily, pngFontAssetPaths: theme.fontFaces.map(face => face.pngFontAssetPath)
    }));
  }
  const ordinaryWidth = Math.max(0, ...result.positionedScene.root.children.filter(item => !groups.includes(item)).map(item => item.width));
  evidence.push({ name, detailId, ordinaryWidth, width: result.positionedScene.root.width, height: result.positionedScene.root.height,
    diagnostics: result.diagnostics, groups: groups.map(group => ({ id: group.id, width: group.width, height: group.height,
      titleMinimum: Math.max(0, ...group.headerContent.map(block => block.x + block.width + group.chrome.padding.right)),
      rows: [...new Set(group.children.map(card => card.y))].map(y => group.children.filter(card => card.y === y).map(card => card.id)),
      cards: group.children.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })) })) });
}
await writeFile(`${output}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Wrote ${evidence.length} production renderer proofs to ${output}`);
