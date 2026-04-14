import { readFile } from "node:fs/promises";
import type { Bundle } from "../bundle/types.js";
import type {
  DocumentPath,
  ProjectionResource,
  ProjectDocumentArgs,
  ValidateDocumentArgs,
  ValidationResource
} from "./contracts.js";
import { evaluateDocumentText } from "./evaluation.js";
import { normalizeTextToLf } from "./revisions.js";
import type { AuthoringWorkspace } from "./workspace.js";

function createDocumentUri(documentPath: DocumentPath): string {
  return `sdd://document/${documentPath}`;
}

export async function validateDocument(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: ValidateDocumentArgs
): Promise<ValidationResource> {
  const resolvedDocument = workspace.resolveDocumentPath(args.path);
  const rawText = await readFile(resolvedDocument.absolutePath, "utf8");
  const canonicalText = normalizeTextToLf(rawText);
  const evaluated = evaluateDocumentText(bundle, resolvedDocument.publicPath, canonicalText, {
    validate_profile: args.profile_id
  });

  return {
    kind: "sdd-validation",
    uri: `${createDocumentUri(resolvedDocument.publicPath)}/validation/${args.profile_id}`,
    path: resolvedDocument.publicPath,
    revision: evaluated.revision,
    profile_id: args.profile_id,
    report: evaluated.validationReport,
    diagnostics: evaluated.diagnostics
  };
}

export async function projectDocument(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: ProjectDocumentArgs
): Promise<ProjectionResource> {
  const resolvedDocument = workspace.resolveDocumentPath(args.path);
  const rawText = await readFile(resolvedDocument.absolutePath, "utf8");
  const canonicalText = normalizeTextToLf(rawText);
  const evaluated = evaluateDocumentText(bundle, resolvedDocument.publicPath, canonicalText, {
    projection_views: [args.view_id]
  });
  const projected = evaluated.projectionResults?.[0];

  return {
    kind: "sdd-projection",
    uri: `${createDocumentUri(resolvedDocument.publicPath)}/projection/${args.view_id}`,
    path: resolvedDocument.publicPath,
    revision: evaluated.revision,
    view_id: args.view_id,
    projection: projected?.projection,
    diagnostics: projected?.diagnostics ?? evaluated.diagnostics
  };
}
