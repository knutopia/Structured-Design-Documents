import { readFile } from "node:fs/promises";
import type { Bundle } from "../bundle/types.js";
import type { Diagnostic } from "../diagnostics/types.js";
import { renderSourcePreview } from "../renderer/previewWorkflow.js";
import type { RenderPreviewArgs, RenderPreviewResult } from "./contracts.js";
import {
  materializePreviewDisplayCopy,
  PreviewMaterializationError
} from "./previewMaterialization.js";
import { computeDocumentRevision, normalizeTextToLf } from "./revisions.js";
import type { AuthoringWorkspace } from "./workspace.js";

export class AuthoringPreviewError extends Error {
  readonly diagnostics: Diagnostic[];

  constructor(message: string, diagnostics: Diagnostic[] = []) {
    super(message);
    this.name = "AuthoringPreviewError";
    this.diagnostics = diagnostics;
  }
}

function normalizePreviewFailureStage(stage: Diagnostic["stage"]): string {
  switch (stage) {
    case "bundle":
    case "parse":
    case "compile":
      return "compile";
    case "validate":
      return "validate";
    case "project":
      return "project";
    case "render":
      return "render";
    case "cli":
      return "cli";
    default:
      return stage;
  }
}

function buildPreviewFailureMessage(
  path: string,
  args: Pick<RenderPreviewArgs, "view_id" | "profile_id">,
  diagnostics: Diagnostic[]
): string {
  const primaryDiagnostic = diagnostics.find((diagnostic) => diagnostic.severity === "error");
  const context = `'${path}' (view_id=${args.view_id}, profile_id=${args.profile_id})`;

  if (primaryDiagnostic) {
    return `Preview ${normalizePreviewFailureStage(primaryDiagnostic.stage)} failure for ${context}: ${primaryDiagnostic.message}`;
  }

  return `Preview failed without artifact output for ${context}.`;
}

export async function renderPreview(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: RenderPreviewArgs
): Promise<RenderPreviewResult> {
  const resolvedPath = workspace.resolveDocumentPath(args.path);
  const rawText = await readFile(resolvedPath.absolutePath, "utf8");
  const canonicalText = normalizeTextToLf(rawText);
  const revision = computeDocumentRevision(canonicalText);
  const previewResult = await renderSourcePreview(
    {
      path: resolvedPath.publicPath,
      text: canonicalText
    },
    bundle,
    {
      viewId: args.view_id,
      format: args.format,
      profileId: args.profile_id,
      backendId: args.backend_id
    }
  );

  if (!previewResult.artifact) {
    throw new AuthoringPreviewError(
      buildPreviewFailureMessage(resolvedPath.publicPath, args, previewResult.diagnostics),
      previewResult.diagnostics
    );
  }

  const artifact: RenderPreviewResult["artifact"] =
    previewResult.artifact.format === "svg"
      ? {
          format: "svg",
          mime_type: "image/svg+xml",
          text: previewResult.artifact.text
        }
      : {
          format: "png",
          mime_type: "image/png",
          base64: Buffer.from(previewResult.artifact.bytes).toString("base64")
        };

  let displayCopyPath: string | undefined;
  if (args.display_copy_name !== undefined) {
    try {
      displayCopyPath = await materializePreviewDisplayCopy(artifact, args.display_copy_name);
    } catch (error) {
      if (error instanceof PreviewMaterializationError) {
        throw error;
      }
      throw new AuthoringPreviewError(
        `Preview materialization failure for '${resolvedPath.publicPath}' (view_id=${args.view_id}, profile_id=${args.profile_id}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return {
    kind: "sdd-preview",
    path: resolvedPath.publicPath,
    revision,
    view_id: args.view_id,
    profile_id: args.profile_id,
    backend_id: previewResult.previewCapability.backendId,
    ...(displayCopyPath !== undefined ? { display_copy_path: displayCopyPath } : {}),
    notes: previewResult.notes,
    diagnostics: previewResult.diagnostics,
    artifact
  };
}
