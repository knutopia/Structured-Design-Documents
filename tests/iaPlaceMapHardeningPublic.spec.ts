import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { compileSource } from "../src/compiler/compileSource.js";
import { runCli, type CliDeps } from "../src/cli/program.js";
import { renderSourcePreview, prepareCompiledGraphPreview, renderPreparedCompiledGraphPreview } from "../src/renderer/previewWorkflow.js";
import { getPreviewBackend } from "../src/renderer/previewBackends.js";
import { renderPreview, AuthoringPreviewError } from "../src/authoring/preview.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";

const sourcePath = path.resolve("tests/fixtures/render/ia_parallel_navigation_v02.sdd");
let bundle: Bundle, text: string;
beforeAll(async () => {
  bundle = await loadBundle("bundle/v0.2/manifest.yaml");
  text = await readFile(sourcePath, "utf8");
});

async function cli(options: string[]) {
  const files = new Map<string, string | Uint8Array>();
  const messages: string[] = [];
  const deps: Partial<CliDeps> = {
    loadBundle: async () => bundle,
    readSourceInput: async () => ({ path: sourcePath, text }),
    stdout: value => { messages.push(value); }, stderr: value => { messages.push(value); },
    writeTextFile: async (file, content) => { files.set(file, content); },
    writeBinaryFile: async (file, content) => { files.set(file, content); },
    defaultsConfig: { getGlobalConfigPath: () => "/tmp/ia-hardening-defaults.yaml", read: async () => undefined,
      set: async file => ({ changed: false, path: file }), unset: async file => ({ changed: false, path: file }) }
  };
  const result = await runCli(["node", "sdd", "show", sourcePath, "--bundle", bundle.manifestPath,
    "--profile", "simple", "--out", "/tmp/ia-public.svg", ...options], deps);
  return { ...result, files, messages: messages.join("\n") };
}

describe("IA hardening public artifact paths", () => {
  it("withholds actual exhausted endpoint capacity under force in combined and named output", async () => {
    const declaration = '    NAVIGATES_TO P-002 [E-001] {workspace selected} diagrams="DG-001,DG-002"';
    const crowded = text.replace(declaration, Array(24).fill(declaration).join("\n"));
    for (const diagramId of [undefined, "DG-001"]) {
      const result = await renderSourcePreview({ path: sourcePath, text: crowded }, bundle, {
        viewId: "ia_place_map", diagramId, format: "svg", profileId: "simple", detailId: "compact", force: true });
      expect(result.artifact).toBeUndefined();
      expect(result.diagnostics.some(d => d.code === "renderer.routing.ia_port_capacity_exhausted")).toBe(true);
      expect(result.diagnostics.some(d => d.severity === "warn" && d.message.includes("Duplicate"))).toBe(true);
    }
  });
  it.each(["compact", "detailed"])("agrees between source and serialized compiled API paths in %s", async detailId => {
    const compiled = compileSource({ path: sourcePath, text }, bundle);
    expect(compiled.graph).toBeDefined();
    const serializedGraph = JSON.parse(JSON.stringify(compiled.graph));
    for (const diagramId of [undefined, "DG-001", "DG-002", "DG-003"]) {
      const options = { viewId: "ia_place_map", diagramId, format: "svg" as const, profileId: "simple", detailId };
      const source = await renderSourcePreview({ path: sourcePath, text }, bundle, options);
      const prepared = prepareCompiledGraphPreview(sourcePath, serializedGraph, bundle, options);
      const fromGraph = await renderPreparedCompiledGraphPreview(sourcePath, serializedGraph, bundle, prepared);
      expect(source.diagnostics.filter(d => d.severity === "error")).toEqual([]);
      expect(fromGraph.diagnostics.filter(d => d.severity === "error")).toEqual([]);
      expect(source.artifact?.format).toBe("svg");
      expect(fromGraph.artifact?.format).toBe("svg");
      // Author ordering is intentionally not serialized with the graph. This
      // comparison checks selected occurrence identity and label payloads.
      const sourceSvg = source.artifact!.format === "svg" ? source.artifact!.text : "";
      const graphSvg = fromGraph.artifact!.format === "svg" ? fromGraph.artifact!.text : "";
      for (const label of diagramId === "DG-002" ? ["Open current workspace"] : diagramId === "DG-003"
        ? ["Accept invitation"] : ["Open current workspace", "Accept invitation"]) {
        expect(sourceSvg).toContain(label);
        expect(graphSvg).toContain(label);
      }
      const ids = (svg: string) => [...new Set([...svg.matchAll(/data-edge-id="([^"]+)"/g)].map(m => m[1]))].sort();
      expect(ids(graphSvg)).toEqual(ids(sourceSvg));
      expect(ids(graphSvg).length).toBe(diagramId === "DG-002" || diagramId === "DG-003" ? 1 : 4);
    }
  });

  it.each(["compact", "detailed"])("materializes distinct named batches and preserves IA in combined batches in %s", async detail => {
    const named = await cli(["--diagram", "all", "--view", "ia_place_map", "--detail", detail]);
    expect(named.exitCode, named.messages).toBe(0);
    expect([...named.files.keys()]).toEqual(["DG-001", "DG-002", "DG-003"]
      .map(id => `/tmp/ia-public.ia_place_map.diagram-${id}.svg`));
    const combined = await cli(["--view", "all", "--detail", detail]);
    expect(combined.files.has("/tmp/ia-public.ia_place_map.svg"), combined.messages).toBe(true);
    expect(combined.files.get("/tmp/ia-public.ia_place_map.svg")).toContain("Open current workspace");
    // Other view failures are per-target findings, not IA failures.
  });

  it("never publishes a fatal IA renderer artifact under force in either selection mode", async () => {
    const backend = getPreviewBackend("staged_ia_place_map_preview");
    const stub = vi.spyOn(backend, "render").mockResolvedValue({ format: "svg", text: "invalid-artifact",
      diagnostics: [{ phase: "routing", severity: "error", code: "renderer.routing.ia_place_map_capacity_exhausted",
        message: "The bounded layout cannot allocate distinct tracks." }] });
    try {
      for (const diagramId of [undefined, "DG-001"]) {
        const result = await renderSourcePreview({ path: sourcePath, text }, bundle, {
          viewId: "ia_place_map", diagramId, format: "svg", profileId: "simple", detailId: "compact", force: true
        });
        expect(result.artifact).toBeUndefined();
        expect(result.diagnostics.some(d => d.code === "renderer.routing.ia_place_map_capacity_exhausted")).toBe(true);
      }
      const root = await mkdtemp(path.join(os.tmpdir(), "ia-failed-helper-"));
      try {
        await writeFile(path.join(root, "navigation.sdd"), text);
        await expect(renderPreview(createAuthoringWorkspace(root), bundle, { path: "navigation.sdd", view_id: "ia_place_map",
          profile_id: "simple", detail_id: "compact", format: "svg" })).rejects.toBeInstanceOf(AuthoringPreviewError);
      } finally { await rm(root, { recursive: true, force: true }); }
    } finally { stub.mockRestore(); }
  });

  it("materializes accepted helper SVG and PNG previews for combined and named selection", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ia-helper-"));
    try {
      await writeFile(path.join(root, "navigation.sdd"), text);
      const workspace = createAuthoringWorkspace(root);
      for (const diagram_id of [undefined, "DG-001", "DG-002", "DG-003"]) {
        for (const format of ["svg", "png"] as const) {
          const result = await renderPreview(workspace, bundle, { path: "navigation.sdd", view_id: "ia_place_map", diagram_id,
            profile_id: "simple", detail_id: "compact", format });
          expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);
          const bytes = await readFile(result.artifact_path);
          if (format === "png") expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
          else expect(bytes.toString()).toContain(diagram_id === "DG-003" ? "Accept invitation" : "Open current workspace");
        }
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
