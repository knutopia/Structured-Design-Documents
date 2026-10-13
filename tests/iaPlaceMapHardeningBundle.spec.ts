import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { beforeAll, describe, expect, it } from "vitest";
import {
  loadBundle
} from "../src/bundle/loadBundle.js";
import { computeBundleFingerprint } from "../src/bundle/fingerprint.js";
import type { Bundle } from "../src/bundle/types.js";
import { compileSource } from "../src/compiler/compileSource.js";
import { projectDiagram, projectView } from "../src/projector/projectView.js";
import { resolveDiagramSelection } from "../src/diagrams/resolveDiagrams.js";
import { renderPreviewArtifact } from "../src/renderer/previewBackends.js";
import { renderPreparedProjectionText, renderSource } from "../src/renderer/renderView.js";
import type { Projection } from "../src/projector/types.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundlePath = path.join(repoRoot, "bundle/v0.2/manifest.yaml");
const fixturePath = path.join(repoRoot, "tests/fixtures/render/ia_parallel_navigation_v02.sdd");

let bundle: Bundle;
let fixture: string;

beforeAll(async () => {
  [bundle, fixture] = await Promise.all([
    loadBundle(bundlePath),
    readFile(fixturePath, "utf8")
  ]);
});

function compiled(graphBundle: Bundle = bundle) {
  const result = compileSource({ path: fixturePath, text: fixture }, graphBundle);
  expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  expect(result.graph).toBeDefined();
  return result.graph!;
}

async function withLoadedViewMutation<T>(
  mutate: (
    views: Record<string, unknown>,
    iaPolicy: Record<string, unknown>,
    contracts: Record<string, unknown>
  ) => void,
  run: (loaded: Bundle) => Promise<T> | T
): Promise<T> {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "sdd-ia-policy-"));
  const copiedBundle = path.join(temporary, "v0.2");
  try {
    await cp(path.join(repoRoot, "bundle/v0.2"), copiedBundle, { recursive: true });
    const viewsPath = path.join(copiedBundle, "core/views.yaml");
    const contractsPath = path.join(copiedBundle, "core/contracts.yaml");
    const views = YAML.parse(await readFile(viewsPath, "utf8")) as Record<string, unknown>;
    const contracts = YAML.parse(await readFile(contractsPath, "utf8")) as Record<string, unknown>;
    const viewList = views.views as Array<Record<string, unknown>>;
    const iaView = viewList.find((view) => view.id === "ia_place_map")!;
    const conventions = iaView.conventions as Record<string, unknown>;
    const rendererDefaults = conventions.renderer_defaults as Record<string, unknown>;
    const iaPolicy = rendererDefaults.ia_place_map as Record<string, unknown>;
    mutate(views, iaPolicy, contracts);
    await writeFile(viewsPath, YAML.stringify(views), "utf8");
    await writeFile(contractsPath, YAML.stringify(contracts), "utf8");
    const loaded = await loadBundle(path.join(copiedBundle, "manifest.yaml"));
    return await run(loaded);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function projectionOptions(viewId = "ia_place_map") {
  return {
    viewId,
    format: "dot" as const,
    profileId: "simple",
    detailId: "detailed"
  };
}

describe("IA place map bundle occurrence policy", () => {
  it("loads an opt-in exact-reference and navigation presentation contract", () => {
    const policy = bundle.views.views.find((view) => view.id === "ia_place_map")!.conventions.renderer_defaults!.ia_place_map!;
    expect(policy.projection_edge_references).toBe("exact_source_occurrences");
    expect(policy.navigation).toMatchObject({
      relationship: "NAVIGATES_TO",
      occurrence_coverage: "each_selected_occurrence_once",
      presentation: {
        parts: [
          { field: "event", template: "[{value}]", resolve_node_name: true },
          { field: "guard", template: "{{value}}", resolve_node_name: false }
        ],
        detail_display: { compact: true, detailed: true }
      },
      containment_fusion: {
        relationship: "CONTAINS",
        rule: "single_unannotated_navigation_occurrence"
      }
    });
  });

  it("emits exact source references for combined and named IA selections", () => {
    const graph = compiled();
    const selections = [
      { projection: projectView(graph, bundle, "ia_place_map").projection!, diagramId: undefined },
      ...["DG-001", "DG-002", "DG-003"].map((diagramId) => ({
        projection: projectDiagram(graph, bundle, diagramId).projection!,
        diagramId
      }))
    ];
    for (const { projection, diagramId } of selections) {
      expect(projection.edges.length).toBeGreaterThan(0);
      expect(projection.edges.every((edge) => edge.source_edge_id)).toBe(true);
      const selection = resolveDiagramSelection(graph, bundle, { viewId: "ia_place_map", diagramId });
      const expectedIds = selection.edges.map((edge) => selection.sourceEdgeIndex.idFor(edge)).sort();
      const actualIds = projection.edges.map((edge) => edge.source_edge_id).sort();
      expect(actualIds).toEqual(expectedIds);
    }
  });

  it("reconstructs occurrence indexes from the supplied serialized graph and projection", () => {
    const graph = compiled();
    const view = bundle.views.views.find((candidate) => candidate.id === "ia_place_map")!;
    const projection = JSON.parse(JSON.stringify(projectView(graph, bundle, view.id).projection)) as Projection;
    const detachedGraph = JSON.parse(JSON.stringify(graph));
    const rendered = renderPreparedProjectionText(detachedGraph, bundle, view, projection, projectionOptions());
    expect(rendered.text).toBeDefined();
    expect(rendered.diagnostics.some((diagnostic) => diagnostic.code === "project.invalid_source_edge_reference")).toBe(false);
  });

  it("rejects missing, stale, substituted, omitted, and duplicated combined occurrence references at public boundaries", async () => {
    const graph = compiled();
    const view = bundle.views.views.find((candidate) => candidate.id === "ia_place_map")!;
    const base = projectView(graph, bundle, view.id).projection!;
    const corruptions: Array<(projection: Projection) => void> = [
      (projection) => { projection.nodes = projection.nodes.filter(node => node.id !== "P-001"); },
      (projection) => projection.edges.forEach((edge) => { delete edge.source_edge_id; }),
      (projection) => { projection.edges[0]!.source_edge_id = "source-edge-stale"; },
      (projection) => {
        const parallels = projection.edges.filter((edge) => edge.type === "NAVIGATES_TO"
          && edge.from === "P-001" && edge.to === "P-002");
        expect(parallels).toHaveLength(2);
        parallels[0]!.source_edge_id = parallels[1]!.source_edge_id;
      },
      (projection) => { projection.edges.pop(); },
      (projection) => { projection.edges.push(structuredClone(projection.edges[0]!)); },
      (projection) => { projection.view_id = "scenario_flow"; }
    ];

    for (const corrupt of corruptions) {
      const projection = structuredClone(base);
      corrupt(projection);
      const rendered = renderPreparedProjectionText(graph, bundle, view, projection, projectionOptions());
      expect(rendered.text).toBeUndefined();
      expect(rendered.diagnostics.some((diagnostic) => diagnostic.code === "project.invalid_source_edge_reference")).toBe(true);
      await expect(renderPreviewArtifact({
        bundle,
        view,
        backendId: "staged_ia_place_map_preview",
        format: "svg",
        source: { kind: "projection", graph, projection, detailId: "detailed" }
      })).rejects.toMatchObject({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: "project.invalid_source_edge_reference", severity: "error" })
        ])
      });
    }
  });

  it("rejects an unselected named occurrence even when it has the same endpoint triple", () => {
    const graph = compiled();
    const view = bundle.views.views.find((candidate) => candidate.id === "ia_place_map")!;
    const projection = projectDiagram(graph, bundle, "DG-002").projection!;
    const otherOccurrence = projectDiagram(graph, bundle, "DG-003").projection!.edges.find((edge) =>
      edge.type === "NAVIGATES_TO" && edge.from === "P-001" && edge.to === "P-002")!.source_edge_id;
    const parallel = projection.edges.find((edge) => edge.type === "NAVIGATES_TO")!;
    parallel.source_edge_id = otherOccurrence;
    const result = renderPreparedProjectionText(graph, bundle, view, projection, projectionOptions());
    expect(result.text).toBeUndefined();
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "project.invalid_source_edge_reference")).toBe(true);
  });

  it("retains legacy combined projection behavior when the whole capability is absent", async () => {
    await withLoadedViewMutation((views) => {
      const viewList = views.views as Array<Record<string, unknown>>;
      const ia = viewList.find((view) => view.id === "ia_place_map")!;
      const defaults = (ia.conventions as Record<string, unknown>).renderer_defaults as Record<string, unknown>;
      delete defaults.ia_place_map;
    }, async (withoutPolicy) => {
      const original = projectView(compiled(), bundle, "ia_place_map").projection!;
      const legacy = projectView(compiled(withoutPolicy), withoutPolicy, "ia_place_map").projection!;
      expect(original.edges.every((edge) => edge.source_edge_id)).toBe(true);
      expect(legacy.edges.every((edge) => edge.source_edge_id === undefined)).toBe(true);
      expect(computeBundleFingerprint(withoutPolicy)).not.toBe(computeBundleFingerprint(bundle));
    });
  });

  it("uses real-loaded navigation presentation policy for order, templates, and detail visibility", async () => {
    const render = (loaded: Bundle, detailId = "detailed") => renderSource(
      { path: fixturePath, text: fixture },
      loaded,
      { viewId: "ia_place_map", format: "dot", profileId: "simple", detailId }
    );
    const original = render(bundle);
    expect(original.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(original.text).toContain('[Open current workspace] {workspace selected}');

    await withLoadedViewMutation((_views, policy) => {
      const navigation = policy.navigation as Record<string, unknown>;
      const presentation = navigation.presentation as Record<string, unknown>;
      const parts = presentation.parts as Array<Record<string, unknown>>;
      parts[0] = { field: "guard", template: "<{value}>", resolve_node_name: false };
      parts[1] = { field: "event", template: "<<{value}>>", resolve_node_name: true };
      presentation.separator = " :: ";
    }, async (loaded) => {
      const changed = render(loaded);
      expect(changed.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(changed.text).toContain('<workspace selected> :: <<Open current workspace>>');
      expect(changed.text).toContain('<invitation valid> :: <<Accept invitation>>');
    });

    await withLoadedViewMutation((_views, policy) => {
      const navigation = policy.navigation as Record<string, unknown>;
      const presentation = navigation.presentation as Record<string, unknown>;
      presentation.detail_display = { compact: true, detailed: false };
    }, async (loaded) => {
      const hidden = render(loaded);
      expect(hidden.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(hidden.text).not.toContain("workspace selected");
      expect(hidden.text).not.toContain("Open current workspace");
    });
  });

  it("resolves event names only when the loaded descriptor declares the event node type", async () => {
    await withLoadedViewMutation((_views, _policy, contracts) => {
      const relationships = contracts.relationships as Array<Record<string, unknown>>;
      const navigation = relationships.find((relationship) => relationship.type === "NAVIGATES_TO")!;
      navigation.presentation_annotation_references = { event: { node_type: "Place" } };
    }, async (loaded) => {
      const rendered = renderSource(
        { path: fixturePath, text: fixture },
        loaded,
        { viewId: "ia_place_map", format: "dot", profileId: "simple", detailId: "detailed" }
      );
      expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(rendered.text).toContain("[E-001]");
      expect(rendered.text).not.toContain("Open current workspace");
    });
  });

  it("leaves v0.1 and unrelated v0.2 combined projections without exact-reference fields", async () => {
    const v01 = await loadBundle(path.join(repoRoot, "bundle/v0.1/manifest.yaml"));
    const v01Path = path.join(repoRoot, "bundle/v0.1/examples/outcome_to_ia_trace.sdd");
    const v01Text = await readFile(v01Path, "utf8");
    const v01Graph = compileSource({ path: v01Path, text: v01Text }, v01).graph!;
    const v01Projection = projectView(v01Graph, v01, "ia_place_map").projection!;
    expect(v01Projection.edges.length).toBeGreaterThan(0);
    expect(v01Projection.edges.every((edge) => edge.source_edge_id === undefined)).toBe(true);

    const scenarioPath = path.join(repoRoot, "tests/fixtures/diagram-separation/scenario_control.sdd");
    const scenarioText = await readFile(scenarioPath, "utf8");
    const scenarioGraph = compileSource({ path: scenarioPath, text: scenarioText }, bundle).graph!;
    const scenarioProjection = projectView(scenarioGraph, bundle, "scenario_flow").projection!;
    expect(scenarioProjection.edges.length).toBeGreaterThan(0);
    expect(scenarioProjection.edges.every((edge) => edge.source_edge_id === undefined)).toBe(true);
  });

  it("rejects malformed policy combinations through the real bundle loader", async () => {
    const cases: Array<{
      code: string;
      mutate: (policy: Record<string, unknown>) => void;
    }> = [
      {
        code: "bundle.renderer.ia_place_map_detail_display",
        mutate: (policy) => {
          const nav = policy.navigation as Record<string, unknown>;
          const presentation = nav.presentation as Record<string, unknown>;
          presentation.detail_display = { compact: true };
        }
      },
      {
        code: "bundle.renderer.ia_place_map_label_part_field",
        mutate: (policy) => {
          const nav = policy.navigation as Record<string, unknown>;
          const presentation = nav.presentation as Record<string, unknown>;
          const parts = presentation.parts as Array<Record<string, unknown>>;
          parts[1]!.field = "effect";
        }
      },
      {
        code: "bundle.renderer.ia_place_map_label_part_reference",
        mutate: (policy) => {
          const nav = policy.navigation as Record<string, unknown>;
          const presentation = nav.presentation as Record<string, unknown>;
          const parts = presentation.parts as Array<Record<string, unknown>>;
          parts[1]!.resolve_node_name = true;
        }
      },
      {
        code: "bundle.renderer.ia_place_map_containment_fusion_relationship",
        mutate: (policy) => {
          const nav = policy.navigation as Record<string, unknown>;
          const fusion = nav.containment_fusion as Record<string, unknown>;
          fusion.relationship = "MISSING";
        }
      }
    ];

    for (const { code, mutate } of cases) {
      await expect(withLoadedViewMutation((_views, policy) => mutate(policy), () => undefined)).rejects.toMatchObject({
        diagnostics: expect.arrayContaining([expect.objectContaining({ code })])
      });
    }
  });

  it("validates presentation reference descriptors against supported annotation fields and vocabulary", async () => {
    const mutations: Array<{ code: string; mutate: (contracts: Record<string, unknown>) => void }> = [
      {
        code: "bundle.contracts.presentation_annotation_reference_field",
        mutate: (contracts) => {
          const relations = contracts.relationships as Array<Record<string, unknown>>;
          const navigation = relations.find((relationship) => relationship.type === "NAVIGATES_TO")!;
          navigation.presentation_annotation_references = { effect: { node_type: "Event" } };
        }
      },
      {
        code: "bundle.contracts.presentation_annotation_reference_node_type",
        mutate: (contracts) => {
          const relations = contracts.relationships as Array<Record<string, unknown>>;
          const navigation = relations.find((relationship) => relationship.type === "NAVIGATES_TO")!;
          navigation.presentation_annotation_references = { event: { node_type: "NotANodeType" } };
        }
      }
    ];
    for (const { code, mutate } of mutations) {
      await expect(withLoadedViewMutation((_views, _policy, contracts) => mutate(contracts), () => undefined)).rejects.toMatchObject({
        diagnostics: expect.arrayContaining([expect.objectContaining({ code })])
      });
    }
  });

});
