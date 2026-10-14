/** Review-2 trial capture. Run with TMPDIR=/tmp node --import tsx scripts/captureIaReview2Evidence.ts.
 * --policies export | export,loop | all loads a mutated temporary bundle through the real loader.
 * --case billsage,parallel --detail compact --decorator plain narrows trials.
 * Defaults to /tmp; never publishes repository evidence. --baseline-only summarizes preserved baselines.
 */
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { loadBundle } from "../src/bundle/loadBundle.js";
import { computeBundleFingerprint } from "../src/bundle/fingerprint.js";
import { compileSource } from "../src/compiler/compileSource.js";
import { projectView } from "../src/projector/projectView.js";
import { buildIaPlaceMapRendererScene } from "../src/renderer/staged/iaPlaceMap.js";
import { auditIaPlaceMapFinalScene, runIaPlaceMapRendererPipeline } from "../src/renderer/staged/iaPlaceMapRouting.js";
import { renderPositionedSceneToSvg } from "../src/renderer/staged/svgBackend.js";
import type { PositionedItem, PositionedScene } from "../src/renderer/staged/contracts.js";

const args = process.argv.slice(2);
function option(name: string) { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; }
const output = path.resolve(option("--out") ?? "/tmp/ia-review2-trials");
if (!output.startsWith("/tmp/")) throw new Error("Trial captures must stay in /tmp until visual and numerical gates are approved.");
await mkdir(output, { recursive: true });
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const save = (name: string, data: unknown) => writeFile(path.join(output, name), JSON.stringify(data, null, 2) + "\n");

function geometry(scene: PositionedScene) {
  const items: unknown[] = [];
  function visit(item: PositionedItem) {
    items.push({ id: item.id, kind: item.kind, x: item.x, y: item.y, width: item.width, height: item.height, ports: item.ports,
      ...(item.kind === "container" ? { chrome: item.chrome, layout: item.layout } : {}) });
    if (item.kind === "container") item.children.forEach(visit);
  }
  visit(scene.root);
  return { items, edges: scene.edges.map(edge => ({ id: edge.id, from: edge.from, to: edge.to, route: edge.route,
    label: edge.label, markers: edge.markers })) };
}
function metrics(scene: PositionedScene) {
  const inventory = scene.root.viewMetadata?.iaPlaceMap;
  const items = new Map<string, PositionedItem>();
  function index(item: PositionedItem) { items.set(item.id, item); if (item.kind === "container") item.children.forEach(index); }
  index(scene.root);
  const segments = scene.edges.flatMap(edge => edge.route.points.slice(1).map((to, index) => ({ id: edge.id,
    from: edge.route.points[index]!, to })));
  let crossings = 0;
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const a = segments[i]!, b = segments[j]!;
    if (a.id === b.id) continue;
    const ah = Math.abs(a.from.y - a.to.y) < 0.001, bh = Math.abs(b.from.y - b.to.y) < 0.001;
    if (ah === bh) continue;
    const h = ah ? a : b, v = ah ? b : a;
    if (v.from.x > Math.min(h.from.x, h.to.x) + 0.001 && v.from.x < Math.max(h.from.x, h.to.x) - 0.001
      && h.from.y > Math.min(v.from.y, v.to.y) + 0.001 && h.from.y < Math.max(v.from.y, v.to.y) - 0.001) crossings++;
  }
  const occurrences = inventory?.expectedNavigationOccurrences.map(occurrence => {
    const edge = scene.edges.find(edge => edge.id === occurrence.connectorId);
    return { from: occurrence.from, to: occurrence.to, sourceEdgeId: occurrence.sourceEdgeId,
      label: occurrence.label, lines: edge?.label?.lines, fromPort: edge?.from.portId, toPort: edge?.to.portId,
      fromSide: edge && items.get(edge.from.itemId)?.ports.find(port => port.id === edge.from.portId)?.side,
      toSide: edge && items.get(edge.to.itemId)?.ports.find(port => port.id === edge.to.portId)?.side,
      points: edge?.route.points, bends: Math.max(0, (edge?.route.points.length ?? 1) - 2) };
  });
  return { width: scene.root.width, height: scene.root.height, connectorCount: scene.edges.length,
    occurrenceCount: occurrences?.length, crossings, bends: segments.length - scene.edges.length,
    rootPadding: scene.root.chrome.padding, occurrences,
    expansions: scene.routingEvidence?.revisions.filter(revision => revision.expansion),
    consumedBudget: scene.routingEvidence && { candidates: scene.routingEvidence.candidates, repairs: scene.routingEvidence.repairs, expansions: scene.routingEvidence.expansionPasses, remainingCandidates: scene.routingEvidence.remainingCandidates, remainingRepairs: scene.routingEvidence.remainingRepairs, remainingExpansions: scene.routingEvidence.remainingExpansionPasses },
    diagnostics: scene.diagnostics, geometryHash: hash(JSON.stringify(geometry(scene))) };
}

if (args.includes("--baseline-only")) {
  const baselineDirectory = "/tmp/ia-review2-baseline";
  const records = [];
  for (const filename of (await readdir(baselineDirectory)).filter(name => name.endsWith(".json")).sort()) {
    const source = await readFile(path.join(baselineDirectory, filename), "utf8");
    records.push({ name: filename, sceneHash: hash(source), ...metrics(JSON.parse(source)) });
  }
  await save("baseline-metrics.json", { head: (await readFile(path.join(baselineDirectory, "head.txt"), "utf8")).trim(),
    status: await readFile(path.join(baselineDirectory, "status.txt"), "utf8"), records });
  console.log(`Summarized ${records.length} immutable baseline scenes to ${output}/baseline-metrics.json`);
  process.exit(0);
}

const parallelPath = "tests/fixtures/render/ia_parallel_navigation_v02.sdd";
const first = '    NAVIGATES_TO P-002 [E-001] {workspace selected} diagrams="DG-001,DG-002"';
const cases = [
  { name: "billsage", source: "tests/fixtures/render/billSage_structure.sdd", decorated: true },
  { name: "billsage-real", source: "real_world_exploration/billSage_example/billSage_simple_structure.sdd", decorated: true },
  { name: "parallel", source: parallelPath, decorated: true },
  ...["DG-001", "DG-002", "DG-003"].map(diagram => ({ name: diagram, source: parallelPath, diagram, decorated: false })),
  { name: "self-loop", source: parallelPath, decorated: false,
    mutate: (text: string) => text.replace(first, first + '\n    NAVIGATES_TO P-001 [E-001] {refresh workspace} diagrams=DG-001') },
  { name: "multiple-incoming", source: parallelPath, decorated: false,
    mutate: (text: string) => text.replace("    route_or_key=/workspace/settings", '    NAVIGATES_TO P-002 [E-001] {settings saved} diagrams=DG-001\n    route_or_key=/workspace/settings') }
];
const canonicalBundle = await loadBundle("bundle/v0.2/manifest.yaml");
const policies = args.includes("--all-policies") ? ["export", "loop", "forward"]
  : (option("--policies") ?? "").split(",").filter(Boolean);
if (policies.some(policy => !["export", "loop", "forward", "all"].includes(policy))) throw new Error("Unsupported --policies selector");
if (policies.includes("all")) policies.push("export", "loop", "forward");
let copiedDirectory: string | undefined;
let bundle = canonicalBundle;
if (policies.length) {
  copiedDirectory = await mkdtemp("/tmp/ia-review2-policy-");
  await cp("bundle/v0.2", copiedDirectory, { recursive: true });
  const viewsPath = path.join(copiedDirectory, "core/views.yaml");
  const views = YAML.parse(await readFile(viewsPath, "utf8"));
  const config = views.views.find((view: { id: string }) => view.id === "ia_place_map").conventions.renderer_defaults.ia_place_map;
  if (policies.includes("export")) config.routing_scope.export_clearance = "readable_gap";
  if (policies.includes("loop") || policies.includes("forward")) config.navigation.routing_preferences ??= {};
  if (policies.includes("loop")) config.navigation.routing_preferences.self_loop = {
    traversal: { axis: "x", direction: "negative" }, side_trials: [
      { side: "south", pair_placement: "before_other_arrivals" }, { side: "north", pair_placement: "nearest_feasible" }
    ]
  };
  if (policies.includes("forward")) config.navigation.routing_preferences.forward_shortcut = {
    scope: "same_owner", progression: { axis: "y", direction: "positive" }, side_pairs: [{ source: "south", target: "west" }],
    source_offset: "nearest_feasible", admission: "fewer_scene_bends_without_extra_crossings_or_expansion"
  };
  const modified = YAML.stringify(views);
  await writeFile(viewsPath, modified);
  await writeFile(path.join(output, "loaded-views.yaml"), modified);
  bundle = await loadBundle(path.join(copiedDirectory, "manifest.yaml"));
}
const canonicalBundleFingerprint = computeBundleFingerprint(canonicalBundle);
const loadedBundleFingerprint = computeBundleFingerprint(bundle);
await save("bundle-policy.json", { policies, canonicalBundleFingerprint, loadedBundleFingerprint,
  policy: bundle.views.views.find(view => view.id === "ia_place_map")!.conventions.renderer_defaults!.ia_place_map,
  canonicalViewsSha256: hash(await readFile("bundle/v0.2/core/views.yaml", "utf8")),
  loadedViewsSha256: hash(await readFile(copiedDirectory ? path.join(copiedDirectory, "core/views.yaml") : "bundle/v0.2/core/views.yaml", "utf8")) });
const view = bundle.views.views.find(view => view.id === "ia_place_map")!;
const records: Array<Record<string, unknown>> = [];
const equivalence: Array<Record<string, unknown>> = [];
for (const proof of cases.filter(proof => !option("--case") || option("--case")!.split(",").includes(proof.name))) {
  const original = await readFile(proof.source, "utf8");
  const text = "mutate" in proof ? proof.mutate!(original) : original;
  const compiled = compileSource({ path: proof.source, text }, bundle);
  if (!compiled.graph || compiled.diagnostics.some(item => item.severity === "error")) throw new Error(`Invalid proof source ${proof.name}`);
  const projection = projectView(compiled.graph, bundle, view.id, "diagram" in proof ? { diagramId: proof.diagram } : undefined);
  if (!projection.projection) throw new Error(`Missing proof projection ${proof.name}`);
  for (const detailId of ["compact", "detailed"].filter(detail => !option("--detail") || option("--detail") === detail)) {
    const hashes = new Map<string, string>();
    for (const decorator of (proof.decorated ? ["plain", "type-id", "id", "type"] : ["plain"]).filter(mode => !option("--decorator") || option("--decorator") === mode)) {
      const key = `${proof.name}.${detailId}${decorator === "plain" ? "" : "." + decorator}`;
      await rm(path.join(output, `${key}.svg`), { force: true });
      const scene = buildIaPlaceMapRendererScene(projection.projection, compiled.graph, view, { detailId,
        nodeDecoratorMode: { id: decorator === "plain" ? "none" : decorator, showNodeId: decorator.includes("id"), showNodeType: decorator.includes("type") } }, bundle);
      const result = await runIaPlaceMapRendererPipeline(scene);
      const final = result.positionedScene;
      const audit = auditIaPlaceMapFinalScene(final);
      const failures = [...final.diagnostics.filter(item => item.severity === "error"), ...audit];
      await save(`${key}.json`, final);
      await save(`${key}.trace.json`, final.routingEvidence);
      await writeFile(path.join(output, `${key}.sdd`), text);
      const measured = metrics(final);
      const proofFailures: string[] = [];
      const expectedCount = proof.name.startsWith("billsage") ? 8 : ["DG-002", "DG-003"].includes(proof.name) ? 1
        : ["self-loop", "multiple-incoming"].includes(proof.name) ? 5 : 4;
      if (measured.connectorCount !== expectedCount || measured.occurrenceCount !== expectedCount) proofFailures.push(`Expected ${expectedCount} exact connectors/occurrences`);
      if (measured.crossings > (proof.name === "multiple-incoming" ? 1 : 0)) proofFailures.push("Crossing acceptance violated");
      if (proof.name.startsWith("billsage") && view.conventions.renderer_defaults?.ia_place_map?.navigation.routing_preferences?.forward_shortcut) {
        const shortcut = measured.occurrences?.find(edge => edge.from === "P-210" && edge.to === "P-230");
        const companion = measured.occurrences?.find(edge => edge.from === "P-210" && edge.to === "P-220");
        if (shortcut?.fromSide !== "south" || shortcut?.toSide !== "west" || shortcut.bends !== 1) proofFailures.push("BillSage south/west one-bend shortcut absent");
        if (companion?.bends !== 0) proofFailures.push("BillSage straight companion damaged");
      }
      if (proof.name === "self-loop" && view.conventions.renderer_defaults?.ia_place_map?.navigation.routing_preferences?.self_loop) {
        const loop = measured.occurrences?.find(edge => edge.from === edge.to);
        if (!loop?.points?.length || loop.points.at(-1)!.x >= loop.points[0]!.x) proofFailures.push("Backward loop traversal absent");
      }
      if (["DG-002", "DG-003"].includes(proof.name) && measured.occurrences?.[0]?.bends !== 0) proofFailures.push("Named singleton is not straight");
      hashes.set(decorator, measured.geometryHash);
      let svgHash: string | undefined;
      if (!failures.length && !proofFailures.length && ["plain", "type-id"].includes(decorator)) {
        const artifact = await renderPositionedSceneToSvg(final);
        await writeFile(path.join(output, `${key}.svg`), artifact.svg);
        svgHash = hash(artifact.svg);
      }
      records.push({ key, source: proof.source, sourceHash: hash(text), originalSourceHash: hash(original),
        canonicalBundleFingerprint, loadedBundleFingerprint, policies, svgHash, auditFailures: failures, proofFailures, ...measured });
      await save("summary.json", { status: "trial-only; visual and policy proof gates remain", records, equivalence });
      console.log(`${key}: ${final.edges.length} connectors; ${measured.crossings} crossings; ${failures.length} audit errors; ${proofFailures.length} proof errors; SVG ${svgHash ? "captured" : "not emitted"}`);
    }
    if (proof.decorated && ["id", "type", "type-id"].every(mode => hashes.has(mode))) {
      equivalence.push({ case: proof.name, detailId, equal: new Set([hashes.get("id"), hashes.get("type"), hashes.get("type-id")]).size === 1,
        hashes: Object.fromEntries(hashes) });
    }
  }
}
await save("summary.json", { status: "trial-only; visual and policy proof gates remain", records, equivalence });
if (equivalence.some(record => !record.equal) || records.some(record => (record.auditFailures as unknown[]).length || (record.proofFailures as unknown[]).length)) process.exitCode = 1;

if (copiedDirectory) await rm(copiedDirectory, { recursive: true, force: true });
