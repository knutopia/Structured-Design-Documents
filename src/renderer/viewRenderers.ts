import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import { renderIaPlaceMapDot } from "./dot.js";
import { buildIaPlaceMapRenderModel } from "./iaPlaceMapRenderModel.js";
import { renderIaPlaceMapMermaid } from "./mermaid.js";
import { resolveDotPreviewStyle } from "./previewStyle.js";

export type TextRenderFormat = "dot" | "mermaid";
export type PreviewFormat = "svg" | "png";

export interface ViewRenderCapability {
  textFormats: TextRenderFormat[];
  previewFormats: PreviewFormat[];
  previewSourceByFormat: Record<PreviewFormat, TextRenderFormat>;
  defaultPreviewFormat: PreviewFormat;
}

interface ViewTextRenderer {
  capability: ViewRenderCapability;
  render: (projection: Projection, graph: CompiledGraph, bundle: Bundle, view: ViewSpec, format: TextRenderFormat) => string;
}

const iaPlaceMapRenderer: ViewTextRenderer = {
  capability: {
    textFormats: ["dot", "mermaid"],
    previewFormats: ["svg", "png"],
    previewSourceByFormat: {
      svg: "dot",
      png: "dot"
    },
    defaultPreviewFormat: "svg"
  },
  render: (projection, graph, bundle, view, format) => {
    const model = buildIaPlaceMapRenderModel(projection, graph, view.projection.hierarchy_edges ?? []);
    if (format === "dot") {
      return renderIaPlaceMapDot(model, resolveDotPreviewStyle(bundle, view));
    }

    return renderIaPlaceMapMermaid(model);
  }
};

const viewRenderers: Partial<Record<string, ViewTextRenderer>> = {
  ia_place_map: iaPlaceMapRenderer
};

export function getViewTextRenderer(viewId: string): ViewTextRenderer | undefined {
  return viewRenderers[viewId];
}

export function getViewRenderCapability(viewId: string): ViewRenderCapability | undefined {
  return viewRenderers[viewId]?.capability;
}

export function getKnownRenderableViewIds(bundle: Bundle): string[] {
  return bundle.views.views
    .filter((view) => viewRenderers[view.id])
    .map((view) => view.id);
}
