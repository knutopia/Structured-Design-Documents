import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type {
  PositionedContainer,
  PositionedEdge,
  PositionedItem
} from "../src/renderer/staged/contracts.js";
import {
  buildServiceBlueprintRendererScene,
  renderServiceBlueprintStagedSvg
} from "../src/renderer/staged/serviceBlueprint.js";
import {
  expectRendererStageSnapshot,
  expectRendererStageTextSnapshot
} from "./rendererStageSnapshotHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

function findPositionedItem(root: PositionedContainer, id: string): PositionedItem {
  const queue: PositionedItem[] = [...root.children];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.id === id) {
      return current;
    }

    if (current.kind === "container") {
      queue.push(...current.children);
    }
  }

  throw new Error(`Could not find positioned item "${id}".`);
}

function findEdge(
  scene: Awaited<ReturnType<typeof buildServiceBlueprintArtifacts>>["rendered"]["positionedScene"],
  edgeId: string
): PositionedEdge {
  const edge = scene.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) {
    throw new Error(`Could not find positioned edge "${edgeId}".`);
  }

  return edge;
}

async function buildServiceBlueprintArtifactsFromInput(
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

  const rendererScene = buildServiceBlueprintRendererScene(projected.projection, compiled.graph, view, profileId);
  const rendered = await renderServiceBlueprintStagedSvg(projected.projection, compiled.graph, view, profileId);

  return {
    rendererScene,
    rendered
  };
}

async function buildServiceBlueprintArtifacts(examplePath: string, profileId: string) {
  return buildServiceBlueprintArtifactsFromInput({
    path: examplePath,
    text: await readFile(examplePath, "utf8")
  }, profileId);
}

describe("staged service_blueprint", () => {
  it("matches committed staged snapshots for the sample slice and preserves blueprint lane semantics", async () => {
    const examplePath = path.join(repoRoot, "bundle/v0.1/examples/service_blueprint_slice.sdd");
    const { rendererScene, rendered } = await buildServiceBlueprintArtifacts(examplePath, "recommended");

    expect(rendered.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(rendered.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "renderer.layout.elk_lanes_second_pass_unstable"
    );
    expect(rendered.positionedScene.root.children.map((child) => child.id)).toEqual([
      "lane:01:customer",
      "lane:02:frontstage",
      "lane:03:backstage",
      "lane:04:support",
      "lane:05:system",
      "lane:06:policy"
    ]);

    const submitClaim = findPositionedItem(rendered.positionedScene.root, "J-020");
    const validateClaim = findPositionedItem(rendered.positionedScene.root, "PR-020");
    const reviewClaimHistory = findPositionedItem(rendered.positionedScene.root, "PR-021");
    const notifyCustomer = findPositionedItem(rendered.positionedScene.root, "PR-022");
    const storeClaim = findPositionedItem(rendered.positionedScene.root, "SA-020");
    const loadClaimHistory = findPositionedItem(rendered.positionedScene.root, "SA-021");
    const sendEmail = findPositionedItem(rendered.positionedScene.root, "SA-022");
    const claimEntity = findPositionedItem(rendered.positionedScene.root, "D-020");
    const retentionPolicy = findPositionedItem(rendered.positionedScene.root, "PL-020");

    if (
      submitClaim.kind !== "node"
      || validateClaim.kind !== "node"
      || reviewClaimHistory.kind !== "node"
      || notifyCustomer.kind !== "node"
      || storeClaim.kind !== "node"
      || loadClaimHistory.kind !== "node"
      || sendEmail.kind !== "node"
      || claimEntity.kind !== "node"
      || retentionPolicy.kind !== "node"
    ) {
      throw new Error("Expected positioned service_blueprint semantic nodes.");
    }

    expect(validateClaim.x).toBe(submitClaim.x);
    expect(storeClaim.x).toBe(validateClaim.x);
    expect(loadClaimHistory.x).toBe(reviewClaimHistory.x);
    expect(sendEmail.x).toBe(notifyCustomer.x);
    expect(claimEntity.x).toBeGreaterThan(sendEmail.x);
    expect(retentionPolicy.x).toBe(claimEntity.x);

    const readsRoute = findEdge(rendered.positionedScene, "SA-020__reads__D-020");
    const writesRoute = findEdge(rendered.positionedScene, "SA-020__writes__D-020");
    expect(readsRoute.route.points).not.toEqual(writesRoute.route.points);

    await expectRendererStageSnapshot("service-blueprint.slice.renderer-scene.json", rendererScene);
    await expectRendererStageSnapshot("service-blueprint.slice.measured-scene.json", rendered.measuredScene);
    await expectRendererStageSnapshot("service-blueprint.slice.positioned-scene.json", rendered.positionedScene);
    await expectRendererStageTextSnapshot("service-blueprint.slice.svg", rendered.svg);
  });

  it("appends a synthetic ungrouped lane when projected nodes have no derived lane mapping", async () => {
    const source = `
SDD-TEXT 0.1

Step J-100 "Start"
END

Process PR-100 "Investigate"
END
`;
    const { rendererScene, rendered } = await buildServiceBlueprintArtifactsFromInput({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_ungrouped__.sdd"),
      text: source.trimStart()
    }, "recommended");

    expect(rendererScene.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "renderer.scene.service_blueprint_ungrouped_lane"
    );
    expect(rendered.positionedScene.root.children.map((child) => child.id)).toEqual([
      "lane:01:customer",
      "lane:99:ungrouped"
    ]);
  });

  it("renders disconnected nodes deterministically in lane order", async () => {
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
    const first = await buildServiceBlueprintArtifactsFromInput({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_disconnected_a__.sdd"),
      text: source.trimStart()
    }, "recommended");
    const second = await buildServiceBlueprintArtifactsFromInput({
      path: path.join(repoRoot, "tests/fixtures/render/__inline_service_blueprint_disconnected_b__.sdd"),
      text: source.trimStart()
    }, "recommended");

    expect(first.rendered.positionedScene).toEqual(second.rendered.positionedScene);
  });
});
