import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import type {
  MeasuredItem,
  PositionedContainer,
  PositionedScene,
  PositionedTextDecoration,
  PositionedItem,
  RendererScene,
  SceneItem
} from "../src/renderer/staged/contracts.js";
import {
  buildOutcomeOpportunityMapRendererScene,
  renderOutcomeOpportunityMapPreRoutingArtifacts,
  renderOutcomeOpportunityMapRoutingDebugArtifacts,
  renderOutcomeOpportunityMapStagedSvg
} from "../src/renderer/staged/outcomeOpportunityMap.js";
import { measureScene } from "../src/renderer/staged/pipeline.js";
import {
  expectRendererStageSnapshot,
  expectRendererStageTextSnapshot
} from "./rendererStageSnapshotHarness.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

async function resolveOutcomeOpportunityContext(exampleName: string, profileId = "strict") {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "outcome_opportunity_map");
  if (!view) {
    throw new Error("Could not resolve the outcome_opportunity_map view.");
  }

  const examplePath = path.join(bundle.rootDir, "examples", `${exampleName}.sdd`);
  const input = {
    path: examplePath,
    text: await readFile(examplePath, "utf8")
  };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!compiled.graph) {
    throw new Error(`Could not compile ${examplePath}.`);
  }

  const projected = projectView(compiled.graph, bundle, "outcome_opportunity_map");
  expect(projected.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!projected.projection) {
    throw new Error(`Could not project ${examplePath} to outcome_opportunity_map.`);
  }

  return {
    graph: compiled.graph,
    projection: projected.projection,
    view,
    profileId
  };
}

async function resolveOutcomeOpportunitySourceContext(sourceText: string, profileId = "strict") {
  const bundle = await loadBundle(manifestPath);
  const view = bundle.views.views.find((candidate) => candidate.id === "outcome_opportunity_map");
  if (!view) {
    throw new Error("Could not resolve the outcome_opportunity_map view.");
  }

  const input = {
    path: path.join(repoRoot, "tests/fixtures/render/__inline_outcome_opportunity_stage_snapshot__.sdd"),
    text: `${sourceText.trim()}\n`
  };
  const compiled = compileSource(input, bundle);
  expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!compiled.graph) {
    throw new Error("Could not compile inline outcome-opportunity source.");
  }

  const projected = projectView(compiled.graph, bundle, "outcome_opportunity_map");
  expect(projected.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!projected.projection) {
    throw new Error("Could not project inline source to outcome_opportunity_map.");
  }

  return {
    graph: compiled.graph,
    projection: projected.projection,
    view,
    profileId
  };
}

function flattenSceneItems(children: readonly SceneItem[]): SceneItem[] {
  return children.flatMap((child) => [
    child,
    ...(child.kind === "container" ? flattenSceneItems(child.children) : [])
  ]);
}

function flattenMeasuredItems(item: MeasuredItem): MeasuredItem[] {
  return [
    item,
    ...(item.kind === "container" ? item.children.flatMap(flattenMeasuredItems) : [])
  ];
}

function flattenPositionedItems(root: PositionedContainer): PositionedItem[] {
  const items: PositionedItem[] = [root];
  for (const child of root.children) {
    items.push(child);
    if (child.kind === "container") {
      items.push(...flattenPositionedItems(child));
    }
  }
  return items;
}

function findSceneItem(scene: RendererScene, itemId: string): SceneItem {
  const item = flattenSceneItems(scene.root.children).find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`Could not find scene item "${itemId}".`);
  }
  return item;
}

function stripViewMetadata<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripViewMetadata(entry)) as T;
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "viewMetadata")
      .map(([key, nested]) => [key, stripViewMetadata(nested)] as const)
  ) as T;
}

function expectNoForbiddenOutcomeOpportunityDiagnostics(diagnostics: readonly { code: string }[]): void {
  expect(diagnostics.filter((diagnostic) =>
    diagnostic.code === "renderer.routing.outcome_opportunity_unresolved_connector"
    || diagnostic.code === "renderer.routing.outcome_opportunity_unresolved_port"
    || diagnostic.code === "renderer.routing.outcome_opportunity_node_intersection"
    || diagnostic.code === "renderer.routing.outcome_opportunity_edge_label_omitted"
    || diagnostic.code === "renderer.routing.outcome_opportunity_edge_label_fallback"
  )).toEqual([]);
}

function expectNoOutcomeOpportunityCellChrome(svg: string): void {
  expect(svg).not.toContain("outcome_opportunity_cell");
  expect(svg).not.toContain("role-outcome_opportunity_cell");
}

function expectNoOutcomeOpportunityBandLabelsInSvg(svg: string): void {
  expect(svg).not.toContain("outcome_opportunity_band_title");
  expect(svg).not.toContain("outcome-opportunity-band-");
  expect(svg).not.toMatch(/>Band \d+</);
}

function expectNoOutcomeOpportunityImplementedByEdgesInSvg(svg: string): void {
  expect(svg).not.toContain("edge-type-implemented_by");
  expect(svg).not.toContain("role-implemented_by");
}

function expectNoOutcomeOpportunityBandDecorations(scene: PositionedScene): void {
  expect(scene.decorations.filter((decoration) =>
    decoration.id.startsWith("outcome-opportunity-band-")
    || decoration.classes.includes("outcome_opportunity_band_title")
    || (decoration.kind === "text" && /^Band \d+$/.test(decoration.text))
  )).toEqual([]);
}

function expectOutcomeOpportunityColumnHeadersAligned(scene: PositionedScene): void {
  const firstCellByColumn = new Map<string, PositionedContainer>();
  for (const item of scene.root.children) {
    if (item.kind !== "container" || item.viewMetadata?.outcomeOpportunity?.kind !== "cell") {
      continue;
    }
    const metadata = item.viewMetadata.outcomeOpportunity;
    const existing = firstCellByColumn.get(metadata.columnId);
    if (!existing || item.y < existing.y || (item.y === existing.y && item.x < existing.x)) {
      firstCellByColumn.set(metadata.columnId, item);
    }
  }

  const columnTitles = scene.decorations.filter((decoration): decoration is PositionedTextDecoration =>
    decoration.kind === "text" && decoration.classes.includes("outcome_opportunity_column_title")
  );
  expect(columnTitles.map((decoration) => decoration.id).sort()).toEqual([
    "outcome-opportunity-column-initiative__title",
    "outcome-opportunity-column-metric__title",
    "outcome-opportunity-column-opportunity__title",
    "outcome-opportunity-column-outcome__title"
  ]);
  expect(new Set(columnTitles.map((decoration) => decoration.y)).size).toBe(1);

  for (const [columnId, cell] of firstCellByColumn.entries()) {
    const title = columnTitles.find((decoration) => decoration.id === `outcome-opportunity-column-${columnId}__title`);
    expect(title).toBeDefined();
    expect(title?.x).toBeCloseTo(cell.x + 4, 3);
    expect(title?.y).toBe(Math.max(12, cell.y - 30));
  }
}

describe("staged outcome_opportunity_map", () => {
  it("builds a RendererScene from the middle layer without final geometry", async () => {
    const context = await resolveOutcomeOpportunityContext("outcome_to_ia_trace", "strict");
    const scene = buildOutcomeOpportunityMapRendererScene(
      context.projection,
      context.graph,
      context.view,
      context.profileId
    );

    expect(scene.viewId).toBe("outcome_opportunity_map");
    expect(scene.root.layout).toEqual(expect.objectContaining({
      strategy: "grid",
      columns: 4
    }));
    expect(scene.edges.map((edge) => ({
      id: edge.id,
      sourcePortRole: edge.routing.sourcePortRole,
      targetPortRole: edge.routing.targetPortRole
    }))).toEqual([
      {
        id: "O-001__measured_by__M-001",
        sourcePortRole: "measure_out",
        targetPortRole: "measure_in"
      },
      {
        id: "OP-001__supports__O-001",
        sourcePortRole: "intent_out",
        targetPortRole: "intent_in"
      },
      {
        id: "I-001__addresses__OP-001",
        sourcePortRole: "intent_out",
        targetPortRole: "intent_in"
      }
    ]);

    const metricNode = findSceneItem(scene, "M-001");
    expect(metricNode.kind).toBe("node");
    if (metricNode.kind !== "node") {
      throw new Error("Expected M-001 to be a node.");
    }
    expect(metricNode.viewMetadata?.outcomeOpportunity).toEqual(expect.objectContaining({
      kind: "semantic_node",
      placementRole: "measuring_metric",
      semanticColumnId: "metric",
      anchorOutcomeId: "O-001"
    }));
    expect(metricNode.ports.map((port) => port.role)).toEqual([
      "intent_in",
      "intent_out",
      "measure_in",
      "measure_out",
      "secondary_in",
      "secondary_out"
    ]);
    expect(metricNode.content.map((block) => ({
      text: block.text,
      priority: block.priority
    }))).toEqual([
      { text: "Checkout Completion Rate", priority: "primary" },
      { text: "Experience: J-002 Confirm Payment", priority: "secondary" },
      { text: "Event: E-001 Payment Submitted", priority: "secondary" }
    ]);

    const initiativeNode = findSceneItem(scene, "I-001");
    expect(initiativeNode.kind).toBe("node");
    if (initiativeNode.kind !== "node") {
      throw new Error("Expected I-001 to be a node.");
    }
    expect(initiativeNode.content.map((block) => ({
      text: block.text,
      priority: block.priority
    }))).toEqual([
      { text: "Billing Simplification", priority: "primary" },
      { text: "Implemented by: P-001 Billing", priority: "secondary" }
    ]);
    expect(JSON.stringify(scene)).not.toMatch(/"x"|"y"|"points"|"svg"|"dot"|"mermaid"|"elk"/i);
  });

  it("emits meaningful pre-routing artifacts with no semantic routes", async () => {
    const context = await resolveOutcomeOpportunityContext("metric_event_instrumentation", "strict");
    const rendered = await renderOutcomeOpportunityMapPreRoutingArtifacts(
      context.projection,
      context.graph,
      context.view,
      context.profileId
    );

    expect(rendered.preRoutingPositionedScene.edges).toEqual([]);
    expect(rendered.preRoutingSvg).toContain('class="staged-svg view-outcome_opportunity_map');
    expect(Array.from(rendered.preRoutingPng.slice(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
    expect(rendered.preRoutingPng.length).toBeGreaterThan(32);
    expect(rendered.middleLayer.placements.map((placement) => placement.nodeId).sort()).toEqual([
      "I-050",
      "M-050",
      "M-051",
      "O-050",
      "OP-050"
    ]);
    expect(rendered.middleLayer.bands).toEqual([
      expect.objectContaining({
        id: "band:outcome:1",
        label: "B1",
        kind: "outcome",
        anchorOutcomeId: "O-050"
      })
    ]);

    const positionedItems = flattenPositionedItems(rendered.preRoutingPositionedScene.root);
    const metricNode = positionedItems.find((item) => item.id === "M-051");
    expect(metricNode?.viewMetadata?.outcomeOpportunity).toEqual(expect.objectContaining({
      kind: "semantic_node",
      semanticColumnId: "metric",
      semanticBandId: "band:outcome:1",
      anchorOutcomeId: "O-050"
    }));
    const metricCell = positionedItems.find((item) =>
      item.kind === "container"
      && item.viewMetadata?.outcomeOpportunity?.kind === "cell"
      && item.viewMetadata.outcomeOpportunity.columnId === "metric"
      && item.viewMetadata.outcomeOpportunity.slotOrderWithinBand === 1
    );
    expect(metricCell?.viewMetadata?.outcomeOpportunity).toEqual(expect.objectContaining({
      kind: "cell",
      bandId: "band:outcome:1",
      bandLabel: "Band 1",
      bandKind: "outcome",
      physicalSlotId: "band:outcome:1__slot:1",
      rowOrder: 1,
      parking: false
    }));
    expect(metricCell?.primitive).toBe("stack");
    expect(rendered.preRoutingSvg).toContain('id="scene-node-m-051"');
    expectNoOutcomeOpportunityCellChrome(rendered.preRoutingSvg);
    expectNoOutcomeOpportunityBandLabelsInSvg(rendered.preRoutingSvg);
    expectNoOutcomeOpportunityBandDecorations(rendered.preRoutingPositionedScene);
    expectOutcomeOpportunityColumnHeadersAligned(rendered.preRoutingPositionedScene);
    expect(rendered.preRoutingPositionedScene.decorations.map((decoration) => decoration.id)).toEqual([
      "outcome-opportunity-column-initiative__title",
      "outcome-opportunity-column-opportunity__title",
      "outcome-opportunity-column-outcome__title",
      "outcome-opportunity-column-metric__title"
    ]);
  });

  it("keeps outcome annotations in measured secondary blocks according to profile display", async () => {
    const strictContext = await resolveOutcomeOpportunityContext("outcome_to_ia_trace", "strict");
    const strictRendered = await renderOutcomeOpportunityMapPreRoutingArtifacts(
      strictContext.projection,
      strictContext.graph,
      strictContext.view,
      strictContext.profileId
    );
    const simpleContext = await resolveOutcomeOpportunityContext("outcome_to_ia_trace", "simple");
    const simpleRendered = await renderOutcomeOpportunityMapPreRoutingArtifacts(
      simpleContext.projection,
      simpleContext.graph,
      simpleContext.view,
      simpleContext.profileId
    );

    const strictMetric = flattenMeasuredItems(strictRendered.measuredScene.root).find((item) => item.id === "M-001");
    const simpleMetric = flattenMeasuredItems(simpleRendered.measuredScene.root).find((item) => item.id === "M-001");
    const strictInitiative = flattenMeasuredItems(strictRendered.measuredScene.root).find((item) => item.id === "I-001");
    const simpleInitiative = flattenMeasuredItems(simpleRendered.measuredScene.root).find((item) => item.id === "I-001");
    expect(strictMetric?.kind).toBe("node");
    expect(simpleMetric?.kind).toBe("node");
    expect(strictInitiative?.kind).toBe("node");
    expect(simpleInitiative?.kind).toBe("node");
    if (
      strictMetric?.kind !== "node" ||
      simpleMetric?.kind !== "node" ||
      strictInitiative?.kind !== "node" ||
      simpleInitiative?.kind !== "node"
    ) {
      throw new Error("Expected M-001 and I-001 to be measured as nodes.");
    }

    expect(strictMetric.content.map((block) => ({
      lines: block.lines,
      kind: block.kind,
      priority: block.priority
    }))).toEqual([
      {
        lines: ["Checkout Completion Rate"],
        kind: "text",
        priority: "primary"
      },
      {
        lines: ["Experience: J-002 Confirm Payment"],
        kind: "metadata",
        priority: "secondary"
      },
      {
        lines: ["Event: E-001 Payment Submitted"],
        kind: "metadata",
        priority: "secondary"
      }
    ]);
    expect(simpleMetric.content.map((block) => block.lines.join(" "))).toEqual([
      "Checkout Completion Rate"
    ]);
    expect(strictInitiative.content.map((block) => ({
      lines: block.lines,
      kind: block.kind,
      priority: block.priority
    }))).toEqual([
      {
        lines: ["Billing Simplification"],
        kind: "text",
        priority: "primary"
      },
      {
        lines: ["Implemented by: P-001 Billing"],
        kind: "metadata",
        priority: "secondary"
      }
    ]);
    expect(simpleInitiative.content.map((block) => block.lines.join(" "))).toEqual([
      "Billing Simplification"
    ]);
  });

  it("matches renderer-stage snapshots for canonical proof cases and routing debug stages", async () => {
    const cases = [
      {
        exampleName: "outcome_to_ia_trace",
        goldenPrefix: "outcome-opportunity-map.outcome-to-ia-trace",
        expectedEdges: [
          "OP-001__supports__O-001",
          "I-001__addresses__OP-001",
          "O-001__measured_by__M-001"
        ]
      },
      {
        exampleName: "metric_event_instrumentation",
        goldenPrefix: "outcome-opportunity-map.metric-event-instrumentation",
        expectedEdges: [
          "OP-050__supports__O-050",
          "I-050__addresses__OP-050",
          "O-050__measured_by__M-050",
          "O-050__measured_by__M-051"
        ]
      }
    ] as const;

    for (const testCase of cases) {
      const context = await resolveOutcomeOpportunityContext(testCase.exampleName, "strict");
      const rendererScene = buildOutcomeOpportunityMapRendererScene(
        context.projection,
        context.graph,
        context.view,
        "strict"
      );
      const measuredScene = measureScene(rendererScene);
      const preRouting = await renderOutcomeOpportunityMapPreRoutingArtifacts(
        context.projection,
        context.graph,
        context.view,
        "strict"
      );
      const routingDebug = await renderOutcomeOpportunityMapRoutingDebugArtifacts(
        context.projection,
        context.graph,
        context.view,
        "strict"
      );
      const rendered = await renderOutcomeOpportunityMapStagedSvg(
        context.projection,
        context.graph,
        context.view,
        "strict"
      );

      expect(routingDebug.routingStages.connectorPlans.map((plan) => plan.edgeId)).toEqual(testCase.expectedEdges);
      expect(rendered.positionedScene.edges.map((edge) => edge.id)).toEqual(testCase.expectedEdges);
      expectNoForbiddenOutcomeOpportunityDiagnostics(rendered.positionedScene.diagnostics);
      expect(JSON.stringify(rendererScene)).not.toMatch(/"points"|"svg"|"dot"|"mermaid"|"elk"/i);
      expectNoOutcomeOpportunityCellChrome(preRouting.preRoutingSvg);
      expectNoOutcomeOpportunityCellChrome(routingDebug.step2Svg);
      expectNoOutcomeOpportunityCellChrome(routingDebug.step3Svg);
      expectNoOutcomeOpportunityCellChrome(rendered.svg);
      expectNoOutcomeOpportunityBandLabelsInSvg(preRouting.preRoutingSvg);
      expectNoOutcomeOpportunityBandLabelsInSvg(routingDebug.step2Svg);
      expectNoOutcomeOpportunityBandLabelsInSvg(routingDebug.step3Svg);
      expectNoOutcomeOpportunityBandLabelsInSvg(rendered.svg);
      expectNoOutcomeOpportunityImplementedByEdgesInSvg(preRouting.preRoutingSvg);
      expectNoOutcomeOpportunityImplementedByEdgesInSvg(routingDebug.step2Svg);
      expectNoOutcomeOpportunityImplementedByEdgesInSvg(routingDebug.step3Svg);
      expectNoOutcomeOpportunityImplementedByEdgesInSvg(rendered.svg);
      expectNoOutcomeOpportunityBandDecorations(preRouting.preRoutingPositionedScene);
      expectNoOutcomeOpportunityBandDecorations(routingDebug.step2PositionedScene);
      expectNoOutcomeOpportunityBandDecorations(routingDebug.step3PositionedScene);
      expectNoOutcomeOpportunityBandDecorations(rendered.positionedScene);
      expectOutcomeOpportunityColumnHeadersAligned(preRouting.preRoutingPositionedScene);
      expectOutcomeOpportunityColumnHeadersAligned(routingDebug.step2PositionedScene);
      expectOutcomeOpportunityColumnHeadersAligned(routingDebug.step3PositionedScene);
      expectOutcomeOpportunityColumnHeadersAligned(rendered.positionedScene);

      await expectRendererStageSnapshot(`${testCase.goldenPrefix}.renderer-scene.json`, stripViewMetadata(rendererScene));
      await expectRendererStageSnapshot(`${testCase.goldenPrefix}.measured-scene.json`, stripViewMetadata(measuredScene));
      await expectRendererStageSnapshot(`${testCase.goldenPrefix}.pre-routing.positioned-scene.json`, stripViewMetadata(preRouting.preRoutingPositionedScene));
      await expectRendererStageSnapshot(`${testCase.goldenPrefix}.step-2.positioned-scene.json`, stripViewMetadata(routingDebug.step2PositionedScene));
      await expectRendererStageTextSnapshot(`${testCase.goldenPrefix}.step-2.svg`, routingDebug.step2Svg);
      await expectRendererStageSnapshot(`${testCase.goldenPrefix}.step-3.positioned-scene.json`, stripViewMetadata(routingDebug.step3PositionedScene));
      await expectRendererStageTextSnapshot(`${testCase.goldenPrefix}.step-3.svg`, routingDebug.step3Svg);
      await expectRendererStageSnapshot(`${testCase.goldenPrefix}.positioned-scene.json`, stripViewMetadata(rendered.positionedScene));
      await expectRendererStageTextSnapshot(`${testCase.goldenPrefix}.svg`, rendered.svg);
    }
  });

  it("matches selected synthetic renderer-stage snapshots for routing risk cases", async () => {
    const cases = [
      {
        goldenPrefix: "outcome-opportunity-map.synthetic-dense-fanout",
        source: `
SDD-TEXT 0.1

Outcome O-900 "Dense Outcome"
  MEASURED_BY M-901 "Metric One"
  MEASURED_BY M-902 "Metric Two"
  MEASURED_BY M-903 "Metric Three"
END

Metric M-901 "Metric One"
END

Metric M-902 "Metric Two"
END

Metric M-903 "Metric Three"
END

Opportunity OP-901 "Dense Opportunity"
  SUPPORTS O-900 "Dense Outcome"
END

Initiative I-901 "Dense Initiative"
  ADDRESSES OP-901 "Dense Opportunity"
END
`
      },
      {
        goldenPrefix: "outcome-opportunity-map.synthetic-shared-multi-outcome",
        source: `
SDD-TEXT 0.1

Outcome O-301 "Outcome A"
  MEASURED_BY M-399 "Shared Metric"
END

Outcome O-302 "Outcome B"
  MEASURED_BY M-399 "Shared Metric"
END

Opportunity OP-399 "Shared Opportunity"
  SUPPORTS O-302 "Outcome B"
  SUPPORTS O-301 "Outcome A"
END

Opportunity OP-301 "Opportunity A"
  SUPPORTS O-301 "Outcome A"
END

Initiative I-399 "Shared Initiative"
  ADDRESSES OP-301 "Opportunity A"
  ADDRESSES OP-399 "Shared Opportunity"
END

Metric M-399 "Shared Metric"
END
`
      },
      {
        goldenPrefix: "outcome-opportunity-map.synthetic-parking-fallback",
        source: `
SDD-TEXT 0.1

Outcome O-990 "Anchored Outcome"
END

Opportunity OP-991 "Orphan Opportunity"
END

Initiative I-991 "Orphan Initiative"
  ADDRESSES OP-991 "Orphan Opportunity"
END
`
      }
    ] as const;

    for (const testCase of cases) {
      const context = await resolveOutcomeOpportunitySourceContext(testCase.source, "strict");
      const rendered = await renderOutcomeOpportunityMapStagedSvg(
        context.projection,
        context.graph,
        context.view,
        "strict"
      );

      expect(rendered.positionedScene.edges.length).toBeGreaterThan(0);
      expectNoForbiddenOutcomeOpportunityDiagnostics(rendered.positionedScene.diagnostics);
      expectNoOutcomeOpportunityCellChrome(rendered.svg);
      expectNoOutcomeOpportunityBandLabelsInSvg(rendered.svg);
      expectNoOutcomeOpportunityBandDecorations(rendered.positionedScene);
      expectOutcomeOpportunityColumnHeadersAligned(rendered.positionedScene);

      await expectRendererStageSnapshot(`${testCase.goldenPrefix}.positioned-scene.json`, stripViewMetadata(rendered.positionedScene));
      await expectRendererStageTextSnapshot(`${testCase.goldenPrefix}.svg`, rendered.svg);
    }
  });
});
