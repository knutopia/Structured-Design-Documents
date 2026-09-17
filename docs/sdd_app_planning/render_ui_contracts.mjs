// One-off helper: render the ui_contracts view for sdd_for_sdd.sdd and write
// the SVG artifact even when the renderer reports routing diagnostics that
// would normally cause the CLI to exit non-zero and drop the artifact.
//
// The CLI's `show` command discards the artifact whenever any error-severity
// diagnostic is present (see renderSourcePreview / renderPreparedCompiledGraphPreview
// in src/renderer/previewWorkflow.ts). This script bypasses that gate by calling
// the staged renderer directly and writing the produced SVG regardless.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const { loadBundle } = await import(join(repoRoot, "dist", "index.js"));
const { compileSource } = await import(join(repoRoot, "dist", "compiler", "compileSource.js"));
const { projectView } = await import(join(repoRoot, "dist", "projector", "projectView.js"));
const { renderUiContractsStagedSvg } = await import(join(repoRoot, "dist", "renderer", "staged", "uiContracts.js"));

const inputPath = join(here, "sdd_for_sdd.sdd");
const manifestPath = join(repoRoot, "bundle", "v0.1", "manifest.yaml");

const bundle = await loadBundle(manifestPath);
const text = await readFile(inputPath, "utf8");

const compiled = compileSource({ path: inputPath, text }, bundle);
if (!compiled.graph) {
  console.error("Compilation produced no graph.");
  console.error(JSON.stringify(compiled.diagnostics, null, 2));
  process.exit(1);
}

const view = bundle.views.views.find((v) => v.id === "ui_contracts");
if (!view) {
  console.error("ui_contracts view not found in bundle.");
  process.exit(1);
}

const projected = projectView(compiled.graph, bundle, "ui_contracts");
if (!projected.projection) {
  console.error("Projection produced no projection.");
  console.error(JSON.stringify(projected.diagnostics, null, 2));
  process.exit(1);
}

const settings = {
  detailId: "compact",
  themeId: "default",
  nodeDecoratorMode: {
    id: "type,id",
    showNodeType: true,
    showNodeId: true
  }
};

const result = await renderUiContractsStagedSvg(
  projected.projection,
  compiled.graph,
  view,
  settings
);

const outPath = join(here, "sdd_for_sdd.sdd.ui_contracts.compact.decorators-type,id.svg");
await writeFile(outPath, result.svg, "utf8");

console.log(`Wrote ${outPath}`);
if (result.diagnostics && result.diagnostics.length) {
  console.log(`Diagnostics (${result.diagnostics.length}):`);
  for (const d of result.diagnostics) {
    console.log(`  [${d.severity}] ${d.code}: ${d.message}`);
  }
}
