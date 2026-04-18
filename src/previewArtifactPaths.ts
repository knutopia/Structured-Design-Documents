import path from "node:path";
import type { PreviewFormat, PreviewRendererBackendId } from "./renderer/viewRenderers.js";

export interface PreviewArtifactPathOptions {
  viewId: string;
  profileId: string;
  format: PreviewFormat;
  backendId?: PreviewRendererBackendId | string;
}

export function buildPreviewArtifactBasename(
  documentPath: string,
  options: PreviewArtifactPathOptions
): string {
  const parsed = path.parse(documentPath);
  const stemParts = [parsed.name, options.viewId, options.profileId];
  if (options.backendId) {
    stemParts.push(options.backendId);
  }
  return `${stemParts.join(".")}.${options.format}`;
}

export function buildShowPreviewOutputPath(
  filePath: string,
  options: PreviewArtifactPathOptions
): string {
  const parsed = path.parse(path.resolve(filePath));
  return path.join(parsed.dir, buildPreviewArtifactBasename(parsed.base, options));
}
