import type { RendererScene, SceneContainer, SceneEdge, SceneItem, SceneNode } from "../src/renderer/staged/contracts.js";
import { createEdgeLabelMeasurementService } from "../src/renderer/staged/microLayout.js";
import { measureScene } from "../src/renderer/staged/pipeline.js";
import { DEFAULT_ROUTING_POLICY } from "../src/renderer/staged/routingCore/contracts.js";
import { resolveRendererTheme } from "../src/renderer/staged/theme.js";

export function proofStack(id: string, children: SceneItem[], direction: "horizontal" | "vertical", gap = 0): SceneContainer {
  return { kind: "container", id, role: "fanout_proof", primitive: "stack", classes: [],
    layout: { strategy: "stack", direction, gap, crossAlignment: "start" },
    chrome: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, headerBandHeight: 0 }, children, ports: [] };
}

/** Stage 1 scene-input proof: shared services alone measure, place, and route it. */
export function buildFanoutProof(sourceInput: SceneNode, targetsInput: SceneNode[], edgeInputs: SceneEdge[]): RendererScene {
  const source = structuredClone(sourceInput), targets = structuredClone(targetsInput), edges = structuredClone(edgeInputs);
  const scene: RendererScene = { viewId: "ui_contracts", detailId: "detailed", themeId: "default",
    root: proofStack("root", [], "vertical"), edges, diagnostics: [] };
  const measured = measureScene({ ...scene, root: proofStack("measurement", [source, ...targets], "vertical"), edges: [] });
  const [measuredSource, ...measuredTargets] = measured.root.children;
  const labelMeasure = createEdgeLabelMeasurementService(scene.themeId, scene.diagnostics);
  const labels = edges.map(edge => edge.label ? labelMeasure(edge.label, edge.id) : { width: 0, height: 0 });
  const { minSeparation, minTerminalLeg } = DEFAULT_ROUTING_POLICY;
  const radius = resolveRendererTheme(scene.themeId).theme.sharedNode.cornerRadius;
  const cornerClearance = Math.max(radius, minTerminalLeg * 2);
  const firstAnchor = Math.min(measuredSource.height, measuredTargets[0]?.height ?? measuredSource.height) / 2;
  const topInset = Math.max(0, (labels[0]?.height ?? 0) + minTerminalLeg - firstAnchor);
  source.ports = [];
  const gap = Math.max(0, ...labels.map(label => label.width)) + 2 * minTerminalLeg;
  const leads: SceneEdge[] = [];
  const rows = targets.map((target, index) => {
    const row = proofStack(`target-row:${index}`, [], "horizontal", gap);
    const anchor = index === 0 ? firstAnchor : measuredTargets[index].height / 2;
    row.chrome.padding.top = index === 0 ? topInset : Math.max(0, labels[index].height + minTerminalLeg - anchor);
    const offset = index === 0 ? firstAnchor : measuredSource.width - cornerClearance - (index - 1) * minSeparation;
    if (index > 0 && offset < cornerClearance) throw new Error("Fan-out exceeds independent source-port capacity");
    source.ports.push({ id: `contract-out:${index}`, role: "contract_out", side: index === 0 ? "east" : "south", offset });
    target.ports = [{ id: "contract-in", role: "contract_in", side: "west", offset: anchor }];
    edges[index].from = { itemId: source.id, portId: `contract-out:${index}` };
    edges[index].to = { itemId: target.id, portId: "contract-in" };
    edges[index].routing = { style: "orthogonal", preferAxis: "horizontal" };
    if (index === 0) {
      row.children = [source, target];
    } else {
      const junction = proofStack(`anchor:${index}`, [], "vertical");
      junction.ports = [{ id: "in", role: "in", side: "north", offset: 0 }, { id: "out", role: "out", side: "east", offset: 0 }];
      row.chrome.padding.left = offset;
      row.layout.gap = measuredSource.width + gap - offset;
      row.layout.crossAlignment = "center";
      row.children = [junction, target];
      leads.push({ ...edges[index], id: `${edges[index].id}:lead`, label: undefined, markers: {},
        to: { itemId: junction.id, portId: "in" }, routing: { style: "orthogonal", preferAxis: "vertical" } });
      edges[index].from = { itemId: junction.id, portId: "out" };
    }
    return row;
  });
  const group = proofStack("contract-group", rows, "vertical", 24);
  scene.edges = [...leads, ...edges];
  scene.root.children = [group];
  scene.root.chrome.padding = { top: 16, right: 16, bottom: 16, left: 16 };
  return scene;
}
