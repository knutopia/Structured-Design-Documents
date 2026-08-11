import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { computeBundleFingerprint, stringifyCanonicalJson } from "../bundle/fingerprint.js";
import { hasGuidedAdditionSupport } from "../bundle/guidedAuthoring.js";
import type { Bundle } from "../bundle/types.js";
import { sortDiagnostics, type Diagnostic } from "../diagnostics/types.js";
import type {
  ChangeOperation,
  ChangeSetMode,
  ChangeSetResult,
  ChangeSetSummary,
  Handle,
  Placement
} from "./contracts.js";
import { createChangeSetJournal, type ChangeSetJournal } from "./journal.js";
import { executeChangeOperations } from "./mutations.js";
import { computeDocumentRevision, normalizeTextToLf } from "./revisions.js";
import type { AuthoringWorkspace } from "./workspace.js";
import { createGuidanceCatalog, type GuidanceCatalog, type GuidanceRelationshipRecord } from "./guidedAddition/catalog.js";
import type {
  ApplyAdditionProposalArgs,
  ApplyAdditionProposalResult,
  CompletedAdditionProposal,
  ExistingNodeRef,
  ExistingOrNewNodeRef,
  GuidedDocumentSnapshot,
  ProposedPlacement,
  SelectedPlacement
} from "./guidedAddition/contracts.js";
import { GuidedAdditionDomainError } from "./guidedAddition/contracts.js";
import {
  normalizeAndValidateEdgeFields,
  normalizeAndValidateNodeFields
} from "./guidedAddition/forms.js";
import { createGuidedOpaqueId } from "./guidedAddition/identifiers.js";
import {
  createPlacementRecommendations,
  effectForSelections,
  selectPlacement,
  type GuidedPlacementContext,
  type GuidedPlacementRecommendationRecord
} from "./guidedAddition/placement.js";
import { createGuidedDocumentSnapshot } from "./guidedAddition/snapshot.js";

const TEMP_HANDLE_PREFIX = "tmp_authoring_";

interface InternalOperationTarget {
  local_id: string;
  kind: "node" | "edge";
  temp_handle: Handle;
  parent_local_id?: string;
}

interface VerifiedProposal {
  operations: ChangeOperation[];
  createdTargets: InternalOperationTarget[];
  diagnostics: Diagnostic[];
}

function emptySummary(): ChangeSetSummary {
  return {
    node_insertions: [],
    node_deletions: [],
    node_renames: [],
    property_changes: [],
    edge_insertions: [],
    edge_deletions: [],
    ordering_changes: []
  };
}

function diagnostic(file: string, code: string, message: string): Diagnostic {
  return {
    stage: "authoring",
    code,
    severity: "error",
    message,
    file
  };
}

function canonicalSame(left: unknown, right: unknown): boolean {
  return stringifyCanonicalJson(left) === stringifyCanonicalJson(right);
}

function temporaryHandle(kind: "node" | "edge", proposalId: string, localId: string): Handle {
  const digest = createHash("sha256").update(`${kind}|${proposalId}|${localId}`, "utf8").digest("hex");
  return `${TEMP_HANDLE_PREFIX}${digest}`;
}

function createRejectedChangeSet(
  journal: ChangeSetJournal,
  path: string,
  proposal: CompletedAdditionProposal,
  mode: ChangeSetMode,
  diagnostics: Diagnostic[]
): ChangeSetResult {
  return {
    kind: "sdd-change-set",
    change_set_id: journal.createChangeSetId(),
    path,
    origin: "apply_addition_proposal",
    document_effect: "updated",
    base_revision: proposal.document_context.base_revision,
    mode,
    status: "rejected",
    undo_eligible: false,
    operations: [],
    summary: emptySummary(),
    diagnostics: sortDiagnostics(diagnostics)
  };
}

async function rejectedResult(
  journal: ChangeSetJournal,
  path: string,
  args: ApplyAdditionProposalArgs,
  diagnostics: Diagnostic[]
): Promise<ApplyAdditionProposalResult> {
  const mode = args.mode ?? "dry_run";
  const changeSet = createRejectedChangeSet(journal, path, args.proposal, mode, diagnostics);
  if (mode === "dry_run") {
    await journal.recordChangeSet(changeSet);
  }
  return {
    kind: "sdd-addition-proposal-result",
    proposal: args.proposal,
    base_revision: args.proposal.document_context.base_revision,
    mode,
    status: "rejected",
    change_set: changeSet,
    created_targets: [],
    diagnostics: changeSet.diagnostics
  };
}

function addError(errors: Diagnostic[], file: string, code: string, message: string): void {
  errors.push(diagnostic(file, code, message));
}

function proposalWithoutId(proposal: CompletedAdditionProposal): Omit<CompletedAdditionProposal, "proposal_id"> {
  const { proposal_id: _proposalId, ...withoutId } = proposal;
  return withoutId;
}

function verifyExistingRef(
  snapshot: GuidedDocumentSnapshot,
  reference: ExistingNodeRef,
  errors: Diagnostic[],
  file: string,
  label: string
): void {
  const current = snapshot.nodes.find((node) => node.handle === reference.handle);
  if (
    !current ||
    current.node_id !== reference.node_id ||
    current.node_type !== reference.node_type
  ) {
    addError(errors, file, "guided_addition.state_stale", `${label} no longer identifies the same existing node`);
  }
}

function collectExistingRefs(proposal: CompletedAdditionProposal): Array<{ ref: ExistingNodeRef; label: string }> {
  const refs: Array<{ ref: ExistingNodeRef; label: string }> = [];
  const add = (value: ExistingOrNewNodeRef | undefined, label: string): void => {
    if (value?.kind === "existing_node") refs.push({ ref: value, label });
  };
  if (proposal.anchor) refs.push({ ref: proposal.anchor, label: "Proposal anchor" });
  add(proposal.relationship?.from, "Relationship source");
  add(proposal.relationship?.to, "Relationship target");
  for (const [index, edge] of proposal.new_edges.entries()) {
    add(edge.from, `Edge ${index} source`);
    add(edge.to, `Edge ${index} target`);
  }
  for (const [index, placement] of proposal.placements.entries()) {
    if (placement.target.kind === "node") add(placement.target.node, `Placement ${index} target`);
    add(placement.selected.parent, `Placement ${index} parent`);
    if (placement.selected.anchor) refs.push({ ref: placement.selected.anchor, label: `Placement ${index} anchor` });
  }
  for (const [index, effect] of proposal.confirmed_effects.entries()) {
    refs.push({ ref: effect.target, label: `Effect ${index} target` });
    add(effect.new_parent.kind === "existing_node" ? effect.new_parent : undefined, `Effect ${index} parent`);
    add(effect.relationship.from, `Effect ${index} relationship source`);
    add(effect.relationship.to, `Effect ${index} relationship target`);
    add(effect.placement.parent, `Effect ${index} placement parent`);
    if (effect.placement.anchor) refs.push({ ref: effect.placement.anchor, label: `Effect ${index} placement anchor` });
  }
  return refs;
}

function verifyLocalRef(
  reference: ExistingOrNewNodeRef,
  newNodes: Map<string, CompletedAdditionProposal["new_nodes"][number]>,
  errors: Diagnostic[],
  file: string,
  label: string
): void {
  if (reference.kind !== "new_node") return;
  const node = newNodes.get(reference.local_id);
  if (!node || node.node_id !== reference.node_id || node.node_type !== reference.node_type) {
    addError(errors, file, "guided_addition.choice_unavailable", `${label} does not match a proposal-local node`);
  }
}

function nodeTypeForRef(
  snapshot: GuidedDocumentSnapshot,
  reference: ExistingOrNewNodeRef
): string | undefined {
  return reference.kind === "new_node"
    ? reference.node_type
    : snapshot.nodes.find((node) => node.handle === reference.handle)?.node_type;
}

function handleForRef(reference: ExistingOrNewNodeRef, localHandles: Map<string, Handle>): Handle | undefined {
  return reference.kind === "existing_node" ? reference.handle : localHandles.get(reference.local_id);
}

function nodeIdForRef(reference: ExistingOrNewNodeRef): string {
  return reference.node_id;
}

function operationPlacement(
  placement: ProposedPlacement,
  localHandles: Map<string, Handle>
): Placement | undefined {
  const parentHandle = placement.parent ? handleForRef(placement.parent, localHandles) : undefined;
  if (placement.parent && !parentHandle) return undefined;
  return {
    stream: placement.stream,
    mode: placement.mode,
    ...(parentHandle ? { parent_handle: parentHandle } : {}),
    ...(placement.anchor ? { anchor_handle: placement.anchor.handle } : {})
  };
}

function relationshipForProposal(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  proposal: CompletedAdditionProposal,
  errors: Diagnostic[],
  file: string
): GuidanceRelationshipRecord | undefined {
  if (!proposal.relationship) return undefined;
  const fromType = nodeTypeForRef(snapshot, proposal.relationship.from);
  const toType = nodeTypeForRef(snapshot, proposal.relationship.to);
  const relationship = fromType && toType
    ? catalog.getRelationship({ from: fromType, type: proposal.relationship.type, to: toType })
    : undefined;
  if (!relationship) {
    addError(errors, file, "guided_addition.choice_unavailable", "The proposal endpoint triple is not allowed by the current bundle");
  }
  return relationship;
}

function placementContext(
  proposal: CompletedAdditionProposal,
  relationship: GuidanceRelationshipRecord | undefined
): GuidedPlacementContext {
  const newNode = proposal.new_nodes[0];
  const newRef = newNode
    ? { kind: "new_node" as const, local_id: newNode.local_id, node_id: newNode.node_id, node_type: newNode.node_type }
    : undefined;
  return {
    ...(relationship ? { relationship } : {}),
    ...(proposal.relationship?.direction_relative_to_anchor
      ? { direction: proposal.relationship.direction_relative_to_anchor }
      : {}),
    ...(proposal.anchor ? { anchor: proposal.anchor } : {}),
    ...(newRef ? { new_node: newRef } : {}),
    ...(proposal.relationship ? { from: proposal.relationship.from, to: proposal.relationship.to } : {})
  };
}

function verifyPlacements(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  proposal: CompletedAdditionProposal,
  relationship: GuidanceRelationshipRecord | undefined,
  errors: Diagnostic[],
  file: string
): { records: GuidedPlacementRecommendationRecord[]; selected: SelectedPlacement[] } {
  const records = createPlacementRecommendations(catalog, snapshot, placementContext(proposal, relationship));
  if (proposal.placements.length !== records.length) {
    addError(errors, file, "guided_addition.choice_unavailable", "Proposal placements do not cover the current recommendations exactly");
    return { records, selected: [] };
  }
  const selected = records.flatMap((record) => {
    const supplied = proposal.placements.find(
      (placement) => placement.recommendation_id === record.recommendation.recommendation_id
    );
    if (!supplied) return [];
    const resolved = selectPlacement(records, supplied.recommendation_id, supplied.selected);
    return resolved && canonicalSame(resolved, supplied) ? [resolved] : [];
  });
  if (selected.length !== records.length || new Set(proposal.placements.map((item) => item.recommendation_id)).size !== records.length) {
    addError(errors, file, "guided_addition.choice_unavailable", "A proposal placement is no longer currently offered");
  }
  return { records, selected };
}

function verifyConfirmation(
  records: GuidedPlacementRecommendationRecord[],
  selected: SelectedPlacement[],
  proposal: CompletedAdditionProposal,
  errors: Diagnostic[],
  file: string
): void {
  const expected = effectForSelections(records, selected);
  if (!expected) {
    if (proposal.confirmed_effects.length > 0) {
      addError(errors, file, "guided_addition.confirmation_stale", "Proposal contains a confirmation for an effect that is no longer required");
    }
    return;
  }
  if (proposal.confirmed_effects.length !== 1) {
    addError(errors, file, "guided_addition.confirmation_required", "The current reparenting effect requires exact confirmation");
    return;
  }
  const supplied = proposal.confirmed_effects[0]!;
  const expectedConfirmation = { ...expected, confirmed: true as const };
  if (!canonicalSame(supplied, expectedConfirmation)) {
    addError(errors, file, "guided_addition.confirmation_stale", "The proposal confirmation does not match the current reparenting effect");
  }
}

function verifyProposal(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  proposal: CompletedAdditionProposal,
  file: string
): VerifiedProposal {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const expectedProposalId = createGuidedOpaqueId("addp", proposalWithoutId(proposal));
  if (proposal.proposal_id !== expectedProposalId) {
    addError(errors, file, "guided_addition.choice_unavailable", "Proposal ID does not match its canonical content");
  }
  if (proposal.proposal_version !== "0.1" || proposal.kind !== "sdd-addition-proposal") {
    addError(errors, file, "guided_addition.choice_unavailable", "Proposal kind or version is unsupported");
  }

  const newNodes = new Map<string, CompletedAdditionProposal["new_nodes"][number]>(
    proposal.new_nodes.map((node) => [node.local_id, node])
  );
  if (proposal.new_nodes.length > 1 || newNodes.size !== proposal.new_nodes.length || [...newNodes.keys()].some((id) => id !== "node_1")) {
    addError(errors, file, "guided_addition.choice_unavailable", "V1 proposals may contain only proposal-local node_1");
  }
  if (proposal.new_edges.length > 1 || proposal.new_edges.some((edge) => edge.local_id !== "edge_1")) {
    addError(errors, file, "guided_addition.choice_unavailable", "V1 proposals may contain only proposal-local edge_1");
  }
  for (const { ref, label } of collectExistingRefs(proposal)) {
    verifyExistingRef(snapshot, ref, errors, file, label);
  }
  const localRefs: Array<{ ref: ExistingOrNewNodeRef; label: string }> = [];
  if (proposal.relationship) {
    localRefs.push({ ref: proposal.relationship.from, label: "Relationship source" });
    localRefs.push({ ref: proposal.relationship.to, label: "Relationship target" });
  }
  proposal.new_edges.forEach((edge, index) => {
    localRefs.push({ ref: edge.from, label: `Edge ${index} source` });
    localRefs.push({ ref: edge.to, label: `Edge ${index} target` });
  });
  proposal.placements.forEach((placement, index) => {
    if (placement.target.kind === "node") localRefs.push({ ref: placement.target.node, label: `Placement ${index} target` });
    if (placement.selected.parent) localRefs.push({ ref: placement.selected.parent, label: `Placement ${index} parent` });
  });
  proposal.confirmed_effects.forEach((effect, index) => {
    if (effect.new_parent.kind === "existing_node") {
      localRefs.push({ ref: effect.new_parent, label: `Effect ${index} parent` });
    } else if (!newNodes.has(effect.new_parent.local_id)) {
      addError(errors, file, "guided_addition.choice_unavailable", `Effect ${index} parent does not match a proposal-local node`);
    }
    localRefs.push({ ref: effect.relationship.from, label: `Effect ${index} source` });
    localRefs.push({ ref: effect.relationship.to, label: `Effect ${index} target` });
    if (effect.placement.parent) localRefs.push({ ref: effect.placement.parent, label: `Effect ${index} placement parent` });
  });
  for (const { ref, label } of localRefs) verifyLocalRef(ref, newNodes, errors, file, label);

  for (const node of proposal.new_nodes) {
    const nodeType = catalog.getNodeType(node.node_type);
    if (!nodeType) {
      addError(errors, file, "guided_addition.choice_unavailable", `Node type '${node.node_type}' is not offered`);
      continue;
    }
    const validated = normalizeAndValidateNodeFields(
      catalog,
      snapshot,
      nodeType,
      { node_id: node.node_id, name: node.name, properties: node.properties },
      proposal.guidance_context.display_profile_id
    );
    warnings.push(...validated.diagnostics.filter((item) => item.severity !== "error"));
    errors.push(...validated.diagnostics.filter((item) => item.severity === "error"));
    if (!canonicalSame(validated.fields, { node_id: node.node_id, name: node.name, properties: node.properties })) {
      addError(errors, file, "guided_addition.choice_unavailable", `Node '${node.local_id}' fields are not canonical for the current bundle`);
    }
  }

  if (!proposal.relationship) {
    if (proposal.new_nodes.length !== 1 || proposal.new_edges.length !== 0 || proposal.anchor) {
      addError(errors, file, "guided_addition.choice_unavailable", "A standalone proposal must contain one node and no anchor, relationship, or edge");
    }
  } else {
    if (!proposal.anchor || proposal.new_edges.length !== 1) {
      addError(errors, file, "guided_addition.choice_unavailable", "A relationship proposal requires an anchor and exactly one edge");
    }
    const edge = proposal.new_edges[0];
    if (edge && !canonicalSame(
      { from: edge.from, type: edge.type, to: edge.to },
      { from: proposal.relationship.from, type: proposal.relationship.type, to: proposal.relationship.to }
    )) {
      addError(errors, file, "guided_addition.choice_unavailable", "Proposal relationship and edge endpoints do not match exactly");
    }
    if (
      proposal.anchor &&
      proposal.relationship.direction_relative_to_anchor === "outgoing" &&
      !canonicalSame(proposal.relationship.from, proposal.anchor)
    ) {
      addError(errors, file, "guided_addition.choice_unavailable", "Outgoing relationship source does not match the proposal anchor");
    }
    if (
      proposal.anchor &&
      proposal.relationship.direction_relative_to_anchor === "incoming" &&
      !canonicalSame(proposal.relationship.to, proposal.anchor)
    ) {
      addError(errors, file, "guided_addition.choice_unavailable", "Incoming relationship target does not match the proposal anchor");
    }
  }

  const relationship = relationshipForProposal(catalog, snapshot, proposal, errors, file);
  if (relationship && proposal.new_edges[0]) {
    const edge = proposal.new_edges[0];
    const validated = normalizeAndValidateEdgeFields(snapshot, relationship, {
      event: edge.event,
      guard: edge.guard,
      effect: edge.effect,
      props: edge.props
    });
    errors.push(...validated.diagnostics.filter((item) => item.severity === "error"));
    warnings.push(...validated.diagnostics.filter((item) => item.severity !== "error"));
    if (!canonicalSame(validated.fields, {
      event: edge.event,
      guard: edge.guard,
      effect: edge.effect,
      props: edge.props
    })) {
      addError(errors, file, "guided_addition.choice_unavailable", "Edge fields are not canonical for the current bundle");
    }
  }

  if (proposal.guidance_context.view_id) {
    const view = catalog.getView(proposal.guidance_context.view_id);
    if (!view) {
      addError(errors, file, "guided_addition.choice_unavailable", "Proposal view is not available in the current bundle");
    } else if (relationship) {
      const viewRelationship = catalog.getViewRelationship(view.view_id, relationship);
      if (!viewRelationship || viewRelationship.role !== proposal.guidance_context.relationship_role) {
        addError(errors, file, "guided_addition.choice_unavailable", "Proposal relationship role does not match current view guidance");
      }
    }
  } else if (proposal.guidance_context.relationship_role) {
    addError(errors, file, "guided_addition.choice_unavailable", "Relationship role requires a proposal view");
  }
  if (
    proposal.guidance_context.display_profile_id &&
    !catalog.getProfile(proposal.guidance_context.display_profile_id)
  ) {
    addError(errors, file, "guided_addition.choice_unavailable", "Proposal display profile is not available in the current bundle");
  }

  const placementVerification = verifyPlacements(catalog, snapshot, proposal, relationship, errors, file);
  verifyConfirmation(
    placementVerification.records,
    placementVerification.selected,
    proposal,
    errors,
    file
  );
  if (errors.length > 0) {
    return { operations: [], createdTargets: [], diagnostics: sortDiagnostics([...warnings, ...errors]) };
  }

  const localHandles = new Map<string, Handle>();
  for (const node of proposal.new_nodes) {
    localHandles.set(node.local_id, temporaryHandle("node", proposal.proposal_id, node.local_id));
  }
  for (const edge of proposal.new_edges) {
    localHandles.set(edge.local_id, temporaryHandle("edge", proposal.proposal_id, edge.local_id));
  }
  const operations: ChangeOperation[] = [];
  const createdTargets: InternalOperationTarget[] = [];

  for (const node of proposal.new_nodes) {
    const selected = proposal.placements.find(
      (placement) => placement.target.kind === "node" && placement.target.node.kind === "new_node" && placement.target.node.local_id === node.local_id
    );
    const placement = selected ? operationPlacement(selected.selected, localHandles) : undefined;
    const tempHandle = localHandles.get(node.local_id)!;
    operations.push({
      kind: "insert_node_block",
      node_type: node.node_type,
      node_id: node.node_id,
      name: node.name,
      placement: placement!,
      __internal_handle: tempHandle
    } as ChangeOperation);
    createdTargets.push({
      local_id: node.local_id,
      kind: "node",
      temp_handle: tempHandle,
      ...(selected?.selected.parent?.kind === "new_node"
        ? { parent_local_id: selected.selected.parent.local_id }
        : {})
    });
  }
  for (const node of proposal.new_nodes) {
    for (const property of node.properties) {
      operations.push({
        kind: "set_node_property",
        node_handle: localHandles.get(node.local_id)!,
        key: property.key,
        value_kind: property.value_kind,
        raw_value: property.raw_value
      });
    }
  }
  for (const edge of proposal.new_edges) {
    const selected = proposal.placements.find(
      (placement) => placement.target.kind === "edge" && placement.target.local_id === edge.local_id
    );
    const parentHandle = handleForRef(edge.from, localHandles)!;
    const tempHandle = localHandles.get(edge.local_id)!;
    operations.push({
      kind: "insert_edge_line",
      parent_handle: parentHandle,
      rel_type: edge.type,
      to: nodeIdForRef(edge.to),
      to_name: edge.to_name,
      event: edge.event,
      guard: edge.guard,
      effect: edge.effect,
      props: { ...edge.props },
      placement: selected ? operationPlacement(selected.selected, localHandles) : undefined,
      __internal_handle: tempHandle
    } as ChangeOperation);
    createdTargets.push({
      local_id: edge.local_id,
      kind: "edge",
      temp_handle: tempHandle,
      ...(edge.from.kind === "new_node" ? { parent_local_id: edge.from.local_id } : {})
    });
  }
  for (const effect of proposal.confirmed_effects) {
    operations.push({
      kind: "reparent_node_block",
      node_handle: effect.target.handle,
      placement: operationPlacement(effect.placement, localHandles)!
    });
  }
  return { operations, createdTargets, diagnostics: sortDiagnostics(warnings) };
}

export async function applyAdditionProposal(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: ApplyAdditionProposalArgs,
  journal = createChangeSetJournal(workspace)
): Promise<ApplyAdditionProposalResult> {
  const mode = args.mode ?? "dry_run";
  const proposal = args.proposal;
  const proposalPath = proposal.document_context.path;
  if (!proposalPath) {
    return rejectedResult(journal, proposal.document_context.document_ref, args, [
      diagnostic(
        proposal.document_context.document_ref,
        "guided_addition.choice_unavailable",
        "The file-backed proposal executor requires document_context.path"
      )
    ]);
  }
  const resolved = workspace.resolveDocumentPath(proposalPath);
  if (proposal.document_context.document_ref !== resolved.publicPath) {
    return rejectedResult(journal, resolved.publicPath, args, [
      diagnostic(resolved.publicPath, "guided_addition.choice_unavailable", "Proposal document_ref and normalized path do not match")
    ]);
  }
  if (!hasGuidedAdditionSupport(bundle)) {
    return rejectedResult(journal, resolved.publicPath, args, [
      diagnostic(resolved.publicPath, "guided_addition.unsupported_bundle", "The loaded bundle does not support guided addition")
    ]);
  }

  const rawText = await readFile(resolved.absolutePath, "utf8");
  const text = normalizeTextToLf(rawText);
  const currentRevision = computeDocumentRevision(text);
  if (currentRevision !== proposal.document_context.base_revision) {
    return rejectedResult(journal, resolved.publicPath, args, [
      diagnostic(resolved.publicPath, "guided_addition.state_stale", "Proposal base revision does not match the current document")
    ]);
  }
  const currentFingerprint = computeBundleFingerprint(bundle);
  if (currentFingerprint !== proposal.document_context.bundle_fingerprint) {
    return rejectedResult(journal, resolved.publicPath, args, [
      diagnostic(resolved.publicPath, "guided_addition.state_stale", "Proposal bundle fingerprint does not match the loaded bundle")
    ]);
  }

  let snapshot: GuidedDocumentSnapshot;
  try {
    snapshot = createGuidedDocumentSnapshot(bundle, {
      document_ref: resolved.publicPath,
      path: resolved.publicPath,
      text
    });
  } catch (error) {
    if (error instanceof GuidedAdditionDomainError) {
      return rejectedResult(journal, resolved.publicPath, args, error.diagnostics);
    }
    throw error;
  }
  const catalog = createGuidanceCatalog(bundle);
  const verified = verifyProposal(catalog, snapshot, proposal, resolved.publicPath);
  if (verified.diagnostics.some((item) => item.severity === "error")) {
    return rejectedResult(journal, resolved.publicPath, args, verified.diagnostics);
  }

  const executed = await executeChangeOperations(
    workspace,
    bundle,
    {
      path: resolved.publicPath,
      base_revision: proposal.document_context.base_revision,
      mode,
      operations: verified.operations,
      validate_profile: args.validate_profile,
      projection_views: args.projection_views,
      origin: "apply_addition_proposal"
    },
    journal
  );
  const createdTargets = verified.createdTargets.flatMap((target) => {
    const handle = executed.tempHandleMapping.get(target.temp_handle);
    return handle
      ? [{
          local_id: target.local_id,
          kind: target.kind,
          handle,
          ...(target.parent_local_id ? { parent_local_id: target.parent_local_id } : {})
        }]
      : [];
  });
  return {
    kind: "sdd-addition-proposal-result",
    proposal,
    base_revision: proposal.document_context.base_revision,
    resulting_revision: executed.changeSet.resulting_revision,
    mode,
    status: executed.changeSet.status,
    change_set: executed.changeSet,
    created_targets: createdTargets,
    diagnostics: sortDiagnostics([...verified.diagnostics, ...executed.changeSet.diagnostics])
  };
}
