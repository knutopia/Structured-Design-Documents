import { describe, expect, it } from "vitest";
import type { MeasuredNode, RendererScene, SceneNode } from "../src/renderer/staged/contracts.js";
import {
  hasRendererErrors,
  sortRendererDiagnostics,
  type RendererDiagnostic
} from "../src/renderer/staged/diagnostics.js";
import { runStagedRendererPipeline } from "../src/renderer/staged/pipeline.js";
import { expectRendererStageSnapshot } from "./rendererStageSnapshotHarness.js";
import { buildFixtureScene } from "./stagedRendererFixtures.js";

function buildSingleNodeScene(node: SceneNode, themeId = "default"): RendererScene {
  return {
    viewId: "ia_place_map",
    profileId: "recommended",
    themeId,
    root: {
      kind: "container",
      id: "root",
      role: "diagram_root",
      primitive: "root",
      classes: ["diagram", "test_scene"],
      layout: {
        strategy: "stack",
        direction: "vertical",
        gap: 16,
        crossAlignment: "start"
      },
      chrome: {
        padding: {
          top: 16,
          right: 16,
          bottom: 16,
          left: 16
        },
        gutter: 16
      },
      ports: [],
      children: [node]
    },
    edges: [],
    diagnostics: []
  };
}

async function getOnlyMeasuredNode(scene: RendererScene): Promise<MeasuredNode> {
  const result = await runStagedRendererPipeline(scene);
  const child = result.measuredScene.root.children[0];
  if (!child || child.kind !== "node") {
    throw new Error("Expected exactly one measured node.");
  }

  return child;
}

describe("staged renderer contracts and harness", () => {
  it("matches committed renderer-stage snapshots for the synthetic fixture scene", async () => {
    const scene = buildFixtureScene();
    const result = await runStagedRendererPipeline(scene);

    await expectRendererStageSnapshot("fixture.renderer-scene.json", scene);
    await expectRendererStageSnapshot("fixture.measured-scene.json", result.measuredScene);
    await expectRendererStageSnapshot("fixture.positioned-scene.json", result.positionedScene);
  });

  it("sorts renderer diagnostics deterministically for snapshot-friendly output", async () => {
    const diagnostics: RendererDiagnostic[] = [
      {
        phase: "routing",
        code: "renderer.routing.stubbed",
        severity: "info",
        message: "Routing fallback",
        targetId: "edge-2"
      },
      {
        phase: "scene",
        code: "renderer.scene.unsupported_primitive",
        severity: "error",
        message: "Unsupported primitive combination",
        targetId: "node-9"
      },
      {
        phase: "layout",
        code: "renderer.layout.stubbed",
        severity: "warn",
        message: "Layout fallback",
        targetId: "root"
      },
      {
        phase: "measure",
        code: "renderer.measure.stubbed",
        severity: "info",
        message: "Measurement fallback",
        targetId: "node-2"
      }
    ];

    const sorted = sortRendererDiagnostics(diagnostics);

    expect(hasRendererErrors(sorted)).toBe(true);
    await expectRendererStageSnapshot("diagnostics.sorted.json", sorted);
  });

  it("returns the same staged pipeline result for repeated runs on identical scenes", async () => {
    const scene = buildFixtureScene();
    const first = await runStagedRendererPipeline(scene);
    const second = await runStagedRendererPipeline(scene);

    expect(first).toEqual(second);
  });

  it("keeps container-port deferral as internal state rather than a surfaced diagnostic", async () => {
    const result = await runStagedRendererPipeline(buildFixtureScene());
    const area = result.positionedScene.root.children[0];

    expect(result.measuredScene.diagnostics.some((diagnostic) =>
      diagnostic.code === "renderer.measure.container_ports_deferred"
    )).toBe(false);
    expect(result.positionedScene.diagnostics.some((diagnostic) =>
      diagnostic.code === "renderer.measure.container_ports_deferred"
    )).toBe(false);

    if (!area || area.kind !== "container") {
      throw new Error("Expected the synthetic fixture to include a positioned area container.");
    }

    expect(area.ports[0]).toEqual(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number)
    }));
    expect(area.ports[0]?.y).toBeGreaterThan(0);
  });

  it("preserves explicit newlines and falls back to grapheme splitting for long tokens", async () => {
    const node = await getOnlyMeasuredNode(buildSingleNodeScene({
      kind: "node",
      id: "node-1",
      role: "place",
      primitive: "card",
      classes: ["place"],
      widthPolicy: {
        preferred: "chip",
        allowed: ["chip"]
      },
      overflowPolicy: {
        kind: "grow_height"
      },
      content: [
        {
          id: "title",
          kind: "text",
          text: "Alpha\nSupercalifragilisticexpialidocious",
          textStyleRole: "title",
          priority: "primary"
        }
      ],
      ports: []
    }));

    expect(node.content[0]?.lines[0]).toBe("Alpha");
    expect(node.content[0]?.lines.slice(1).join("")).toBe("Supercalifragilisticexpialidocious");
    expect(node.content[0]?.lines.length).toBeGreaterThan(2);
  });

  it("escalates width bands deterministically when maxLines would otherwise be exceeded", async () => {
    const node = await getOnlyMeasuredNode(buildSingleNodeScene({
      kind: "node",
      id: "node-2",
      role: "place",
      primitive: "card",
      classes: ["place"],
      widthPolicy: {
        preferred: "narrow",
        allowed: ["narrow", "standard"]
      },
      overflowPolicy: {
        kind: "escalate_width_band",
        maxLines: 1
      },
      content: [
        {
          id: "title",
          kind: "text",
          text: "Quarterly Revenue Panel",
          textStyleRole: "title",
          priority: "primary"
        }
      ],
      ports: []
    }));

    expect(node.widthBand).toBe("standard");
    expect(node.overflow.status).toBe("escalated_width_band");
    expect(node.content[0]?.lines).toHaveLength(1);
  });

  it("grows height instead of clipping when grow_height is selected", async () => {
    const node = await getOnlyMeasuredNode(buildSingleNodeScene({
      kind: "node",
      id: "node-3",
      role: "place",
      primitive: "card",
      classes: ["place"],
      widthPolicy: {
        preferred: "chip",
        allowed: ["chip"]
      },
      overflowPolicy: {
        kind: "grow_height"
      },
      content: [
        {
          id: "title",
          kind: "text",
          text: "This node needs multiple wrapped lines in a very small width band",
          textStyleRole: "title",
          priority: "primary"
        }
      ],
      ports: []
    }));

    expect(node.widthBand).toBe("chip");
    expect(node.overflow.status).toBe("fits");
    expect(node.content[0]?.lines.length).toBeGreaterThan(2);
  });

  it("clamps overflowing text with ellipsis when requested", async () => {
    const scene = buildSingleNodeScene({
      kind: "node",
      id: "node-4",
      role: "place",
      primitive: "card",
      classes: ["place"],
      widthPolicy: {
        preferred: "chip",
        allowed: ["chip"]
      },
      overflowPolicy: {
        kind: "clamp_with_ellipsis",
        maxLines: 2
      },
      content: [
        {
          id: "title",
          kind: "text",
          text: "This node has far too much text to fit on two tiny lines without clamping",
          textStyleRole: "title",
          priority: "primary"
        }
      ],
      ports: []
    });
    const result = await runStagedRendererPipeline(scene);
    const node = await getOnlyMeasuredNode(scene);

    expect(node.overflow.status).toBe("clamped");
    expect(node.content[0]?.lines).toHaveLength(2);
    expect(node.content[0]?.wasClamped).toBe(true);
    expect(node.content[0]?.lines[1]?.endsWith("...")).toBe(true);
    expect(result.measuredScene.diagnostics.some((diagnostic) => diagnostic.code === "renderer.measure.text_clamped")).toBe(true);
  });

  it("moves secondary blocks into a secondary region before declaring overflow", async () => {
    const node = await getOnlyMeasuredNode(buildSingleNodeScene({
      kind: "node",
      id: "node-5",
      role: "place",
      primitive: "card",
      classes: ["place"],
      widthPolicy: {
        preferred: "chip",
        allowed: ["chip"]
      },
      overflowPolicy: {
        kind: "secondary_area",
        maxLines: 1
      },
      content: [
        {
          id: "title",
          kind: "text",
          text: "Home",
          textStyleRole: "title",
          priority: "primary"
        },
        {
          id: "badge",
          kind: "badge_text",
          text: "role:billing_administrator_access",
          textStyleRole: "badge",
          priority: "secondary"
        }
      ],
      ports: []
    }));

    expect(node.overflow.status).toBe("fits");
    expect(node.content.find((block) => block.id === "badge")?.region).toBe("secondary");
  });

  it("falls back to the default theme with an explicit diagnostic for unknown theme ids", async () => {
    const scene = buildSingleNodeScene({
      kind: "node",
      id: "node-6",
      role: "place",
      primitive: "card",
      classes: ["place"],
      widthPolicy: {
        preferred: "standard",
        allowed: ["standard"]
      },
      overflowPolicy: {
        kind: "grow_height"
      },
      content: [
        {
          id: "title",
          kind: "text",
          text: "Settings",
          textStyleRole: "title",
          priority: "primary"
        }
      ],
      ports: []
    }, "mystery");
    const result = await runStagedRendererPipeline(scene);

    expect(result.measuredScene.themeId).toBe("default");
    expect(result.measuredScene.diagnostics).toContainEqual(expect.objectContaining({
      code: "renderer.measure.unknown_theme",
      severity: "warn"
    }));
  });
});
