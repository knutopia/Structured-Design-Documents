import type {
  ContentBlock,
  ContentBlockKind,
  SceneContainerPrimitive,
  SceneNodePrimitive
} from "./contracts.js";
import { createMeasureDiagnostic, type RendererDiagnostic } from "./diagnostics.js";
import type { ContainerPrimitiveTheme, NodePrimitiveTheme, RendererTheme } from "./theme.js";

export function getNodePrimitiveTheme(
  theme: RendererTheme,
  primitive: SceneNodePrimitive
): NodePrimitiveTheme {
  return theme.nodePrimitives[primitive];
}

export function getContainerPrimitiveTheme(
  theme: RendererTheme,
  primitive: SceneContainerPrimitive
): ContainerPrimitiveTheme {
  return theme.containerPrimitives[primitive];
}

export function validatePrimitiveContent(
  nodeId: string,
  primitive: SceneNodePrimitive,
  blocks: ContentBlock[],
  theme: RendererTheme
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  const primitiveTheme = getNodePrimitiveTheme(theme, primitive);
  const disallowedKinds = blocks
    .filter((block) => !primitiveTheme.textRule.allowedKinds.includes(block.kind))
    .map((block) => block.kind);

  if (disallowedKinds.length > 0) {
    const kinds = [...new Set(disallowedKinds)].join(", ");
    diagnostics.push(createMeasureDiagnostic(
      "renderer.measure.unsupported_primitive_content",
      `Primitive "${primitive}" does not support content kind(s): ${kinds}.`,
      { targetId: nodeId }
    ));
  }

  if (
    typeof primitiveTheme.textRule.maxBlocks === "number" &&
    blocks.length > primitiveTheme.textRule.maxBlocks
  ) {
    diagnostics.push(createMeasureDiagnostic(
      "renderer.measure.primitive_block_limit",
      `Primitive "${primitive}" accepts at most ${primitiveTheme.textRule.maxBlocks} content block(s). Extra blocks will be ignored.`,
      { targetId: nodeId }
    ));
  }

  return diagnostics;
}

export function isMovableSecondaryBlock(
  primitiveTheme: NodePrimitiveTheme,
  block: Pick<ContentBlock, "kind" | "priority">
): boolean {
  return (
    block.priority === "secondary" &&
    primitiveTheme.textRule.movableSecondaryKinds.includes(block.kind)
  );
}

export function resolveTextRoleForBlock(kind: ContentBlockKind, textStyleRole: string): string {
  if (textStyleRole.length > 0) {
    return textStyleRole;
  }

  switch (kind) {
    case "badge_text":
      return "badge";
    case "edge_label":
      return "edge_label";
    case "metadata":
      return "metadata";
    default:
      return "label";
  }
}
