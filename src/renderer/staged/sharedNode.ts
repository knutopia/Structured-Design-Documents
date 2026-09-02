import type {
  ContentRegion,
  MeasuredContentBlock,
  MeasuredSharedNodeAttributeGroup,
  MeasuredSharedNodeLayout,
  SceneNode,
  SharedNodeAttribute
} from "./contracts.js";
import { createMeasureDiagnostic, type RendererDiagnostic } from "./diagnostics.js";
import type { RendererTheme, TextStyleToken } from "./theme.js";

export interface WrappedSharedNodeText {
  lines: string[];
  width: number;
  lineHeight: number;
}

export interface SharedNodeMeasurementResult {
  layout: MeasuredSharedNodeLayout;
  blocks: MeasuredContentBlock[];
  width: number;
  height: number;
}

interface NormalizedAttributeGroup {
  id: string;
  label: string;
  values: string[];
}

interface MeasureSharedNodeOptions {
  node: SceneNode & { sharedNode: NonNullable<SceneNode["sharedNode"]> };
  theme: RendererTheme;
  diagnostics: RendererDiagnostic[];
  getTextStyle: (role: string) => TextStyleToken;
  wrapText: (text: string, maxWidth: number, style: TextStyleToken) => WrappedSharedNodeText;
}

const ATTRIBUTE_LABEL_MINOR_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or",
  "per", "the", "to", "via", "vs"
]);

function isProtectedCase(word: string): boolean {
  const letters = word.replace(/[^A-Za-z]/g, "");
  if (letters.length < 2) return false;
  if (letters === letters.toUpperCase()) return true;
  return /[A-Z]/.test(letters.slice(1)) && /[a-z]/.test(letters);
}

function titleCaseLexicalPart(part: string, isFirstWord: boolean): string {
  const match = part.match(/^([^A-Za-z]*)(.*?)([^A-Za-z]*)$/);
  if (!match || !match[2]) return part;
  const [, prefix, lexical, suffix] = match;
  if (isProtectedCase(lexical)) return `${prefix}${lexical}${suffix}`;

  const lowercase = lexical.toLowerCase();
  const formatted = !isFirstWord && ATTRIBUTE_LABEL_MINOR_WORDS.has(lowercase)
    ? lowercase
    : lowercase.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());
  return `${prefix}${formatted}${suffix}`;
}

export function titleCaseSharedNodeAttributeLabel(label: string): string {
  let lexicalWordIndex = 0;
  return label.trim().replace(/\S+/g, (word) => {
    const formatted = word.split(/(-)/).map((part) => {
      if (part === "-") return part;
      const isFirstWord = lexicalWordIndex === 0;
      if (/[A-Za-z]/.test(part)) lexicalWordIndex += 1;
      return titleCaseLexicalPart(part, isFirstWord);
    }).join("");
    return formatted;
  });
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function measuredTextBlock(
  id: string,
  textStyleRole: string,
  wrapped: WrappedSharedNodeText,
  region: ContentRegion = "primary"
): MeasuredContentBlock {
  return {
    id,
    kind: "text",
    textStyleRole,
    lines: [...wrapped.lines],
    x: 0,
    y: 0,
    width: wrapped.width,
    height: roundMetric(wrapped.lines.length * wrapped.lineHeight),
    lineHeight: wrapped.lineHeight,
    region
  };
}

export function normalizeSharedNodeAttributes(
  nodeId: string,
  attributes: readonly SharedNodeAttribute[],
  diagnostics: RendererDiagnostic[]
): NormalizedAttributeGroup[] {
  const groups: NormalizedAttributeGroup[] = [];
  const groupById = new Map<string, NormalizedAttributeGroup>();

  attributes.forEach((attribute, index) => {
    const groupId = attribute.groupId.trim();
    const label = titleCaseSharedNodeAttributeLabel(attribute.label);
    const value = attribute.value.trim();
    if (!groupId || !label || !value) {
      diagnostics.push(createMeasureDiagnostic(
        "renderer.measure.shared_node_invalid_attribute",
        "Shared-node attributes require a non-empty groupId, label, and value. The incomplete attribute was omitted.",
        { targetId: nodeId, details: `attributeIndex=${index}` }
      ));
      return;
    }

    const existing = groupById.get(groupId);
    if (existing) {
      if (existing.label !== label) {
        diagnostics.push(createMeasureDiagnostic(
          "renderer.measure.shared_node_attribute_label_mismatch",
          `Attribute group "${groupId}" used more than one label. Keeping "${existing.label}" from its first occurrence.`,
          { targetId: nodeId }
        ));
      }
      existing.values.push(value);
      return;
    }

    const group = { id: groupId, label, values: [value] };
    groupById.set(groupId, group);
    groups.push(group);
  });

  return groups;
}

function measureDecorator(
  options: MeasureSharedNodeOptions,
  availableWidth: number,
  xOrigin: number,
  yOrigin: number,
  width: number
): MeasuredSharedNodeLayout["decorator"] {
  const { node, theme, diagnostics, getTextStyle, wrapText } = options;
  const { decoratorMode } = node.sharedNode;
  const requestedItems: Array<{ kind: "type" | "id"; value: string | undefined }> = [];
  if (decoratorMode.showNodeType) requestedItems.push({ kind: "type", value: node.sharedNode.nodeType });
  if (decoratorMode.showNodeId) requestedItems.push({ kind: "id", value: node.sharedNode.nodeId });
  if (requestedItems.length === 0) return undefined;

  const styleRole = theme.sharedNode.decorator.textStyleRole;
  const style = getTextStyle(styleRole);
  const items: MeasuredContentBlock[] = [];
  let x = roundMetric(xOrigin + theme.sharedNode.decorator.padding.left);

  requestedItems.forEach((item, index) => {
    const value = item.value?.trim();
    if (!value) {
      diagnostics.push(createMeasureDiagnostic(
        "renderer.measure.shared_node_missing_decorator_data",
        `Decorator mode "${decoratorMode.id}" requires a node ${item.kind}, but none was supplied.`,
        { targetId: node.id }
      ));
      return;
    }

    const block = measuredTextBlock(
      `${node.id}__decorator_${item.kind}`,
      styleRole,
      wrapText(value, Number.MAX_SAFE_INTEGER, style)
    );
    block.x = x;
    block.y = yOrigin;
    block.height = theme.sharedNode.decorator.height;
    items.push(block);
    x = roundMetric(x + block.width + theme.sharedNode.decorator.gap);
  });

  const maxRight = xOrigin + theme.sharedNode.decorator.padding.left + availableWidth;
  if (items.some((item) => item.x + item.width > maxRight)) {
    diagnostics.push(createMeasureDiagnostic(
      "renderer.measure.shared_node_decorator_overflow",
      "Shared-node decorator content exceeds the available header width.",
      { targetId: node.id }
    ));
  }

  return {
    x: xOrigin,
    y: yOrigin,
    width,
    height: theme.sharedNode.decorator.height,
    items
  };
}

export function measureSharedNode(options: MeasureSharedNodeOptions): SharedNodeMeasurementResult {
  const { node, theme, diagnostics, getTextStyle, wrapText } = options;
  const nodeTheme = theme.sharedNode;
  const strokeInset = nodeTheme.strokeWidth;
  const containerContentX = roundMetric(strokeInset + nodeTheme.container.padding.left);
  const containerContentY = roundMetric(strokeInset + nodeTheme.container.padding.top);
  const bodyWidth = roundMetric(
    nodeTheme.width
    - 2 * strokeInset
    - nodeTheme.container.padding.left
    - nodeTheme.container.padding.right
  );
  const contentWidth = Math.max(
    roundMetric(bodyWidth - nodeTheme.body.padding.left - nodeTheme.body.padding.right),
    1
  );
  const decoratorAvailableWidth = Math.max(
    bodyWidth - nodeTheme.decorator.padding.left - nodeTheme.decorator.padding.right,
    1
  );
  const decorator = measureDecorator(
    options,
    decoratorAvailableWidth,
    containerContentX,
    containerContentY,
    bodyWidth
  );
  const bodyY = roundMetric(
    containerContentY
    + (decorator?.height ?? 0)
    + (decorator ? nodeTheme.container.gap : 0)
  );
  const titleRole = nodeTheme.titleTextStyleRole;
  const titleStyle = getTextStyle(titleRole);
  const titleText = node.sharedNode.title.trim();
  if (!titleText) {
    diagnostics.push(createMeasureDiagnostic(
      "renderer.measure.shared_node_empty_title",
      "Shared nodes require a non-empty title.",
      { targetId: node.id }
    ));
  }
  const title = measuredTextBlock(
    `${node.id}__title`,
    titleRole,
    wrapText(titleText, contentWidth, titleStyle)
  );

  const normalizedGroups = normalizeSharedNodeAttributes(node.id, node.sharedNode.attributes, diagnostics);
  const attributeGroups: MeasuredSharedNodeAttributeGroup[] = normalizedGroups.map((group, groupIndex) => {
    const labelRole = nodeTheme.attribute.labelTextStyleRole;
    const valueRole = nodeTheme.attribute.valueTextStyleRole;
    const attributeContentWidth = Math.max(
      contentWidth - nodeTheme.attribute.padding.left - nodeTheme.attribute.padding.right,
      1
    );
    const label = measuredTextBlock(
      `${node.id}__attribute_${groupIndex}_label`,
      labelRole,
      wrapText(group.label, attributeContentWidth, getTextStyle(labelRole))
    );
    const values = group.values.map((value, valueIndex) => measuredTextBlock(
      `${node.id}__attribute_${groupIndex}_value_${valueIndex}`,
      valueRole,
      wrapText(value, attributeContentWidth, getTextStyle(valueRole))
    ));
    const height = roundMetric(
      nodeTheme.attribute.padding.top
      + label.height
      + values.reduce((sum, value) => sum + value.height, 0)
      + nodeTheme.attribute.gap * values.length
      + nodeTheme.attribute.padding.bottom
    );
    return {
      id: group.id,
      label,
      values,
      x: 0,
      y: 0,
      width: contentWidth,
      height
    };
  });

  const bodyContentHeight = roundMetric(
    title.height
    + attributeGroups.reduce((sum, group) => sum + group.height, 0)
    + nodeTheme.body.gap * attributeGroups.length
  );
  const naturalBodyHeight = roundMetric(
    nodeTheme.body.padding.top + bodyContentHeight + nodeTheme.body.padding.bottom
  );
  const naturalHeight = roundMetric(
    2 * strokeInset + (decorator?.height ?? 0) + naturalBodyHeight
    + nodeTheme.container.padding.top
    + nodeTheme.container.padding.bottom
    + (decorator ? nodeTheme.container.gap : 0)
  );
  const height = roundMetric(Math.max(nodeTheme.minHeight, naturalHeight));
  const density: MeasuredSharedNodeLayout["density"] = naturalHeight <= nodeTheme.minHeight
    ? "plain"
    : "dense";
  const bodyHeight = roundMetric(
    height
    - 2 * strokeInset
    - nodeTheme.container.padding.top
    - nodeTheme.container.padding.bottom
    - (decorator?.height ?? 0)
    - (decorator ? nodeTheme.container.gap : 0)
  );
  const contentX = roundMetric(containerContentX + nodeTheme.body.padding.left);
  let contentY = density === "plain"
    ? roundMetric(bodyY + (bodyHeight - title.height) / 2)
    : roundMetric(bodyY + nodeTheme.body.padding.top);

  title.x = contentX;
  title.y = contentY;
  contentY = roundMetric(contentY + title.height);

  attributeGroups.forEach((group) => {
    contentY = roundMetric(contentY + nodeTheme.body.gap);
    group.x = contentX;
    group.y = contentY;
    group.label.x = roundMetric(contentX + nodeTheme.attribute.padding.left);
    group.label.y = roundMetric(contentY + nodeTheme.attribute.padding.top);
    let valueY = roundMetric(group.label.y + group.label.height + nodeTheme.attribute.gap);
    group.values.forEach((value) => {
      value.x = group.label.x;
      value.y = valueY;
      valueY = roundMetric(valueY + value.height + nodeTheme.attribute.gap);
    });
    contentY = roundMetric(contentY + group.height);
  });

  const layout: MeasuredSharedNodeLayout = {
    density,
    ...(decorator ? { decorator } : {}),
    body: {
      x: containerContentX,
      y: bodyY,
      width: bodyWidth,
      height: bodyHeight,
      title,
      attributeGroups
    }
  };
  const blocks = [
    ...(decorator?.items ?? []),
    title,
    ...attributeGroups.flatMap((group) => [group.label, ...group.values])
  ];

  return {
    layout,
    blocks,
    width: nodeTheme.width,
    height
  };
}

export function reflowMeasuredSharedNode(layout: MeasuredSharedNodeLayout, height: number): void {
  const strokeInset = layout.body.x;
  layout.body.height = roundMetric(height - strokeInset - layout.body.y);
  if (layout.density === "plain") {
    layout.body.title.y = roundMetric(
      layout.body.y + (layout.body.height - layout.body.title.height) / 2
    );
  }
}

export function cloneMeasuredSharedNodeLayout(
  layout: MeasuredSharedNodeLayout
): MeasuredSharedNodeLayout {
  const cloneBlock = (block: MeasuredContentBlock): MeasuredContentBlock => ({
    ...block,
    lines: [...block.lines]
  });

  return {
    density: layout.density,
    ...(layout.decorator
      ? {
        decorator: {
          ...layout.decorator,
          items: layout.decorator.items.map(cloneBlock)
        }
      }
      : {}),
    body: {
      ...layout.body,
      title: cloneBlock(layout.body.title),
      attributeGroups: layout.body.attributeGroups.map((group) => ({
        ...group,
        label: cloneBlock(group.label),
        values: group.values.map(cloneBlock)
      }))
    }
  };
}
