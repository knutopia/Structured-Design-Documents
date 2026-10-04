import { readFile } from "node:fs/promises";
import type { Bundle } from "../bundle/types.js";
import { resolveDocumentDiagrams, resolveDiagramSelection } from "../diagrams/resolveDiagrams.js";
import { projectView } from "../projector/projectView.js";
import { sortDiagnostics } from "../diagnostics/types.js";
import { computeBundleFingerprint } from "../bundle/fingerprint.js";
import type {
  DocumentPath,
  ListDocumentDiagramsArgs,
  ListDocumentDiagramsResult,
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
  const evaluated = evaluateDocumentText(bundle, resolvedDocument.publicPath, canonicalText);
  const selection = evaluated.graph ? resolveDiagramSelection(evaluated.graph, bundle, {
    viewId: args.view_id,
    diagramId: args.diagram_id
  }) : undefined;
  const projected = selection && !selection.diagnostics.some((diagnostic) => diagnostic.severity === "error") && evaluated.graph
    ? projectView(evaluated.graph, bundle, selection.viewId, { diagramId: args.diagram_id })
    : undefined;
  const viewId = selection?.viewId ?? args.view_id ?? "";
  const diagramPath = args.diagram_id ? `/diagram/${encodeURIComponent(args.diagram_id)}` : "";
  const resourceContext = args.diagram_id ? `?revision=${encodeURIComponent(evaluated.revision)}&bundle=${encodeURIComponent(computeBundleFingerprint(bundle))}` : "";

  return {
    kind: "sdd-projection",
    uri: `${createDocumentUri(resolvedDocument.publicPath)}/projection/${viewId}${diagramPath}${resourceContext}`,
    path: resolvedDocument.publicPath,
    revision: evaluated.revision,
    view_id: viewId,
    ...(args.diagram_id ? { diagram_id: args.diagram_id } : {}),
    ...(selection?.diagramName ? { diagram_name: selection.diagramName } : {}),
    projection: projected?.projection,
    diagnostics: sortDiagnostics([...evaluated.diagnostics, ...(projected?.diagnostics ?? selection?.diagnostics ?? [])])
  };
}

export async function listDocumentDiagrams(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: ListDocumentDiagramsArgs
): Promise<ListDocumentDiagramsResult> {
  const resolvedDocument = workspace.resolveDocumentPath(args.path);
  const canonicalText = normalizeTextToLf(await readFile(resolvedDocument.absolutePath, "utf8"));
  const evaluated = evaluateDocumentText(bundle, resolvedDocument.publicPath, canonicalText);
  const resolved = evaluated.graph ? resolveDocumentDiagrams(evaluated.graph, bundle) : undefined;
  const unsupported = !bundle.contracts.diagram_membership ? [{
    stage: "project" as const,
    code: "diagram.unsupported",
    severity: "error" as const,
    message: "The selected bundle does not support named diagrams.",
    file: resolvedDocument.publicPath
  }] : [];
  return {
    kind: "sdd-diagram-list",
    uri: `${createDocumentUri(resolvedDocument.publicPath)}/diagrams?revision=${encodeURIComponent(evaluated.revision)}&bundle=${encodeURIComponent(computeBundleFingerprint(bundle))}&details=${args.details === true}`,
    path: resolvedDocument.publicPath,
    revision: evaluated.revision,
    effective_version: evaluated.graph?.version ?? bundle.manifest.language_version,
    bundle: { manifest_path: bundle.manifestPath, version: bundle.manifest.bundle_version, fingerprint: computeBundleFingerprint(bundle) },
    diagrams: (resolved?.diagrams ?? []).map((diagram) => ({
      diagram_id: diagram.diagramId,
      diagram_name: diagram.diagramName,
      view_id: diagram.viewId,
      node_count: diagram.nodeCount,
      edge_count: diagram.edgeCount,
      diagnostics: diagram.diagnostics,
      ...(args.details ? {
        node_ids: diagram.nodeIds,
        edge_ids: diagram.edgeIds,
        inclusions: diagram.inclusions.map((inclusion) => ({ node_id: inclusion.nodeId, reasons: inclusion.reasons }))
      } : {})
    })),
    diagnostics: sortDiagnostics([...evaluated.diagnostics, ...(resolved?.diagnostics ?? []), ...unsupported])
  };
}
