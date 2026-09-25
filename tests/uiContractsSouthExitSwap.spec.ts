import { describe, expect, it } from "vitest";
import type {
  PositionedContainer,
  PositionedEdge,
  PositionedNode,
  PositionedScene
} from "../src/renderer/staged/contracts.js";
import { routeUiContractsScene, validateUiContractsRoutes } from "../src/renderer/staged/uiContractsRouting.js";
import { auditUiContractsFinalScene, repairUiContractsLabels } from "../src/renderer/staged/uiContractsLabels.js";
import { routeCost, routeCrossings } from "../src/renderer/staged/routingCore/optimization.js";
import type { FinalRoutingConnector } from "../src/renderer/staged/routingCore/lifecycle.js";

interface ExitSpec { targetY: number; portOffset: number }

function node(id: string, x: number, y: number, width: number, height: number, ports: PositionedNode["ports"] = []): PositionedNode {
  return {
    kind: "node", id, role: "viewstate", primitive: "card", classes: ["fixture"],
    widthPolicy: { preferred: "standard", allowed: ["standard"] }, widthBand: "standard",
    overflowPolicy: { kind: "allow" }, content: [], ports, overflow: { kind: "none" },
    x, y, width, height
  } as unknown as PositionedNode;
}

function makeScene(
  exits: readonly ExitSpec[],
  options: {
    blockedSwap?: boolean;
    unaffectedCrossing?: boolean;
    targetLeft?: boolean;
    portRoles?: readonly string[];
  } = {}
): PositionedScene {
  const sourceX = options.targetLeft ? 300 : 100;
  const sourceY = 100;
  const sourceWidth = 100;
  const sourceHeight = 40;
  const ports = exits.map((exit, index) => ({
    id: `south-${index}`, role: options.portRoles?.[index] ?? "routing_south", side: "south" as const,
    offset: exit.portOffset, x: exit.portOffset, y: sourceHeight
  }));
  const source = node("source", sourceX, sourceY, sourceWidth, sourceHeight, ports);
  const targets = exits.map((exit, index) => {
    const targetX = options.targetLeft ? 20 : 400;
    const targetWidth = 80;
    const targetHeight = 40;
    const targetY = exit.targetY - targetHeight / 2;
    const port = options.targetLeft
      ? { id: "east", role: "routing_east", side: "east" as const, offset: targetHeight / 2, x: targetWidth, y: targetHeight / 2 }
      : { id: "west", role: "routing_west", side: "west" as const, offset: targetHeight / 2, x: 0, y: targetHeight / 2 };
    return node(`target-${index}`, targetX, targetY, targetWidth, targetHeight, [port]);
  });
  const edges: PositionedEdge[] = exits.map((exit, index) => {
    const target = targets[index]!;
    const start = { x: sourceX + exit.portOffset, y: sourceY + sourceHeight };
    const targetPoint = { x: options.targetLeft ? target.x + target.width : target.x, y: exit.targetY };
    return {
      id: `exit-${index}`, role: "transition", classes: ["transition"],
      from: { itemId: source.id, portId: `south-${index}`, ...start },
      to: { itemId: target.id, portId: options.targetLeft ? "east" : "west", ...targetPoint },
      route: { style: "orthogonal", points: [start, { x: start.x, y: exit.targetY }, targetPoint] },
      paintGroup: "edges"
    } as PositionedEdge;
  });

  const children: PositionedScene["root"]["children"] = [source, ...targets];
  if (options.blockedSwap) children.push(node("blocker", 130, 190, 20, 30));
  if (options.unaffectedCrossing) {
    const cSource = node("crossing-source", 145, 155, 9, 10, [
      { id: "east", role: "routing_east", side: "east", offset: 5, x: 9, y: 5 }
    ]);
    const cTarget = node("crossing-target", 170, 155, 20, 10, [
      { id: "west", role: "routing_west", side: "west", offset: 5, x: 0, y: 5 }
    ]);
    children.push(cSource, cTarget);
    edges.push({
      id: "unaffected", role: "transition", classes: ["transition"],
      from: { itemId: cSource.id, portId: "east", x: 154, y: 160 },
      to: { itemId: cTarget.id, portId: "west", x: 170, y: 160 },
      route: { style: "orthogonal", points: [{ x: 154, y: 160 }, { x: 170, y: 160 }] },
      paintGroup: "edges"
    } as PositionedEdge);
  }

  const root: PositionedContainer = {
    kind: "container", id: "root", role: "diagram_root", primitive: "root", classes: ["diagram"],
    layout: { strategy: "stack", direction: "horizontal", gap: 0, crossAlignment: "start" },
    chrome: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, gutter: 0, headerBandHeight: 0 },
    headerContent: [], children, ports: [], x: 0, y: 0, width: 600, height: 400
  };
  return {
    viewId: "ui_contracts", detailId: "detailed", themeId: "default", root, edges,
    decorations: [], diagnostics: [], paintOrder: ["edges"]
  };
}

function toConnector(edge: PositionedEdge): FinalRoutingConnector {
  const points = edge.route.points;
  const sourceNeighbour = points[1]!;
  const targetNeighbour = points[points.length - 2]!;
  return {
    id: edge.id,
    route: edge.route,
    source: { nodeId: edge.from.itemId, point: { x: edge.from.x, y: edge.from.y }, side: "south", minLeg: 0 },
    target: {
      nodeId: edge.to.itemId,
      point: { x: edge.to.x, y: edge.to.y },
      side: sourceNeighbour.x === edge.from.x ? (edge.to.x > edge.from.x ? "west" : "east") : "west",
      minLeg: 0
    },
    priority: 0
  };
}

function cost(scene: PositionedScene): [number, number, number] {
  return routeCost(scene.edges.map(toConnector));
}

function edge(scene: PositionedScene, id: string): PositionedEdge {
  return scene.edges.find((candidate) => candidate.id === id)!;
}

function expectPortGeometryConsistent(scene: PositionedScene): void {
  const sourceById = new Map(scene.root.children.filter((item): item is PositionedNode => item.kind === "node").map((item) => [item.id, item]));
  for (const connector of scene.edges) {
    const source = sourceById.get(connector.from.itemId);
    const port = source?.ports.find((candidate) => candidate.id === connector.from.portId);
    expect(port).toBeDefined();
    expect(connector.from.x).toBe(source!.x + port!.x);
    expect(connector.from.y).toBe(source!.y + port!.y);
    expect(connector.route.points[0]).toEqual({ x: connector.from.x, y: connector.from.y });
    expect(connector.route.points.at(-1)).toEqual({ x: connector.to.x, y: connector.to.y });
  }
}

describe("UI Contracts south-exit ordering", () => {
  it("swaps reversed two-exit order to remove a crossing", () => {
    const original = makeScene([{ targetY: 180, portOffset: 40 }, { targetY: 280, portOffset: 56 }]);
    expect(cost(original)[0]).toBe(1);
    const routed = routeUiContractsScene(original);
    expect(cost(routed)[0]).toBe(0);
    expect(edge(routed, "exit-0").from.portId).toBe("south-1");
    expect(edge(routed, "exit-1").from.portId).toBe("south-0");
    expect(edge(routed, "exit-0").to).toEqual(edge(original, "exit-0").to);
    expect(validateUiContractsRoutes(routed)).toEqual([]);
    expectPortGeometryConsistent(routed);
  });

  it("uses successive deterministic swaps for three exits and handles leftward targets", () => {
    for (const targetLeft of [false, true]) {
      const targetYs = targetLeft ? [280, 220, 180] : [180, 220, 280];
      const original = makeScene(targetYs.map((targetY, index) => ({
        targetY, portOffset: 40 + index * 16
      })), { targetLeft });
      expect(cost(original)[0]).toBeGreaterThan(0);
      const first = routeUiContractsScene(original);
      const second = routeUiContractsScene(original);
      expect(cost(first)[0]).toBe(0);
      expect(first.edges).toEqual(second.edges);
      expect(first.edges.filter((candidate) => candidate.id.startsWith("exit-"))
        .map((candidate) => candidate.from.x)).toEqual(targetLeft ? [372, 356, 340] : [172, 156, 140]);
      expect(validateUiContractsRoutes(first)).toEqual([]);
      expectPortGeometryConsistent(first);
    }
  });

  it("rejects swaps blocked by a node or by insufficient corner clearance", () => {
    const blocked = makeScene([
      { targetY: 180, portOffset: 40 },
      { targetY: 280, portOffset: 56 }
    ], { blockedSwap: true });
    const blockedResult = routeUiContractsScene(blocked);
    expect(edge(blockedResult, "exit-0").from.portId).toBe("south-0");
    expect(edge(blockedResult, "exit-1").from.portId).toBe("south-1");

    const crowded = makeScene([
      { targetY: 180, portOffset: 8 },
      { targetY: 280, portOffset: 24 }
    ]);
    const crowdedResult = routeUiContractsScene(crowded);
    expect(edge(crowdedResult, "exit-0").from.portId).toBe("south-0");
    expect(edge(crowdedResult, "exit-1").from.portId).toBe("south-1");

    const distinctRoles = makeScene([
      { targetY: 180, portOffset: 40 },
      { targetY: 280, portOffset: 56 }
    ], { portRoles: ["primary-south", "return-south"] });
    const distinctRolesResult = routeUiContractsScene(distinctRoles);
    expect(edge(distinctRolesResult, "exit-0").from.portId).toBe("south-0");
    expect(edge(distinctRolesResult, "exit-1").from.portId).toBe("south-1");
  });

  it("keeps the original order on ties or when a swap transfers a crossing", () => {
    const tied = makeScene([
      { targetY: 220, portOffset: 40 },
      { targetY: 220, portOffset: 56 }
    ]);
    expect(routeUiContractsScene(tied).edges).toEqual(tied.edges);

    const transferred = makeScene([
      { targetY: 180, portOffset: 40 },
      { targetY: 280, portOffset: 56 }
    ], { unaffectedCrossing: true });
    expect(cost(transferred)[0]).toBe(2);
    const result = routeUiContractsScene(transferred);
    expect(cost(result)[0]).toBe(2);
    expect(edge(result, "exit-0").from.portId).toBe("south-0");
    expect(edge(result, "exit-1").from.portId).toBe("south-1");
  });

  it("repositions labels for routes whose south ports changed", () => {
    const source = makeScene([{ targetY: 180, portOffset: 40 }, { targetY: 280, portOffset: 56 }]);
    const oldLabel = {
      lines: ["upper"], width: 32, height: 14, lineHeight: 14,
      textStyleRole: "edge_label", x: 145, y: 145
    };
    const labeled = {
      ...source,
      edges: source.edges.map((candidate) => candidate.id === "exit-0"
        ? { ...candidate, label: oldLabel } : candidate)
    };
    const changed = new Set<string>();
    const routed = routeUiContractsScene(labeled, (ids) => ids.forEach((id) => changed.add(id)));
    expect(changed).toEqual(new Set(["exit-0", "exit-1"]));
    const placed = repairUiContractsLabels(routed, changed);
    expect(edge(placed, "exit-0").label).toBeDefined();
    expect(edge(placed, "exit-0").label).not.toEqual(oldLabel);
    expect(auditUiContractsFinalScene(placed).filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  });

  it("counts route crossings independently and preserves target attachments during the swap", () => {
    const original = makeScene([{ targetY: 180, portOffset: 40 }, { targetY: 280, portOffset: 56 }]);
    const first = toConnector(edge(original, "exit-0"));
    const second = toConnector(edge(original, "exit-1"));
    expect(routeCrossings(first, second)).toBe(1);
    const routed = routeUiContractsScene(original);
    expect(edge(routed, "exit-0").route.points.at(-1)).toEqual(edge(original, "exit-0").route.points.at(-1));
    expect(edge(routed, "exit-1").route.points.at(-1)).toEqual(edge(original, "exit-1").route.points.at(-1));
  });
});
