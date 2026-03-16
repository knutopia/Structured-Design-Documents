import type {
  ChromeSpec,
  ContentBlock,
  ContentRegion,
  EdgeLabelSpec,
  MeasuredContainer,
  MeasuredContentBlock,
  MeasuredEdge,
  MeasuredEdgeLabel,
  MeasuredItem,
  MeasuredNode,
  MeasuredPort,
  MeasuredScene,
  OverflowPolicy,
  PortSpec,
  RendererScene,
  SceneContainer,
  SceneEdge,
  SceneItem,
  SceneNode,
  WidthBand,
  WidthPolicy
} from "./contracts.js";
import type { RendererDiagnostic } from "./diagnostics.js";
import { sortRendererDiagnostics } from "./diagnostics.js";
import {
  getContainerPrimitiveTheme,
  getNodePrimitiveTheme,
  isMovableSecondaryBlock,
  resolveTextRoleForBlock,
  validatePrimitiveContent
} from "./primitives.js";
import { createTextMeasurementService, type TextMeasurementService } from "./textMeasurement.js";
import { resolveRendererTheme, WIDTH_BAND_ORDER, type RendererTheme, type TextStyleToken } from "./theme.js";

const ELLIPSIS = "...";

type SegmenterLike = {
  segment(text: string): Iterable<{ segment: string }>;
};

interface MeasureContext {
  theme: RendererTheme;
  measureText: TextMeasurementService;
  diagnostics: RendererDiagnostic[];
}

interface WrappedTextResult {
  lines: string[];
  lineWidths: number[];
  width: number;
  lineHeight: number;
}

interface NodeLayoutResult {
  blocks: MeasuredContentBlock[];
  width: number;
  height: number;
  widthBand: WidthBand;
}

interface ContainerHeaderLayoutResult {
  blocks: MeasuredContentBlock[];
  width: number;
  height: number;
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
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

function createMeasuredPort(port: PortSpec, x: number, y: number): MeasuredPort {
  return {
    id: port.id,
    role: port.role,
    side: port.side,
    offset: port.offset,
    offsetPolicy: port.offsetPolicy,
    x: roundMetric(x),
    y: roundMetric(y)
  };
}

function getTextStyle(
  context: MeasureContext,
  nodeId: string,
  role: string
): TextStyleToken {
  const style = context.theme.textStyles[role];
  if (style) {
    return style;
  }

  context.diagnostics.push({
    phase: "measure",
    code: "renderer.measure.unknown_text_style",
    severity: "warn",
    message: `Unknown text style role "${role}". Falling back to "label".`,
    targetId: nodeId
  });
  return context.theme.textStyles.label;
}

function getGraphemeSegments(text: string): string[] {
  const segmenterCtor = (Intl as typeof Intl & { Segmenter?: new (
    locales?: string | string[],
    options?: { granularity: string }
  ) => SegmenterLike }).Segmenter;

  if (segmenterCtor) {
    const segmenter = new segmenterCtor(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (entry) => entry.segment);
  }

  return Array.from(text);
}

function breakLongToken(
  token: string,
  maxWidth: number,
  style: TextStyleToken,
  measurement: TextMeasurementService
): string[] {
  if (token.length === 0) {
    return [""];
  }

  const segments = getGraphemeSegments(token);
  const lines: string[] = [];
  let current = "";

  for (const segment of segments) {
    const next = `${current}${segment}`;
    if (current.length > 0 && measurement.measureText(next, style) > maxWidth) {
      lines.push(current);
      current = segment;
      continue;
    }

    current = next;
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [token];
}

function wrapParagraph(
  paragraph: string,
  maxWidth: number,
  style: TextStyleToken,
  measurement: TextMeasurementService
): string[] {
  if (paragraph.length === 0) {
    return [""];
  }

  const words = paragraph.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length === 0) {
      continue;
    }

    if (current.length === 0) {
      if (measurement.measureText(word, style) <= maxWidth) {
        current = word;
        continue;
      }

      lines.push(...breakLongToken(word, maxWidth, style, measurement));
      continue;
    }

    const candidate = `${current} ${word}`;
    if (measurement.measureText(candidate, style) <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current);
    if (measurement.measureText(word, style) <= maxWidth) {
      current = word;
      continue;
    }

    lines.push(...breakLongToken(word, maxWidth, style, measurement));
    current = "";
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function wrapTextBlock(
  text: string,
  maxWidth: number,
  style: TextStyleToken,
  measurement: TextMeasurementService
): WrappedTextResult {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines = paragraphs.flatMap((paragraph) => wrapParagraph(paragraph, maxWidth, style, measurement));
  const lineWidths = lines.map((line) => roundMetric(measurement.measureText(line, style)));
  const width = lineWidths.length > 0 ? Math.max(...lineWidths) : 0;

  return {
    lines,
    lineWidths,
    width,
    lineHeight: style.lineHeight
  };
}

function truncateLineToFit(
  text: string,
  maxWidth: number,
  style: TextStyleToken,
  measurement: TextMeasurementService
): string {
  const ellipsisWidth = measurement.measureText(ELLIPSIS, style);
  if (ellipsisWidth >= maxWidth) {
    return ELLIPSIS;
  }

  const segments = getGraphemeSegments(text);
  let current = "";

  for (const segment of segments) {
    const candidate = `${current}${segment}`;
    if (measurement.measureText(`${candidate}${ELLIPSIS}`, style) > maxWidth) {
      break;
    }
    current = candidate;
  }

  return `${current}${ELLIPSIS}`;
}

function clampWrappedText(
  wrapped: WrappedTextResult,
  maxLines: number,
  maxWidth: number,
  style: TextStyleToken,
  measurement: TextMeasurementService
): WrappedTextResult {
  if (wrapped.lines.length <= maxLines) {
    return wrapped;
  }

  const kept = wrapped.lines.slice(0, Math.max(maxLines - 1, 0));
  const tailSource = wrapped.lines.slice(Math.max(maxLines - 1, 0)).join(" ");
  const finalLine = truncateLineToFit(tailSource, maxWidth, style, measurement);
  const lines = [...kept, finalLine];
  const lineWidths = lines.map((line) => roundMetric(measurement.measureText(line, style)));

  return {
    lines,
    lineWidths,
    width: lineWidths.length > 0 ? Math.max(...lineWidths) : 0,
    lineHeight: wrapped.lineHeight
  };
}

function createMeasuredBlock(
  block: ContentBlock,
  region: ContentRegion,
  wrapped: WrappedTextResult,
  availableWidth: number,
  badgePadding?: ChromeSpec["padding"]
): MeasuredContentBlock {
  const blockWidth = badgePadding
    ? roundMetric(Math.min(availableWidth, wrapped.width + badgePadding.left + badgePadding.right))
    : wrapped.width;
  const blockHeight = badgePadding
    ? roundMetric(wrapped.lines.length * wrapped.lineHeight + badgePadding.top + badgePadding.bottom)
    : roundMetric(wrapped.lines.length * wrapped.lineHeight);

  return {
    id: block.id,
    kind: block.kind,
    textStyleRole: block.textStyleRole,
    lines: [...wrapped.lines],
    x: 0,
    y: 0,
    width: blockWidth,
    height: blockHeight,
    lineHeight: wrapped.lineHeight,
    region,
    priority: block.priority
  };
}

function positionMeasuredBlocks(
  blocks: MeasuredContentBlock[],
  primitivePadding: ChromeSpec["padding"],
  blockGap: number,
  secondaryGap: number,
  minHeight: number,
  width: number
): NodeLayoutResult {
  const primaryBlocks = blocks.filter((block) => block.region === "primary");
  const secondaryBlocks = blocks.filter((block) => block.region === "secondary");
  const x = primitivePadding.left;
  let y = primitivePadding.top;

  for (const block of primaryBlocks) {
    block.x = x;
    block.y = roundMetric(y);
    y += block.height + blockGap;
  }

  if (primaryBlocks.length > 0) {
    y -= blockGap;
  }

  if (secondaryBlocks.length > 0) {
    y += primaryBlocks.length > 0 ? secondaryGap : 0;
    for (const block of secondaryBlocks) {
      block.x = x;
      block.y = roundMetric(y);
      y += block.height + blockGap;
    }
    y -= blockGap;
  }

  const contentHeight = primaryBlocks.length === 0 && secondaryBlocks.length === 0 ? 0 : y - primitivePadding.top;
  const height = roundMetric(Math.max(minHeight, primitivePadding.top + contentHeight + primitivePadding.bottom));

  return {
    blocks,
    width,
    height,
    widthBand: "narrow"
  };
}

function measureContainerHeaderContent(
  context: MeasureContext,
  container: SceneContainer,
  chrome: ChromeSpec
): ContainerHeaderLayoutResult {
  const headerContent = container.headerContent ?? [];
  if (headerContent.length === 0) {
    return {
      blocks: [],
      width: 0,
      height: 0
    };
  }

  context.diagnostics.push(...validatePrimitiveContent(container.id, "header", headerContent, context.theme));
  const headerTheme = getNodePrimitiveTheme(context.theme, "header");
  const headerPadding = {
    top: headerTheme.padding.top,
    right: chrome.padding.right,
    bottom: headerTheme.padding.bottom,
    left: chrome.padding.left
  };
  const measuredBlocks = headerContent
    .filter((block) => headerTheme.textRule.allowedKinds.includes(block.kind))
    .slice(0, headerTheme.textRule.maxBlocks ?? Number.POSITIVE_INFINITY)
    .map((block) => {
      const resolvedRole = resolveTextRoleForBlock(block.kind, block.textStyleRole);
      const style = getTextStyle(context, container.id, resolvedRole);
      const wrapped = wrapTextBlock(block.text, Number.MAX_SAFE_INTEGER, style, context.measureText);
      const badgePadding = block.kind === "badge_text" ? headerTheme.badgePadding : undefined;
      return createMeasuredBlock(block, "primary", wrapped, Number.MAX_SAFE_INTEGER, badgePadding);
    });
  const contentWidth = measuredBlocks.length > 0 ? Math.max(...measuredBlocks.map((block) => block.width)) : 0;
  const layoutWidth = roundMetric(headerPadding.left + contentWidth + headerPadding.right);
  const positioned = positionMeasuredBlocks(
    measuredBlocks,
    headerPadding,
    headerTheme.blockGap,
    headerTheme.secondaryGap,
    headerTheme.minHeight,
    layoutWidth
  );

  return {
    blocks: positioned.blocks,
    width: layoutWidth,
    height: positioned.height
  };
}

function exceedsPrimaryMaxLines(blocks: MeasuredContentBlock[], maxLines: number): boolean {
  return blocks.some((block) => block.region === "primary" && block.lines.length > maxLines);
}

function buildCandidateBands(widthPolicy: WidthPolicy, diagnostics: RendererDiagnostic[], targetId: string): WidthBand[] {
  const deduped = Array.from(new Set(widthPolicy.allowed));
  const validAllowed = deduped.filter((band): band is WidthBand => WIDTH_BAND_ORDER.includes(band));
  if (!validAllowed.includes(widthPolicy.preferred)) {
    validAllowed.push(widthPolicy.preferred);
    diagnostics.push({
      phase: "measure",
      code: "renderer.measure.preferred_width_band_missing",
      severity: "warn",
      message: `Preferred width band "${widthPolicy.preferred}" was not listed in allowed width bands. It has been injected for deterministic measurement.`,
      targetId
    });
  }

  validAllowed.sort((left, right) => WIDTH_BAND_ORDER.indexOf(left) - WIDTH_BAND_ORDER.indexOf(right));
  const preferredIndex = WIDTH_BAND_ORDER.indexOf(widthPolicy.preferred);
  const bands = validAllowed.filter((band) => WIDTH_BAND_ORDER.indexOf(band) >= preferredIndex);

  return bands.length > 0 ? bands : [widthPolicy.preferred];
}

function measureNodeContentAtBand(
  context: MeasureContext,
  node: SceneNode,
  widthBand: WidthBand,
  secondaryBlockIds: Set<string>
): NodeLayoutResult {
  const primitiveTheme = getNodePrimitiveTheme(context.theme, node.primitive);
  const usableBlocks = node.content
    .filter((block) => primitiveTheme.textRule.allowedKinds.includes(block.kind))
    .slice(0, primitiveTheme.textRule.maxBlocks ?? Number.POSITIVE_INFINITY);
  const width = context.theme.widthBands[widthBand];
  const availableWidth = Math.max(width - primitiveTheme.padding.left - primitiveTheme.padding.right, 1);
  const measuredBlocks = usableBlocks.map((block) => {
    const region: ContentRegion = secondaryBlockIds.has(block.id) ? "secondary" : "primary";
    const resolvedRole = resolveTextRoleForBlock(block.kind, block.textStyleRole);
    const style = getTextStyle(context, node.id, resolvedRole);
    const badgePadding = block.kind === "badge_text" && primitiveTheme.badgePadding
      ? primitiveTheme.badgePadding
      : undefined;
    const textWidth = badgePadding
      ? Math.max(availableWidth - badgePadding.left - badgePadding.right, 1)
      : availableWidth;
    const wrapped = wrapTextBlock(block.text, textWidth, style, context.measureText);

    return createMeasuredBlock(block, region, wrapped, availableWidth, badgePadding);
  });
  const positioned = positionMeasuredBlocks(
    measuredBlocks,
    primitiveTheme.padding,
    primitiveTheme.blockGap,
    primitiveTheme.secondaryGap,
    primitiveTheme.minHeight,
    width
  );

  return {
    ...positioned,
    widthBand
  };
}

function createOverflowDiagnostic(
  code: string,
  message: string,
  targetId: string,
  severity: "warn" | "info" = "warn"
): RendererDiagnostic {
  return {
    phase: "measure",
    code,
    severity,
    message,
    targetId
  };
}

function addConfiguredFallbackDiagnostic(
  context: MeasureContext,
  nodeId: string,
  policyKind: OverflowPolicy["kind"]
): void {
  context.diagnostics.push(
    createOverflowDiagnostic(
      "renderer.measure.missing_max_lines",
      `Overflow policy "${policyKind}" requires maxLines. Falling back to grow_height for this node.`,
      nodeId
    )
  );
}

function applyNodeOverflowPolicy(
  context: MeasureContext,
  node: SceneNode,
  candidateBands: WidthBand[]
): { layout: NodeLayoutResult; overflowStatus: MeasuredNode["overflow"] } {
  const preferredBand = candidateBands[0];

  if (node.overflowPolicy.kind === "grow_height") {
    return {
      layout: measureNodeContentAtBand(context, node, preferredBand, new Set()),
      overflowStatus: {
        status: "fits"
      }
    };
  }

  if (typeof node.overflowPolicy.maxLines !== "number" || node.overflowPolicy.maxLines < 1) {
    addConfiguredFallbackDiagnostic(context, node.id, node.overflowPolicy.kind);
    return {
      layout: measureNodeContentAtBand(context, node, preferredBand, new Set()),
      overflowStatus: {
        status: "fits",
        detail: "Fell back to grow_height because maxLines was missing."
      }
    };
  }

  const { maxLines } = node.overflowPolicy;

  switch (node.overflowPolicy.kind) {
    case "escalate_width_band": {
      let lastLayout = measureNodeContentAtBand(context, node, preferredBand, new Set());
      for (const widthBand of candidateBands) {
        const layout = measureNodeContentAtBand(context, node, widthBand, new Set());
        lastLayout = layout;
        if (!exceedsPrimaryMaxLines(layout.blocks, maxLines)) {
          return {
            layout,
            overflowStatus: {
              status: widthBand === preferredBand ? "fits" : "escalated_width_band"
            }
          };
        }
      }

      context.diagnostics.push(
        createOverflowDiagnostic(
          "renderer.measure.width_band_exhausted",
          `Node exceeded maxLines=${maxLines} at every allowed width band. Falling back to grow_height at "${lastLayout.widthBand}".`,
          node.id
        )
      );

      return {
        layout: lastLayout,
        overflowStatus: {
          status: "overflowed",
          detail: `Exceeded maxLines=${maxLines} at all allowed width bands.`
        }
      };
    }
    case "clamp_with_ellipsis": {
      const layout = measureNodeContentAtBand(context, node, preferredBand, new Set());
      if (!exceedsPrimaryMaxLines(layout.blocks, maxLines)) {
        return {
          layout,
          overflowStatus: {
            status: "fits"
          }
        };
      }

      const clampedBlocks = layout.blocks.map((block) => {
        if (block.region !== "primary" || block.lines.length <= maxLines) {
          return block;
        }

        const resolvedRole = resolveTextRoleForBlock(block.kind, block.textStyleRole);
        const style = getTextStyle(context, node.id, resolvedRole);
        const primitiveTheme = getNodePrimitiveTheme(context.theme, node.primitive);
        const badgePadding = block.kind === "badge_text" && primitiveTheme.badgePadding
          ? primitiveTheme.badgePadding
          : undefined;
        const textWidth = badgePadding
          ? Math.max(layout.width - primitiveTheme.padding.left - primitiveTheme.padding.right - badgePadding.left - badgePadding.right, 1)
          : Math.max(layout.width - primitiveTheme.padding.left - primitiveTheme.padding.right, 1);
        const clamped = clampWrappedText(
          {
            lines: block.lines,
            lineWidths: block.lines.map((line) => context.measureText.measureText(line, style)),
            width: block.width,
            lineHeight: block.lineHeight
          },
          maxLines,
          textWidth,
          style,
          context.measureText
        );

        return {
          ...block,
          lines: clamped.lines,
          width: roundMetric(
            badgePadding
              ? Math.min(
                  layout.width - primitiveTheme.padding.left - primitiveTheme.padding.right,
                  clamped.width + badgePadding.left + badgePadding.right
                )
              : clamped.width
          ),
          height: roundMetric(
            badgePadding
              ? clamped.lines.length * clamped.lineHeight + badgePadding.top + badgePadding.bottom
              : clamped.lines.length * clamped.lineHeight
          ),
          wasClamped: true
        };
      });
      const positioned = positionMeasuredBlocks(
        clampedBlocks,
        getNodePrimitiveTheme(context.theme, node.primitive).padding,
        getNodePrimitiveTheme(context.theme, node.primitive).blockGap,
        getNodePrimitiveTheme(context.theme, node.primitive).secondaryGap,
        getNodePrimitiveTheme(context.theme, node.primitive).minHeight,
        layout.width
      );

      context.diagnostics.push(
        createOverflowDiagnostic(
          "renderer.measure.text_clamped",
          `Node text was clamped to maxLines=${maxLines} with ellipsis.`,
          node.id
        )
      );

      return {
        layout: {
          ...positioned,
          widthBand: preferredBand
        },
        overflowStatus: {
          status: "clamped",
          detail: `Clamped primary text to maxLines=${maxLines}.`
        }
      };
    }
    case "secondary_area": {
      const initialLayout = measureNodeContentAtBand(context, node, preferredBand, new Set());
      if (!exceedsPrimaryMaxLines(initialLayout.blocks, maxLines)) {
        return {
          layout: initialLayout,
          overflowStatus: {
            status: "fits"
          }
        };
      }

      const secondaryIds = new Set(
        node.content
          .filter((block) => isMovableSecondaryBlock(getNodePrimitiveTheme(context.theme, node.primitive), block))
          .map((block) => block.id)
      );
      if (secondaryIds.size > 0) {
        const movedLayout = measureNodeContentAtBand(context, node, preferredBand, secondaryIds);
        if (!exceedsPrimaryMaxLines(movedLayout.blocks, maxLines)) {
          return {
            layout: movedLayout,
            overflowStatus: {
              status: "fits",
              detail: "Moved secondary blocks into a secondary region."
            }
          };
        }
      }

      context.diagnostics.push(
        createOverflowDiagnostic(
          "renderer.measure.secondary_area_exhausted",
          `Node still exceeded maxLines=${maxLines} after moving secondary blocks. Falling back to grow_height.`,
          node.id
        )
      );

      return {
        layout: initialLayout,
        overflowStatus: {
          status: "overflowed",
          detail: `Exceeded maxLines=${maxLines} even after moving secondary blocks.`
        }
      };
    }
    case "diagnostic": {
      const layout = measureNodeContentAtBand(context, node, preferredBand, new Set());
      if (exceedsPrimaryMaxLines(layout.blocks, maxLines)) {
        context.diagnostics.push(
          createOverflowDiagnostic(
            "renderer.measure.overflow_diagnostic",
            `Node exceeded maxLines=${maxLines} at preferred width band "${preferredBand}".`,
            node.id
          )
        );
        return {
          layout,
          overflowStatus: {
            status: "overflowed",
            detail: `Exceeded maxLines=${maxLines} without clamping.`
          }
        };
      }

      return {
        layout,
        overflowStatus: {
          status: "fits"
        }
      };
    }
  }
}

function measureNodePorts(
  node: SceneNode,
  width: number,
  height: number,
  portInset: number
): MeasuredPort[] {
  return node.ports.map((port) => {
    switch (port.side) {
      case "north":
        return createMeasuredPort(
          port,
          port.offset ?? roundMetric(width / 2),
          0
        );
      case "south":
        return createMeasuredPort(
          port,
          port.offset ?? roundMetric(width / 2),
          height
        );
      case "east":
        return createMeasuredPort(
          port,
          width,
          port.offset ?? roundMetric(Math.max(portInset, height / 2))
        );
      case "west":
        return createMeasuredPort(
          port,
          0,
          port.offset ?? roundMetric(Math.max(portInset, height / 2))
        );
    }
  });
}

function measureNode(item: SceneNode, context: MeasureContext): MeasuredNode {
  context.diagnostics.push(...validatePrimitiveContent(item.id, item.primitive, item.content, context.theme));
  const candidateBands = buildCandidateBands(item.widthPolicy, context.diagnostics, item.id);
  const { layout, overflowStatus } = applyNodeOverflowPolicy(context, item, candidateBands);
  const primitiveTheme = getNodePrimitiveTheme(context.theme, item.primitive);

  return {
    kind: "node",
    id: item.id,
    role: item.role,
    primitive: item.primitive,
    classes: [...item.classes],
    widthPolicy: cloneWidthPolicy(item.widthPolicy),
    widthBand: layout.widthBand,
    overflowPolicy: cloneOverflowPolicy(item.overflowPolicy),
    content: layout.blocks,
    ports: measureNodePorts(item, layout.width, layout.height, primitiveTheme.portInset),
    overflow: overflowStatus,
    width: layout.width,
    height: layout.height
  };
}

function measureContainerPorts(
  context: MeasureContext,
  container: SceneContainer
): MeasuredPort[] {
  if (container.ports.length > 0) {
    context.diagnostics.push(
      createOverflowDiagnostic(
        "renderer.measure.container_ports_deferred",
        `Container port offsets remain deferred until macro-layout reserves container bounds.`,
        container.id,
        "info"
      )
    );
  }

  return container.ports.map((port) => createMeasuredPort(port, 0, 0));
}

function measureItem(item: SceneItem, context: MeasureContext): MeasuredItem {
  if (item.kind === "container") {
    return measureContainer(item, context);
  }

  return measureNode(item, context);
}

function measureContainer(container: SceneContainer, context: MeasureContext): MeasuredContainer {
  const containerTheme = getContainerPrimitiveTheme(context.theme, container.primitive);
  const children = container.children.map((child) => measureItem(child, context));
  const chrome = cloneChromeSpec(container.chrome);

  if (chrome.gutter === undefined) {
    chrome.gutter = containerTheme.defaultGutter;
  }

  if (chrome.headerBandHeight === undefined) {
    chrome.headerBandHeight = containerTheme.defaultHeaderBandHeight;
  }

  const headerLayout = measureContainerHeaderContent(context, container, chrome);
  chrome.headerBandHeight = Math.max(chrome.headerBandHeight ?? 0, headerLayout.height);

  return {
    kind: "container",
    id: container.id,
    role: container.role,
    primitive: container.primitive,
    classes: [...container.classes],
    layout: { ...container.layout },
    chrome,
    headerContent: headerLayout.blocks,
    children,
    ports: measureContainerPorts(context, container),
    width: 0,
    height: 0
  };
}

function measureEdgeLabel(
  label: EdgeLabelSpec,
  context: MeasureContext,
  targetId: string
): MeasuredEdgeLabel {
  const resolvedRole = resolveTextRoleForBlock("edge_label", label.textStyleRole);
  const style = getTextStyle(context, targetId, resolvedRole);
  const wrapped = wrapTextBlock(label.text, context.theme.edgeLabelMaxWidth, style, context.measureText);
  const primitiveTheme = getNodePrimitiveTheme(context.theme, "edge_label");

  return {
    lines: wrapped.lines,
    width: roundMetric(wrapped.width + primitiveTheme.padding.left + primitiveTheme.padding.right),
    height: roundMetric(
      wrapped.lines.length * wrapped.lineHeight + primitiveTheme.padding.top + primitiveTheme.padding.bottom
    ),
    lineHeight: wrapped.lineHeight,
    textStyleRole: label.textStyleRole
  };
}

function measureEdge(edge: SceneEdge, context: MeasureContext): MeasuredEdge {
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
    routing: {
      ...edge.routing
    },
    label: edge.label ? measureEdgeLabel(edge.label, context, edge.id) : undefined,
    markers: edge.markers ? { ...edge.markers } : undefined
  };
}

export function measureRendererScene(scene: RendererScene): MeasuredScene {
  const resolvedTheme = resolveRendererTheme(scene.themeId);
  const context: MeasureContext = {
    theme: resolvedTheme.theme,
    measureText: createTextMeasurementService(resolvedTheme.theme.fontAssets.measurement),
    diagnostics: [...scene.diagnostics, ...resolvedTheme.diagnostics]
  };

  const measuredScene: MeasuredScene = {
    viewId: scene.viewId,
    profileId: scene.profileId,
    themeId: resolvedTheme.theme.id,
    root: measureContainer(scene.root, context),
    edges: scene.edges.map((edge) => measureEdge(edge, context)),
    diagnostics: []
  };

  measuredScene.diagnostics = sortRendererDiagnostics(context.diagnostics);
  return measuredScene;
}
