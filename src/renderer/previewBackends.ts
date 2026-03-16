import type { Bundle, ViewSpec } from "../bundle/types.js";
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

export interface RenderPreviewArtifactRequest {
  backendId: PreviewRendererBackendId;
  bundle: Bundle;
  view: ViewSpec;
  format: PreviewFormat;
  sourceText: string;
}

export type PreviewArtifactResult =
  | {
    format: "svg";
    text: string;
    sourceArtifacts?: Partial<Record<TextRenderFormat, string>>;
  }
  | {
    format: "png";
    bytes: Uint8Array;
    sourceArtifacts?: Partial<Record<TextRenderFormat, string>>;
  };

export interface PreviewBackendDescriptor {
  id: PreviewRendererBackendId;
  backendClass: RendererBackendClass;
  sourceFormat: TextRenderFormat;
  installHint: () => string;
  assertAvailable?: () => void;
  render: (request: Omit<RenderPreviewArtifactRequest, "backendId">) => Promise<PreviewArtifactResult>;
}

const previewBackends: Record<PreviewRendererBackendId, PreviewBackendDescriptor> = {
  [LEGACY_GRAPHVIZ_PREVIEW_BACKEND_ID]: {
    id: LEGACY_GRAPHVIZ_PREVIEW_BACKEND_ID,
    backendClass: "legacy",
    sourceFormat: LEGACY_GRAPHVIZ_PREVIEW_SOURCE_FORMAT,
    installHint: legacyGraphvizInstallHint,
    assertAvailable: assertLegacyGraphvizPreviewAvailable,
    render: async (request) => {
      const payload = await renderLegacyGraphvizPreview(request);
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
  const rendered = await backend.render({
    bundle: request.bundle,
    view: request.view,
    format: request.format,
    sourceText: request.sourceText
  });
  const sourceArtifacts = {
    ...rendered.sourceArtifacts,
    [backend.sourceFormat]: request.sourceText
  };

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
