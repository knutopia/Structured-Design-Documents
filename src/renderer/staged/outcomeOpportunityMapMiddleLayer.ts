import type {
  OutcomeOpportunityMapRenderModel,
  OutcomeOpportunityRenderEdge,
  OutcomeOpportunityRenderNode
} from "../outcomeOpportunityMapRenderModel.js";
import {
  createSceneDiagnostic,
  sortRendererDiagnostics,
  type RendererDiagnostic
} from "./diagnostics.js";

export type OutcomeOpportunityBandKind = "outcome" | "parking";
export type OutcomeOpportunitySlotKind = "primary" | "stack" | "parking";
export type OutcomeOpportunityPlacementRole =
  | "anchor_outcome"
  | "supporting_opportunity"
  | "addressing_initiative"
  | "measuring_metric"
  | "parking";
export type OutcomeOpportunityEdgeChannel =
  | "opportunity_support"
  | "initiative_addressing"
  | "outcome_measurement"
  | "implementation_reference"
  | "instrumentation_reference"
  | string;

export interface OutcomeOpportunityColumn {
  id: string;
  label: string;
  order: number;
}

export interface OutcomeOpportunityBand {
  id: string;
  label: string;
  kind: OutcomeOpportunityBandKind;
  bandOrder: number;
  anchorOutcomeId?: string;
}

export interface OutcomeOpportunityPhysicalSlot {
  id: string;
  bandId: string;
  bandOrder: number;
  rowOrder: number;
  slotOrderWithinBand: number;
  kind: OutcomeOpportunitySlotKind;
}

export interface OutcomeOpportunityCell {
  id: string;
  columnId: string;
  bandId: string;
  physicalSlotId: string;
  bandKind: OutcomeOpportunityBandKind;
  bandOrder: number;
  rowOrder: number;
  columnOrder: number;
  slotOrderWithinBand: number;
  slotKind: OutcomeOpportunitySlotKind;
  anchorOutcomeId?: string;
  nodeIds: string[];
  sharedWidthGroup: string;
  sharedHeightGroup: string;
}

export interface OutcomeOpportunityNodePlacement {
  nodeId: string;
  nodeType: string;
  semanticColumnId: string;
  semanticBandId: string;
  anchorOutcomeId?: string;
  physicalSlotId: string;
  cellId: string;
  placementRole: OutcomeOpportunityPlacementRole;
  sourceAuthorOrder: number;
  bandOrder: number;
  rowOrder: number;
  columnOrder: number;
  slotOrderWithinBand: number;
  parking: boolean;
}

export interface OutcomeOpportunityMiddleEdge {
  id: string;
  semanticEdgeIds: string[];
  channel: OutcomeOpportunityEdgeChannel;
  type: string;
  from: string;
  to: string;
  label?: string;
  authorOrder: number;
}

export interface OutcomeOpportunityConnectorPlan {
  id: string;
  edgeId: string;
  channel: OutcomeOpportunityEdgeChannel;
  fromPlacementId?: string;
  toPlacementId?: string;
  priority: number;
  sourceSemanticBandOrder: number;
  sourcePhysicalSlotOrder: number;
  sourceColumnOrder: number;
  sourceAuthorOrder: number;
  outgoingOrder: number;
  targetStableId: string;
}

export interface OutcomeOpportunityMiddleLayerModel {
  columns: OutcomeOpportunityColumn[];
  bands: OutcomeOpportunityBand[];
  physicalSlots: OutcomeOpportunityPhysicalSlot[];
  cells: OutcomeOpportunityCell[];
  placements: OutcomeOpportunityNodePlacement[];
  edges: OutcomeOpportunityMiddleEdge[];
  connectorPlans: OutcomeOpportunityConnectorPlan[];
  diagnostics: RendererDiagnostic[];
}

interface PlacementTarget {
  node: OutcomeOpportunityRenderNode;
  columnId: string;
  bandId: string;
  anchorOutcomeId?: string;
  placementRole: OutcomeOpportunityPlacementRole;
  parking: boolean;
}

function compareNodeOrder(
  left: Pick<OutcomeOpportunityRenderNode, "authorOrder" | "id">,
  right: Pick<OutcomeOpportunityRenderNode, "authorOrder" | "id">
): number {
  return left.authorOrder - right.authorOrder || left.id.localeCompare(right.id);
}

function compareEdgeOrder(
  left: Pick<OutcomeOpportunityRenderEdge, "authorOrder" | "to" | "id">,
  right: Pick<OutcomeOpportunityRenderEdge, "authorOrder" | "to" | "id">
): number {
  return left.authorOrder - right.authorOrder || left.to.localeCompare(right.to) || left.id.localeCompare(right.id);
}

function createNodeMap(nodes: readonly OutcomeOpportunityRenderNode[]): Map<string, OutcomeOpportunityRenderNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function buildColumnOrderById(columns: readonly OutcomeOpportunityColumn[]): Map<string, number> {
  return new Map(columns.map((column) => [column.id, column.order]));
}

function buildOutcomeBands(outcomes: readonly OutcomeOpportunityRenderNode[]): OutcomeOpportunityBand[] {
  return [...outcomes]
    .sort(compareNodeOrder)
    .map((outcome, index) => ({
      id: `band:outcome:${index + 1}`,
      label: `B${index + 1}`,
      kind: "outcome",
      bandOrder: index,
      anchorOutcomeId: outcome.id
    }));
}

function firstAnchoredTarget(
  edges: readonly OutcomeOpportunityRenderEdge[],
  sourceId: string,
  edgeType: string,
  anchorByTargetId: ReadonlyMap<string, string>
): string | undefined {
  return [...edges]
    .filter((edge) => edge.from === sourceId && edge.type === edgeType)
    .sort(compareEdgeOrder)
    .map((edge) => anchorByTargetId.get(edge.to))
    .find((anchorOutcomeId): anchorOutcomeId is string => !!anchorOutcomeId);
}

function firstMeasuredOutcome(
  edges: readonly OutcomeOpportunityRenderEdge[],
  metricId: string,
  outcomeBandByOutcomeId: ReadonlyMap<string, string>
): string | undefined {
  return [...edges]
    .filter((edge) => edge.to === metricId && edge.type === "MEASURED_BY")
    .sort((left, right) =>
      left.authorOrder - right.authorOrder || left.from.localeCompare(right.from) || left.id.localeCompare(right.id)
    )
    .map((edge) => outcomeBandByOutcomeId.has(edge.from) ? edge.from : undefined)
    .find((anchorOutcomeId): anchorOutcomeId is string => !!anchorOutcomeId);
}

function createParkingBand(node: OutcomeOpportunityRenderNode, bandOrder: number, parkingIndex: number): OutcomeOpportunityBand {
  return {
    id: `band:parking:${parkingIndex + 1}:${node.id}`,
    label: `P${parkingIndex + 1}`,
    kind: "parking",
    bandOrder
  };
}

function resolvePlacementTargets(
  model: OutcomeOpportunityMapRenderModel,
  nodeMap: ReadonlyMap<string, OutcomeOpportunityRenderNode>,
  outcomeBands: readonly OutcomeOpportunityBand[],
  diagnostics: RendererDiagnostic[]
): {
  targets: PlacementTarget[];
  parkingBands: OutcomeOpportunityBand[];
} {
  const outcomeBandByOutcomeId = new Map(
    outcomeBands.flatMap((band) => band.anchorOutcomeId ? [[band.anchorOutcomeId, band.id] as const] : [])
  );
  const anchorOutcomeByOutcomeId = new Map(
    outcomeBands.flatMap((band) => band.anchorOutcomeId ? [[band.anchorOutcomeId, band.anchorOutcomeId] as const] : [])
  );
  const anchorOutcomeByOpportunityId = new Map<string, string>();
  const anchorOutcomeByNodeId = new Map<string, string>();
  const targets: PlacementTarget[] = [];
  const parkingSeeds: OutcomeOpportunityRenderNode[] = [];

  for (const outcome of [...model.nodes].filter((node) => node.type === "Outcome").sort(compareNodeOrder)) {
    const bandId = outcomeBandByOutcomeId.get(outcome.id);
    if (!bandId) {
      continue;
    }
    anchorOutcomeByNodeId.set(outcome.id, outcome.id);
    targets.push({
      node: outcome,
      columnId: outcome.laneId,
      bandId,
      anchorOutcomeId: outcome.id,
      placementRole: "anchor_outcome",
      parking: false
    });
  }

  for (const opportunity of [...model.nodes].filter((node) => node.type === "Opportunity").sort(compareNodeOrder)) {
    const anchorOutcomeId = firstAnchoredTarget(model.edges, opportunity.id, "SUPPORTS", anchorOutcomeByOutcomeId);
    if (!anchorOutcomeId) {
      parkingSeeds.push(opportunity);
      continue;
    }
    const bandId = outcomeBandByOutcomeId.get(anchorOutcomeId)!;
    anchorOutcomeByOpportunityId.set(opportunity.id, anchorOutcomeId);
    anchorOutcomeByNodeId.set(opportunity.id, anchorOutcomeId);
    targets.push({
      node: opportunity,
      columnId: opportunity.laneId,
      bandId,
      anchorOutcomeId,
      placementRole: "supporting_opportunity",
      parking: false
    });
  }

  for (const initiative of [...model.nodes].filter((node) => node.type === "Initiative").sort(compareNodeOrder)) {
    const anchorOutcomeId = firstAnchoredTarget(model.edges, initiative.id, "ADDRESSES", anchorOutcomeByOpportunityId);
    if (!anchorOutcomeId) {
      parkingSeeds.push(initiative);
      continue;
    }
    const bandId = outcomeBandByOutcomeId.get(anchorOutcomeId)!;
    anchorOutcomeByNodeId.set(initiative.id, anchorOutcomeId);
    targets.push({
      node: initiative,
      columnId: initiative.laneId,
      bandId,
      anchorOutcomeId,
      placementRole: "addressing_initiative",
      parking: false
    });
  }

  for (const metric of [...model.nodes].filter((node) => node.type === "Metric").sort(compareNodeOrder)) {
    const anchorOutcomeId = firstMeasuredOutcome(model.edges, metric.id, outcomeBandByOutcomeId);
    if (!anchorOutcomeId) {
      parkingSeeds.push(metric);
      continue;
    }
    const bandId = outcomeBandByOutcomeId.get(anchorOutcomeId)!;
    anchorOutcomeByNodeId.set(metric.id, anchorOutcomeId);
    targets.push({
      node: metric,
      columnId: metric.laneId,
      bandId,
      anchorOutcomeId,
      placementRole: "measuring_metric",
      parking: false
    });
  }

  const parkingBands = parkingSeeds.sort(compareNodeOrder).map((node, index) => {
    diagnostics.push(
      createSceneDiagnostic(
        "renderer.scene.outcome_opportunity_map_parking_node",
        `Node "${node.id}" has no anchoring path to an Outcome. Placing it in a deterministic parking band.`,
        {
          targetId: node.id,
          severity: "info"
        }
      )
    );
    return createParkingBand(node, outcomeBands.length + index, index);
  });
  const parkingBandByNodeId = new Map(parkingSeeds.map((node, index) => [node.id, parkingBands[index]] as const));

  for (const node of parkingSeeds) {
    const band = parkingBandByNodeId.get(node.id);
    if (!band) {
      continue;
    }
    targets.push({
      node,
      columnId: node.laneId,
      bandId: band.id,
      placementRole: "parking",
      parking: true
    });
  }

  const placedNodeIds = new Set(targets.map((target) => target.node.id));
  for (const node of model.nodes) {
    if (!placedNodeIds.has(node.id) && nodeMap.has(node.id)) {
      diagnostics.push(
        createSceneDiagnostic(
          "renderer.scene.outcome_opportunity_map_unplaced_node",
          `Node "${node.id}" could not be placed by the outcome-opportunity middle layer.`,
          {
            targetId: node.id
          }
        )
      );
    }
  }

  return {
    targets,
    parkingBands
  };
}

function buildSlotsCellsAndPlacements(
  columns: readonly OutcomeOpportunityColumn[],
  bands: readonly OutcomeOpportunityBand[],
  targets: readonly PlacementTarget[]
): {
  physicalSlots: OutcomeOpportunityPhysicalSlot[];
  cells: OutcomeOpportunityCell[];
  placements: OutcomeOpportunityNodePlacement[];
} {
  const columnOrderById = buildColumnOrderById(columns);
  const bandById = new Map(bands.map((band) => [band.id, band]));
  const targetsByBandAndColumn = new Map<string, PlacementTarget[]>();
  const sortedTargets = [...targets].sort((left, right) =>
    (bandById.get(left.bandId)?.bandOrder ?? 0) - (bandById.get(right.bandId)?.bandOrder ?? 0)
    || (columnOrderById.get(left.columnId) ?? Number.MAX_SAFE_INTEGER) -
      (columnOrderById.get(right.columnId) ?? Number.MAX_SAFE_INTEGER)
    || compareNodeOrder(left.node, right.node)
  );

  for (const target of sortedTargets) {
    const key = `${target.bandId}::${target.columnId}`;
    const group = targetsByBandAndColumn.get(key) ?? [];
    group.push(target);
    targetsByBandAndColumn.set(key, group);
  }

  const physicalSlots: OutcomeOpportunityPhysicalSlot[] = [];
  const cells: OutcomeOpportunityCell[] = [];
  const placements: OutcomeOpportunityNodePlacement[] = [];
  let nextRowOrder = 0;

  for (const band of [...bands].sort((left, right) => left.bandOrder - right.bandOrder || left.id.localeCompare(right.id))) {
    const maxSlotCount = Math.max(
      1,
      ...columns.map((column) => targetsByBandAndColumn.get(`${band.id}::${column.id}`)?.length ?? 0)
    );
    const bandSlots = Array.from({ length: maxSlotCount }, (_, slotOrderWithinBand) => {
      const slot: OutcomeOpportunityPhysicalSlot = {
        id: `${band.id}__slot:${slotOrderWithinBand}`,
        bandId: band.id,
        bandOrder: band.bandOrder,
        rowOrder: nextRowOrder + slotOrderWithinBand,
        slotOrderWithinBand,
        kind: band.kind === "parking"
          ? "parking"
          : slotOrderWithinBand === 0
            ? "primary"
            : "stack"
      };
      physicalSlots.push(slot);
      return slot;
    });

    for (const slot of bandSlots) {
      for (const column of columns) {
        const group = targetsByBandAndColumn.get(`${band.id}::${column.id}`) ?? [];
        const target = group[slot.slotOrderWithinBand];
        const cellId = `${column.id}__cell__${band.id}__slot:${slot.slotOrderWithinBand}`;
        cells.push({
          id: cellId,
          columnId: column.id,
          bandId: band.id,
          physicalSlotId: slot.id,
          bandKind: band.kind,
          bandOrder: band.bandOrder,
          rowOrder: slot.rowOrder,
          columnOrder: column.order,
          slotOrderWithinBand: slot.slotOrderWithinBand,
          slotKind: slot.kind,
          anchorOutcomeId: band.anchorOutcomeId,
          nodeIds: target ? [target.node.id] : [],
          sharedWidthGroup: `outcome_opportunity_map:column:${column.id}`,
          sharedHeightGroup: `outcome_opportunity_map:row:${slot.rowOrder}`
        });

        if (target) {
          placements.push({
            nodeId: target.node.id,
            nodeType: target.node.type,
            semanticColumnId: target.columnId,
            semanticBandId: target.bandId,
            anchorOutcomeId: target.anchorOutcomeId,
            physicalSlotId: slot.id,
            cellId,
            placementRole: target.placementRole,
            sourceAuthorOrder: target.node.authorOrder,
            bandOrder: band.bandOrder,
            rowOrder: slot.rowOrder,
            columnOrder: column.order,
            slotOrderWithinBand: slot.slotOrderWithinBand,
            parking: target.parking
          });
        }
      }
    }

    nextRowOrder += maxSlotCount;
  }

  return {
    physicalSlots,
    cells,
    placements
  };
}

function buildMiddleEdges(edges: readonly OutcomeOpportunityRenderEdge[]): OutcomeOpportunityMiddleEdge[] {
  return [...edges]
    .sort((left, right) => left.authorOrder - right.authorOrder || left.id.localeCompare(right.id))
    .map((edge) => ({
      id: edge.id,
      semanticEdgeIds: [edge.id],
      channel: edge.channel,
      type: edge.type,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      authorOrder: edge.authorOrder
    }));
}

function buildConnectorPlans(
  edges: readonly OutcomeOpportunityRenderEdge[],
  placements: readonly OutcomeOpportunityNodePlacement[]
): OutcomeOpportunityConnectorPlan[] {
  const placementByNodeId = new Map(placements.map((placement) => [placement.nodeId, placement] as const));
  const outgoingOrderByEdgeId = new Map<string, number>();
  const outgoingCountBySource = new Map<string, number>();

  for (const edge of [...edges].sort((left, right) => left.authorOrder - right.authorOrder || left.id.localeCompare(right.id))) {
    const outgoingOrder = outgoingCountBySource.get(edge.from) ?? 0;
    outgoingOrderByEdgeId.set(edge.id, outgoingOrder);
    outgoingCountBySource.set(edge.from, outgoingOrder + 1);
  }

  return [...edges]
    .sort((left, right) => {
      const leftSource = placementByNodeId.get(left.from);
      const rightSource = placementByNodeId.get(right.from);
      return left.priority - right.priority
        || (leftSource?.bandOrder ?? Number.MAX_SAFE_INTEGER) -
          (rightSource?.bandOrder ?? Number.MAX_SAFE_INTEGER)
        || (leftSource?.slotOrderWithinBand ?? Number.MAX_SAFE_INTEGER) -
          (rightSource?.slotOrderWithinBand ?? Number.MAX_SAFE_INTEGER)
        || (leftSource?.columnOrder ?? Number.MAX_SAFE_INTEGER) -
          (rightSource?.columnOrder ?? Number.MAX_SAFE_INTEGER)
        || (leftSource?.sourceAuthorOrder ?? Number.MAX_SAFE_INTEGER) -
          (rightSource?.sourceAuthorOrder ?? Number.MAX_SAFE_INTEGER)
        || (outgoingOrderByEdgeId.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (outgoingOrderByEdgeId.get(right.id) ?? Number.MAX_SAFE_INTEGER)
        || left.to.localeCompare(right.to)
        || left.id.localeCompare(right.id);
    })
    .map((edge, index) => {
      const source = placementByNodeId.get(edge.from);
      const target = placementByNodeId.get(edge.to);
      return {
        id: `connector:${index + 1}:${edge.id}`,
        edgeId: edge.id,
        channel: edge.channel,
        fromPlacementId: source?.cellId,
        toPlacementId: target?.cellId,
        priority: index,
        sourceSemanticBandOrder: source?.bandOrder ?? Number.MAX_SAFE_INTEGER,
        sourcePhysicalSlotOrder: source?.slotOrderWithinBand ?? Number.MAX_SAFE_INTEGER,
        sourceColumnOrder: source?.columnOrder ?? Number.MAX_SAFE_INTEGER,
        sourceAuthorOrder: source?.sourceAuthorOrder ?? Number.MAX_SAFE_INTEGER,
        outgoingOrder: outgoingOrderByEdgeId.get(edge.id) ?? Number.MAX_SAFE_INTEGER,
        targetStableId: edge.to
      };
    });
}

export function buildOutcomeOpportunityMapMiddleLayer(
  model: OutcomeOpportunityMapRenderModel
): OutcomeOpportunityMiddleLayerModel {
  const diagnostics: RendererDiagnostic[] = [];
  const nodeMap = createNodeMap(model.nodes);
  const columns = model.columns.map<OutcomeOpportunityColumn>((column) => ({
    id: column.id,
    label: column.label,
    order: column.order
  }));
  const outcomeBands = buildOutcomeBands(model.nodes.filter((node) => node.type === "Outcome"));
  const { targets, parkingBands } = resolvePlacementTargets(model, nodeMap, outcomeBands, diagnostics);
  const bands = [...outcomeBands, ...parkingBands].sort((left, right) =>
    left.bandOrder - right.bandOrder || left.id.localeCompare(right.id)
  );
  const { physicalSlots, cells, placements } = buildSlotsCellsAndPlacements(columns, bands, targets);

  return {
    columns,
    bands,
    physicalSlots,
    cells,
    placements,
    edges: buildMiddleEdges(model.edges),
    connectorPlans: buildConnectorPlans(model.edges, placements),
    diagnostics: sortRendererDiagnostics(diagnostics)
  };
}
