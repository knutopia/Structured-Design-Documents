import type { MeasuredContentBlock, PositionedContainer, SceneContainer } from "./contracts.js";
import type { RendererTheme } from "./theme.js";
import type { TextMeasurementService } from "./textMeasurement.js";

/** B5 container chrome is view-owned; semantic nodes keep their native tokens. */
export const UI_CONTRACTS_CONTAINER = {
  radius: 14, strokeWidth: 1.5, bandHeight: 19, titleInset: 14, titleTop: 3,
  bodyFill: "#f4f7fb", outline: "#aebdce", bandFill: "#dbe4f0",
  titleStyleRole: "shared_node_decorator"
} as const;

export function measureUiContractsHeader(container: SceneContainer, theme: RendererTheme, measurement: TextMeasurementService): {
  blocks: MeasuredContentBlock[]; width: number; height: number;
} {
  const title = container.viewMetadata?.uiContracts?.title;
  if (!title) return { blocks: [], width: 0, height: 0 };
  const token = UI_CONTRACTS_CONTAINER, style = theme.textStyles[token.titleStyleRole];
  const text = title.replace(/\s*\n\s*/g, " ");
  const width = measurement.measureText(text, style);
  return { width: width + token.titleInset * 2, height: token.bandHeight, blocks: [{
    id: `${container.id}:title`, kind: "text", textStyleRole: token.titleStyleRole,
    lines: [text], x: token.titleInset, y: token.titleTop, width, height: style.lineHeight,
    lineHeight: style.lineHeight, region: "primary"
  }] };
}

const number = (value: number) => String(Math.round(value * 1000) / 1000);
const xml = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Paint from positioned geometry; the closed band path clips to the interior. */
export function paintUiContractsContainer(container: PositionedContainer, theme: RendererTheme): string {
  const t = UI_CONTRACTS_CONTAINER, { x, y, width, height } = container;
  const inset = t.strokeWidth, left = x + inset, top = y + inset;
  const right = x + width - inset, bottom = y + t.bandHeight, radius = t.radius - inset;
  const style = theme.textStyles[t.titleStyleRole];
  const cssId = container.id.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character.codePointAt(0)!.toString(16)} `);
  const lines = [
    `<g class="ui-contracts-container" data-item-id="${xml(container.id)}">`,
    // Shared-node CSS is intentionally absent in scenes without semantic nodes.
    // Scope this font declaration to this container's measured title only.
    `  <style>g[data-item-id="${cssId}"] .text-role-${t.titleStyleRole} { font-family: '${style.fontFamily}'; font-size: ${style.fontSize}px; font-weight: ${style.fontWeight}; letter-spacing: ${style.letterSpacing ?? 0}px; }</style>`,
    `  <style>.view-ui_contracts .role-ui_contracts_description .scene-node__chrome { fill: none; stroke: none; }</style>`,
    `  <rect class="ui-contracts-container__body" x="${number(x)}" y="${number(y)}" width="${number(width)}" height="${number(height)}" rx="${t.radius}" fill="${container.viewMetadata?.uiContracts?.tone === "inset" ? "#ffffff" : container.viewMetadata?.uiContracts?.tone === "hierarchy" ? "#f1f5f9" : t.bodyFill}" stroke="none"/>`
  ];
  if (container.headerContent.length) {
    const path = `M ${number(left)} ${number(bottom)} L ${number(left)} ${number(top + radius)} Q ${number(left)} ${number(top)} ${number(left + radius)} ${number(top)} L ${number(right - radius)} ${number(top)} Q ${number(right)} ${number(top)} ${number(right)} ${number(top + radius)} L ${number(right)} ${number(bottom)} Z`;
    lines.push(`  <path class="ui-contracts-container__title-band" d="${path}" fill="${t.bandFill}" stroke="none"/>`);
  }
  const border = inset / 2;
  lines.push(`  <rect class="ui-contracts-container__outline" x="${number(x + border)}" y="${number(y + border)}" width="${number(width - inset)}" height="${number(height - inset)}" rx="${number(t.radius - border)}" fill="none" stroke="${t.outline}" stroke-width="${inset}"/>`, "</g>");
  return lines.join("\n");
}
