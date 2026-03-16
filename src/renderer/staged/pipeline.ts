import type {
  ChromeSpec,
  ContentBlock,
  LayoutIntent,
  MeasuredContainer,
  MeasuredContentBlock,
  MeasuredEdge,
  MeasuredItem,
  MeasuredNode,
  MeasuredPort,
  MeasuredScene,
  OverflowPolicy,
  PortSpec,
  PositionedContainer,
  PositionedEdge,
  PositionedEdgeLabel,
  PositionedItem,
  PositionedNode,
  PositionedScene,
  RendererScene,
  RoutingIntent,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode,
  WidthPolicy
} from "./contracts.js";
import { sortRendererDiagnostics, type RendererDiagnostic, type RendererDiagnosticPhase } from "./diagnostics.js";

export interface StagedRendererPipelineResult {
  rendererScene: RendererScene;
  measuredScene: MeasuredScene;
  positionedScene: PositionedScene;
}

function cloneLayoutIntent(layout: LayoutIntent): LayoutIntent {
  return {
    ...layout
  };
}

function cloneChromeSpec(chrome: ChromeSpec): ChromeSpec {
  return {
    padding: { ...chrome.padding },
    gutter: chrome.gutter,
    headerBandHeight: chrome.headerBandHeight
  };
}

function cloneWidthPolicy(widthPolicy: WidthPolicy): WidthPolicy {
  return {
    preferred: widthPolicy.preferred,
    allowed: [...widthPolicy.allowed]
  };
}

function cloneOverflowPolicy(overflowPolicy: OverflowPolicy): OverflowPolicy {
  return {
    kind: overflowPolicy.kind,
    maxLines: overflowPolicy.maxLines
  };
}

function cloneRoutingIntent(routing: RoutingIntent): RoutingIntent {
  return {
    ...routing
  };
}

function measurePorts(ports: PortSpec[]): MeasuredPort[] {
  return ports.map((port) => ({
    id: port.id,
    role: port.role,
    side: port.side,
    x: 0,
    y: 0
  }));
}

function measureContent(content: ContentBlock[]): MeasuredContentBlock[] {
  return content.map((block) => ({
    id: block.id,
    kind: block.kind,
    textStyleRole: block.textStyleRole,
    lines: [block.text],
    width: 0,
    height: 0,
    priority: block.priority
  }));
}

function measureItem(item: SceneItem): MeasuredItem {
  if (item.kind === "container") {
    return measureContainer(item);
  }

  return measureNode(item);
}

function measureContainer(container: SceneContainer): MeasuredContainer {
  return {
    kind: "container",
    id: container.id,
    role: container.role,
    primitive: container.primitive,
    classes: [...container.classes],
    layout: cloneLayoutIntent(container.layout),
    chrome: cloneChromeSpec(container.chrome),
    children: container.children.map((child) => measureItem(child)),
    ports: measurePorts(container.ports),
    width: 0,
    height: 0
  };
}

function measureNode(node: SceneNode): MeasuredNode {
  return {
    kind: "node",
    id: node.id,
    role: node.role,
    primitive: node.primitive,
    classes: [...node.classes],
    widthPolicy: cloneWidthPolicy(node.widthPolicy),
    widthBand: node.widthPolicy.preferred,
    overflowPolicy: cloneOverflowPolicy(node.overflowPolicy),
    content: measureContent(node.content),
    ports: measurePorts(node.ports),
    overflow: {
      status: "stubbed",
      detail: "Step 2 stub measurement does not compute intrinsic sizing yet."
    },
    width: 0,
    height: 0
  };
}

function measureEdge(edge: SceneEdge): MeasuredEdge {
  return {
    id: edge.id,
    role: edge.role,
    classes: [...edge.classes],
    from: {
      itemId: edge.from.itemId,
      portId: edge.from.portId,
      x: 0,
      y: 0
    },
    to: {
      itemId: edge.to.itemId,
      portId: edge.to.portId,
      x: 0,
      y: 0
    },
    routing: cloneRoutingIntent(edge.routing),
    label: edge.label
      ? {
          lines: [edge.label.text],
          width: 0,
          height: 0,
          textStyleRole: edge.label.textStyleRole
        }
      : undefined
  };
}

function positionItem(item: MeasuredItem): PositionedItem {
  if (item.kind === "container") {
    return positionContainer(item);
  }

  return positionNode(item);
}

function positionContainer(container: MeasuredContainer): PositionedContainer {
  return {
    kind: "container",
    id: container.id,
    role: container.role,
    primitive: container.primitive,
    classes: [...container.classes],
    layout: cloneLayoutIntent(container.layout),
    chrome: cloneChromeSpec(container.chrome),
    children: container.children.map((child) => positionItem(child)),
    ports: container.ports.map((port) => ({ ...port })),
    x: 0,
    y: 0,
    width: container.width,
    height: container.height
  };
}

function positionNode(node: MeasuredNode): PositionedNode {
  return {
    kind: "node",
    id: node.id,
    role: node.role,
    primitive: node.primitive,
    classes: [...node.classes],
    widthPolicy: cloneWidthPolicy(node.widthPolicy),
    widthBand: node.widthBand,
    overflowPolicy: cloneOverflowPolicy(node.overflowPolicy),
    content: node.content.map((block) => ({
      ...block,
      lines: [...block.lines]
    })),
    ports: node.ports.map((port) => ({ ...port })),
    overflow: {
      ...node.overflow
    },
    x: 0,
    y: 0,
    width: node.width,
    height: node.height
  };
}

function positionEdgeLabel(label: NonNullable<MeasuredEdge["label"]>): PositionedEdgeLabel {
  return {
    lines: [...label.lines],
    width: label.width,
    height: label.height,
    textStyleRole: label.textStyleRole,
    x: 0,
    y: 0
  };
}

function positionEdge(edge: MeasuredEdge): PositionedEdge {
  return {
    id: edge.id,
    role: edge.role,
    classes: [...edge.classes],
    from: {
      itemId: edge.from.itemId,
      portId: edge.from.portId,
      x: edge.from.x,
      y: edge.from.y
    },
    to: {
      itemId: edge.to.itemId,
      portId: edge.to.portId,
      x: edge.to.x,
      y: edge.to.y
    },
    route: {
      style: edge.routing.style,
      points: [
        { x: edge.from.x, y: edge.from.y },
        { x: edge.to.x, y: edge.to.y }
      ]
    },
    label: edge.label ? positionEdgeLabel(edge.label) : undefined,
    paintGroup: "edges"
  };
}

function createStubDiagnostic(phase: RendererDiagnosticPhase, code: string, message: string, targetId: string): RendererDiagnostic {
  return {
    phase,
    code,
    severity: "info",
    message,
    targetId
  };
}

export function measureScene(scene: RendererScene): MeasuredScene {
  return {
    viewId: scene.viewId,
    profileId: scene.profileId,
    themeId: scene.themeId,
    root: measureContainer(scene.root),
    edges: scene.edges.map((edge) => measureEdge(edge)),
    diagnostics: sortRendererDiagnostics([
      ...scene.diagnostics,
      createStubDiagnostic(
        "measure",
        "renderer.measure.stubbed",
        "Measurement is currently a stub and does not compute intrinsic sizes or wrapped lines.",
        scene.root.id
      )
    ])
  };
}

export function positionScene(measuredScene: MeasuredScene): PositionedScene {
  return {
    viewId: measuredScene.viewId,
    profileId: measuredScene.profileId,
    themeId: measuredScene.themeId,
    root: positionContainer(measuredScene.root),
    edges: measuredScene.edges.map((edge) => positionEdge(edge)),
    diagnostics: sortRendererDiagnostics([
      ...measuredScene.diagnostics,
      createStubDiagnostic(
        "layout",
        "renderer.layout.stubbed",
        "Macro-layout is currently a stub and leaves all items at placeholder coordinates.",
        measuredScene.root.id
      ),
      createStubDiagnostic(
        "routing",
        "renderer.routing.stubbed",
        "Routing is currently a stub and emits placeholder edge paths only.",
        measuredScene.root.id
      )
    ]),
    paintOrder: ["chrome", "nodes", "labels", "edges", "edge_labels"]
  };
}

export function runStagedRendererPipeline(scene: RendererScene): StagedRendererPipelineResult {
  const measuredScene = measureScene(scene);
  const positionedScene = positionScene(measuredScene);

  return {
    rendererScene: scene,
    measuredScene,
    positionedScene
  };
}
