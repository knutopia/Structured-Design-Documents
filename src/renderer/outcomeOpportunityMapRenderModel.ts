import { getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import type { RendererConnectorChannelConfig, ViewSpec } from "../bundle/types.js";
import { getGraphAuthorOrder, type CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import type { ResolvedProfileDisplayPolicy } from "./profileDisplay.js";
import { readBooleanProfileDisplaySetting } from "./profileDisplay.js";

type OutcomeOpportunityLaneId = string;

export interface OutcomeOpportunityRenderNode {
  id: string;
  type: string;
  laneId: OutcomeOpportunityLaneId;
  authorOrder: number;
  visualRole: string;
  shape: string;
  labelLines: string[];
}

export interface OutcomeOpportunityRenderColumn {
  id: OutcomeOpportunityLaneId;
  label: string;
  order: number;
}

export interface OutcomeOpportunityRenderLane {
  id: OutcomeOpportunityLaneId;
  label: string;
  headerId: string;
  nodeIds: string[];
}

export interface OutcomeOpportunityRenderEdge {
  id: string;
  from: string;
  type: string;
  to: string;
  channel: string;
  label: string;
  priority: number;
  authorOrder: number;
}

export interface OutcomeOpportunityMapRenderModel {
  columns: OutcomeOpportunityRenderColumn[];
  lanes: OutcomeOpportunityRenderLane[];
  nodes: OutcomeOpportunityRenderNode[];
  edges: OutcomeOpportunityRenderEdge[];
  siblingOrderChains: string[][];
  connectorPriorityOrder: string[];
}

interface OutcomeOpportunityMapDisplayOptions {
  showInstrumentationAnnotations: boolean;
}

interface OutcomeOpportunitySemanticColumn {
  id: OutcomeOpportunityLaneId;
  label: string;
}

interface OutcomeOpportunityNodeChrome {
  visualRole: string;
  legacyDotShape: string;
}

interface OutcomeOpportunityConnectorLabel {
  visible: boolean;
  text: string;
}

interface OutcomeOpportunityConnector {
  channel: string;
  label: OutcomeOpportunityConnectorLabel;
}

export interface OutcomeOpportunityRendererDefaults {
  semanticColumns: OutcomeOpportunitySemanticColumn[];
  nodeTypeColumns: Record<string, OutcomeOpportunityLaneId>;
  nodeChrome: Record<string, OutcomeOpportunityNodeChrome>;
  connectors: Record<string, OutcomeOpportunityConnector>;
  connectorPriorityOrder: string[];
}

const expectedFixedColumns: OutcomeOpportunitySemanticColumn[] = [
  { id: "initiative", label: "Initiatives" },
  { id: "opportunity", label: "Opportunities" },
  { id: "outcome", label: "Outcomes" },
  { id: "metric", label: "Metrics" }
];

function capitalize(text: string | undefined): string {
  if (!text || text.length === 0) {
    return "Reference";
  }
  return `${text[0].toUpperCase()}${text.slice(1)}`;
}

function formatReferenceTarget(targetId: string, targetName?: string): string {
  if (targetName && targetName.length > 0 && targetName !== targetId) {
    return `${targetId} ${targetName}`;
  }

  return targetName && targetName.length > 0 ? targetName : targetId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function columnSummary(columns: readonly OutcomeOpportunitySemanticColumn[]): string {
  return columns.map((column) => `${column.id} (${column.label})`).join(", ");
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid outcome_opportunity_map renderer_defaults.${label}: expected non-empty string`);
  }
  return value;
}

function assertRecordValue(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Invalid outcome_opportunity_map renderer_defaults.${label}: expected object`);
  }
  return value;
}

function readFixedSemanticColumns(view: ViewSpec): OutcomeOpportunitySemanticColumn[] {
  const columns = view.conventions.renderer_defaults?.semantic_columns?.fixed_order;
  if (!Array.isArray(columns)) {
    throw new Error(
      "Invalid outcome_opportunity_map renderer_defaults.semantic_columns.fixed_order: expected exactly four semantic columns"
    );
  }

  const actualColumns = columns.map((column, index) => {
    const columnRecord = assertRecordValue(column, `semantic_columns.fixed_order[${index}]`);
    return {
      id: assertString(columnRecord.id, `semantic_columns.fixed_order[${index}].id`),
      label: assertString(columnRecord.label, `semantic_columns.fixed_order[${index}].label`)
    };
  });

  if (actualColumns.length !== expectedFixedColumns.length) {
    throw new Error(
      `Invalid outcome_opportunity_map semantic column contract: expected ${expectedFixedColumns.length} columns ` +
      `[${columnSummary(expectedFixedColumns)}], got ${actualColumns.length} [${columnSummary(actualColumns)}]`
    );
  }

  for (let index = 0; index < expectedFixedColumns.length; index += 1) {
    const expected = expectedFixedColumns[index];
    const actual = actualColumns[index];
    if (actual.id !== expected.id) {
      throw new Error(
        `Invalid outcome_opportunity_map semantic column contract at position ${index + 1}: ` +
        `expected ${expected.id} (${expected.label}), got ${actual.id} (${actual.label})`
      );
    }
  }

  return actualColumns;
}

function readNodeTypeColumns(view: ViewSpec, semanticColumns: readonly OutcomeOpportunitySemanticColumn[]): Record<string, string> {
  const nodeTypeColumns = assertRecordValue(
    view.conventions.renderer_defaults?.semantic_columns?.node_type_columns,
    "semantic_columns.node_type_columns"
  );
  const knownColumnIds = new Set(semanticColumns.map((column) => column.id));

  return Object.fromEntries(
    view.projection.include_node_types.map((nodeType) => {
      const columnId = assertString(
        nodeTypeColumns[nodeType],
        `semantic_columns.node_type_columns.${nodeType}`
      );
      if (!knownColumnIds.has(columnId)) {
        throw new Error(
          `Invalid outcome_opportunity_map renderer_defaults.semantic_columns.node_type_columns.${nodeType}: ` +
          `unknown semantic column '${columnId}'`
        );
      }
      return [nodeType, columnId] as const;
    })
  );
}

function readNodeChrome(view: ViewSpec): Record<string, OutcomeOpportunityNodeChrome> {
  const nodeChrome = assertRecordValue(view.conventions.renderer_defaults?.node_chrome, "node_chrome");

  return Object.fromEntries(
    view.projection.include_node_types.map((nodeType) => {
      const chrome = assertRecordValue(nodeChrome[nodeType], `node_chrome.${nodeType}`);
      return [
        nodeType,
        {
          visualRole: assertString(chrome.visual_role, `node_chrome.${nodeType}.visual_role`),
          legacyDotShape: assertString(chrome.legacy_dot_shape, `node_chrome.${nodeType}.legacy_dot_shape`)
        }
      ] as const;
    })
  );
}

function readConnectorLabel(edgeType: string, connector: RendererConnectorChannelConfig): OutcomeOpportunityConnectorLabel {
  const label = assertRecordValue(connector.label, `connectors.edge_type_channels.${edgeType}.label`);
  if (typeof label.visible !== "boolean") {
    throw new Error(
      `Invalid outcome_opportunity_map renderer_defaults.connectors.edge_type_channels.${edgeType}.label.visible: ` +
      "expected boolean"
    );
  }

  return {
    visible: label.visible,
    text: label.visible ? assertString(label.text, `connectors.edge_type_channels.${edgeType}.label.text`) : ""
  };
}

function readConnectors(view: ViewSpec): Record<string, OutcomeOpportunityConnector> {
  const connectors = assertRecordValue(view.conventions.renderer_defaults?.connectors, "connectors");
  const channels = assertRecordValue(connectors.edge_type_channels, "connectors.edge_type_channels");

  return Object.fromEntries(
    view.projection.include_edge_types.map((edgeType) => {
      const connector = assertRecordValue(channels[edgeType], `connectors.edge_type_channels.${edgeType}`) as RendererConnectorChannelConfig;
      return [
        edgeType,
        {
          channel: assertString(connector.channel, `connectors.edge_type_channels.${edgeType}.channel`),
          label: readConnectorLabel(edgeType, connector)
        }
      ] as const;
    })
  );
}

function readConnectorPriorityOrder(view: ViewSpec): string[] {
  const priorityOrder = view.conventions.renderer_defaults?.connectors?.priority_order;
  if (!Array.isArray(priorityOrder)) {
    throw new Error("Invalid outcome_opportunity_map renderer_defaults.connectors.priority_order: expected array");
  }

  const edgeTypes = priorityOrder.map((value, index) => assertString(value, `connectors.priority_order[${index}]`));
  const includedEdgeTypes = new Set(view.projection.include_edge_types);
  const seen = new Set<string>();

  for (const edgeType of edgeTypes) {
    if (seen.has(edgeType)) {
      throw new Error(`Invalid outcome_opportunity_map renderer_defaults.connectors.priority_order: duplicate ${edgeType}`);
    }
    seen.add(edgeType);
    if (!includedEdgeTypes.has(edgeType)) {
      throw new Error(
        `Invalid outcome_opportunity_map renderer_defaults.connectors.priority_order: ` +
        `${edgeType} is not included by the view projection`
      );
    }
  }

  for (const edgeType of includedEdgeTypes) {
    if (!seen.has(edgeType)) {
      throw new Error(
        `Invalid outcome_opportunity_map renderer_defaults.connectors.priority_order: missing ${edgeType}`
      );
    }
  }

  return edgeTypes;
}

export function readOutcomeOpportunityRendererDefaults(view: ViewSpec): OutcomeOpportunityRendererDefaults {
  const semanticColumns = readFixedSemanticColumns(view);
  return {
    semanticColumns,
    nodeTypeColumns: readNodeTypeColumns(view, semanticColumns),
    nodeChrome: readNodeChrome(view),
    connectors: readConnectors(view),
    connectorPriorityOrder: readConnectorPriorityOrder(view)
  };
}

function readOutcomeOpportunityMapDisplayOptions(
  policy: ResolvedProfileDisplayPolicy
): OutcomeOpportunityMapDisplayOptions {
  return {
    showInstrumentationAnnotations: readBooleanProfileDisplaySetting(policy, "show_instrumentation_annotations", true)
  };
}

function buildAuthorOrderByEdgeKey(graph: CompiledGraph): Map<string, number> {
  const graphAuthorOrder = getGraphAuthorOrder(graph);
  const orderByKey = new Map<string, number>();
  let nextOrder = 0;

  if (graphAuthorOrder) {
    for (const [from, edges] of graphAuthorOrder.edgeLineOrderByParentId.entries()) {
      for (const edge of edges) {
        const key = `${from}->${edge.type}->${edge.to}`;
        if (!orderByKey.has(key)) {
          orderByKey.set(key, nextOrder);
        }
        nextOrder += 1;
      }
    }
  }

  for (const edge of graph.edges) {
    const key = `${edge.from}->${edge.type}->${edge.to}`;
    if (!orderByKey.has(key)) {
      orderByKey.set(key, nextOrder);
      nextOrder += 1;
    }
  }

  return orderByKey;
}

function edgeId(from: string, type: string, to: string): string {
  return `${from}__${type.toLowerCase()}__${to}`;
}

export function buildOutcomeOpportunityMapRenderModel(
  projection: Projection,
  graph: CompiledGraph,
  view: ViewSpec,
  displayPolicy: ResolvedProfileDisplayPolicy = {}
): OutcomeOpportunityMapRenderModel {
  const rendererDefaults = readOutcomeOpportunityRendererDefaults(view);
  const displayOptions = readOutcomeOpportunityMapDisplayOptions(displayPolicy);
  const projectionNodesById = new Map(projection.nodes.map((node) => [node.id, node]));
  const annotationsByNodeId = new Map(
    projection.derived.node_annotations.map((annotation) => [annotation.node_id, annotation])
  );
  const orderedProjectionNodeIds = getTopLevelNodeIdsInAuthorOrder(
    graph,
    projection.nodes.map((node) => node.id)
  );
  const nodeRankById = new Map(orderedProjectionNodeIds.map((nodeId, index) => [nodeId, index]));
  const authorOrderByEdgeKey = buildAuthorOrderByEdgeKey(graph);
  const columns = rendererDefaults.semanticColumns.map<OutcomeOpportunityRenderColumn>((column, order) => ({
    id: column.id,
    label: column.label,
    order
  }));

  const nodes = rendererDefaults.semanticColumns.flatMap((column) => {
    const laneNodeIds = projection.nodes
      .filter((node) => rendererDefaults.nodeTypeColumns[node.type] === column.id)
      .map((node) => node.id)
      .sort(
        (left, right) =>
          (nodeRankById.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (nodeRankById.get(right) ?? Number.MAX_SAFE_INTEGER)
      );

    return laneNodeIds.map<OutcomeOpportunityRenderNode>((nodeId) => {
      const node = projectionNodesById.get(nodeId)!;
      const chrome = rendererDefaults.nodeChrome[node.type];
      const labelLines = [node.name];
      if (displayOptions.showInstrumentationAnnotations) {
        for (const reference of annotationsByNodeId.get(nodeId)?.references ?? []) {
          labelLines.push(`${capitalize(reference.group)}: ${formatReferenceTarget(reference.target_id, reference.target_name)}`);
        }
      }

      return {
        id: node.id,
        type: node.type,
        laneId: column.id,
        authorOrder: nodeRankById.get(node.id) ?? Number.MAX_SAFE_INTEGER,
        visualRole: chrome.visualRole,
        shape: chrome.legacyDotShape,
        labelLines
      };
    });
  });

  const nodesByLaneId = new Map<OutcomeOpportunityLaneId, string[]>();
  for (const node of nodes) {
    const laneNodes = nodesByLaneId.get(node.laneId) ?? [];
    laneNodes.push(node.id);
    nodesByLaneId.set(node.laneId, laneNodes);
  }

  const lanes = rendererDefaults.semanticColumns
    .map<OutcomeOpportunityRenderLane | undefined>((column) => {
      const nodeIds = nodesByLaneId.get(column.id) ?? [];
      if (nodeIds.length === 0) {
        return undefined;
      }

      return {
        id: column.id,
        label: column.label,
        headerId: `lane_${column.id}`,
        nodeIds
      };
    })
    .filter((lane): lane is OutcomeOpportunityRenderLane => lane !== undefined);

  const siblingOrderChains = [
    ...(lanes.length > 1 ? [lanes.map((lane) => lane.headerId)] : []),
    ...lanes
      .map((lane) => [lane.headerId, ...lane.nodeIds])
      .filter((chain) => chain.length > 1)
  ];

  const priorityByEdgeType = new Map(
    rendererDefaults.connectorPriorityOrder.map((edgeType, index) => [edgeType, index])
  );
  const edges = projection.edges.map((edge) => {
    const connector = rendererDefaults.connectors[edge.type];
    if (!connector) {
      throw new Error(
        `Invalid outcome_opportunity_map renderer_defaults.connectors.edge_type_channels.${edge.type}: missing connector`
      );
    }

    return {
      id: edgeId(edge.from, edge.type, edge.to),
      from: edge.from,
      type: edge.type,
      to: edge.to,
      channel: connector.channel,
      label: connector.label.visible ? connector.label.text : "",
      priority: priorityByEdgeType.get(edge.type) ?? Number.MAX_SAFE_INTEGER,
      authorOrder: authorOrderByEdgeKey.get(`${edge.from}->${edge.type}->${edge.to}`)
        ?? Number.MAX_SAFE_INTEGER
    };
  });

  return {
    columns,
    lanes,
    nodes,
    edges,
    siblingOrderChains,
    connectorPriorityOrder: rendererDefaults.connectorPriorityOrder
  };
}
