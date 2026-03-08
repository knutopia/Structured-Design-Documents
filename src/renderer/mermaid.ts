import type { IaPlaceMapRenderModel } from "./iaPlaceMapRenderModel.js";

function mermaidId(id: string): string {
  return `n_${id.replace(/[^A-Za-z0-9]/g, "_")}`;
}

function escapeLabel(text: string): string {
  return text.replace(/"/g, "&quot;");
}

export function renderIaPlaceMapMermaid(model: IaPlaceMapRenderModel): string {
  const lines = ["flowchart LR"];

  for (const area of model.areas) {
    lines.push(`  subgraph ${mermaidId(area.id)}["${escapeLabel(area.label)}"]`);
    for (const placeId of area.placeIds) {
      const place = model.placesById.get(placeId);
      if (!place) {
        continue;
      }
      lines.push(`    ${mermaidId(place.id)}["${escapeLabel(place.labelLines.join("<br/>"))}"]`);
    }
    lines.push("  end");
  }

  for (const place of model.topLevelPlaces) {
    lines.push(`  ${mermaidId(place.id)}["${escapeLabel(place.labelLines.join("<br/>"))}"]`);
  }

  for (const edge of model.edges) {
    lines.push(`  ${mermaidId(edge.from)} --> ${mermaidId(edge.to)}`);
  }

  return lines.join("\n");
}

