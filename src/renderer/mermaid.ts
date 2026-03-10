import type { IaPlaceMapRenderModel, IaRenderItem, IaRenderPlace } from "./iaPlaceMapRenderModel.js";

function mermaidId(id: string): string {
  return `n_${id.replace(/[^A-Za-z0-9]/g, "_")}`;
}

function escapeLabel(text: string): string {
  return text.replace(/"/g, "&quot;");
}

function renderPlace(place: IaRenderPlace, indent: string, lines: string[]): void {
  lines.push(`${indent}${mermaidId(place.id)}["${escapeLabel(place.labelLines.join("<br/>"))}"]`);
  renderItems(place.items, indent, lines);
}

function renderItems(items: IaRenderItem[], indent: string, lines: string[]): void {
  for (const item of items) {
    if (item.kind === "area") {
      lines.push(`${indent}subgraph ${mermaidId(item.id)}["${escapeLabel(item.label)}"]`);
      renderItems(item.items, `${indent}  `, lines);
      lines.push(`${indent}end`);
      continue;
    }

    renderPlace(item, indent, lines);
  }
}

export function renderIaPlaceMapMermaid(model: IaPlaceMapRenderModel): string {
  const lines = ["flowchart LR"];

  renderItems(model.rootItems, "  ", lines);

  for (const edge of model.edges) {
    lines.push(`  ${mermaidId(edge.from)} --> ${mermaidId(edge.to)}`);
  }

  return lines.join("\n");
}
