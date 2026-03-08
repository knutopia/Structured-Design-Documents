import type { IaPlaceMapRenderModel } from "./iaPlaceMapRenderModel.js";

function escapeLabel(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function quoteId(id: string): string {
  return `"${escapeLabel(id)}"`;
}

export function renderIaPlaceMapDot(model: IaPlaceMapRenderModel): string {
  const lines = [
    "digraph ia_place_map {",
    "  rankdir=LR;",
    "  node [shape=box];"
  ];

  for (const area of model.areas) {
    lines.push(`  subgraph cluster_${area.id.replace(/[^A-Za-z0-9_]/g, "_")} {`);
    lines.push(`    label="${escapeLabel(area.label)}";`);
    for (const placeId of area.placeIds) {
      const place = model.placesById.get(placeId);
      if (!place) {
        continue;
      }
      lines.push(`    ${quoteId(place.id)} [label="${escapeLabel(place.labelLines.join("\\n"))}"];`);
    }
    lines.push("  }");
  }

  for (const place of model.topLevelPlaces) {
    lines.push(`  ${quoteId(place.id)} [label="${escapeLabel(place.labelLines.join("\\n"))}"];`);
  }

  for (const edge of model.edges) {
    lines.push(`  ${quoteId(edge.from)} -> ${quoteId(edge.to)};`);
  }

  lines.push("}");
  return lines.join("\n");
}

