import type { Diagnostic, DiagnosticStage } from "../types.js";
import type {
  ApplyAuthoringIntentResult,
  AuthoringOutcomeAssessment,
  ChangeSetResult,
  CreateDocumentResult,
  HelperErrorResult,
  ProjectionResource,
  RenderPreviewResult,
  ValidationResource
} from "./contracts.js";

const EMPTY_BOOTSTRAP_PARSE_CODE = "parse.minimum_top_level_blocks";

export interface HelperErrorAssessmentContext {
  request_source?: "stdin_dash" | "file_path" | "unknown";
  request_body_empty?: boolean;
}

export type AssessableAuthoringOutcome =
  | HelperErrorResult
  | ChangeSetResult
  | ApplyAuthoringIntentResult
  | CreateDocumentResult
  | ValidationResource
  | ProjectionResource
  | RenderPreviewResult;

type AssessmentLayer = AuthoringOutcomeAssessment["layer"];
type AssessmentOutcome = AuthoringOutcomeAssessment["outcome"];

function errorDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.severity === "error");
}

function hasReviewDiagnostics(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "warn" || diagnostic.severity === "info");
}

function createAssessment(args: {
  outcome: AssessmentOutcome;
  layer: AssessmentLayer;
  can_commit: boolean;
  can_render: boolean;
  should_stop: boolean;
  next_action: string;
  blocking_diagnostics?: Diagnostic[];
  summary: string;
}): AuthoringOutcomeAssessment {
  return {
    kind: "sdd-authoring-outcome-assessment",
    outcome: args.outcome,
    layer: args.layer,
    can_commit: args.can_commit,
    can_render: args.can_render,
    should_stop: args.should_stop,
    next_action: args.next_action,
    blocking_diagnostics: args.blocking_diagnostics ?? [],
    summary: args.summary
  };
}

function diagnosticStageLayer(stage: DiagnosticStage): AssessmentLayer {
  switch (stage) {
    case "validate":
      return "persisted_validation";
    case "project":
      return "projection";
    case "render":
      return "render";
    default:
      return "candidate_diagnostics";
  }
}

function helperRuntimeLayer(diagnostics: readonly Diagnostic[] | undefined): AssessmentLayer {
  const primary = diagnostics?.find((diagnostic) => diagnostic.severity === "error");
  if (!primary) {
    return "transport";
  }

  switch (primary.stage) {
    case "validate":
      return "persisted_validation";
    case "project":
      return "projection";
    case "render":
      return "render";
    default:
      return "transport";
  }
}

function changeSetDiagnostics(result: ChangeSetResult): Diagnostic[] {
  return [
    ...result.diagnostics,
    ...(result.projection_results ?? []).flatMap((entry) => entry.diagnostics)
  ];
}

function reviewOrAcceptableAssessment(args: {
  diagnostics: readonly Diagnostic[];
  layerWhenReview: AssessmentLayer;
  can_commit: boolean;
  can_render: boolean;
  next_action: string;
  acceptable_summary: string;
  review_summary: string;
}): AuthoringOutcomeAssessment {
  const reviewRequired = hasReviewDiagnostics(args.diagnostics);
  return createAssessment({
    outcome: reviewRequired ? "review_required" : "acceptable",
    layer: reviewRequired ? args.layerWhenReview : "success",
    can_commit: args.can_commit,
    can_render: args.can_render,
    should_stop: false,
    next_action: args.next_action,
    summary: reviewRequired ? args.review_summary : args.acceptable_summary
  });
}

export function assessHelperError(
  error: HelperErrorResult,
  context: HelperErrorAssessmentContext = {}
): AuthoringOutcomeAssessment {
  if (error.code === "invalid_json" && context.request_source === "stdin_dash" && context.request_body_empty === true) {
    return createAssessment({
      outcome: "blocked",
      layer: "transport",
      can_commit: false,
      can_render: false,
      should_stop: true,
      next_action: "Resubmit the helper request with a non-empty JSON body or a request file.",
      summary: "The helper request body was empty before it reached SDD domain semantics."
    });
  }

  if (error.code === "invalid_json" || error.code === "invalid_args") {
    return createAssessment({
      outcome: "blocked",
      layer: "request_shape",
      can_commit: false,
      can_render: false,
      should_stop: true,
      next_action: "Fix the helper request shape and resubmit it.",
      summary: "The helper request could not be parsed or did not match the expected request shape."
    });
  }

  const blockingDiagnostics = errorDiagnostics(error.diagnostics ?? []);
  const layer = helperRuntimeLayer(error.diagnostics);
  return createAssessment({
    outcome: "blocked",
    layer,
    can_commit: false,
    can_render: false,
    should_stop: true,
    next_action: "Fix the reported helper failure before continuing.",
    blocking_diagnostics: blockingDiagnostics,
    summary: "The helper failed before producing a successful result payload."
  });
}

export function assessChangeSetResult(result: ChangeSetResult): AuthoringOutcomeAssessment {
  const diagnostics = changeSetDiagnostics(result);
  const blockingDiagnostics = errorDiagnostics(diagnostics);

  if (result.status === "rejected") {
    return createAssessment({
      outcome: "blocked",
      layer: "domain_rejection",
      can_commit: false,
      can_render: false,
      should_stop: true,
      next_action: "Fix the rejected change request before continuing.",
      blocking_diagnostics: blockingDiagnostics,
      summary: "The change set was understood but rejected by the SDD authoring domain."
    });
  }

  if (blockingDiagnostics.length > 0) {
    return createAssessment({
      outcome: "blocked",
      layer: "candidate_diagnostics",
      can_commit: false,
      can_render: false,
      should_stop: true,
      next_action: "Fix the candidate diagnostics before commit or render.",
      blocking_diagnostics: blockingDiagnostics,
      summary: "The applied candidate has blocking diagnostics."
    });
  }

  if (result.mode === "dry_run") {
    return reviewOrAcceptableAssessment({
      diagnostics,
      layerWhenReview: "success",
      can_commit: true,
      can_render: false,
      next_action: "Review the dry-run result, then commit the same candidate if acceptable.",
      acceptable_summary: "The dry-run change set is clean and commit-eligible.",
      review_summary: "The dry-run change set has non-blocking diagnostics to review before commit."
    });
  }

  return reviewOrAcceptableAssessment({
    diagnostics,
    layerWhenReview: "success",
    can_commit: false,
    can_render: true,
    next_action: "Validate or render the committed document state as needed.",
    acceptable_summary: "The committed change set is clean and render-eligible.",
    review_summary: "The committed change set has non-blocking diagnostics to review before render."
  });
}

export function assessApplyAuthoringIntentResult(
  result: ApplyAuthoringIntentResult
): AuthoringOutcomeAssessment {
  return assessChangeSetResult(result.change_set);
}

function isEmptyBootstrapCreate(result: CreateDocumentResult): boolean {
  const { change_set: changeSet } = result;
  return (
    changeSet.origin === "create_document" &&
    changeSet.status === "applied" &&
    changeSet.mode === "commit" &&
    changeSet.diagnostics.length > 0 &&
    changeSet.diagnostics.every((diagnostic) => diagnostic.code === EMPTY_BOOTSTRAP_PARSE_CODE)
  );
}

export function assessCreateDocumentResult(result: CreateDocumentResult): AuthoringOutcomeAssessment {
  if (isEmptyBootstrapCreate(result)) {
    return createAssessment({
      outcome: "review_required",
      layer: "success",
      can_commit: false,
      can_render: false,
      should_stop: false,
      next_action: "Author initial content from the returned create revision before inspecting or rendering.",
      summary: "The document was created as an empty bootstrap and needs initial authoring content."
    });
  }

  return assessChangeSetResult(result.change_set);
}

export function assessValidationResource(result: ValidationResource): AuthoringOutcomeAssessment {
  const blockingDiagnostics = errorDiagnostics(result.diagnostics);
  if (blockingDiagnostics.length > 0) {
    return createAssessment({
      outcome: "blocked",
      layer: "persisted_validation",
      can_commit: false,
      can_render: false,
      should_stop: true,
      next_action: "Fix persisted validation diagnostics before rendering.",
      blocking_diagnostics: blockingDiagnostics,
      summary: "The persisted document state has blocking validation diagnostics."
    });
  }

  return reviewOrAcceptableAssessment({
    diagnostics: result.diagnostics,
    layerWhenReview: "persisted_validation",
    can_commit: false,
    can_render: true,
    next_action: "Render the persisted document state if a visual artifact is needed.",
    acceptable_summary: "The persisted document state passed validation and is render-eligible.",
    review_summary: "The persisted document state has non-blocking validation diagnostics to review."
  });
}

export function assessProjectionResource(result: ProjectionResource): AuthoringOutcomeAssessment {
  const blockingDiagnostics = errorDiagnostics(result.diagnostics);
  if (blockingDiagnostics.length > 0) {
    return createAssessment({
      outcome: "blocked",
      layer: "projection",
      can_commit: false,
      can_render: false,
      should_stop: true,
      next_action: "Fix projection diagnostics before rendering.",
      blocking_diagnostics: blockingDiagnostics,
      summary: "The persisted document state has blocking projection diagnostics."
    });
  }

  return reviewOrAcceptableAssessment({
    diagnostics: result.diagnostics,
    layerWhenReview: "projection",
    can_commit: false,
    can_render: true,
    next_action: "Render the projected document state if a visual artifact is needed.",
    acceptable_summary: "The projection is clean and render-eligible.",
    review_summary: "The projection has non-blocking diagnostics to review."
  });
}

export function assessRenderPreviewResult(result: RenderPreviewResult): AuthoringOutcomeAssessment {
  const blockingDiagnostics = errorDiagnostics(result.diagnostics);
  if (blockingDiagnostics.length > 0) {
    return createAssessment({
      outcome: "blocked",
      layer: diagnosticStageLayer(blockingDiagnostics[0]!.stage),
      can_commit: false,
      can_render: false,
      should_stop: true,
      next_action: "Fix preview diagnostics before treating the render as usable.",
      blocking_diagnostics: blockingDiagnostics,
      summary: "The preview result has blocking diagnostics."
    });
  }

  return reviewOrAcceptableAssessment({
    diagnostics: result.diagnostics,
    layerWhenReview: "success",
    can_commit: false,
    can_render: true,
    next_action: "Use the rendered preview artifact.",
    acceptable_summary: "The preview rendered successfully.",
    review_summary: "The preview rendered with non-blocking diagnostics to review."
  });
}

export function assessAuthoringOutcome(
  result: AssessableAuthoringOutcome,
  context?: HelperErrorAssessmentContext
): AuthoringOutcomeAssessment {
  switch (result.kind) {
    case "sdd-helper-error":
      return assessHelperError(result, context);
    case "sdd-change-set":
      return assessChangeSetResult(result);
    case "sdd-authoring-intent-result":
      return assessApplyAuthoringIntentResult(result);
    case "sdd-create-document":
      return assessCreateDocumentResult(result);
    case "sdd-validation":
      return assessValidationResource(result);
    case "sdd-projection":
      return assessProjectionResource(result);
    case "sdd-preview":
      return assessRenderPreviewResult(result);
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}
