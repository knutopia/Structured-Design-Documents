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

type MermaidNodeShape = "box" | "rounded" | "component" | "diamond" | "pill";
type MermaidEdgeStyle = "solid" | "dashed" | "dotted" | "bold";

interface MermaidEdgeRegistry {
  nextIndex: number;
  dashed: number[];
  dotted: number[];
  bold: number[];
}

function createEdgeRegistry(): MermaidEdgeRegistry {
  return {
    nextIndex: 0,
    dashed: [],
    dotted: [],
    bold: []
  };
}

function mermaidId(id: string): string {
  return `n_${id.replace(/[^A-Za-z0-9]/g, "_")}`;
}

function escapeLabel(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/\|/g, "/");
}

function formatLabelLines(lines: string[]): string {
  return escapeLabel(lines.join("<br/>"));
}

function formatNode(id: string, label: string, shape: MermaidNodeShape): string {
  const safeId = mermaidId(id);
  switch (shape) {
    case "rounded":
      return `${safeId}("${label}")`;
    case "component":
      return `${safeId}[["${label}"]]`;
    case "diamond":
      return `${safeId}{"${label}"}`;
    case "pill":
      return `${safeId}(["${label}"])`;
    default:
      return `${safeId}["${label}"]`;
  }
}

function pushEdge(
  lines: string[],
  registry: MermaidEdgeRegistry,
  from: string,
  to: string,
  label?: string,
  style: MermaidEdgeStyle = "solid",
  indent = "  "
): void {
  const renderedLabel = label ? `|${escapeLabel(label)}|` : "";
  lines.push(`${indent}${mermaidId(from)} -->${renderedLabel} ${mermaidId(to)}`);

  const edgeIndex = registry.nextIndex;
  registry.nextIndex += 1;

  if (style === "dashed") {
    registry.dashed.push(edgeIndex);
    return;
  }

  if (style === "dotted") {
    registry.dotted.push(edgeIndex);
    return;
  }

  if (style === "bold") {
    registry.bold.push(edgeIndex);
  }
}

function pushLinkStyles(lines: string[], registry: MermaidEdgeRegistry): void {
  if (registry.dashed.length > 0) {
    lines.push(`  linkStyle ${registry.dashed.join(",")} stroke-dasharray: 6 4;`);
  }

  if (registry.dotted.length > 0) {
    lines.push(`  linkStyle ${registry.dotted.join(",")} stroke-dasharray: 2 4;`);
  }

  if (registry.bold.length > 0) {
    lines.push(`  linkStyle ${registry.bold.join(",")} stroke-width: 3px;`);
  }
}

function parseNodeStyle(style: string | undefined): { shape: MermaidNodeShape; dashed: boolean } {
  const dashed = style?.split(",").includes("dashed") ?? false;
  const rounded = style?.split(",").includes("rounded") ?? false;

  return {
    shape: rounded ? "rounded" : "box",
    dashed
  };
}

function inferNodeShape(shape: string, style?: string): { shape: MermaidNodeShape; dashed: boolean } {
  const parsedStyle = parseNodeStyle(style);
  switch (shape) {
    case "diamond":
      return {
        shape: "diamond",
        dashed: parsedStyle.dashed
      };
    case "ellipse":
    case "oval":
      return {
        shape: "pill",
        dashed: parsedStyle.dashed
      };
    case "component":
      return {
        shape: "component",
        dashed: parsedStyle.dashed
      };
    default:
      return parsedStyle;
  }
}

function pushNode(
  lines: string[],
  dashedNodeIds: string[],
  id: string,
  labelLines: string[],
  shape: MermaidNodeShape = "box",
  dashed = false,
  indent = "  "
): void {
  lines.push(`${indent}${formatNode(id, formatLabelLines(labelLines), shape)}`);
  if (dashed) {
    dashedNodeIds.push(mermaidId(id));
  }
}

function pushDashedNodeStyles(lines: string[], dashedNodeIds: string[]): void {
  if (dashedNodeIds.length === 0) {
    return;
  }

  lines.push("  classDef dashedNode stroke-dasharray: 6 4;");
  lines.push(`  class ${dashedNodeIds.join(",")} dashedNode;`);
}

function pushHiddenAnchor(
  lines: string[],
  hiddenAnchorIds: string[],
  id: string,
  indent = "  "
): void {
  lines.push(`${indent}${mermaidId(id)}[""]`);
  hiddenAnchorIds.push(mermaidId(id));
}

function pushHiddenAnchorStyles(lines: string[], hiddenAnchorIds: string[]): void {
  if (hiddenAnchorIds.length === 0) {
    return;
  }

  lines.push("  classDef hiddenAnchor fill:transparent,stroke:transparent,color:transparent;");
  lines.push(`  class ${hiddenAnchorIds.join(",")} hiddenAnchor;`);
}

function renderIaPlace(place: IaRenderPlace, indent: string, lines: string[]): void {
  pushNode(lines, [], place.id, place.labelLines, "box", false, indent);
  renderIaItems(place.items, indent, lines);
}

function renderIaItems(items: IaRenderItem[], indent: string, lines: string[]): void {
  for (const item of items) {
    if (item.kind === "area") {
      lines.push(`${indent}subgraph ${mermaidId(item.id)}["${escapeLabel(item.label)}"]`);
      renderIaItems(item.items, `${indent}  `, lines);
      lines.push(`${indent}end`);
      continue;
    }

    renderIaPlace(item, indent, lines);
  }
}

export function renderIaPlaceMapMermaid(model: IaPlaceMapRenderModel): string {
  const lines = ["flowchart LR"];
  const registry = createEdgeRegistry();

  renderIaItems(model.rootItems, "  ", lines);

  for (const edge of model.edges) {
    pushEdge(lines, registry, edge.from, edge.to);
  }

  pushLinkStyles(lines, registry);
  return lines.join("\n");
}

function renderJourneyStep(step: JourneyRenderStep, indent: string, lines: string[]): void {
  pushNode(lines, [], step.id, step.labelLines, "box", false, indent);
}

function renderJourneyStage(stage: JourneyRenderStage, indent: string, lines: string[]): void {
  lines.push(`${indent}subgraph ${mermaidId(stage.id)}["${escapeLabel(stage.label)}"]`);
  for (const item of stage.items) {
    renderJourneyStep(item, `${indent}  `, lines);
  }
  lines.push(`${indent}end`);
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

export function renderJourneyMapMermaid(model: JourneyMapRenderModel): string {
  const lines = ["flowchart LR"];
  const registry = createEdgeRegistry();

  renderJourneyItems(model.rootItems, "  ", lines);

  for (const edge of model.edges) {
    pushEdge(lines, registry, edge.from, edge.to);
  }

  pushLinkStyles(lines, registry);
  return lines.join("\n");
}

function renderOutcomeOpportunityLane(
  lane: OutcomeOpportunityRenderLane,
  nodesById: Map<string, OutcomeOpportunityRenderNode>,
  lines: string[],
  indent: string
): void {
  lines.push(`${indent}subgraph ${mermaidId(lane.id)}["${escapeLabel(lane.label)}"]`);
  for (const nodeId of lane.nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    pushNode(lines, [], node.id, node.labelLines, "box", false, `${indent}  `);
  }
  lines.push(`${indent}end`);
}

export function renderOutcomeOpportunityMapMermaid(model: OutcomeOpportunityMapRenderModel): string {
  const lines = ["flowchart LR"];
  const registry = createEdgeRegistry();
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));

  for (const lane of model.lanes) {
    renderOutcomeOpportunityLane(lane, nodesById, lines, "  ");
  }

  for (const edge of model.edges) {
    pushEdge(lines, registry, edge.from, edge.to, edge.label);
  }

  pushLinkStyles(lines, registry);
  return lines.join("\n");
}

function renderServiceBlueprintLane(
  lane: ServiceBlueprintRenderLane,
  nodesById: Map<string, ServiceBlueprintRenderNode>,
  dashedNodeIds: string[],
  lines: string[],
  indent: string
): void {
  lines.push(`${indent}subgraph ${mermaidId(lane.id)}["${escapeLabel(lane.label)}"]`);
  for (const nodeId of lane.nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    const display = inferNodeShape(node.shape, node.style);
    pushNode(lines, dashedNodeIds, node.id, node.labelLines, display.shape, display.dashed, `${indent}  `);
  }
  lines.push(`${indent}end`);
}

function mapMermaidEdgeStyle(style: string | undefined): MermaidEdgeStyle {
  switch (style) {
    case "dashed":
      return "dashed";
    case "dotted":
      return "dotted";
    case "bold":
      return "bold";
    default:
      return "solid";
  }
}

export function renderServiceBlueprintMermaid(model: ServiceBlueprintRenderModel): string {
  const lines = ["flowchart TB"];
  const registry = createEdgeRegistry();
  const dashedNodeIds: string[] = [];
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));

  for (const lane of model.lanes) {
    renderServiceBlueprintLane(lane, nodesById, dashedNodeIds, lines, "  ");
  }

  for (const nodeId of model.ungroupedNodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    const display = inferNodeShape(node.shape, node.style);
    pushNode(lines, dashedNodeIds, node.id, node.labelLines, display.shape, display.dashed, "  ");
  }

  for (const edge of model.edges) {
    pushEdge(lines, registry, edge.from, edge.to, edge.label, mapMermaidEdgeStyle(edge.style));
  }

  pushDashedNodeStyles(lines, dashedNodeIds);
  pushLinkStyles(lines, registry);
  return lines.join("\n");
}

function renderScenarioFlowLane(
  lane: ScenarioFlowRenderLane,
  nodesById: Map<string, ScenarioFlowRenderNode>,
  dashedNodeIds: string[],
  lines: string[],
  indent: string
): void {
  lines.push(`${indent}subgraph ${mermaidId(lane.id)}["${escapeLabel(lane.label)}"]`);
  for (const nodeId of lane.nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    const display = inferNodeShape(node.shape, node.style);
    pushNode(lines, dashedNodeIds, node.id, node.labelLines, display.shape, display.dashed, `${indent}  `);
  }
  lines.push(`${indent}end`);
}

export function renderScenarioFlowMermaid(model: ScenarioFlowRenderModel): string {
  const lines = ["flowchart TB"];
  const registry = createEdgeRegistry();
  const dashedNodeIds: string[] = [];
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));

  for (const lane of model.lanes) {
    renderScenarioFlowLane(lane, nodesById, dashedNodeIds, lines, "  ");
  }

  for (const edge of model.edges) {
    pushEdge(lines, registry, edge.from, edge.to, edge.label, mapMermaidEdgeStyle(edge.style));
  }

  pushDashedNodeStyles(lines, dashedNodeIds);
  pushLinkStyles(lines, registry);
  return lines.join("\n");
}

function renderUiContractsNode(
  node: UiContractsRenderNode,
  dashedNodeIds: string[],
  indent: string,
  lines: string[]
): void {
  const display = inferNodeShape(node.shape, node.style);
  pushNode(lines, dashedNodeIds, node.id, node.labelLines, display.shape, display.dashed, indent);
}

function renderUiContractsComponent(
  item: UiContractsComponentItem,
  nodesById: Map<string, UiContractsRenderNode>,
  dashedNodeIds: string[],
  hiddenAnchorIds: string[],
  indent: string,
  lines: string[]
): void {
  if (item.childItems.length > 0) {
    lines.push(`${indent}subgraph ${mermaidId(`${item.id}__group`)}["${formatLabelLines(item.labelLines ?? [])}"]`);
    pushHiddenAnchor(lines, hiddenAnchorIds, item.anchorId, `${indent}  `);
    renderUiContractsItems(item.childItems, nodesById, dashedNodeIds, hiddenAnchorIds, `${indent}  `, lines);
    lines.push(`${indent}end`);
    return;
  }

  const node = nodesById.get(item.nodeId);
  if (!node) {
    return;
  }

  renderUiContractsNode(node, dashedNodeIds, indent, lines);
}

function renderUiContractsStateGroup(
  item: UiContractsStateGroupItem,
  nodesById: Map<string, UiContractsRenderNode>,
  dashedNodeIds: string[],
  hiddenAnchorIds: string[],
  indent: string,
  lines: string[]
): void {
  lines.push(`${indent}subgraph ${mermaidId(item.id)}["${formatLabelLines(item.labelLines)}"]`);
  for (const nodeId of item.nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    renderUiContractsNode(node, dashedNodeIds, `${indent}  `, lines);
  }
  lines.push(`${indent}end`);
}

function renderUiContractsViewState(
  item: UiContractsViewStateItem,
  nodesById: Map<string, UiContractsRenderNode>,
  dashedNodeIds: string[],
  hiddenAnchorIds: string[],
  indent: string,
  lines: string[]
): void {
  if (item.childItems.length === 0) {
    const node = nodesById.get(item.nodeId);
    if (node) {
      renderUiContractsNode(node, dashedNodeIds, indent, lines);
    }
    return;
  }

  lines.push(`${indent}subgraph ${mermaidId(`${item.id}__group`)}["${formatLabelLines(item.labelLines ?? [])}"]`);
  pushHiddenAnchor(lines, hiddenAnchorIds, item.anchorId, `${indent}  `);
  renderUiContractsItems(item.childItems, nodesById, dashedNodeIds, hiddenAnchorIds, `${indent}  `, lines);
  lines.push(`${indent}end`);
}

function renderUiContractsPlace(
  item: UiContractsPlaceItem,
  nodesById: Map<string, UiContractsRenderNode>,
  dashedNodeIds: string[],
  hiddenAnchorIds: string[],
  indent: string,
  lines: string[]
): void {
  lines.push(`${indent}subgraph ${mermaidId(item.id)}["${formatLabelLines(item.labelLines)}"]`);
  renderUiContractsItems(item.childItems, nodesById, dashedNodeIds, hiddenAnchorIds, `${indent}  `, lines);
  lines.push(`${indent}end`);
}

function renderUiContractsSupportGroup(
  item: UiContractsSupportingGroupItem,
  nodesById: Map<string, UiContractsRenderNode>,
  dashedNodeIds: string[],
  hiddenAnchorIds: string[],
  indent: string,
  lines: string[]
): void {
  lines.push(`${indent}subgraph ${mermaidId(item.id)}["${formatLabelLines(item.labelLines)}"]`);
  for (const nodeId of item.nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    renderUiContractsNode(node, dashedNodeIds, `${indent}  `, lines);
  }
  lines.push(`${indent}end`);
}

function renderUiContractsItems(
  items:
    | Array<UiContractsViewStateItem | UiContractsComponentItem | UiContractsStateGroupItem | UiContractsLeafNodeItem>
    | UiContractsRootItem[],
  nodesById: Map<string, UiContractsRenderNode>,
  dashedNodeIds: string[],
  hiddenAnchorIds: string[],
  indent: string,
  lines: string[]
): void {
  for (const item of items) {
    if (item.kind === "place") {
      renderUiContractsPlace(item, nodesById, dashedNodeIds, hiddenAnchorIds, indent, lines);
      continue;
    }

    if (item.kind === "view_state") {
      renderUiContractsViewState(item, nodesById, dashedNodeIds, hiddenAnchorIds, indent, lines);
      continue;
    }

    if (item.kind === "state_group") {
      renderUiContractsStateGroup(item, nodesById, dashedNodeIds, hiddenAnchorIds, indent, lines);
      continue;
    }

    if (item.kind === "support_group") {
      renderUiContractsSupportGroup(item, nodesById, dashedNodeIds, hiddenAnchorIds, indent, lines);
      continue;
    }

    if (item.kind === "node") {
      const node = nodesById.get(item.nodeId);
      if (node) {
        renderUiContractsNode(node, dashedNodeIds, indent, lines);
      }
      continue;
    }

    renderUiContractsComponent(item, nodesById, dashedNodeIds, hiddenAnchorIds, indent, lines);
  }
}

export function renderUiContractsMermaid(model: UiContractsRenderModel): string {
  const lines = ["flowchart LR"];
  const registry = createEdgeRegistry();
  const dashedNodeIds: string[] = [];
  const hiddenAnchorIds: string[] = [];
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));

  renderUiContractsItems(model.rootItems, nodesById, dashedNodeIds, hiddenAnchorIds, "  ", lines);

  for (const edge of model.edges) {
    pushEdge(lines, registry, edge.from, edge.to, edge.label, mapMermaidEdgeStyle(edge.style));
  }

  pushDashedNodeStyles(lines, dashedNodeIds);
  pushHiddenAnchorStyles(lines, hiddenAnchorIds);
  pushLinkStyles(lines, registry);
  return lines.join("\n");
}
