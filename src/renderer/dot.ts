import type { IaPlaceMapRenderModel, IaRenderItem, IaRenderPlace } from "./iaPlaceMapRenderModel.js";
import type {
  JourneyMapRenderModel,
  JourneyRenderItem,
  JourneyRenderStage,
  JourneyRenderStep
} from "./journeyMapRenderModel.js";
import type {
  OutcomeOpportunityMapRenderModel,
  OutcomeOpportunityRenderLane,
  OutcomeOpportunityRenderNode
} from "./outcomeOpportunityMapRenderModel.js";
import type { DotPreviewStyle } from "./previewStyle.js";

function escapeLabel(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatMultilineLabel(lines: string[]): string {
  return lines.map((line) => escapeLabel(line)).join("\\n");
}

function quoteId(id: string): string {
  return `"${escapeLabel(id)}"`;
}

function clusterId(prefix: string, id: string): string {
  return `${prefix}_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function renderInvisibleOrderChains(
  chains: string[][],
  lines: string[],
  visibleEdgeKeys: ReadonlySet<string> = new Set()
): void {
  for (const chain of chains) {
    for (let index = 0; index < chain.length - 1; index += 1) {
      const edgeKey = `${chain[index]}->${chain[index + 1]}`;
      if (visibleEdgeKeys.has(edgeKey)) {
        continue;
      }

      lines.push(`  ${quoteId(chain[index])} -> ${quoteId(chain[index + 1])} [style=invis, weight=100];`);
    }
  }
}

function renderPlace(place: IaRenderPlace, indent: string, lines: string[]): void {
  lines.push(`${indent}${quoteId(place.id)} [label="${formatMultilineLabel(place.labelLines)}"];`);
  renderItems(place.items, indent, lines);
}

function renderItems(items: IaRenderItem[], indent: string, lines: string[]): void {
  for (const item of items) {
    if (item.kind === "area") {
      lines.push(`${indent}subgraph cluster_${item.id.replace(/[^A-Za-z0-9_]/g, "_")} {`);
      lines.push(`${indent}  label="${escapeLabel(item.label)}";`);
      renderItems(item.items, `${indent}  `, lines);
      lines.push(`${indent}}`);
      continue;
    }

    renderPlace(item, indent, lines);
  }
}

export function renderIaPlaceMapDot(model: IaPlaceMapRenderModel, style?: DotPreviewStyle): string {
  const fontFamily = style?.fontFamily ? escapeLabel(style.fontFamily) : "Public Sans";
  const lines = [
    "digraph ia_place_map {",
    "  rankdir=LR;",
    `  graph [fontname="${fontFamily}"];`,
    `  node [shape=box, fontname="${fontFamily}"];`,
    `  edge [fontname="${fontFamily}"];`
  ];

  renderItems(model.rootItems, "  ", lines);

  renderInvisibleOrderChains(model.siblingOrderChains, lines);

  for (const edge of model.edges) {
    lines.push(`  ${quoteId(edge.from)} -> ${quoteId(edge.to)};`);
  }

  lines.push("}");
  return lines.join("\n");
}

function renderJourneyStep(step: JourneyRenderStep, indent: string, lines: string[]): void {
  lines.push(`${indent}${quoteId(step.id)} [label="${formatMultilineLabel(step.labelLines)}"];`);
}

function renderJourneyStage(stage: JourneyRenderStage, indent: string, lines: string[]): void {
  lines.push(`${indent}subgraph ${clusterId("cluster", stage.id)} {`);
  lines.push(`${indent}  label="${escapeLabel(stage.label)}";`);
  lines.push(`${indent}  style="rounded";`);
  lines.push(`${indent}  ${quoteId(stage.anchorId)} [label="", shape=point, width=0, height=0, style=invis];`);
  for (const item of stage.items) {
    renderJourneyStep(item, `${indent}  `, lines);
  }
  lines.push(`${indent}}`);
}

function renderJourneyItems(items: JourneyRenderItem[], indent: string, lines: string[]): void {
  for (const item of items) {
    if (item.kind === "stage") {
      renderJourneyStage(item, indent, lines);
      continue;
    }

    renderJourneyStep(item, indent, lines);
  }
}

export function renderJourneyMapDot(model: JourneyMapRenderModel, style?: DotPreviewStyle): string {
  const fontFamily = style?.fontFamily ? escapeLabel(style.fontFamily) : "Public Sans";
  const lines = [
    "digraph journey_map {",
    "  rankdir=LR;",
    `  graph [fontname="${fontFamily}"];`,
    `  node [shape=box, style="rounded", fontname="${fontFamily}"];`,
    `  edge [fontname="${fontFamily}"];`
  ];

  renderJourneyItems(model.rootItems, "  ", lines);

  renderInvisibleOrderChains(model.siblingOrderChains, lines, new Set(model.edges.map((edge) => `${edge.from}->${edge.to}`)));

  for (const edge of model.edges) {
    lines.push(`  ${quoteId(edge.from)} -> ${quoteId(edge.to)};`);
  }

  lines.push("}");
  return lines.join("\n");
}

function renderOutcomeOpportunityNode(node: OutcomeOpportunityRenderNode, indent: string, lines: string[]): void {
  lines.push(
    `${indent}${quoteId(node.id)} [shape=${node.shape}, label="${formatMultilineLabel(node.labelLines)}"];`
  );
}

function renderOutcomeOpportunityLane(
  lane: OutcomeOpportunityRenderLane,
  nodesById: Map<string, OutcomeOpportunityRenderNode>,
  indent: string,
  lines: string[]
): void {
  lines.push(`${indent}subgraph ${clusterId("rank", lane.id)} {`);
  lines.push(`${indent}  rank=same;`);
  lines.push(`${indent}  ${quoteId(lane.headerId)} [shape=plaintext, label="${escapeLabel(lane.label)}"];`);
  for (const nodeId of lane.nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    renderOutcomeOpportunityNode(node, `${indent}  `, lines);
  }
  lines.push(`${indent}}`);
}

export function renderOutcomeOpportunityMapDot(
  model: OutcomeOpportunityMapRenderModel,
  style?: DotPreviewStyle
): string {
  const fontFamily = style?.fontFamily ? escapeLabel(style.fontFamily) : "Public Sans";
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const lines = [
    "digraph outcome_opportunity_map {",
    "  rankdir=LR;",
    `  graph [fontname="${fontFamily}", nodesep=0.6, ranksep=1.0];`,
    `  node [fontname="${fontFamily}"];`,
    `  edge [fontname="${fontFamily}"];`
  ];

  for (const lane of model.lanes) {
    renderOutcomeOpportunityLane(lane, nodesById, "  ", lines);
  }

  renderInvisibleOrderChains(model.siblingOrderChains, lines);

  for (const edge of model.edges) {
    lines.push(`  ${quoteId(edge.from)} -> ${quoteId(edge.to)} [label="${escapeLabel(edge.label)}"];`);
  }

  lines.push("}");
  return lines.join("\n");
}
