import type { IaPlaceMapRenderModel } from "./iaPlaceMapRenderModel.js";
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

  for (const area of model.areas) {
    lines.push(`  subgraph cluster_${area.id.replace(/[^A-Za-z0-9_]/g, "_")} {`);
    lines.push(`    label="${escapeLabel(area.label)}";`);
    for (const placeId of area.placeIds) {
      const place = model.placesById.get(placeId);
      if (!place) {
        continue;
      }
      lines.push(`    ${quoteId(place.id)} [label="${formatMultilineLabel(place.labelLines)}"];`);
    }
    lines.push("  }");
  }

  for (const place of model.topLevelPlaces) {
    lines.push(`  ${quoteId(place.id)} [label="${formatMultilineLabel(place.labelLines)}"];`);
  }

  for (const edge of model.edges) {
    lines.push(`  ${quoteId(edge.from)} -> ${quoteId(edge.to)};`);
  }

  lines.push("}");
  return lines.join("\n");
}
