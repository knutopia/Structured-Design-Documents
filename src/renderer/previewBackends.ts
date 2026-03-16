import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import type { Projection } from "../projector/types.js";
import {
  assertLegacyGraphvizPreviewAvailable,
  LEGACY_GRAPHVIZ_PREVIEW_BACKEND_ID,
  LEGACY_GRAPHVIZ_PREVIEW_SOURCE_FORMAT,
  legacyGraphvizInstallHint,
  renderLegacyGraphvizPreview
} from "./legacyGraphvizPreviewBackend.js";
import type {
  PreviewFormat,
  PreviewRendererBackendId,
  RendererBackendClass,
  TextRenderFormat
} from "./renderArtifacts.js";
import type { RendererDiagnostic } from "./staged/diagnostics.js";
import {
  renderIaPlaceMapStagedPng,
  renderIaPlaceMapStagedSvg
} from "./staged/iaPlaceMap.js";

export const STAGED_IA_PLACE_MAP_PREVIEW_BACKEND_ID = "staged_ia_place_map_preview";

export type PreviewArtifactSource =
  | {
    kind: "text";
    format: TextRenderFormat;
    text: string;
  }
  | {
    kind: "projection";
    graph: CompiledGraph;
    projection: Projection;
    profileId: string;
    themeId?: string;
  };

export interface RenderPreviewArtifactRequest {
  backendId: PreviewRendererBackendId;
  bundle: Bundle;
  view: ViewSpec;
  format: PreviewFormat;
  source: PreviewArtifactSource;
}

export interface PreviewArtifactBase {
  sourceArtifacts?: Partial<Record<TextRenderFormat, string>>;
  diagnostics?: RendererDiagnostic[];
}

export type PreviewArtifactResult =
  | ({
    format: "svg";
    text: string;
  } & PreviewArtifactBase)
  | ({
    format: "png";
    bytes: Uint8Array;
  } & PreviewArtifactBase);

export type PreviewBackendInputRequirement =
  | {
    kind: "text";
    sourceFormat: TextRenderFormat;
  }
  | {
    kind: "projection";
  };

export interface PreviewBackendDescriptor {
  id: PreviewRendererBackendId;
  backendClass: RendererBackendClass;
  inputRequirement: PreviewBackendInputRequirement;
  installHint: () => string;
  assertAvailable?: () => void;
  render: (request: RenderPreviewArtifactRequest) => Promise<PreviewArtifactResult>;
}

const previewBackends: Record<PreviewRendererBackendId, PreviewBackendDescriptor> = {
  [LEGACY_GRAPHVIZ_PREVIEW_BACKEND_ID]: {
    id: LEGACY_GRAPHVIZ_PREVIEW_BACKEND_ID,
    backendClass: "legacy",
    inputRequirement: {
      kind: "text",
      sourceFormat: LEGACY_GRAPHVIZ_PREVIEW_SOURCE_FORMAT
    },
    installHint: legacyGraphvizInstallHint,
    assertAvailable: assertLegacyGraphvizPreviewAvailable,
    render: async (request) => {
      if (request.source.kind !== "text") {
        throw new Error(`Preview backend '${LEGACY_GRAPHVIZ_PREVIEW_BACKEND_ID}' requires text source input.`);
      }

      const payload = await renderLegacyGraphvizPreview({
        bundle: request.bundle,
        view: request.view,
        format: request.format,
        sourceText: request.source.text
      });

      if (request.format === "svg") {
        return {
          format: "svg",
          text: payload as string
        };
      }

      return {
        format: "png",
        bytes: payload as Uint8Array
      };
    }
  },
  [STAGED_IA_PLACE_MAP_PREVIEW_BACKEND_ID]: {
    id: STAGED_IA_PLACE_MAP_PREVIEW_BACKEND_ID,
    backendClass: "staged",
    inputRequirement: {
      kind: "projection"
    },
    installHint: () => "",
    render: async (request) => {
      if (request.source.kind !== "projection") {
        throw new Error(`Preview backend '${STAGED_IA_PLACE_MAP_PREVIEW_BACKEND_ID}' requires projection source input.`);
      }
      if (request.view.id !== "ia_place_map") {
        throw new Error(`Preview backend '${STAGED_IA_PLACE_MAP_PREVIEW_BACKEND_ID}' only supports the ia_place_map view.`);
      }

      if (request.format === "svg") {
        const rendered = await renderIaPlaceMapStagedSvg(
          request.source.projection,
          request.source.graph,
          request.view,
          request.source.profileId,
          request.source.themeId
        );
        return {
          format: "svg",
          text: rendered.svg,
          diagnostics: rendered.diagnostics
        };
      }

      const rendered = await renderIaPlaceMapStagedPng(
        request.source.projection,
        request.source.graph,
        request.view,
        request.source.profileId,
        request.source.themeId
      );
      return {
        format: "png",
        bytes: rendered.png,
        diagnostics: rendered.diagnostics
      };
    }
  }
};

export function getPreviewBackend(backendId: PreviewRendererBackendId): PreviewBackendDescriptor {
  return previewBackends[backendId];
}

export function assertPreviewBackendAvailable(backendId: PreviewRendererBackendId): void {
  previewBackends[backendId].assertAvailable?.();
}

export async function renderPreviewArtifact(request: RenderPreviewArtifactRequest): Promise<PreviewArtifactResult> {
  const backend = getPreviewBackend(request.backendId);
  const rendered = await backend.render(request);
  const sourceArtifacts = request.source.kind === "text"
    ? {
      ...rendered.sourceArtifacts,
      [request.source.format]: request.source.text
    }
    : rendered.sourceArtifacts;

  if (rendered.format === "svg") {
    return {
      ...rendered,
      sourceArtifacts
    };
  }

  return {
    ...rendered,
    sourceArtifacts
  };
}
