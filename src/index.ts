export { loadBundle } from "./bundle/loadBundle.js";
export { resolveBundleFieldReference, resolveProfileRuleField } from "./bundle/bundleReferences.js";
export {
  canonicalizeJson,
  computeBundleFingerprint,
  createBundleFingerprintInput,
  stringifyCanonicalJson
} from "./bundle/fingerprint.js";
export {
  getNodeAuthoringForm,
  getNodeIdSuggestionInputs,
  getPlacementPolicyInputs,
  getRelationshipAuthoringSemantics,
  getRelationshipEdgeFieldSupport,
  getRelationshipRequiredEdgeProperties,
  hasGuidedAdditionSupport,
  listAllowedEndpointTriples,
  listGuidedViewDefinitions,
  listGuidedViewRelationships,
  resolveGuidedRelationshipDisplay,
  GuidedAdditionUnsupportedBundleError
} from "./bundle/guidedAuthoring.js";
export { createGuidanceCatalog, GuidanceCatalog } from "./authoring/guidedAddition/catalog.js";
export { createGuidedDocumentSnapshot } from "./authoring/guidedAddition/snapshot.js";
export { createGuidedDocumentSnapshotFromWorkspace } from "./authoring/guidedAddition/snapshotFiles.js";
export { createGuidedAdditionRuntime } from "./authoring/guidedAddition/planner.js";
export { applyAdditionProposal } from "./authoring/additionProposals.js";
export { GuidedAdditionDomainError } from "./authoring/guidedAddition/contracts.js";
export { BundleValidationError, collectBundleDiagnostics, validateLoadedBundle } from "./bundle/validateLoadedBundle.js";
export { parseSource } from "./parser/parseSource.js";
export { compileSource } from "./compiler/compileSource.js";
export { projectSource } from "./projector/projectSource.js";
export { projectView } from "./projector/projectView.js";
export { validateGraph } from "./validator/validateGraph.js";
export { renderSource } from "./renderer/renderView.js";
export type {
  BundleFingerprint,
  BundleFingerprintInput,
  CanonicalJsonValue
} from "./bundle/fingerprint.js";
export type {
  AllowedEndpointTriple,
  EdgeFieldSupport,
  GuidedDisplayContext,
  GuidedViewDefinition,
  NodeAuthoringForm,
  NodeIdSuggestionInputs,
  ResolvedGuidedRelationshipDisplay
} from "./bundle/guidedAuthoring.js";
export type {
  GuidanceDisplayContext,
  GuidanceNodeTypeRecord,
  GuidanceProfileRecord,
  GuidanceRelationshipRecord,
  GuidanceSyntaxMetadata,
  GuidanceViewRecord,
  GuidanceViewRelationshipRecord
} from "./authoring/guidedAddition/catalog.js";
export type * from "./authoring/guidedAddition/contracts.js";
export type { ChangeOperation, OrderingChange, ReparentNodeBlockOp } from "./authoring/contracts.js";
export type {
  AuthoringConfig,
  AuthoringFieldDescriptor,
  AuthoringNodeForm,
  Bundle,
  BundleFieldReference,
  GuidedAdditionViewConfig,
  GuidedDisplayPredicate,
  GuidedDisplayRule,
  GuidedViewRelationship,
  RelationshipAuthoringConfig
} from "./bundle/types.js";
export type { ParseResult } from "./parser/types.js";
export type { CompileResult, CompiledGraph, CompiledEdge, CompiledNode } from "./compiler/types.js";
export type {
  Projection,
  ProjectionEdge,
  ProjectionEdgeAnnotation,
  ProjectionNode,
  ProjectionNodeAnnotation,
  ProjectionNodeGroup,
  ProjectionOmission,
  ProjectionResult
} from "./projector/types.js";
export type { ValidationReport } from "./validator/types.js";
export type { Diagnostic, DiagnosticStage, RenderOptions, RenderResult, SourceInput, SourceSpan } from "./types.js";
