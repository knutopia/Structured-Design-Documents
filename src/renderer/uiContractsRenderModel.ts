import { getSourceOrderedStructuralStream, getTopLevelNodeIdsInAuthorOrder } from "../compiler/authorOrder.js";
import type { CompiledEdge, CompiledGraph } from "../compiler/types.js";
import type { Projection, ProjectionNodeGroup } from "../projector/types.js";
import { buildIaStylePlaceLabelLines } from "./placeLabelLines.js";
import type { ResolvedProfileDisplayPolicy } from "./profileDisplay.js";
import { readBooleanProfileDisplaySetting } from "./profileDisplay.js";

type UiContractsNodeType = "Component" | "DataEntity" | "Event" | "State" | "SystemAction" | "ViewState";
type RenderedTransitionType = "State" | "ViewState";

export interface UiContractsRenderNode {
  id: string;
  shape: string;
  style?: string;
  labelLines: string[];
}

export interface UiContractsRenderEdge {
  from: string;
  to: string;
  label?: string;
  style?: string;
  constraint?: boolean;
  weight?: number;
}

export interface UiContractsComponentItem {
  kind: "component";
  nodeId: string;
  orderAnchorId: string;
}

export interface UiContractsStateGroupItem {
  kind: "state_group";
  id: string;
  labelLines: string[];
  nodeIds: string[];
  orderAnchorId: string;
  style?: string;
}

export interface UiContractsViewStateItem {
  kind: "view_state";
  id: string;
  nodeId: string;
  childItems: Array<UiContractsComponentItem | UiContractsStateGroupItem>;
  orderAnchorId: string;
  style?: string;
}

export interface UiContractsPlaceItem {
  kind: "place";
  id: string;
  labelLines: string[];
  anchorId: string;
  childItems: Array<UiContractsViewStateItem | UiContractsComponentItem | UiContractsStateGroupItem>;
  orderAnchorId: string;
}

export type UiContractsRootItem = UiContractsPlaceItem | UiContractsViewStateItem | UiContractsComponentItem | UiContractsStateGroupItem;

export interface UiContractsSupportingLane {
  headerId: string;
  label: string;
  nodeIds: string[];
}

export interface UiContractsRenderModel {
  rootItems: UiContractsRootItem[];
  nodes: UiContractsRenderNode[];
  edges: UiContractsRenderEdge[];
  siblingOrderChains: string[][];
  supportingLane?: UiContractsSupportingLane;
}

interface TransitionGraphPriorityViewMetadata {
  primary_node_type?: string;
  secondary_node_type?: string;
  secondary_render_mode?: string;
  fallback_to_secondary_when_primary_absent?: boolean;
}

interface UiContractsDisplayOptions {
  includeViewStateDataRequired: boolean;
  showSecondaryStateGroupsWhenPrimaryViewState: boolean;
  showSupportingContractLaneWhenPrimaryViewState: boolean;
}

function getTransitionGraphPriorityMetadata(projection: Projection): TransitionGraphPriorityViewMetadata {
  const raw = projection.derived.view_metadata.transition_graph_priority;
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const metadata = raw as Record<string, unknown>;
  return {
    primary_node_type: typeof metadata.primary_node_type === "string" ? metadata.primary_node_type : undefined,
    secondary_node_type: typeof metadata.secondary_node_type === "string" ? metadata.secondary_node_type : undefined,
    secondary_render_mode: typeof metadata.secondary_render_mode === "string" ? metadata.secondary_render_mode : undefined,
    fallback_to_secondary_when_primary_absent:
      metadata.fallback_to_secondary_when_primary_absent === true
  };
}

function readUiContractsDisplayOptions(policy: ResolvedProfileDisplayPolicy): UiContractsDisplayOptions {
  return {
    includeViewStateDataRequired: readBooleanProfileDisplaySetting(policy, "show_view_state_data_required", true),
    showSecondaryStateGroupsWhenPrimaryViewState: readBooleanProfileDisplaySetting(
      policy,
      "show_secondary_state_groups_when_primary_view_state",
      true
    ),
    showSupportingContractLaneWhenPrimaryViewState: readBooleanProfileDisplaySetting(
      policy,
      "show_supporting_contract_lane_when_primary_view_state",
      true
    )
  };
}

function getEffectiveTransitionNodeType(
  projection: Projection,
  metadata: TransitionGraphPriorityViewMetadata
): RenderedTransitionType {
  const primaryType = metadata.primary_node_type;
  const secondaryType = metadata.secondary_node_type;
  const hasPrimary = primaryType ? projection.nodes.some((node) => node.type === primaryType) : false;
  const hasSecondary = secondaryType ? projection.nodes.some((node) => node.type === secondaryType) : false;

  if (primaryType === "ViewState" && hasPrimary) {
    return "ViewState";
  }

  if (
    secondaryType === "State" &&
    metadata.fallback_to_secondary_when_primary_absent === true &&
    !hasPrimary &&
    hasSecondary
  ) {
    return "State";
  }

  return "ViewState";
}

function orderNodeIds(graph: CompiledGraph, nodeIds: Iterable<string>): string[] {
  return getTopLevelNodeIdsInAuthorOrder(graph, nodeIds);
}

function formatTransitionLabel(edge: Pick<CompiledEdge, "event" | "guard" | "effect">): string | undefined {
  const parts: string[] = [];
  if (edge.event) {
    parts.push(`[${edge.event}]`);
  }
  if (edge.guard) {
    parts.push(`{${edge.guard}}`);
  }
  if (edge.effect) {
    parts.push(`/ ${edge.effect}`);
  }

  return parts.length > 0 ? parts.join(" ") : undefined;
}

function nodeDisplay(type: UiContractsNodeType, effectiveTransitionNodeType: RenderedTransitionType): Pick<UiContractsRenderNode, "shape" | "style"> {
  switch (type) {
    case "ViewState":
      return {
        shape: "box",
        style: "rounded,dashed"
      };
    case "State":
      return effectiveTransitionNodeType === "State"
        ? {
            shape: "ellipse"
          }
        : {
            shape: "ellipse",
            style: "dashed"
          };
    case "Component":
      return {
        shape: "box",
        style: "rounded"
      };
    case "SystemAction":
      return {
        shape: "component"
      };
    case "DataEntity":
      return {
        shape: "cylinder"
      };
    case "Event":
      return {
        shape: "oval"
      };
  }
}

function transitionEdgeDisplay(
  edge: Pick<CompiledEdge, "type" | "event" | "guard" | "effect" | "from">,
  graphNodesById: Map<string, { type: string }>,
  effectiveTransitionNodeType: RenderedTransitionType
): Omit<UiContractsRenderEdge, "from" | "to"> {
  const fromType = graphNodesById.get(edge.from)?.type;
  const label = formatTransitionLabel(edge);

  if (fromType === "State") {
    return effectiveTransitionNodeType === "State"
      ? {
          label,
          style: "solid",
          weight: 4
        }
      : {
          label,
          style: "dashed",
          weight: 3
        };
  }

  return {
    label,
    style: "solid",
    weight: 4
  };
}

function contractEdgeDisplay(edge: Pick<CompiledEdge, "type" | "props">): Omit<UiContractsRenderEdge, "from" | "to"> {
  switch (edge.type) {
    case "EMITS":
      return {
        label: "emits",
        style: "dashed",
        constraint: false
      };
    case "DEPENDS_ON":
      return {
        label: "depends on",
        constraint: false
      };
    case "BINDS_TO":
      return {
        label: edge.props.field ? `binds field ${edge.props.field}` : "binds to",
        style: "dotted",
        constraint: false
      };
    default:
      return {
        label: edge.type.toLowerCase().replace(/_/g, " "),
        constraint: false
      };
  }
}

function buildPlaceLabelLines(placeId: string, graphNodesById: Map<string, { name: string; props: Record<string, string> }>): string[] {
  const place = graphNodesById.get(placeId);
  if (!place) {
    return [placeId];
  }

  return buildIaStylePlaceLabelLines({
    name: place.name,
    subtitle: place.props.route_or_key,
    badge: place.props.access
  });
}

function buildStateGroupLabelLines(
  group: ProjectionNodeGroup,
  scopeNode: { name: string } | undefined,
  effectiveTransitionNodeType: RenderedTransitionType
): string[] {
  const scopeName = scopeNode?.name ?? group.scope_id ?? group.label;
  return [
    `${effectiveTransitionNodeType === "State" ? "State graph" : "State detail"}: ${scopeName}`,
    `scope_id=${group.scope_id ?? group.label}`
  ];
}

function collectSiblingOrderChains(rootItems: UiContractsRootItem[], supportingLane?: UiContractsSupportingLane): string[][] {
  const chains: string[][] = [];

  const collectNestedChains = (
    items: Array<UiContractsViewStateItem | UiContractsComponentItem | UiContractsStateGroupItem>
  ): void => {
    for (const item of items) {
      if (item.kind === "view_state") {
        const childAnchors = item.childItems.map((child) => child.orderAnchorId);
        if (childAnchors.length > 0) {
          chains.push([item.nodeId, ...childAnchors]);
        }
        collectNestedChains(item.childItems);
        continue;
      }

      if (item.kind === "state_group" && item.nodeIds.length > 1) {
        chains.push(item.nodeIds);
      }
    }
  };

  for (const item of rootItems) {
    if (item.kind === "place") {
      const childAnchors = item.childItems.map((child) => child.orderAnchorId);
      if (childAnchors.length > 0) {
        chains.push([item.anchorId, ...childAnchors]);
      }
      collectNestedChains(item.childItems);
      continue;
    }

    if (item.kind === "view_state") {
      const childAnchors = item.childItems.map((child) => child.orderAnchorId);
      if (childAnchors.length > 0) {
        chains.push([item.nodeId, ...childAnchors]);
      }
      collectNestedChains(item.childItems);
      continue;
    }

    if (item.kind === "state_group" && item.nodeIds.length > 1) {
      chains.push(item.nodeIds);
    }
  }

  if (supportingLane) {
    const laneChain = [supportingLane.headerId, ...supportingLane.nodeIds];
    if (laneChain.length > 1) {
      chains.push(laneChain);
    }
  }

  const rootAnchors = rootItems.map((item) => item.orderAnchorId);
  if (supportingLane) {
    rootAnchors.push(supportingLane.headerId);
  }
  if (rootAnchors.length > 1) {
    chains.unshift(rootAnchors);
  }

  return chains;
}

export function buildUiContractsRenderModel(
  projection: Projection,
  graph: CompiledGraph,
  displayPolicy: ResolvedProfileDisplayPolicy = {}
): UiContractsRenderModel {
  const graphNodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const projectedNodeIds = new Set(projection.nodes.map((node) => node.id));
  const hierarchyEdges = projection.edges.filter((edge) => edge.type === "COMPOSED_OF" || edge.type === "CONTAINS");
  const displayOptions = readUiContractsDisplayOptions(displayPolicy);
  const metadata = getTransitionGraphPriorityMetadata(projection);
  const effectiveTransitionNodeType = getEffectiveTransitionNodeType(projection, metadata);
  const showSecondaryStateGroups =
    effectiveTransitionNodeType === "State" || displayOptions.showSecondaryStateGroupsWhenPrimaryViewState;
  const showSupportingContractLane =
    effectiveTransitionNodeType === "State" || displayOptions.showSupportingContractLaneWhenPrimaryViewState;

  const viewStateIds = new Set(
    projection.nodes.filter((node) => node.type === "ViewState").map((node) => node.id)
  );
  const componentIds = new Set(
    projection.nodes.filter((node) => node.type === "Component").map((node) => node.id)
  );
  const placeIds = new Set(projection.nodes.filter((node) => node.type === "Place").map((node) => node.id));

  const childViewStatesByPlaceId = new Map<string, string[]>();
  const childComponentsByParentId = new Map<string, string[]>();
  const parentByNodeId = new Map<string, string>();

  for (const edge of hierarchyEdges) {
    if (!projectedNodeIds.has(edge.from) || !projectedNodeIds.has(edge.to)) {
      continue;
    }

    if (placeIds.has(edge.from) && viewStateIds.has(edge.to)) {
      const viewStates = childViewStatesByPlaceId.get(edge.from) ?? [];
      viewStates.push(edge.to);
      childViewStatesByPlaceId.set(edge.from, viewStates);
      parentByNodeId.set(edge.to, edge.from);
      continue;
    }

    if ((placeIds.has(edge.from) || viewStateIds.has(edge.from)) && componentIds.has(edge.to)) {
      const components = childComponentsByParentId.get(edge.from) ?? [];
      components.push(edge.to);
      childComponentsByParentId.set(edge.from, components);
      parentByNodeId.set(edge.to, edge.from);
    }
  }

  const secondaryStateGroups = projection.derived.node_groups.filter(
    (group) => group.role === "secondary_state_group"
  );
  const stateGroupsByScopeId = new Map<string, ProjectionNodeGroup[]>();
  for (const group of secondaryStateGroups) {
    const scopeId = group.scope_id ?? group.label;
    const groups = stateGroupsByScopeId.get(scopeId) ?? [];
    groups.push(group);
    stateGroupsByScopeId.set(scopeId, groups);
  }
  const visibleStateNodeIds = new Set(
    showSecondaryStateGroups ? secondaryStateGroups.flatMap((group) => group.node_ids) : []
  );

  const buildStateGroup = (group: ProjectionNodeGroup): UiContractsStateGroupItem => ({
    kind: "state_group",
    id: group.id,
    labelLines: buildStateGroupLabelLines(group, graphNodesById.get(group.scope_id ?? group.label), effectiveTransitionNodeType),
    nodeIds: [...group.node_ids],
    orderAnchorId: group.node_ids[0] ?? `${group.id}__anchor`,
    style:
      effectiveTransitionNodeType === "State" || metadata.secondary_render_mode !== "inset" ? "rounded" : "rounded,dashed"
  });

  const buildScopedGroupItems = (scopeId: string): UiContractsStateGroupItem[] =>
    showSecondaryStateGroups ? (stateGroupsByScopeId.get(scopeId) ?? []).map((group) => buildStateGroup(group)) : [];

  const buildComponentItems = (parentId: string): Array<UiContractsComponentItem | UiContractsStateGroupItem> => {
    const orderedComponentIds = getSourceOrderedStructuralStream(
      graph,
      parentId,
      ["COMPOSED_OF"],
      childComponentsByParentId.get(parentId) ?? []
    ).map((edge) => edge.to);

    return orderedComponentIds.flatMap((componentId) => [
      {
        kind: "component" as const,
        nodeId: componentId,
        orderAnchorId: componentId
      },
      ...buildScopedGroupItems(componentId)
    ]);
  };

  const buildViewStateItem = (viewStateId: string): UiContractsViewStateItem => ({
    kind: "view_state",
    id: viewStateId,
    nodeId: viewStateId,
    childItems: buildComponentItems(viewStateId),
    orderAnchorId: viewStateId,
    style: "rounded,dashed"
  });

  const buildPlaceItem = (placeId: string): UiContractsPlaceItem => {
    const orderedStructuralChildren = getSourceOrderedStructuralStream(
      graph,
      placeId,
      ["CONTAINS", "COMPOSED_OF"],
      [
        ...(childViewStatesByPlaceId.get(placeId) ?? []),
        ...(childComponentsByParentId.get(placeId) ?? [])
      ]
    ).map((edge) => edge.to);

    const childItems: Array<UiContractsViewStateItem | UiContractsComponentItem | UiContractsStateGroupItem> = [];
    if (effectiveTransitionNodeType === "State") {
      childItems.push(...buildScopedGroupItems(placeId));
    }

    for (const childId of orderedStructuralChildren) {
      if (viewStateIds.has(childId)) {
        childItems.push(buildViewStateItem(childId));
        continue;
      }

      if (componentIds.has(childId)) {
        childItems.push({
          kind: "component",
          nodeId: childId,
          orderAnchorId: childId
        });
        childItems.push(...buildScopedGroupItems(childId));
      }
    }

    if (effectiveTransitionNodeType !== "State") {
      childItems.push(...buildScopedGroupItems(placeId));
    }

    return {
      kind: "place",
      id: placeId,
      labelLines: buildPlaceLabelLines(placeId, graphNodesById),
      anchorId: `${placeId}__anchor`,
      childItems,
      orderAnchorId: `${placeId}__anchor`
    };
  };

  const rootPlaceIds = projection.nodes
    .filter((node) => node.type === "Place" && !parentByNodeId.has(node.id))
    .map((node) => node.id);
  const rootViewStateIds = projection.nodes
    .filter((node) => node.type === "ViewState" && !parentByNodeId.has(node.id))
    .map((node) => node.id);
  const rootComponentIds = projection.nodes
    .filter((node) => node.type === "Component" && !parentByNodeId.has(node.id))
    .map((node) => node.id);
  const rootItemsByAnchorId = new Map<string, UiContractsRootItem[]>();

  for (const placeId of rootPlaceIds) {
    const item = buildPlaceItem(placeId);
    rootItemsByAnchorId.set(placeId, [item]);
  }
  for (const viewStateId of rootViewStateIds) {
    const item = buildViewStateItem(viewStateId);
    rootItemsByAnchorId.set(viewStateId, [item]);
  }
  for (const componentId of rootComponentIds) {
    rootItemsByAnchorId.set(componentId, [
      {
        kind: "component",
        nodeId: componentId,
        orderAnchorId: componentId
      },
      ...buildScopedGroupItems(componentId)
    ]);
  }

  const orderedRootNodeIds = orderNodeIds(graph, [...rootItemsByAnchorId.keys()]);
  const rootItems: UiContractsRootItem[] = orderedRootNodeIds.flatMap(
    (nodeId) => rootItemsByAnchorId.get(nodeId) ?? []
  );

  const groupedStateScopeIds = new Set(stateGroupsByScopeId.keys());
  const renderedStateScopeIds = new Set<string>();
  for (const rootItem of rootItems) {
    if (rootItem.kind === "place") {
      renderedStateScopeIds.add(rootItem.id);
      for (const childItem of rootItem.childItems) {
        if (childItem.kind === "component") {
          renderedStateScopeIds.add(childItem.nodeId);
        }
        if (childItem.kind === "view_state") {
          for (const nestedItem of childItem.childItems) {
            if (nestedItem.kind === "component") {
              renderedStateScopeIds.add(nestedItem.nodeId);
            }
          }
        }
      }
    }
    if (rootItem.kind === "component") {
      renderedStateScopeIds.add(rootItem.nodeId);
    }
  }

  for (const scopeId of [...groupedStateScopeIds].sort((left, right) => left.localeCompare(right))) {
    if (renderedStateScopeIds.has(scopeId)) {
      continue;
    }
    rootItems.push(...buildScopedGroupItems(scopeId));
  }

  const externalNodeIds = orderNodeIds(
    graph,
    projection.nodes
      .filter((node) => node.type === "Event" || node.type === "DataEntity" || node.type === "SystemAction")
      .map((node) => node.id)
  );
  const supportingLane =
    showSupportingContractLane && externalNodeIds.length > 0
      ? {
          headerId: "supporting_contracts__header",
          label: "Supporting Contracts",
          nodeIds: externalNodeIds
        }
      : undefined;
  const hiddenNodeIds = new Set<string>();
  if (!showSecondaryStateGroups) {
    for (const group of secondaryStateGroups) {
      for (const nodeId of group.node_ids) {
        hiddenNodeIds.add(nodeId);
      }
    }
  }
  if (!showSupportingContractLane) {
    for (const nodeId of externalNodeIds) {
      hiddenNodeIds.add(nodeId);
    }
  }

  const nodes = projection.nodes
    .filter(
      (node): node is typeof node & { type: UiContractsNodeType } =>
        node.type !== "Place" && !hiddenNodeIds.has(node.id) && (node.type !== "State" || visibleStateNodeIds.has(node.id))
    )
    .map<UiContractsRenderNode>((node) => {
      const graphNode = graphNodesById.get(node.id);
      const display = nodeDisplay(node.type, effectiveTransitionNodeType);
      const labelLines = [node.name];
      if (displayOptions.includeViewStateDataRequired && node.type === "ViewState" && graphNode?.props.data_required) {
        labelLines.push(`data: ${graphNode.props.data_required}`);
      }
      return {
        id: node.id,
        shape: display.shape,
        style: display.style,
        labelLines
      };
    });
  const renderedNodeIds = new Set(nodes.map((node) => node.id));
  const isRenderedEndpoint = (nodeId: string): boolean => placeIds.has(nodeId) || renderedNodeIds.has(nodeId);

  const edges = projection.edges
    .filter(
      (edge) =>
        edge.type !== "COMPOSED_OF" &&
        edge.type !== "CONTAINS" &&
        isRenderedEndpoint(edge.from) &&
        isRenderedEndpoint(edge.to)
    )
    .map<UiContractsRenderEdge>((edge) => {
      const sourceEdge = graph.edges.find(
        (candidate) => candidate.from === edge.from && candidate.type === edge.type && candidate.to === edge.to
      );
      if (edge.type === "TRANSITIONS_TO") {
        return {
          from: edge.from,
          to: edge.to,
          ...transitionEdgeDisplay(sourceEdge ?? { ...edge, event: null, guard: null, effect: null, from: edge.from }, graphNodesById, effectiveTransitionNodeType)
        };
      }

      return {
        from: edge.from,
        to: edge.to,
        ...contractEdgeDisplay(sourceEdge ?? { type: edge.type, props: {} })
      };
    });

  return {
    rootItems,
    nodes,
    edges,
    siblingOrderChains: collectSiblingOrderChains(rootItems, supportingLane),
    supportingLane
  };
}
