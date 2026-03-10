import type { IaPlaceMapRenderModel, IaRenderItem, IaRenderPlace } from "./iaPlaceMapRenderModel.js";
import type { DotPreviewStyle } from "./previewStyle.js";

function escapeLabel(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatMultilineLabel(lines: string[]): string {
  return lines.map((line) => escapeLabel(line)).join("\\n");
}

function quoteId(id: string): string {
  return `"${escapeLabel(id)}"`;
}

function renderPlace(place: IaRenderPlace, indent: string, lines: string[]): void {
  lines.push(`${indent}${quoteId(place.id)} [label="${formatMultilineLabel(place.labelLines)}"];`);
  renderItems(place.items, indent, lines);
}

function renderItems(items: IaRenderItem[], indent: string, lines: string[]): void {
  for (const item of items) {
    if (item.kind === "area") {
      lines.push(`${indent}subgraph cluster_${item.id.replace(/[^A-Za-z0-9_]/g, "_")} {`);
      lines.push(`${indent}  label="${escapeLabel(item.label)}";`);
      renderItems(item.items, `${indent}  `, lines);
      lines.push(`${indent}}`);
      continue;
    }

    renderPlace(item, indent, lines);
  }
}

export function renderIaPlaceMapDot(model: IaPlaceMapRenderModel, style?: DotPreviewStyle): string {
  const fontFamily = style?.fontFamily ? escapeLabel(style.fontFamily) : "Public Sans";
  const dpi = typeof style?.dpi === "number" && Number.isFinite(style.dpi) ? style.dpi : 192;
  const lines = [
    "digraph ia_place_map {",
    "  rankdir=LR;",
    `  graph [dpi=${dpi}, fontname="${fontFamily}"];`,
    `  node [shape=box, fontname="${fontFamily}"];`,
    `  edge [fontname="${fontFamily}"];`
  ];

  renderItems(model.rootItems, "  ", lines);

  for (const chain of model.siblingOrderChains) {
    for (let index = 0; index < chain.length - 1; index += 1) {
      lines.push(`  ${quoteId(chain[index])} -> ${quoteId(chain[index + 1])} [style=invis, weight=100];`);
    }
  }

  for (const edge of model.edges) {
    lines.push(`  ${quoteId(edge.from)} -> ${quoteId(edge.to)};`);
  }

  lines.push("}");
  return lines.join("\n");
}
