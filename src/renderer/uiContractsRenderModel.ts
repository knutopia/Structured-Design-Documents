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

export interface UiContractsLeafNodeItem {
  kind: "node";
  nodeId: string;
  orderAnchorId: string;
}

export interface UiContractsComponentItem {
  kind: "component";
  id: string;
  nodeId: string;
  anchorId: string;
  labelLines?: string[];
  childItems: Array<UiContractsStateGroupItem | UiContractsLeafNodeItem>;
  orderAnchorId: string;
  style?: string;
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
  anchorId: string;
  labelLines?: string[];
  childItems: Array<UiContractsComponentItem | UiContractsLeafNodeItem>;
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

export interface UiContractsSupportingGroupItem {
  kind: "support_group";
  id: string;
  labelLines: string[];
  nodeIds: string[];
  orderAnchorId: string;
  style?: string;
}

export type UiContractsRootItem =
  | UiContractsPlaceItem
  | UiContractsViewStateItem
  | UiContractsComponentItem
  | UiContractsStateGroupItem
  | UiContractsSupportingGroupItem;

export interface UiContractsRenderModel {
  rootItems: UiContractsRootItem[];
  nodes: UiContractsRenderNode[];
  edges: UiContractsRenderEdge[];
  siblingOrderChains: string[][];
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

function formatTransitionLabel(
  edge: Pick<CompiledEdge, "event" | "guard" | "effect">,
  graphNodesById: Map<string, { type: string; name: string }>
): string | undefined {
  const parts: string[] = [];
  if (edge.event) {
    const eventNode = graphNodesById.get(edge.event);
    const eventLabel = eventNode?.type === "Event" ? eventNode.name : edge.event;
    parts.push(`[${eventLabel}]`);
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
  graphNodesById: Map<string, { type: string; name: string }>,
  effectiveTransitionNodeType: RenderedTransitionType
): Omit<UiContractsRenderEdge, "from" | "to"> {
  const fromType = graphNodesById.get(edge.from)?.type;
  const label = formatTransitionLabel(edge, graphNodesById);

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

function contractEdgeDisplay(
  edge: Pick<CompiledEdge, "type" | "props">,
  constraint = false
): Omit<UiContractsRenderEdge, "from" | "to"> {
  switch (edge.type) {
    case "EMITS":
      return {
        label: "emits",
        style: "dashed",
        constraint
      };
    case "DEPENDS_ON":
      return {
        label: "depends on",
        constraint
      };
    case "BINDS_TO":
      return {
        label: edge.props.field ? `binds field ${edge.props.field}` : "binds to",
        style: "dotted",
        constraint
      };
    default:
      return {
        label: edge.type.toLowerCase().replace(/_/g, " "),
        constraint
      };
  }
}

function buildPlaceLabelLines(
  placeId: string,
  graphNodesById: Map<string, { name: string; props: Record<string, string> }>,
  displayPolicy: ResolvedProfileDisplayPolicy
): string[] {
  const place = graphNodesById.get(placeId);
  if (!place) {
    return [placeId];
  }

  return buildIaStylePlaceLabelLines({
    name: place.name,
    subtitle: place.props.route_or_key,
    badge: place.props.access
  }, {
    displayPolicy
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

function buildComponentContainerLabelLines(
  componentId: string,
  graphNodesById: Map<string, { name: string }>
): string[] {
  return [`Component: ${graphNodesById.get(componentId)?.name ?? componentId}`];
}

function buildViewStateContainerLabelLines(
  viewStateId: string,
  graphNodesById: Map<string, { name: string; props: Record<string, string> }>,
  includeViewStateDataRequired: boolean
): string[] {
  const viewState = graphNodesById.get(viewStateId);
  if (!viewState) {
    return [`ViewState: ${viewStateId}`];
  }

  const labelLines = [`ViewState: ${viewState.name}`];
  if (includeViewStateDataRequired && viewState.props.data_required) {
    labelLines.push(`data: ${viewState.props.data_required}`);
  }
  return labelLines;
}

function collectSiblingOrderChains(rootItems: UiContractsRootItem[]): string[][] {
  const chains: string[][] = [];

  const pushChain = (...nodeIds: string[]): void => {
    const filtered = nodeIds.filter((nodeId) => nodeId.length > 0);
    if (filtered.length < 2) {
      return;
    }

    const deduped: string[] = [];
    for (const nodeId of filtered) {
      if (deduped.at(-1) !== nodeId) {
        deduped.push(nodeId);
      }
    }

    if (deduped.length > 1) {
      chains.push(deduped);
    }
  };

  const collectChildBoundaryChains = (
    parentAnchorId: string,
    items: Array<UiContractsViewStateItem | UiContractsComponentItem | UiContractsStateGroupItem | UiContractsLeafNodeItem>
  ): void => {
    let previousAnchorId = parentAnchorId;
    let index = 0;

    while (index < items.length) {
      const item = items[index];
      if (item.kind === "node") {
        const runStartAnchorId = item.orderAnchorId;
        let runEndAnchorId = runStartAnchorId;
        index += 1;

        while (index < items.length && items[index]?.kind === "node") {
          runEndAnchorId = items[index]!.orderAnchorId;
          index += 1;
        }

        pushChain(previousAnchorId, runStartAnchorId);
        previousAnchorId = runEndAnchorId;
        continue;
      }

      pushChain(previousAnchorId, item.orderAnchorId);
      previousAnchorId = item.orderAnchorId;
      index += 1;
    }
  };

  const collectNestedChains = (
    items: Array<UiContractsViewStateItem | UiContractsComponentItem | UiContractsStateGroupItem | UiContractsLeafNodeItem>
  ): void => {
    for (const item of items) {
      if (item.kind === "view_state" || item.kind === "component") {
        collectChildBoundaryChains(item.orderAnchorId, item.childItems);
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
      collectChildBoundaryChains(item.anchorId, item.childItems);
      collectNestedChains(item.childItems);
      continue;
    }

    if (item.kind === "view_state" || item.kind === "component") {
      collectChildBoundaryChains(item.orderAnchorId, item.childItems);
      collectNestedChains(item.childItems);
      continue;
    }

    if ((item.kind === "state_group" || item.kind === "support_group") && item.nodeIds.length > 1) {
      chains.push(item.nodeIds);
    }
  }

  const rootAnchors = rootItems.map((item) => item.orderAnchorId);
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
  const showSupportingContracts =
    effectiveTransitionNodeType === "State" || displayOptions.showSupportingContractLaneWhenPrimaryViewState;

  const viewStateIds = new Set(
    projection.nodes.filter((node) => node.type === "ViewState").map((node) => node.id)
  );
  const componentIds = new Set(
    projection.nodes.filter((node) => node.type === "Component").map((node) => node.id)
  );
  const placeIds = new Set(projection.nodes.filter((node) => node.type === "Place").map((node) => node.id));
  const supportNodeIds = new Set(
    projection.nodes
      .filter((node) => node.type === "Event" || node.type === "DataEntity" || node.type === "SystemAction")
      .map((node) => node.id)
  );

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

  const structuralSupportOwnersByTargetId = new Map<string, Set<string>>();
  const addStructuralSupportOwner = (targetId: string, ownerId: string): void => {
    const owners = structuralSupportOwnersByTargetId.get(targetId) ?? new Set<string>();
    owners.add(ownerId);
    structuralSupportOwnersByTargetId.set(targetId, owners);
  };

  for (const edge of projection.edges) {
    if (!supportNodeIds.has(edge.to)) {
      continue;
    }

    if (edge.type === "BINDS_TO" && componentIds.has(edge.from)) {
      addStructuralSupportOwner(edge.to, edge.from);
      continue;
    }

    if (edge.type === "DEPENDS_ON" && (componentIds.has(edge.from) || viewStateIds.has(edge.from))) {
      addStructuralSupportOwner(edge.to, edge.from);
      continue;
    }

    if (edge.type === "EMITS" && (componentIds.has(edge.from) || viewStateIds.has(edge.from))) {
      addStructuralSupportOwner(edge.to, edge.from);
    }
  }

  const ownedSupportNodeIdsByOwnerId = new Map<string, string[]>();
  const sharedSupportNodeIds: string[] = [];
  for (const nodeId of orderNodeIds(graph, supportNodeIds)) {
    const owners = [...(structuralSupportOwnersByTargetId.get(nodeId) ?? new Set<string>())];
    if (owners.length === 1) {
      const ownedNodeIds = ownedSupportNodeIdsByOwnerId.get(owners[0]) ?? [];
      ownedNodeIds.push(nodeId);
      ownedSupportNodeIdsByOwnerId.set(owners[0], ownedNodeIds);
      continue;
    }

    sharedSupportNodeIds.push(nodeId);
  }

  const buildOwnedSupportItems = (ownerId: string): UiContractsLeafNodeItem[] =>
    showSupportingContracts
      ? (ownedSupportNodeIdsByOwnerId.get(ownerId) ?? []).map((nodeId) => ({
          kind: "node",
          nodeId,
          orderAnchorId: nodeId
        }))
      : [];

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

  const buildComponentItem = (componentId: string): UiContractsComponentItem => {
    const childItems = [
      ...buildOwnedSupportItems(componentId),
      ...buildScopedGroupItems(componentId)
    ];

    const isContainer = childItems.length > 0;
    return {
      kind: "component",
      id: componentId,
      nodeId: componentId,
      anchorId: isContainer ? `${componentId}__anchor` : componentId,
      labelLines: isContainer ? buildComponentContainerLabelLines(componentId, graphNodesById) : undefined,
      childItems,
      orderAnchorId: isContainer ? `${componentId}__anchor` : componentId,
      style: "rounded"
    };
  };

  const buildComponentItems = (parentId: string): UiContractsComponentItem[] => {
    const orderedComponentIds = getSourceOrderedStructuralStream(
      graph,
      parentId,
      ["COMPOSED_OF"],
      childComponentsByParentId.get(parentId) ?? []
    ).map((edge) => edge.to);

    return orderedComponentIds.map((componentId) => buildComponentItem(componentId));
  };

  const buildViewStateItem = (viewStateId: string): UiContractsViewStateItem => {
    const childItems = [
      ...buildComponentItems(viewStateId),
      ...buildOwnedSupportItems(viewStateId)
    ];
    const isContainer = childItems.length > 0;

    return {
      kind: "view_state",
      id: viewStateId,
      nodeId: viewStateId,
      anchorId: isContainer ? `${viewStateId}__anchor` : viewStateId,
      labelLines: isContainer
        ? buildViewStateContainerLabelLines(viewStateId, graphNodesById, displayOptions.includeViewStateDataRequired)
        : undefined,
      childItems,
      orderAnchorId: isContainer ? `${viewStateId}__anchor` : viewStateId,
      style: "rounded,dashed"
    };
  };

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
        childItems.push(buildComponentItem(childId));
      }
    }

    if (effectiveTransitionNodeType !== "State") {
      childItems.push(...buildScopedGroupItems(placeId));
    }

    return {
      kind: "place",
      id: placeId,
      labelLines: buildPlaceLabelLines(placeId, graphNodesById, displayPolicy),
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
    rootItemsByAnchorId.set(componentId, [buildComponentItem(componentId)]);
  }

  const orderedRootNodeIds = orderNodeIds(graph, [...rootItemsByAnchorId.keys()]);
  const rootItems: UiContractsRootItem[] = orderedRootNodeIds.flatMap(
    (nodeId) => rootItemsByAnchorId.get(nodeId) ?? []
  );

  const groupedStateScopeIds = new Set(stateGroupsByScopeId.keys());
  const renderedStateScopeIds = new Set<string>();
  const collectRenderedStateScopes = (
    items: Array<UiContractsRootItem | UiContractsViewStateItem | UiContractsComponentItem | UiContractsStateGroupItem | UiContractsLeafNodeItem>
  ): void => {
    for (const item of items) {
      if (item.kind === "place") {
        renderedStateScopeIds.add(item.id);
        collectRenderedStateScopes(item.childItems);
        continue;
      }

      if (item.kind === "view_state") {
        collectRenderedStateScopes(item.childItems);
        continue;
      }

      if (item.kind === "component") {
        renderedStateScopeIds.add(item.nodeId);
        collectRenderedStateScopes(item.childItems);
      }
    }
  };
  collectRenderedStateScopes(rootItems);

  for (const scopeId of [...groupedStateScopeIds].sort((left, right) => left.localeCompare(right))) {
    if (renderedStateScopeIds.has(scopeId)) {
      continue;
    }
    rootItems.push(...buildScopedGroupItems(scopeId));
  }
  if (showSupportingContracts && sharedSupportNodeIds.length > 0) {
    rootItems.push({
      kind: "support_group",
      id: "shared_supporting_contracts",
      labelLines: ["Shared Supporting Contracts"],
      nodeIds: [...sharedSupportNodeIds],
      orderAnchorId: sharedSupportNodeIds[0],
      style: "rounded"
    });
  }
  const hiddenNodeIds = new Set<string>();
  if (!showSecondaryStateGroups) {
    for (const group of secondaryStateGroups) {
      for (const nodeId of group.node_ids) {
        hiddenNodeIds.add(nodeId);
      }
    }
  }
  if (!showSupportingContracts) {
    for (const nodeId of supportNodeIds) {
      hiddenNodeIds.add(nodeId);
    }
  }

  const containerAnchorByNodeId = new Map<string, string>();
  const collectContainerAnchors = (
    items: Array<UiContractsRootItem | UiContractsViewStateItem | UiContractsComponentItem | UiContractsStateGroupItem | UiContractsLeafNodeItem>
  ): void => {
    for (const item of items) {
      if (item.kind === "place" || item.kind === "state_group" || item.kind === "support_group" || item.kind === "node") {
        if (item.kind === "place") {
          collectContainerAnchors(item.childItems);
        }
        continue;
      }

      if (item.childItems.length > 0) {
        containerAnchorByNodeId.set(item.nodeId, item.anchorId);
        hiddenNodeIds.add(item.nodeId);
      }
      collectContainerAnchors(item.childItems);
    }
  };
  collectContainerAnchors(rootItems);

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
  const isRenderedEndpoint = (nodeId: string): boolean =>
    placeIds.has(nodeId) || renderedNodeIds.has(nodeId) || containerAnchorByNodeId.has(nodeId);
  const resolveRenderedEndpointId = (nodeId: string): string => containerAnchorByNodeId.get(nodeId) ?? nodeId;
  const localSupportEdgeKeys = new Set(
    [...ownedSupportNodeIdsByOwnerId.entries()].flatMap(([ownerId, nodeIds]) =>
      nodeIds.map((nodeId) => `${ownerId}->${nodeId}`)
    )
  );

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
          from: resolveRenderedEndpointId(edge.from),
          to: resolveRenderedEndpointId(edge.to),
          ...transitionEdgeDisplay(sourceEdge ?? { ...edge, event: null, guard: null, effect: null, from: edge.from }, graphNodesById, effectiveTransitionNodeType)
        };
      }

      return {
        from: resolveRenderedEndpointId(edge.from),
        to: resolveRenderedEndpointId(edge.to),
        ...contractEdgeDisplay(
          sourceEdge ?? { type: edge.type, props: {} },
          localSupportEdgeKeys.has(`${edge.from}->${edge.to}`)
        )
      };
    });

  return {
    rootItems,
    nodes,
    edges,
    siblingOrderChains: collectSiblingOrderChains(rootItems)
  };
}
