import type { Bundle } from "../bundle/types.js";
import type { CompiledGraph } from "../compiler/types.js";
import { compileSource } from "../compiler/compileSource.js";
import { sortDiagnostics, type Diagnostic } from "../diagnostics/types.js";
import { projectView } from "../projector/projectView.js";
import type { ProjectionResult } from "../projector/types.js";
import { validateGraph } from "../validator/validateGraph.js";
import type {
  DocumentPath,
  DocumentRevision,
  ProfileId,
  ProjectionResultEntry,
  ViewId
} from "./contracts.js";
import { computeDocumentRevision, normalizeTextToLf } from "./revisions.js";

export interface EvaluationOptions {
  validate_profile?: ProfileId;
  projection_views?: ViewId[];
}

export interface EvaluatedDocumentText {
  revision: DocumentRevision;
  diagnostics: Diagnostic[];
  graph?: CompiledGraph;
  projectionResults?: ProjectionResultEntry[];
  validationReport?: {
    error_count: number;
    warning_count: number;
  };
}

export function evaluateDocumentText(
  bundle: Bundle,
  documentPath: DocumentPath,
  text: string,
  options: EvaluationOptions = {}
): EvaluatedDocumentText {
  const canonicalText = normalizeTextToLf(text);
  const compileResult = compileSource(
    {
      path: documentPath,
      text: canonicalText
    },
    bundle
  );
  const diagnostics = [...compileResult.diagnostics];
  let validationReport: EvaluatedDocumentText["validationReport"];

  if (options.validate_profile && compileResult.graph) {
    const validation = validateGraph(compileResult.graph, bundle, options.validate_profile);
    diagnostics.push(...validation.diagnostics);
    validationReport = {
      error_count: validation.errorCount,
      warning_count: validation.warningCount
    };
  }

  let projectionResults: ProjectionResultEntry[] | undefined;
  if (options.projection_views && options.projection_views.length > 0) {
    projectionResults = options.projection_views.map((viewId) => {
      let projected: ProjectionResult;
      if (compileResult.graph) {
        projected = projectView(compileResult.graph, bundle, viewId);
      } else {
        projected = {
          diagnostics: compileResult.diagnostics
        };
      }

      return {
        view_id: viewId,
        projection: projected.projection,
        diagnostics: sortDiagnostics(projected.diagnostics)
      };
    });
  }

  return {
    revision: computeDocumentRevision(canonicalText),
    diagnostics: sortDiagnostics(diagnostics),
    graph: compileResult.graph,
    projectionResults,
    validationReport
  };
}
