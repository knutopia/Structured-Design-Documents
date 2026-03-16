export type TextRenderFormat = "dot" | "mermaid";
export type PreviewFormat = "svg" | "png";

export type RendererBackendClass = "legacy" | "staged" | "experimental";

export type TextRendererBackendId = "legacy_dot" | "legacy_mermaid";
export type PreviewRendererBackendId = "legacy_graphviz_preview";

export interface TextArtifactCapability {
  format: TextRenderFormat;
  backendId: TextRendererBackendId;
  backendClass: RendererBackendClass;
}

export interface PreviewArtifactCapability {
  format: PreviewFormat;
  backendId: PreviewRendererBackendId;
  backendClass: RendererBackendClass;
}
