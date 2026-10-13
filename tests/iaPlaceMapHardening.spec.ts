import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import { compileSource } from "../src/compiler/compileSource.js";
import { projectView } from "../src/projector/projectView.js";
import { buildIaPlaceMapRenderModel, resolveIaPlaceMapRelationshipRuntime } from "../src/renderer/iaPlaceMapRenderModel.js";
import { resolveDetailDisplayPolicy } from "../src/renderer/detailDisplay.js";
import { renderSource } from "../src/renderer/renderView.js";
import { buildIaPlaceMapRendererScene } from "../src/renderer/staged/iaPlaceMap.js";
import type { Bundle } from "../src/bundle/types.js";
import type { CompiledGraph } from "../src/compiler/types.js";
import type { Projection } from "../src/projector/types.js";
import type { ViewSpec } from "../src/bundle/types.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(repoRoot, "tests/fixtures/render/ia_parallel_navigation_v02.sdd");

async function context(sourcePath = fixturePath, overrideText?: string): Promise<{
  bundle: Bundle;
  view: ViewSpec;
  graph: CompiledGraph;
  text: string;
  projection: Projection;
}> {
  const bundle = await loadBundle(path.join(repoRoot, "bundle/v0.2/manifest.yaml"));
  const view = bundle.views.views.find((candidate) => candidate.id === "ia_place_map");
  if (!view) throw new Error("Could not load the ia_place_map view.");
  const text = overrideText ?? await readFile(sourcePath, "utf8");
  const compiled = compileSource({ path: sourcePath, text }, bundle);
  if (!compiled.graph) throw new Error(`Could not compile fixture: ${JSON.stringify(compiled.diagnostics)}`);
  const projected = projectView(compiled.graph, bundle, "ia_place_map");
  if (!projected.projection) throw new Error(`Could not project fixture: ${JSON.stringify(projected.diagnostics)}`);
  return { bundle, view, graph: compiled.graph, text, projection: projected.projection };
}

function buildModel(input: Awaited<ReturnType<typeof context>>, diagramId?: string, detailId = "detailed") {
  const projected = diagramId
    ? projectView(input.graph, input.bundle, "ia_place_map", { diagramId })
    : { projection: input.projection };
  if (!projected.projection) throw new Error(`Could not project ${diagramId ?? "combined"}.`);
  const config = input.view.conventions.renderer_defaults?.ia_place_map;
  if (!config) throw new Error("Expected the v0.2 IA occurrence policy.");
  return buildIaPlaceMapRenderModel(
    projected.projection,
    input.graph,
    input.view.projection.hierarchy_edges ?? [],
    resolveDetailDisplayPolicy(input.view, detailId),
    config,
    detailId,
    resolveIaPlaceMapRelationshipRuntime(input.bundle, config)
  );
}

function renderLegacy(input: Awaited<ReturnType<typeof context>>, format: "dot" | "mermaid", diagramId?: string, detailId = "detailed") {
  return renderSource({ path: fixturePath, text: input.text }, input.bundle, {
    viewId: "ia_place_map",
    ...(diagramId ? { diagramId } : {}),
    format,
    profileId: "simple",
    detailId
  });
}

describe("ia_place_map occurrence labels and scene inventory", () => {
  it("keeps the complete authored occurrence and label inventory in combined and named selections", async () => {
    const input = await context();
    const combined = buildModel(input);
    const fullNamed = buildModel(input, "DG-001");
    const expected = [
      { from: "P-001", to: "P-002", label: "[Open current workspace] {workspace selected}" },
      { from: "P-001", to: "P-002", label: "[Accept invitation] {invitation valid}" },
      { from: "P-002", to: "P-003", label: undefined },
      { from: "P-002", to: "P-001", label: undefined }
    ];

    expect(combined.edges.map(({ from, to, label }) => ({ from, to, label }))).toEqual(expected);
    expect(fullNamed.edges.map(({ from, to, label }) => ({ from, to, label }))).toEqual(expected);
    expect(fullNamed.edges.map((edge) => edge.source_edge_id)).toEqual(combined.edges.map((edge) => edge.source_edge_id));
    expect(buildModel(input, "DG-002").edges.map(({ from, to, label }) => ({ from, to, label }))).toEqual([expected[0]]);
    expect(buildModel(input, "DG-003").edges.map(({ from, to, label }) => ({ from, to, label }))).toEqual([expected[1]]);

    const scene = buildIaPlaceMapRendererScene(input.projection, input.graph, input.view, { detailId: "detailed" }, input.bundle);
    const inventory = scene.root.viewMetadata?.iaPlaceMap;
    expect(inventory?.expectedNavigationOccurrences.map(({ from, to, label }) => ({ from, to, label }))).toEqual(expected);
    expect(inventory?.expectedNavigationOccurrences.map((occurrence) => occurrence.sourceEdgeId)).toEqual(
      combined.edges.map((edge) => edge.source_edge_id)
    );
    expect(inventory?.expectedNavigationOccurrences.every((occurrence) =>
      scene.edges.some((edge) => edge.id === occurrence.connectorId)
    )).toBe(true);

    const fused = inventory?.expectedStructuralEdges.find((edge) => edge.from === "P-002" && edge.to === "P-003");
    expect(fused).toEqual(expect.objectContaining({ role: "contains_navigation" }));
    expect(fused?.sourceEdgeIds).toHaveLength(2);
  });

  it("applies bundle detail visibility to common prepared labels", async () => {
    const input = await context();
    const mutatedView = structuredClone(input.view);
    const config = mutatedView.conventions.renderer_defaults?.ia_place_map;
    if (!config) throw new Error("Expected the IA presentation policy in the bundle.");
    config.navigation.presentation.detail_display.compact = false;
    const model = buildIaPlaceMapRenderModel(
      input.projection,
      input.graph,
      mutatedView.projection.hierarchy_edges ?? [],
      resolveDetailDisplayPolicy(mutatedView, "compact"),
      config,
      "compact",
      resolveIaPlaceMapRelationshipRuntime(input.bundle, config)
    );
    expect(model.edges.map((edge) => edge.label)).toEqual([undefined, undefined, undefined, undefined]);
    expect(buildModel(input, undefined, "detailed").edges.map((edge) => edge.label)).toContain("[Open current workspace] {workspace selected}");
  });

  it("qualifies repeated event display names consistently across named subsets", async () => {
    const original = await readFile(fixturePath, "utf8");
    const text = original
      .replace('Event E-001 "Open current workspace"', 'Event E-001 "Workspace action"')
      .replace('Event E-002 "Accept invitation"', 'Event E-002 "Workspace action"');
    const input = await context(fixturePath, text);

    expect(buildModel(input).edges[0]?.label).toBe("[Workspace action (E-001)] {workspace selected}");
    expect(buildModel(input, "DG-002").edges[0]?.label).toBe("[Workspace action (E-001)] {workspace selected}");
    expect(buildModel(input, "DG-003").edges[0]?.label).toBe("[Workspace action (E-002)] {invitation valid}");
  });

  it("adds the prepared labels to legacy DOT and Mermaid outputs for both detail levels", async () => {
    const input = await context();
    for (const detailId of ["compact", "detailed"]) {
      const dot = renderLegacy(input, "dot", undefined, detailId);
      const mermaid = renderLegacy(input, "mermaid", undefined, detailId);
      expect(dot.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(mermaid.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(dot.text).toContain('"P-001" -> "P-002" [label="[Open current workspace] {workspace selected}"];');
      expect(dot.text).toContain('"P-001" -> "P-002" [label="[Accept invitation] {invitation valid}"];');
      expect(mermaid.text).toContain("n_P_001 -->|[Open current workspace] {workspace selected}| n_P_002");
      expect(mermaid.text).toContain("n_P_001 -->|[Accept invitation] {invitation valid}| n_P_002");
      expect((mermaid.text?.match(/n_P_001 -->/g) ?? []).length).toBe(2);
    }

    const escapedInput = await context(
      fixturePath,
      input.text.replace("{workspace selected}", '{workspace "selected" | valid}')
    );
    const escapedDot = renderLegacy(escapedInput, "dot");
    const escapedMermaid = renderLegacy(escapedInput, "mermaid");
    expect(escapedDot.text).toContain('label="[Open current workspace] {workspace \\"selected\\" | valid}"');
    expect(escapedMermaid.text).toContain("|[Open current workspace] {workspace &quot;selected&quot; / valid}|");
  });
});
