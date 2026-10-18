// Run after pnpm build, from the repository root. Uses the shipped bundle and
// public production preparation/rendering seams; no policy or geometry injection.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { compileSource, loadBundle } from "../dist/index.js";
import { prepareCompiledGraphPreview } from "../dist/renderer/previewWorkflow.js";
import { renderUiContractsStagedSvg } from "../dist/renderer/staged/uiContracts.js";
import { renderPositionedSceneToPng } from "../dist/renderer/staged/svgBackend.js";
import { auditUiContractsScene, uiSceneItems } from "../dist/renderer/staged/uiContractsAcceptance.js";
import { registerStagedRendererTheme } from "../dist/renderer/staged/theme.js";
import { resolveStagedPreviewStyle } from "../dist/renderer/previewStyle.js";

const output = "/tmp/sdd-ui-contracts-production-proof";
const input = { path: "aeb_help_center_de_astra.sdd", text: await readFile("aeb_help_center_de_astra.sdd", "utf8") };
const sha = value => createHash("sha256").update(value).digest("hex");
const bundle = await loadBundle("bundle/v0.2/manifest.yaml");
const compiled = compileSource(input, bundle);
if (!compiled.graph || compiled.diagnostics.some(d => d.severity === "error")) throw new Error(JSON.stringify(compiled.diagnostics));
// Read Git metadata without spawning a nested shell/process (restricted WSL
// runtimes can reject spawnSync even after the child successfully exits).
const head = (await readFile(".git/HEAD", "utf8")).trim();
let revision = head;
if (head.startsWith("ref: ")) {
  const reference = head.slice(5);
  try { revision = (await readFile(`.git/${reference}`, "utf8")).trim(); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    revision = (await readFile(".git/packed-refs", "utf8")).split("\n").find(line => line.endsWith(` ${reference}`))?.split(" ")[0];
    if (!revision) throw new Error("Cannot resolve proof checkout revision.");
  }
}
const sourceFiles = [];
async function sources(path) {
  for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const file = `${path}/${entry.name}`;
    if (entry.isDirectory()) await sources(file);
    else if (file.endsWith(".ts") || file.endsWith(".yaml")) sourceFiles.push(file);
  }
}
await sources("src"); await sources("bundle/v0.2");
const sourceIdentity = createHash("sha256");
for (const path of sourceFiles) sourceIdentity.update(path).update("\0").update(await readFile(path)).update("\0");
await mkdir(output, { recursive: true });
const report = { sourceSha256: sha(input.text), revision, runtimeAndBundleSha256: sourceIdentity.digest("hex"),
  manifest: "bundle/v0.2/manifest.yaml", results: [] };
for (const diagramId of [undefined, "DG-002"]) {
  const prepared = prepareCompiledGraphPreview(input.path, compiled.graph, bundle, {
    viewId: "ui_contracts", diagramId, format: "svg", profileId: "simple", detailId: "compact", nodeDecoratorModeId: "type,id"
  });
  if (!prepared.prepared || prepared.diagnostics.some(d => d.severity === "error")) throw new Error(JSON.stringify(prepared.diagnostics));
  const settings = { detailId: "compact", nodeDecoratorMode: { id: "type,id", showNodeType: true, showNodeId: true },
    themeId: registerStagedRendererTheme("default", resolveStagedPreviewStyle(bundle, prepared.view)) };
  const rendered = await renderUiContractsStagedSvg(prepared.prepared.projection, compiled.graph, prepared.view, settings);
  const scene = rendered.positionedScene, audit = auditUiContractsScene(scene), name = diagramId ? "dg002" : "full";
  if (rendered.routingOutcome?.status !== "accepted" || audit.length || rendered.diagnostics.some(d => d.severity === "error")) throw new Error(JSON.stringify({ name, audit, diagnostics: rendered.diagnostics }));
  const inventory = scene.root.viewMetadata.uiContracts.inventory;
  const scope = uiSceneItems(scene.root).find(item => item.id === "scope:P-360005333058");
  const proofItems = inventory.occurrences.filter(item => ["VS-001", "VS-002"].includes(item.semanticId));
  const loop = scene.edges.find(edge => edge.viewMetadata?.uiTransition?.kind === "loop");
  const binding = loop && scene.uiRoutingBindings.find(binding => binding.id === loop.id);
  const loopGeometry = loop ? { side: binding.source.side, pitch: Math.abs(loop.from.x - loop.to.x),
    depth: Math.abs(loop.route.points[1].y - loop.from.y), label: loop.label, bounds: scope } : undefined;
  const svgPath = `${output}/${name}.svg`, positionedPath = `${output}/${name}.positioned.json`;
  // The evidence driver must match the actual CLI export, when it already exists.
  try {
    const existing = await readFile(svgPath, "utf8");
    if (existing !== rendered.svg) throw new Error(`Production CLI and evidence driver SVG differ: ${svgPath}`);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  await writeFile(svgPath, rendered.svg); await writeFile(positionedPath, JSON.stringify(scene, null, 2) + "\n");
  const png = await renderPositionedSceneToPng(scene);
  if (png.svg !== rendered.svg) throw new Error("PNG did not consume the identical accepted SVG.");
  await writeFile(`${output}/${name}.png`, png.png);
  report.results.push({ name, settings, policy: scene.uiAcceptancePolicy, nodes: inventory.occurrences.length,
    relationships: inventory.relationships.length, physicalConnectors: scene.edges.length,
    proofCards: proofItems.map(item => { const node = uiSceneItems(scene.root).find(node => node.id === item.id); return { semanticId: item.semanticId, width: node.width, height: node.height }; }),
    loop: loopGeometry, evidence: rendered.routingOutcome.evidence, finalAudit: audit,
    svg: svgPath, svgSha256: sha(rendered.svg), png: `${output}/${name}.png`, pngSha256: sha(png.png), positionedScene: positionedPath });
}
await writeFile(`${output}/acceptance-report.json`, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(JSON.stringify(report.results.map(result => ({ name: result.name, nodes: result.nodes, relationships: result.relationships,
  connectors: result.physicalConnectors, side: result.loop?.side, budget: { candidates: result.evidence.candidates, repairs: result.evidence.repairs, expansions: result.evidence.expansions }, findings: result.finalAudit.length })), null, 2) + "\n");
