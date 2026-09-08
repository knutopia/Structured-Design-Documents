import type { UiContractsSequence, UiContractsVisualEdge } from "../uiContractsPresentationModel.js";
import type { SceneContainer, SceneEdge, SceneItem } from "./contracts.js";
import { buildCardinalPorts } from "./sceneBuilders.js";
import { UI_CONTRACTS_SPACING, uiContractsStack, type UiContractsSceneBuilder } from "./uiContractsPresentationScene.js";
import { DEFAULT_ROUTING_POLICY } from "./routingCore/contracts.js";

/** Identify semantic return relationships before layout; ordering is never based on coordinates. */
function returnEdges(sequence: UiContractsSequence): Set<string> {
  const active = new Set<string>(), visited = new Set<string>(), returns = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id); active.add(id);
    for (const edge of sequence.edges.filter(edge => edge.from === id)) {
      if (active.has(edge.to)) returns.add(edge.id);
      else visit(edge.to);
    }
    active.delete(id);
  };
  sequence.nodes.forEach(node => visit(node.id));
  return returns;
}

function withUpperReturn(builder: UiContractsSceneBuilder, sequence: UiContractsSequence, returns: Set<string>): SceneContainer {
  const returning = sequence.edges.filter(edge => returns.has(edge.id));
  const forward = { ...sequence, edges: sequence.edges.filter(edge => !returns.has(edge.id)) };
  const inner = builder.layeredSequence(forward);
  const frame = uiContractsStack(`${sequence.id}:return-region`, [inner]);
  const measured = builder.measure([inner])[0];
  if (measured.kind !== "container") throw new Error("Expected transition group");
  const sizes = new Map(measured.children.map(node => [node.id, node]));
  const labels = returning.map(edge => builder.labelMeasure({ text: edge.label ?? "", textStyleRole: "edge_label" }, edge.id));
  const topClearance = Math.max(0, ...labels.map(label => label.height)) + DEFAULT_ROUTING_POLICY.minTerminalLeg + UI_CONTRACTS_SPACING.padding;
  const approach = UI_CONTRACTS_SPACING.arrowApproach;
  frame.chrome.padding = { top: topClearance + approach, right: approach, bottom: 0, left: approach };
  frame.ports = [];
  for (const [index, semantic] of returning.entries()) {
    const edge = builder.edge(semantic), track = topClearance - index * DEFAULT_ROUTING_POLICY.minSeparation;
    const anchorOffset = (id: string, side: "east" | "west") => inner.children.find(node => node.id === id)!.ports.find(port => port.side === side)?.offset ?? sizes.get(id)!.height / 2;
    const sourceOffset = frame.chrome.padding.top + inner.chrome.padding.top + anchorOffset(semantic.from, "east");
    const targetOffset = frame.chrome.padding.top + inner.chrome.padding.top + anchorOffset(semantic.to, "west");
    const port = (name: string, side: "east" | "west", offset: number) => {
      const id = `${semantic.id}:${name}`;
      frame.ports.push({ id, role: "return_channel", side, offset });
      return { itemId: frame.id, portId: id };
    };
    const east = port("source", "east", sourceOffset), upperEast = port("upper-east", "east", track);
    const upperWest = port("upper-west", "west", track), west = port("target", "west", targetOffset);
    const points = [edge.from, east, upperEast, upperWest, west, edge.to];
    for (let segment = 0; segment < points.length - 1; segment++) builder.add({
      ...edge, id: `${edge.id}:return:${segment}`, from: points[segment], to: points[segment + 1],
      ownerContainerId: frame.id,
      label: segment === 2 ? edge.label : undefined,
      markers: segment === points.length - 2 ? { end: "arrow" } : {},
      routing: { style: "orthogonal", preferAxis: segment === 1 || segment === 3 ? "vertical" : "horizontal" }
    }, [semantic.relationshipId]);
  }
  return frame;
}

/** Branch bars are explicit scene segments, each painted once with full provenance. */
function branchRegion(builder: UiContractsSceneBuilder, sequence: UiContractsSequence): SceneContainer | undefined {
  const incoming = (id: string) => sequence.edges.filter(edge => edge.to === id);
  const outgoing = (id: string) => sequence.edges.filter(edge => edge.from === id);
  const sources = sequence.nodes.filter(node => !incoming(node.id).length);
  const sinks = sequence.nodes.filter(node => !outgoing(node.id).length);
  const isFork = sources.length === 1 && sinks.length === sequence.nodes.length - 1
    && sinks.every(node => incoming(node.id).length === 1 && incoming(node.id)[0].from === sources[0].id);
  const isMerge = sinks.length === 1 && sources.length === sequence.nodes.length - 1
    && sources.every(node => outgoing(node.id).length === 1 && outgoing(node.id)[0].to === sinks[0].id);
  const middle = sequence.nodes.filter(node => !sources.includes(node) && !sinks.includes(node));
  const isDiamond = sources.length === 1 && sinks.length === 1 && middle.length > 1
    && sequence.edges.length === middle.length * 2 && middle.every(node => incoming(node.id).length === 1 && outgoing(node.id).length === 1
      && incoming(node.id)[0].from === sources[0].id && outgoing(node.id)[0].to === sinks[0].id);
  if (sequence.nodes.length < 3 || !(isFork || isMerge || isDiamond)) return undefined;
  const hasFork = isFork || isDiamond, hasMerge = isMerge || isDiamond;
  const branches = isDiamond ? middle : isFork ? sinks : sources;
  const nodes = new Map(sequence.nodes.map(node => [node.id, builder.node(node)]));
  const sizes = new Map(builder.measure([...nodes.values()]).map(node => [node.id, node]));
  const labels = sequence.edges.map(edge => builder.labelMeasure({ text: edge.label ?? "", textStyleRole: "edge_label" }, edge.id));
  const gap = Math.max(0, ...labels.map(label => label.width)) + UI_CONTRACTS_SPACING.layerGap;
  const firstAnchor = Math.min(...[branches[0], ...(hasFork ? [sources[0]] : []), ...(hasMerge ? [sinks[0]] : [])].map(node => sizes.get(node.id)!.height)) / 2;
  const anchors = branches.map((node, index) => index === 0 ? firstAnchor : sizes.get(node.id)!.height / 2);
  const rowGap = Math.max(UI_CONTRACTS_SPACING.siblingGap, ...labels.map(label => label.height + 28 - Math.min(...anchors)));
  for (const node of sequence.nodes) {
    const index = branches.findIndex(branch => branch.id === node.id), offset = index >= 0 ? anchors[index] : firstAnchor;
    for (const port of nodes.get(node.id)!.ports) if (port.side === "east" || port.side === "west") port.offset = offset;
  }
  const branchColumn = uiContractsStack(`${sequence.id}:branch-nodes`, branches.map(node => nodes.get(node.id)!), "vertical", rowGap);
  const bar = (kind: "fork" | "merge") => {
    const junctions = branches.map((_, index) => {
      const point = uiContractsStack(`${sequence.id}:${kind}:${index}`, []);
      point.ports = buildCardinalPorts().map(port => ({ ...port, offset: 0 }));
      return point;
    });
    const cells = branches.map((node, index) => {
      const cell = uiContractsStack(`${junctions[index].id}:cell`, [junctions[index]]);
      cell.chrome.padding.top = anchors[index];
      cell.chrome.padding.bottom = sizes.get(node.id)!.height - anchors[index];
      return cell;
    });
    return { column: uiContractsStack(`${sequence.id}:${kind}:bar`, cells, "vertical", rowGap), junctions };
  };
  const columns: SceneItem[] = [];
  const append = (base: UiContractsVisualEdge, id: string, from: SceneEdge["from"], to: SceneEdge["to"], relations: UiContractsVisualEdge[], label: boolean, arrow: boolean, vertical = false) => builder.add({
    ...builder.edge(base), id, from, to, label: label && base.label ? { text: base.label, textStyleRole: "edge_label" } : undefined,
    markers: arrow ? { end: "arrow" } : {}, routing: { style: "orthogonal", preferAxis: vertical ? "vertical" : "horizontal" }
  }, relations.map(edge => edge.relationshipId));
  if (hasFork) {
    const source = nodes.get(sources[0].id)!, { column, junctions } = bar("fork"), edges = branches.map(node => incoming(node.id)[0]);
    columns.push(source, column);
    append(edges[0], `${sequence.id}:fork:stem`, { itemId: source.id, portId: "east" }, { itemId: junctions[0].id, portId: "west" }, edges, false, false);
    branches.forEach((node, index) => {
      append(edges[index], edges[index].id, { itemId: junctions[index].id, portId: "east" }, { itemId: node.id, portId: "west" }, [edges[index]], true, true);
      if (index) append(edges[index], `${sequence.id}:fork:bar:${index}`, { itemId: junctions[index-1].id, portId: "south" }, { itemId: junctions[index].id, portId: "north" }, edges.slice(index), false, false, true);
    });
  }
  columns.push(branchColumn);
  if (hasMerge) {
    const target = nodes.get(sinks[0].id)!, { column, junctions } = bar("merge"), edges = branches.map(node => outgoing(node.id)[0]);
    columns.push(column, target);
    branches.forEach((node, index) => {
      append(edges[index], edges[index].id, { itemId: node.id, portId: "east" }, { itemId: junctions[index].id, portId: "west" }, [edges[index]], true, false);
      if (index) append(edges[index], `${sequence.id}:merge:bar:${index}`, { itemId: junctions[index].id, portId: "north" }, { itemId: junctions[index-1].id, portId: "south" }, edges.slice(index), false, false, true);
    });
    append(edges[0], `${sequence.id}:merge:stem`, { itemId: junctions[0].id, portId: "east" }, { itemId: target.id, portId: "west" }, edges, false, true);
  }
  const region = uiContractsStack(sequence.id, columns, "horizontal", gap);
  region.chrome.padding.top = Math.max(0, ...labels.map(label => label.height + DEFAULT_ROUTING_POLICY.minTerminalLeg - firstAnchor)) + UI_CONTRACTS_SPACING.padding;
  return region;
}

export function buildUiContractsTransitionRegion(builder: UiContractsSceneBuilder, sequence: UiContractsSequence): SceneContainer | undefined {
  const returns = returnEdges(sequence);
  if (returns.size) return withUpperReturn(builder, sequence, returns);
  return branchRegion(builder, sequence);
}
