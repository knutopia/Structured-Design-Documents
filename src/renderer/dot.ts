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
import type {
  ScenarioFlowRenderLane,
  ScenarioFlowRenderModel,
  ScenarioFlowRenderNode
} from "./scenarioFlowRenderModel.js";
import type {
  ServiceBlueprintRenderLane,
  ServiceBlueprintRenderModel,
  ServiceBlueprintRenderNode
} from "./serviceBlueprintRenderModel.js";
import type {
  UiContractsLeafNodeItem,
  UiContractsComponentItem,
  UiContractsPlaceItem,
  UiContractsRenderModel,
  UiContractsRenderNode,
  UiContractsRootItem,
  UiContractsStateGroupItem,
  UiContractsSupportingGroupItem,
  UiContractsViewStateItem
} from "./uiContractsRenderModel.js";
import type { DotPreviewStyle } from "./previewStyle.js";

interface RawDotAttributeValue {
  kind: "raw";
  value: string;
}

type DotAttributeValue = string | number | boolean | RawDotAttributeValue;

function escapeLabel(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function rawDotAttributeValue(value: string): RawDotAttributeValue {
  return {
    kind: "raw",
    value
  };
}

function formatMultilineLabel(lines: string[]): RawDotAttributeValue {
  return rawDotAttributeValue(lines.map((line) => escapeLabel(line)).join("\\n"));
}

function formatLeftAlignedMultilineLabel(lines: string[]): RawDotAttributeValue {
  return rawDotAttributeValue(`${lines.map((line) => escapeLabel(line)).join("\\l")}\\l`);
}

function quoteId(id: string): string {
  return `"${escapeLabel(id)}"`;
}

function clusterId(prefix: string, id: string): string {
  return `${prefix}_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function formatAttributeValue(value: DotAttributeValue): string {
  if (typeof value === "object") {
    return `"${value.value}"`;
  }

  if (typeof value === "string") {
    return `"${escapeLabel(value)}"`;
  }

  return String(value);
}

function formatAttributes(attributes: Record<string, DotAttributeValue | undefined>): string {
  const entries = Object.entries(attributes).filter((entry): entry is [string, DotAttributeValue] => entry[1] !== undefined);
  if (entries.length === 0) {
    return "";
  }

  return ` [${entries.map(([key, value]) => `${key}=${formatAttributeValue(value)}`).join(", ")}]`;
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
  lines.push(`${indent}${quoteId(place.id)}${formatAttributes({ label: formatMultilineLabel(place.labelLines) })};`);
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
  lines.push(`${indent}${quoteId(step.id)}${formatAttributes({ label: formatMultilineLabel(step.labelLines) })};`);
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
  lines.push(`${indent}${quoteId(node.id)}${formatAttributes({ shape: node.shape, label: formatMultilineLabel(node.labelLines) })};`);
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

function renderServiceBlueprintNode(node: ServiceBlueprintRenderNode, indent: string, lines: string[]): void {
  lines.push(
    `${indent}${quoteId(node.id)}${formatAttributes({
      shape: node.shape,
      style: node.style,
      label: formatMultilineLabel(node.labelLines)
    })};`
  );
}

function renderServiceBlueprintLane(
  lane: ServiceBlueprintRenderLane,
  nodesById: Map<string, ServiceBlueprintRenderNode>,
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
    renderServiceBlueprintNode(node, `${indent}  `, lines);
  }
  lines.push(`${indent}}`);
}

export function renderServiceBlueprintDot(model: ServiceBlueprintRenderModel, style?: DotPreviewStyle): string {
  const fontFamily = style?.fontFamily ? escapeLabel(style.fontFamily) : "Public Sans";
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const lines = [
    "digraph service_blueprint {",
    "  rankdir=TB;",
    `  graph [fontname="${fontFamily}", nodesep=0.6, ranksep=0.9];`,
    `  node [fontname="${fontFamily}"];`,
    `  edge [fontname="${fontFamily}"];`
  ];

  for (const lane of model.lanes) {
    renderServiceBlueprintLane(lane, nodesById, "  ", lines);
  }

  for (const nodeId of model.ungroupedNodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    renderServiceBlueprintNode(node, "  ", lines);
  }

  renderInvisibleOrderChains(model.siblingOrderChains, lines, new Set(model.edges.map((edge) => `${edge.from}->${edge.to}`)));

  for (const edge of model.edges) {
    lines.push(
      `  ${quoteId(edge.from)} -> ${quoteId(edge.to)}${formatAttributes({
        label: edge.label,
        style: edge.style,
        constraint: edge.constraint,
        weight: edge.weight
      })};`
    );
  }

  lines.push("}");
  return lines.join("\n");
}

function renderScenarioFlowNode(node: ScenarioFlowRenderNode, indent: string, lines: string[]): void {
  lines.push(
    `${indent}${quoteId(node.id)}${formatAttributes({
      shape: node.shape,
      style: node.style,
      label: formatMultilineLabel(node.labelLines)
    })};`
  );
}

function renderScenarioFlowLane(
  lane: ScenarioFlowRenderLane,
  nodesById: Map<string, ScenarioFlowRenderNode>,
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
    renderScenarioFlowNode(node, `${indent}  `, lines);
  }
  lines.push(`${indent}}`);
}

export function renderScenarioFlowDot(model: ScenarioFlowRenderModel, style?: DotPreviewStyle): string {
  const fontFamily = style?.fontFamily ? escapeLabel(style.fontFamily) : "Public Sans";
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const lines = [
    "digraph scenario_flow {",
    "  rankdir=TB;",
    `  graph [fontname="${fontFamily}", nodesep=0.7, ranksep=0.9];`,
    `  node [fontname="${fontFamily}"];`,
    `  edge [fontname="${fontFamily}"];`
  ];

  for (const lane of model.lanes) {
    renderScenarioFlowLane(lane, nodesById, "  ", lines);
  }

  renderInvisibleOrderChains(model.siblingOrderChains, lines, new Set(model.edges.map((edge) => `${edge.from}->${edge.to}`)));

  for (const edge of model.edges) {
    lines.push(
      `  ${quoteId(edge.from)} -> ${quoteId(edge.to)}${formatAttributes({
        label: edge.label,
        style: edge.style,
        constraint: edge.constraint,
        weight: edge.weight
      })};`
    );
  }

  lines.push("}");
  return lines.join("\n");
}

function renderUiContractsNode(node: UiContractsRenderNode, indent: string, lines: string[]): void {
  lines.push(
    `${indent}${quoteId(node.id)}${formatAttributes({
      shape: node.shape,
      style: node.style,
      label: node.shape === "plaintext" ? formatLeftAlignedMultilineLabel(node.labelLines) : formatMultilineLabel(node.labelLines)
    })};`
  );
}

function renderUiContractsComponent(
  item: UiContractsComponentItem,
  nodesById: Map<string, UiContractsRenderNode>,
  indent: string,
  lines: string[]
): void {
  if (item.titleNodeId) {
    lines.push(`${indent}subgraph ${clusterId("cluster", item.id)} {`);
    lines.push(
      `${indent}  graph${formatAttributes({
        label: "",
        style: item.style
      })};`
    );
    const titleNode = nodesById.get(item.titleNodeId);
    if (titleNode) {
      renderUiContractsNode(titleNode, `${indent}  `, lines);
    }
    renderUiContractsItems(item.childItems, nodesById, `${indent}  `, lines);
    lines.push(`${indent}}`);
    return;
  }

  const node = nodesById.get(item.nodeId);
  if (!node) {
    return;
  }

  renderUiContractsNode(node, indent, lines);
}

function renderUiContractsStateGroup(
  item: UiContractsStateGroupItem,
  nodesById: Map<string, UiContractsRenderNode>,
  indent: string,
  lines: string[]
): void {
  lines.push(`${indent}subgraph ${clusterId("cluster", item.id)} {`);
  lines.push(
    `${indent}  graph${formatAttributes({
      label: "",
      style: item.style
    })};`
  );
  const titleNode = nodesById.get(item.titleNodeId);
  if (titleNode) {
    renderUiContractsNode(titleNode, `${indent}  `, lines);
  }
  for (const nodeId of item.nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    renderUiContractsNode(node, `${indent}  `, lines);
  }
  lines.push(`${indent}}`);
}

function renderUiContractsViewState(
  item: UiContractsViewStateItem,
  nodesById: Map<string, UiContractsRenderNode>,
  indent: string,
  lines: string[]
): void {
  if (item.titleNodeId) {
    lines.push(`${indent}subgraph ${clusterId("cluster", item.id)} {`);
    lines.push(
      `${indent}  graph${formatAttributes({
        label: "",
        style: item.style
      })};`
    );
    const titleNode = nodesById.get(item.titleNodeId);
    if (titleNode) {
      renderUiContractsNode(titleNode, `${indent}  `, lines);
    }
    renderUiContractsItems(item.childItems, nodesById, `${indent}  `, lines);
    lines.push(`${indent}}`);
    return;
  }

  const node = nodesById.get(item.nodeId);
  if (node) {
    renderUiContractsNode(node, indent, lines);
  }
}

function renderUiContractsSupportGroup(
  item: UiContractsSupportingGroupItem,
  nodesById: Map<string, UiContractsRenderNode>,
  indent: string,
  lines: string[]
): void {
  lines.push(`${indent}subgraph ${clusterId("cluster", item.id)} {`);
  lines.push(
    `${indent}  graph${formatAttributes({
      label: "",
      style: item.style
    })};`
  );
  const titleNode = nodesById.get(item.titleNodeId);
  if (titleNode) {
    renderUiContractsNode(titleNode, `${indent}  `, lines);
  }
  for (const nodeId of item.nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    renderUiContractsNode(node, `${indent}  `, lines);
  }
  lines.push(`${indent}}`);
}

function renderUiContractsPlace(
  item: UiContractsPlaceItem,
  nodesById: Map<string, UiContractsRenderNode>,
  indent: string,
  lines: string[]
): void {
  lines.push(`${indent}subgraph ${clusterId("cluster", item.id)} {`);
  lines.push(
    `${indent}  graph${formatAttributes({
      label: "",
      style: "rounded"
    })};`
  );
  const titleNode = nodesById.get(item.titleNodeId);
  if (titleNode) {
    renderUiContractsNode(titleNode, `${indent}  `, lines);
  }
  renderUiContractsItems(item.childItems, nodesById, `${indent}  `, lines);
  lines.push(`${indent}}`);
}

function renderUiContractsItems(
  items:
    | Array<UiContractsViewStateItem | UiContractsComponentItem | UiContractsStateGroupItem | UiContractsLeafNodeItem>
    | UiContractsRootItem[],
  nodesById: Map<string, UiContractsRenderNode>,
  indent: string,
  lines: string[]
): void {
  for (const item of items) {
    if (item.kind === "place") {
      renderUiContractsPlace(item, nodesById, indent, lines);
      continue;
    }

    if (item.kind === "view_state") {
      renderUiContractsViewState(item, nodesById, indent, lines);
      continue;
    }

    if (item.kind === "state_group") {
      renderUiContractsStateGroup(item, nodesById, indent, lines);
      continue;
    }

    if (item.kind === "support_group") {
      renderUiContractsSupportGroup(item, nodesById, indent, lines);
      continue;
    }

    if (item.kind === "node") {
      const node = nodesById.get(item.nodeId);
      if (node) {
        renderUiContractsNode(node, indent, lines);
      }
      continue;
    }

    renderUiContractsComponent(item, nodesById, indent, lines);
  }
}

export function renderUiContractsDot(model: UiContractsRenderModel, style?: DotPreviewStyle): string {
  const fontFamily = style?.fontFamily ? escapeLabel(style.fontFamily) : "Public Sans";
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const lines = [
    "digraph ui_contracts {",
    "  rankdir=LR;",
    `  graph [fontname="${fontFamily}", compound=true, nodesep=0.7, ranksep=1.0];`,
    `  node [fontname="${fontFamily}"];`,
    `  edge [fontname="${fontFamily}"];`
  ];

  renderUiContractsItems(model.rootItems, nodesById, "  ", lines);

  renderInvisibleOrderChains(model.siblingOrderChains, lines, new Set(model.edges.map((edge) => `${edge.from}->${edge.to}`)));

  for (const edge of model.edges) {
    lines.push(
      `  ${quoteId(edge.from)} -> ${quoteId(edge.to)}${formatAttributes({
        label: edge.label,
        style: edge.style,
        constraint: edge.constraint,
        weight: edge.weight
      })};`
    );
  }

  lines.push("}");
  return lines.join("\n");
}
