import type {
  MeasuredContentBlock,
  PaintGroup,
  Point,
  PositionedContainer,
  PositionedDecoration,
  PositionedEdge,
  PositionedEdgeLabel,
  PositionedItem,
  PositionedNode,
  PositionedScene,
  SceneContainerPrimitive,
  SceneNodePrimitive
} from "./contracts.js";
import {
  createBackendDiagnostic,
  sortRendererDiagnostics,
  type RendererDiagnostic
} from "./diagnostics.js";
import { getContainerPrimitiveTheme, getNodePrimitiveTheme, resolveTextRoleForBlock } from "./primitives.js";
import { resolveRendererTheme, type RendererTheme, type TextStyleToken } from "./theme.js";
import { buildEmbeddedFontFaceStyleElements, renderSvgToPng } from "../svgArtifacts.js";

export interface StagedSvgArtifact {
  svg: string;
  diagnostics: RendererDiagnostic[];
}

export interface StagedPngArtifact extends StagedSvgArtifact {
  png: Uint8Array;
}

export interface StagedSvgRasterizationOptions {
  dpi?: number;
}

interface PaintElementMap {
  chrome: string[];
  nodes: string[];
  labels: string[];
  edges: string[];
  edge_labels: string[];
}

const EDGE_MARKER_IDS = {
  start: "scene-marker-arrow-start",
  end: "scene-marker-arrow-end"
} as const;

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatNumber(value: number): string {
  const rounded = roundMetric(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/\.?0+$/, "");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unnamed";
}

function buildClassList(...entries: Array<string | undefined>): string {
  return entries.filter((entry): entry is string => typeof entry === "string" && entry.length > 0).join(" ");
}

function indentLines(markup: string, spaces: number): string[] {
  const indent = " ".repeat(spaces);
  return markup.split("\n").map((line) => `${indent}${line}`);
}

function buildPaintElementMap(): PaintElementMap {
  return {
    chrome: [],
    nodes: [],
    labels: [],
    edges: [],
    edge_labels: []
  };
}

function isVisibleContainerPrimitive(primitive: SceneContainerPrimitive): boolean {
  return primitive === "root" || primitive === "cluster" || primitive === "lane";
}

function isVisibleNodePrimitive(primitive: SceneNodePrimitive): boolean {
  return primitive !== "connector_port";
}

function getContainerRadius(theme: RendererTheme, primitive: SceneContainerPrimitive): number {
  return theme.paint.cornerRadii.container[primitive] ?? 0;
}

function getNodeRadius(theme: RendererTheme, primitive: SceneNodePrimitive): number {
  return theme.paint.cornerRadii.node[primitive] ?? 0;
}

function buildItemClassList(
  kind: "container" | "node",
  primitive: string,
  role: string,
  classes: string[],
  paintGroup?: PaintGroup
): string {
  return buildClassList(
    `scene-${kind}`,
    `primitive-${sanitizeToken(primitive)}`,
    `role-${sanitizeToken(role)}`,
    paintGroup ? `paint-${paintGroup}` : undefined,
    ...classes.map((className) => sanitizeToken(className))
  );
}

function buildTextClassList(
  role: string,
  kind: string,
  region?: string
): string {
  return buildClassList(
    "scene-text",
    `text-role-${sanitizeToken(role)}`,
    `block-kind-${sanitizeToken(kind)}`,
    region ? `block-region-${sanitizeToken(region)}` : undefined
  );
}

function getTextStyleForBackend(
  theme: RendererTheme,
  role: string,
  targetId: string,
  diagnostics: RendererDiagnostic[]
): TextStyleToken {
  const style = theme.textStyles[role];
  if (style) {
    return style;
  }

  diagnostics.push(createBackendDiagnostic(
    "renderer.backend.unknown_text_style",
    `Unknown text style role "${role}". Falling back to "label".`,
    { targetId }
  ));

  return theme.textStyles.label;
}

function renderTextBlock(
  x: number,
  y: number,
  lines: string[],
  style: TextStyleToken,
  lineHeight: number,
  classes: string
): string {
  const lineMarkup = lines.map((line, index) => {
    const dy = index === 0 ? "0" : formatNumber(lineHeight);
    return `    <tspan x="${formatNumber(x)}" dy="${dy}">${escapeXml(line)}</tspan>`;
  });

  return [
    `<text class="${classes}" x="${formatNumber(x)}" y="${formatNumber(y + style.fontSize)}">`,
    ...lineMarkup,
    "  </text>"
  ].join("\n");
}

function renderCenteredTextBlock(
  x: number,
  y: number,
  height: number,
  lines: string[],
  lineHeight: number,
  classes: string
): string {
  const totalLineHeight = lines.length * lineHeight;
  const firstLineCenterY = y + (height - totalLineHeight) / 2 + lineHeight / 2;
  const lineMarkup = lines.map((line, index) => {
    const dy = index === 0 ? "0" : formatNumber(lineHeight);
    return `    <tspan x="${formatNumber(x)}" dy="${dy}">${escapeXml(line)}</tspan>`;
  });

  return [
    `<text class="${classes}" x="${formatNumber(x)}" y="${formatNumber(firstLineCenterY)}" dominant-baseline="middle">`,
    ...lineMarkup,
    "  </text>"
  ].join("\n");
}

function renderContainerChrome(
  container: PositionedContainer,
  diagnostics: RendererDiagnostic[],
  theme: RendererTheme,
  isSceneRoot: boolean
): string | undefined {
  const classList = buildItemClassList("container", container.primitive, container.role, container.classes, "chrome");
  const lines = [
    `<g id="scene-container-${sanitizeToken(container.id)}" class="${classList}" data-item-id="${escapeXml(container.id)}" data-role="${escapeXml(container.role)}">`
  ];

  const appendChromeRect = (className: string, height: number, radius: number): void => {
    // Keep root paint inside the viewport without changing positioned geometry.
    // Nested outlines retain their centered strokes.
    const inset = isSceneRoot ? theme.paint.strokeWidth / 2 : 0;
    const width = isSceneRoot ? Math.max(0, container.width - 2 * inset) : container.width;
    const paintHeight = isSceneRoot ? Math.max(0, height - 2 * inset) : height;
    if (isSceneRoot && (width === 0 || paintHeight === 0)) {
      if (container.width > 0 && height > 0) {
        diagnostics.push(createBackendDiagnostic(
          "renderer.backend.root_chrome_collapsed",
          "Root chrome is too small for its inside stroke. Omitting the rectangle.",
          { targetId: container.id, details: className }
        ));
      }
      return;
    }
    const paintRadius = isSceneRoot ? Math.max(0, radius - inset) : radius;
    lines.push(
      `  <rect class="${className}" x="${formatNumber(container.x + inset)}" y="${formatNumber(container.y + inset)}" width="${formatNumber(width)}" height="${formatNumber(paintHeight)}" rx="${formatNumber(paintRadius)}" ry="${formatNumber(paintRadius)}"/>`
    );
  };

  if (isVisibleContainerPrimitive(container.primitive)) {
    const radius = getContainerRadius(theme, container.primitive);
    appendChromeRect("scene-container__chrome", container.height, radius);

    if (container.chrome.headerBandHeight && container.chrome.headerBandHeight > 0) {
      const headerRadius = Math.min(radius, container.chrome.headerBandHeight / 2);
      appendChromeRect("scene-container__header-band", container.chrome.headerBandHeight, headerRadius);
    }
  }

  if (lines.length === 1) {
    return undefined;
  }

  lines.push("</g>");
  return lines.join("\n");
}

function renderBadgeChrome(node: PositionedNode, block: MeasuredContentBlock): string {
  return `<rect class="scene-badge__chrome" x="${formatNumber(node.x + block.x)}" y="${formatNumber(node.y + block.y)}" width="${formatNumber(block.width)}" height="${formatNumber(block.height)}" rx="${formatNumber(999)}" ry="${formatNumber(999)}"/>`;
}

function renderNodeChrome(
  node: PositionedNode,
  diagnostics: RendererDiagnostic[],
  theme: RendererTheme
): string | undefined {
  const classList = buildItemClassList("node", node.primitive, node.role, node.classes, "nodes");
  const lines = [
    `<g id="scene-node-${sanitizeToken(node.id)}" class="${classList}" data-item-id="${escapeXml(node.id)}" data-role="${escapeXml(node.role)}">`
  ];

  if (node.primitive === "connector_port") {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    lines.push(
      `  <circle class="scene-node__chrome" cx="${formatNumber(cx)}" cy="${formatNumber(cy)}" r="${formatNumber(theme.paint.portRadius)}"/>`
    );
  } else if (isVisibleNodePrimitive(node.primitive)) {
    const radius = getNodeRadius(theme, node.primitive);
    lines.push(
      `  <rect class="scene-node__chrome" x="${formatNumber(node.x)}" y="${formatNumber(node.y)}" width="${formatNumber(node.width)}" height="${formatNumber(node.height)}" rx="${formatNumber(radius)}" ry="${formatNumber(radius)}"/>`
    );
  } else {
    diagnostics.push(createBackendDiagnostic(
      "renderer.backend.unsupported_node_primitive",
      `Unsupported node primitive "${node.primitive}".`,
      { targetId: node.id }
    ));
  }

  for (const block of node.content) {
    if (block.kind === "badge_text") {
      lines.push(`  ${renderBadgeChrome(node, block)}`);
    }
  }

  lines.push("</g>");
  return lines.join("\n");
}

function resolveBlockTextOrigin(
  node: PositionedNode,
  block: MeasuredContentBlock,
  theme: RendererTheme
): Point {
  if (block.kind === "badge_text") {
    const primitiveTheme = getNodePrimitiveTheme(theme, node.primitive);
    const badgePadding = primitiveTheme.badgePadding ?? {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    };
    return {
      x: node.x + block.x + badgePadding.left,
      y: node.y + block.y + badgePadding.top
    };
  }

  return {
    x: node.x + block.x,
    y: node.y + block.y
  };
}

function renderNodeLabels(
  node: PositionedNode,
  diagnostics: RendererDiagnostic[],
  theme: RendererTheme
): string | undefined {
  if (node.content.length === 0) {
    return undefined;
  }

  const classList = buildItemClassList("node", node.primitive, node.role, node.classes, "labels");
  const lines = [
    `<g class="${classList}" data-item-id="${escapeXml(node.id)}" data-role="${escapeXml(node.role)}">`
  ];

  for (const block of node.content) {
    const resolvedRole = resolveTextRoleForBlock(block.kind, block.textStyleRole);
    const style = getTextStyleForBackend(theme, resolvedRole, node.id, diagnostics);
    const textOrigin = resolveBlockTextOrigin(node, block, theme);
    const markup = renderTextBlock(
      textOrigin.x,
      textOrigin.y,
      block.lines,
      style,
      block.lineHeight,
      buildTextClassList(resolvedRole, block.kind, block.region)
    );
    lines.push(...indentLines(markup, 2));
  }

  lines.push("</g>");
  return lines.join("\n");
}

function renderContainerLabels(
  container: PositionedContainer,
  diagnostics: RendererDiagnostic[],
  theme: RendererTheme
): string | undefined {
  if (container.headerContent.length === 0) {
    return undefined;
  }

  const classList = buildItemClassList("container", container.primitive, container.role, container.classes, "labels");
  const lines = [
    `<g class="${classList}" data-item-id="${escapeXml(container.id)}" data-role="${escapeXml(container.role)}">`
  ];

  for (const block of container.headerContent) {
    const resolvedRole = resolveTextRoleForBlock(block.kind, block.textStyleRole);
    const style = getTextStyleForBackend(theme, resolvedRole, container.id, diagnostics);
    const markup = renderTextBlock(
      container.x + block.x,
      container.y + block.y,
      block.lines,
      style,
      block.lineHeight,
      buildTextClassList(resolvedRole, block.kind, block.region)
    );
    lines.push(...indentLines(markup, 2));
  }

  lines.push("</g>");
  return lines.join("\n");
}

function collectPaintElements(
  item: PositionedItem,
  groups: PaintElementMap,
  diagnostics: RendererDiagnostic[],
  theme: RendererTheme,
  isSceneRoot = false
): void {
  if (item.kind === "container") {
    const chrome = renderContainerChrome(item, diagnostics, theme, isSceneRoot);
    if (chrome) {
      groups.chrome.push(chrome);
    }

    const labels = renderContainerLabels(item, diagnostics, theme);
    if (labels) {
      groups.labels.push(labels);
    }

    for (const child of item.children) {
      collectPaintElements(child, groups, diagnostics, theme);
    }
    return;
  }

  const nodeChrome = renderNodeChrome(item, diagnostics, theme);
  if (nodeChrome) {
    groups.nodes.push(nodeChrome);
  }

  const nodeLabels = renderNodeLabels(item, diagnostics, theme);
  if (nodeLabels) {
    groups.labels.push(nodeLabels);
  }
}

function buildRoutePath(
  edge: PositionedEdge,
  diagnostics: RendererDiagnostic[]
): string | undefined {
  const { points } = edge.route;
  if (points.length < 2) {
    diagnostics.push(createBackendDiagnostic(
      "renderer.backend.invalid_edge_route",
      "Skipping edge because the route needs at least two points.",
      { targetId: edge.id }
    ));
    return undefined;
  }

  const [first, ...rest] = points;
  if (!edge.continuityMarks || edge.continuityMarks.length === 0) {
    return [`M ${formatNumber(first.x)} ${formatNumber(first.y)}`, ...rest.map((point) => `L ${formatNumber(point.x)} ${formatNumber(point.y)}`)].join(" ");
  }

  const marksBySegment = new Map<number, typeof edge.continuityMarks>();
  for (const mark of edge.continuityMarks) {
    marksBySegment.set(mark.segmentIndex, [...(marksBySegment.get(mark.segmentIndex) ?? []), mark]);
  }
  const commands = [`M ${formatNumber(first.x)} ${formatNumber(first.y)}`];
  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start = points[segmentIndex]!;
    const end = points[segmentIndex + 1]!;
    const horizontal = Math.abs(start.y - end.y) <= 0.001;
    const vertical = Math.abs(start.x - end.x) <= 0.001;
    const direction = horizontal ? Math.sign(end.x - start.x) : Math.sign(end.y - start.y);
    const marks = [...(marksBySegment.get(segmentIndex) ?? [])].sort((left, right) =>
      direction * (horizontal ? left.point.x - right.point.x : left.point.y - right.point.y)
        || left.id.localeCompare(right.id)
    );
    let valid = direction !== 0 && (horizontal || vertical);
    let previousExit = Number.NEGATIVE_INFINITY;
    for (const mark of marks) {
      const along = horizontal ? mark.point.x : mark.point.y;
      const startAlong = horizontal ? start.x : start.y;
      const endAlong = horizontal ? end.x : end.y;
      const entryAlong = along - direction * mark.halfSpan;
      const exitAlong = along + direction * mark.halfSpan;
      const directedEntry = direction * entryAlong;
      const directedExit = direction * exitAlong;
      valid = valid
        && mark.halfSpan > 0
        && mark.rise > 0
        && direction * (entryAlong - startAlong) > 0.001
        && direction * (endAlong - exitAlong) > 0.001
        && directedEntry > previousExit + 0.001;
      previousExit = directedExit;
    }
    if (!valid) {
      diagnostics.push(createBackendDiagnostic(
        "renderer.backend.invalid_edge_route",
        "Skipping edge because its continuity marks do not fit its route segments.",
        { targetId: edge.id }
      ));
      return undefined;
    }
    for (const mark of marks) {
      const entry = horizontal
        ? { x: mark.point.x - direction * mark.halfSpan, y: mark.point.y }
        : { x: mark.point.x, y: mark.point.y - direction * mark.halfSpan };
      const exit = horizontal
        ? { x: mark.point.x + direction * mark.halfSpan, y: mark.point.y }
        : { x: mark.point.x, y: mark.point.y + direction * mark.halfSpan };
      const control = horizontal
        ? { x: mark.point.x, y: mark.point.y + mark.normalDirection * mark.rise }
        : { x: mark.point.x + mark.normalDirection * mark.rise, y: mark.point.y };
      commands.push(
        `L ${formatNumber(entry.x)} ${formatNumber(entry.y)}`,
        `Q ${formatNumber(control.x)} ${formatNumber(control.y)} ${formatNumber(exit.x)} ${formatNumber(exit.y)}`
      );
    }
    commands.push(`L ${formatNumber(end.x)} ${formatNumber(end.y)}`);
  }
  return commands.join(" ");
}

function buildArrowMarkerDef(direction: keyof typeof EDGE_MARKER_IDS, arrowSize: number): string {
  const refX = direction === "end" ? formatNumber(arrowSize - 1) : "1";
  const path = direction === "end"
    ? `M 0 0 L ${formatNumber(arrowSize)} ${formatNumber(arrowSize / 2)} L 0 ${formatNumber(arrowSize)} z`
    : `M ${formatNumber(arrowSize)} 0 L 0 ${formatNumber(arrowSize / 2)} L ${formatNumber(arrowSize)} ${formatNumber(arrowSize)} z`;

  return [
    `<marker id="${EDGE_MARKER_IDS[direction]}" class="scene-marker" viewBox="0 0 ${formatNumber(arrowSize)} ${formatNumber(arrowSize)}" refX="${refX}" refY="${formatNumber(arrowSize / 2)}" markerWidth="${formatNumber(arrowSize)}" markerHeight="${formatNumber(arrowSize)}" markerUnits="userSpaceOnUse" orient="auto">`,
    `  <path class="scene-marker" d="${path}"/>`,
    "</marker>"
  ].join("\n");
}

function buildArrowMarkerDefs(theme: RendererTheme): string[] {
  // Resvg mis-orients auto-start-reverse in some PNG rasters, so we keep
  // separate start/end markers and mirror the start arrow geometry ourselves.
  return [
    buildArrowMarkerDef("end", theme.paint.arrowSize),
    buildArrowMarkerDef("start", theme.paint.arrowSize)
  ];
}

function resolveMarkerAttributes(edge: PositionedEdge): string {
  const attributes: string[] = [];
  if (edge.markers?.start === "arrow") {
    attributes.push(`marker-start="url(#${EDGE_MARKER_IDS.start})"`);
  }
  if (edge.markers?.end === "arrow") {
    attributes.push(`marker-end="url(#${EDGE_MARKER_IDS.end})"`);
  }

  return attributes.length > 0 ? ` ${attributes.join(" ")}` : "";
}

function renderEdge(edge: PositionedEdge, diagnostics: RendererDiagnostic[]): string | undefined {
  const path = buildRoutePath(edge, diagnostics);
  if (!path) {
    return undefined;
  }

  const classList = buildClassList(
    "scene-edge",
    `role-${sanitizeToken(edge.role)}`,
    `route-${sanitizeToken(edge.route.style)}`,
    `paint-${sanitizeToken(edge.paintGroup)}`,
    ...edge.classes.map((className) => sanitizeToken(className))
  );

  return [
    `<g id="scene-edge-${sanitizeToken(edge.id)}" class="${classList}" data-edge-id="${escapeXml(edge.id)}" data-role="${escapeXml(edge.role)}">`,
    `  <path class="scene-edge__path" d="${path}"${resolveMarkerAttributes(edge)}/>`,
    "</g>"
  ].join("\n");
}

function renderEdgeLabel(
  edge: PositionedEdge,
  label: PositionedEdgeLabel,
  diagnostics: RendererDiagnostic[],
  theme: RendererTheme
): string {
  const resolvedRole = resolveTextRoleForBlock("edge_label", label.textStyleRole);
  getTextStyleForBackend(theme, resolvedRole, edge.id, diagnostics);
  const labelTheme = getNodePrimitiveTheme(theme, "edge_label");
  const radius = getNodeRadius(theme, "edge_label");
  const classes = buildClassList(
    "scene-edge-label",
    `role-${sanitizeToken(edge.role)}`,
    ...edge.classes.map((className) => sanitizeToken(className))
  );
  const textMarkup = renderCenteredTextBlock(
    label.x + labelTheme.padding.left,
    label.y,
    label.height,
    label.lines,
    label.lineHeight,
    buildTextClassList(resolvedRole, "edge_label")
  );

  return [
    `<g class="${classes}" data-edge-id="${escapeXml(edge.id)}" data-role="${escapeXml(edge.role)}">`,
    `  <rect class="scene-edge-label__box" x="${formatNumber(label.x)}" y="${formatNumber(label.y)}" width="${formatNumber(label.width)}" height="${formatNumber(label.height)}" rx="${formatNumber(radius)}" ry="${formatNumber(radius)}"/>`,
    ...indentLines(textMarkup, 2),
    "</g>"
  ].join("\n");
}

function renderLineDecoration(decoration: Extract<PositionedDecoration, { kind: "line" }>): string {
  const classList = buildClassList(
    "scene-decoration",
    "scene-decoration-line",
    `paint-${sanitizeToken(decoration.paintGroup)}`,
    ...decoration.classes.map((className) => sanitizeToken(className))
  );

  return [
    `<g id="scene-decoration-${sanitizeToken(decoration.id)}" class="${classList}" data-decoration-id="${escapeXml(decoration.id)}">`,
    `  <line class="scene-decoration__line" x1="${formatNumber(decoration.from.x)}" y1="${formatNumber(decoration.from.y)}" x2="${formatNumber(decoration.to.x)}" y2="${formatNumber(decoration.to.y)}"/>`,
    "</g>"
  ].join("\n");
}

function renderTextDecoration(
  decoration: Extract<PositionedDecoration, { kind: "text" }>,
  diagnostics: RendererDiagnostic[],
  theme: RendererTheme
): string {
  const resolvedRole = resolveTextRoleForBlock("text", decoration.textStyleRole);
  const style = getTextStyleForBackend(theme, resolvedRole, decoration.id, diagnostics);
  const classList = buildClassList(
    "scene-decoration",
    "scene-decoration-text",
    `paint-${sanitizeToken(decoration.paintGroup)}`,
    ...decoration.classes.map((className) => sanitizeToken(className))
  );
  const textMarkup = renderTextBlock(
    decoration.x,
    decoration.y,
    [decoration.text],
    style,
    style.lineHeight,
    buildTextClassList(resolvedRole, "text")
  );

  return [
    `<g id="scene-decoration-${sanitizeToken(decoration.id)}" class="${classList}" data-decoration-id="${escapeXml(decoration.id)}">`,
    ...indentLines(textMarkup, 2),
    "</g>"
  ].join("\n");
}

function buildStyleLines(scene: PositionedScene, theme: RendererTheme): string[] {
  const { paint } = theme;
  const hasBoldEdges = scene.edges.some((edge) => edge.classes.some((className) => sanitizeToken(className) === "edge-bold"));
  const hasLineDecorations = scene.decorations.some((decoration) => decoration.kind === "line");
  const isServiceBlueprint = scene.viewId === "service_blueprint";
  const lines = [
    `.staged-svg { background: ${paint.canvasBackground}; }`,
    `.scene-container__chrome { fill: ${paint.palette.containerFill}; stroke: ${paint.palette.containerStroke}; stroke-width: ${formatNumber(paint.strokeWidth)}; }`,
    `.scene-container.primitive-root .scene-container__chrome { fill: ${paint.palette.canvas}; }`,
    `.scene-container__header-band { fill: ${paint.palette.headerBandFill}; stroke: ${paint.palette.containerStroke}; stroke-width: ${formatNumber(paint.strokeWidth)}; }`,
    `.scene-container.role-view_state .scene-container__chrome { fill: ${paint.palette.nodeFill}; }`,
    `.scene-container.role-view_state .scene-container__header-band { fill: ${paint.palette.nodeFill}; stroke: transparent; }`,
    `.scene-container.chrome-dashed .scene-container__chrome, .scene-container.chrome-dashed .scene-container__header-band, .scene-node.chrome-dashed .scene-node__chrome { stroke-dasharray: 8 6; }`,
    `.scene-container.chrome-dotted .scene-container__chrome, .scene-container.chrome-dotted .scene-container__header-band, .scene-node.chrome-dotted .scene-node__chrome { stroke-dasharray: 2 6; }`,
    `.scene-node__chrome { fill: ${paint.palette.nodeFill}; stroke: ${paint.palette.nodeStroke}; stroke-width: ${formatNumber(paint.strokeWidth)}; }`,
    `.scene-node.primitive-badge .scene-node__chrome { fill: ${paint.palette.badgeFill}; stroke: ${paint.palette.badgeStroke}; }`,
    `.scene-node.primitive-connector_port .scene-node__chrome { fill: ${paint.palette.connectorPortFill}; stroke: ${paint.palette.connectorPortStroke}; }`,
    `.scene-badge__chrome { fill: ${paint.palette.badgeFill}; stroke: ${paint.palette.badgeStroke}; stroke-width: ${formatNumber(paint.strokeWidth)}; }`,
    `.scene-edge__path { fill: none; stroke: ${paint.palette.edge}; stroke-width: ${formatNumber(paint.edgeStrokeWidth)}; }`,
    `.scene-edge.edge-dashed .scene-edge__path { stroke-dasharray: 8 6; }`,
    `.scene-edge.edge-dotted .scene-edge__path { stroke-dasharray: 2 6; }`,
    `.scene-edge-label__box { fill: ${paint.palette.edgeLabelFill}; stroke: ${paint.palette.edgeLabelStroke}; stroke-width: ${formatNumber(paint.strokeWidth)}; }`,
    `.scene-marker { fill: ${paint.palette.edge}; }`,
    `.scene-text { fill: ${paint.palette.text}; }`,
    `.scene-text.block-kind-metadata, .scene-text.block-region-secondary, .scene-text.text-role-subtitle, .scene-text.text-role-metadata { fill: ${paint.palette.secondaryText}; }`
  ];

  if (hasBoldEdges) {
    lines.push(`.scene-edge.edge-bold .scene-edge__path { stroke-width: ${formatNumber(paint.edgeStrokeWidth + 1)}; }`);
  }
  if (hasLineDecorations) {
    lines.push(`.scene-decoration__line { fill: none; stroke: ${paint.palette.containerStroke}; stroke-width: ${formatNumber(paint.strokeWidth)}; }`);
  }
  if (isServiceBlueprint) {
    lines.push(
      `.view-service_blueprint .service_blueprint_cell .scene-container__chrome, .view-service_blueprint .service_blueprint_cell .scene-container__header-band { display: none; }`,
      `.view-service_blueprint .service_blueprint_band_column .scene-container__chrome, .view-service_blueprint .service_blueprint_band_column .scene-container__header-band { fill: transparent; stroke: transparent; }`,
      `.view-service_blueprint .service_blueprint_separator .scene-decoration__line { stroke: ${paint.palette.containerStroke}; stroke-dasharray: 6 4; }`,
      `.view-service_blueprint .service_blueprint_lane_title .scene-text, .view-service_blueprint .service_blueprint_separator_title .scene-text { fill: ${paint.palette.secondaryText}; }`
    );
  }

  for (const role of Object.keys(theme.textStyles).sort()) {
    const style = theme.textStyles[role];
    lines.push(
      `.text-role-${sanitizeToken(role)} { font-family: '${theme.fontFamily}'; font-size: ${formatNumber(style.fontSize)}px; font-weight: ${style.fontWeight}; }`
    );
  }

  return lines;
}

async function buildDefs(scene: PositionedScene, theme: RendererTheme): Promise<string[]> {
  const fontFaceStyles = await buildEmbeddedFontFaceStyleElements(
    theme.fontFaces.map((face) => ({
      fontFamily: theme.fontFamily,
      fontAssetPath: face.svgFontAssetPath,
      fontStyle: face.fontStyle,
      fontWeight: face.fontWeight
    }))
  );
  return [
    ...fontFaceStyles,
    `<style><![CDATA[\n${buildStyleLines(scene, theme).join("\n")}\n]]></style>`,
    ...buildArrowMarkerDefs(theme)
  ];
}

export async function renderPositionedSceneToSvg(scene: PositionedScene): Promise<StagedSvgArtifact> {
  const resolvedTheme = resolveRendererTheme(scene.themeId, "backend");
  const theme = resolvedTheme.theme;
  const diagnostics: RendererDiagnostic[] = [...scene.diagnostics, ...resolvedTheme.diagnostics];
  const groups = buildPaintElementMap();

  if (scene.root.width <= 0 || scene.root.height <= 0) {
    diagnostics.push(createBackendDiagnostic(
      "renderer.backend.invalid_root_bounds",
      "Root bounds should be positive for SVG output. Falling back to a 1x1 viewport.",
      { targetId: scene.root.id }
    ));
  }

  collectPaintElements(scene.root, groups, diagnostics, theme, true);

  for (const edge of scene.edges) {
    const rendered = renderEdge(edge, diagnostics);
    if (rendered) {
      groups.edges.push(rendered);
    }
    if (edge.label) {
      groups.edge_labels.push(renderEdgeLabel(edge, edge.label, diagnostics, theme));
    }
  }

  for (const decoration of scene.decorations) {
    if (decoration.kind === "line") {
      groups[decoration.paintGroup].push(renderLineDecoration(decoration));
      continue;
    }

    groups[decoration.paintGroup].push(renderTextDecoration(decoration, diagnostics, theme));
  }

  const defs = await buildDefs(scene, theme);
  const viewWidth = scene.root.width > 0 ? scene.root.width : 1;
  const viewHeight = scene.root.height > 0 ? scene.root.height : 1;
  const svgClasses = buildClassList(
    "staged-svg",
    `view-${sanitizeToken(scene.viewId)}`,
    `detail-${sanitizeToken(scene.detailId)}`,
    `theme-${sanitizeToken(theme.id)}`,
    `theme-revision-${sanitizeToken(theme.revision)}`
  );

  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(viewWidth)}" height="${formatNumber(viewHeight)}" viewBox="${formatNumber(scene.root.x)} ${formatNumber(scene.root.y)} ${formatNumber(viewWidth)} ${formatNumber(viewHeight)}" class="${svgClasses}" data-view-id="${escapeXml(scene.viewId)}" data-detail-id="${escapeXml(scene.detailId)}" data-theme-id="${escapeXml(theme.id)}">`,
    "  <defs>",
    ...defs.flatMap((entry) => indentLines(entry, 4)),
    "  </defs>"
  ];

  for (const paintGroup of scene.paintOrder) {
    lines.push(`  <g class="paint-layer paint-${sanitizeToken(paintGroup)}" data-paint-group="${paintGroup}">`);
    for (const markup of groups[paintGroup]) {
      lines.push(...indentLines(markup, 4));
    }
    lines.push("  </g>");
  }

  lines.push("</svg>");

  return {
    svg: lines.join("\n"),
    diagnostics: sortRendererDiagnostics(diagnostics)
  };
}

export async function renderPositionedSceneToPng(
  scene: PositionedScene,
  options: StagedSvgRasterizationOptions = {}
): Promise<StagedPngArtifact> {
  const rendered = await renderPositionedSceneToSvg(scene);
  const theme = resolveRendererTheme(scene.themeId, "backend").theme;
  const png = await renderSvgToPng(rendered.svg, {
    dpi: options.dpi ?? theme.dpi,
    fontFamily: theme.fontFamily,
    pngFontAssetPaths: theme.fontFaces.map((face) => face.pngFontAssetPath)
  });

  return {
    ...rendered,
    png
  };
}
