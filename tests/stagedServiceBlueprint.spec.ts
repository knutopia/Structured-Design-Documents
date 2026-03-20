import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import {
  SERVICE_BLUEPRINT_STAGED_DISABLED_DIAGNOSTIC_CODE,
  buildServiceBlueprintRendererScene,
  renderServiceBlueprintStagedSvg
} from "../src/renderer/staged/serviceBlueprint.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function resolveServiceBlueprintContext(
  input: { path: string; text: string },
  profileId: string
) {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "service_blueprint");
  if (!view) {
    throw new Error("Could not resolve the service_blueprint view.");
  }

  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics).toEqual([]);
  if (!compiled.graph) {
    throw new Error(`Could not compile ${input.path}.`);
  }

  const projected = projectView(compiled.graph, bundle, "service_blueprint");
  expect(projected.diagnostics).toEqual([]);
  if (!projected.projection) {
    throw new Error(`Could not project ${input.path} to service_blueprint.`);
  }

  return {
    graph: compiled.graph,
    projection: projected.projection,
    view
  };
}

async function loadExampleInput(fileName: string): Promise<{ path: string; text: string }> {
  const filePath = path.join(repoRoot, "bundle/v0.1/examples", fileName);
  return {
    path: filePath,
    text: await readFile(filePath, "utf8")
  };
}

describe("staged service_blueprint", () => {
  it("builds a deterministic lane scene for the sample slice", async () => {
    const context = await resolveServiceBlueprintContext(
      await loadExampleInput("service_blueprint_slice.sdd"),
      "recommended"
    );

    const rendererScene = buildServiceBlueprintRendererScene(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );

    expect(rendererScene.root.layout).toEqual({
      strategy: "stack",
      direction: "vertical",
      gap: 18
    });
    expect(rendererScene.root.children.map((child) => child.id)).toEqual([
      "lane:01:customer",
      "lane:02:frontstage",
      "lane:03:backstage",
      "lane:04:support",
      "lane:05:system",
      "lane:06:policy"
    ]);
  });

  it("fails closed with a high-signal renderer error instead of emitting staged preview geometry", async () => {
    const context = await resolveServiceBlueprintContext(
      await loadExampleInput("service_blueprint_slice.sdd"),
      "recommended"
    );

    const rendered = await renderServiceBlueprintStagedSvg(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );

    expect(rendered.svg).toBe("");
    expect(rendered.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      SERVICE_BLUEPRINT_STAGED_DISABLED_DIAGNOSTIC_CODE
    );
    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toHaveLength(1);
    expect(rendered.diagnostics[0]?.message).toContain("ELK-authoritative final geometry");
    expect(rendered.diagnostics[0]?.message).toContain("--backend legacy_graphviz_preview");
  });

  it("appends a synthetic ungrouped lane during scene construction when projection omits derived lane mapping", async () => {
    const source = `
SDD-TEXT 0.1

Step J-100 "Start"
END

Process PR-100 "Investigate"
END
`;
    const context = await resolveServiceBlueprintContext({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_ungrouped__.sdd"),
      text: source.trimStart()
    }, "recommended");

    const rendererScene = buildServiceBlueprintRendererScene(
      context.projection,
      context.graph,
      context.view,
      "recommended"
    );

    expect(rendererScene.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "renderer.scene.service_blueprint_ungrouped_lane"
    );
    expect(rendererScene.root.children.map((child) => child.id)).toEqual([
      "lane:01:customer",
      "lane:99:ungrouped"
    ]);
  });

  it("keeps disconnected scene construction deterministic in lane order", async () => {
    const source = `
SDD-TEXT 0.1

Step J-200 "Start"
END

Process PR-200 "Assist"
  visibility=support
END

SystemAction SA-200 "Log"
END
`;
    const firstContext = await resolveServiceBlueprintContext({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_disconnected_a__.sdd"),
      text: source.trimStart()
    }, "recommended");
    const secondContext = await resolveServiceBlueprintContext({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_disconnected_b__.sdd"),
      text: source.trimStart()
    }, "recommended");

    const firstScene = buildServiceBlueprintRendererScene(
      firstContext.projection,
      firstContext.graph,
      firstContext.view,
      "recommended"
    );
    const secondScene = buildServiceBlueprintRendererScene(
      secondContext.projection,
      secondContext.graph,
      secondContext.view,
      "recommended"
    );

    expect(firstScene).toEqual(secondScene);
  });
});
