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
  ChangeSetStatus,
  ChangeSetSummary,
  DocumentRevision,
  Handle,
  Placement,
  ProfileId,
  ViewId
} from "./contracts.js";
import { createChangeSetJournal, type ChangeSetJournal } from "./journal.js";
import { executeChangeOperations } from "./mutations.js";
import { computeDocumentRevision, normalizeTextToLf } from "./revisions.js";
import type { AuthoringWorkspace } from "./workspace.js";
import { createGuidanceCatalog, type GuidanceCatalog, type GuidanceRelationshipRecord } from "./guidedAddition/catalog.js";
import {
  normalizeAndValidateEdgeFields,
  normalizeAndValidateNodeFields
} from "./guidedAddition/forms.js";
import { createGuidedOpaqueId } from "./guidedAddition/identifiers.js";
import { createGuidedDocumentSnapshot } from "./guidedAddition/snapshot.js";
import type { GuidedDocumentSnapshot } from "./guidedAddition/sharedContracts.js";
import type {
  CompletedAdditionProposalV1,
  ExistingNodeRefV1,
  GuidedFieldValueV1,
  MaterialEffectV1,
  NewNodeRefV1,
  NodeRefV1,
  ProposedNodeV1,
  ProposedRelationshipV1,
  SemanticNodeOrganizationV1,
  SemanticSameLevelOrderV1
} from "./guidedAddition/v1/contracts.js";
import { createMoveEffect } from "./guidedAddition/v1/organization.js";

const TEMP_HANDLE_PREFIX = "tmp_authoring_";
const NEW_NODE_LOCAL_ID = "node_1";
const NEW_EDGE_LOCAL_ID = "edge_1";

export interface ApplyAdditionProposalV1Args {
  proposal: CompletedAdditionProposalV1;
  mode?: ChangeSetMode;
  validate_profile?: ProfileId;
  projection_views?: ViewId[];
}

export interface ApplyAdditionProposalV1Result {
  kind: "sdd-addition-proposal-result";
  proposal: CompletedAdditionProposalV1;
  base_revision: DocumentRevision;
  resulting_revision?: DocumentRevision;
  mode: ChangeSetMode;
  status: ChangeSetStatus;
  change_set: ChangeSetResult;
  created_targets: Array<{
    local_id: string;
    kind: "node" | "edge";
    handle: Handle;
    parent_local_id?: string;
  }>;
  diagnostics: Diagnostic[];
}

interface InternalOperationTarget {
  local_id: string;
  kind: "node" | "edge";
  temp_handle: Handle;
  parent_local_id?: string;
}

interface ParsedNodeFields {
  properties: Array<{ key: string; value_kind: "quoted_string" | "bare_value"; raw_value: string }>;
  diagnostics: Diagnostic[];
}

interface ParsedEdgeFields {
  event: string | null;
  guard: string | null;
  effect: string | null;
  props: Record<string, string>;
  diagnostics: Diagnostic[];
}

interface VerifiedProposalV1 {
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
  return { stage: "authoring", code, severity: "error", message, file };
}

function addError(errors: Diagnostic[], file: string, code: string, message: string): void {
  errors.push(diagnostic(file, code, message));
}

function canonicalSame(left: unknown, right: unknown): boolean {
  return stringifyCanonicalJson(left) === stringifyCanonicalJson(right);
}

function temporaryHandle(kind: "node" | "edge", proposalId: string, localId: string): Handle {
  const digest = createHash("sha256").update(`${kind}|${proposalId}|${localId}`, "utf8").digest("hex");
  return `${TEMP_HANDLE_PREFIX}${digest}`;
}

function proposalWithoutId(
  proposal: CompletedAdditionProposalV1
): Omit<CompletedAdditionProposalV1, "proposal_id"> {
  const { proposal_id: _proposalId, ...withoutId } = proposal;
  return withoutId;
}

function createRejectedChangeSet(
  journal: ChangeSetJournal,
  path: string,
  proposal: CompletedAdditionProposalV1,
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
  args: ApplyAdditionProposalV1Args,
  diagnostics: Diagnostic[]
): Promise<ApplyAdditionProposalV1Result> {
  const mode = args.mode ?? "dry_run";
  const changeSet = createRejectedChangeSet(journal, path, args.proposal, mode, diagnostics);
  if (mode === "dry_run") await journal.recordChangeSet(changeSet);
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

function currentNode(snapshot: GuidedDocumentSnapshot, ref: ExistingNodeRefV1) {
  return snapshot.nodes.find((node) => node.handle === ref.handle);
}

function verifyExistingRef(
  snapshot: GuidedDocumentSnapshot,
  ref: ExistingNodeRefV1,
  errors: Diagnostic[],
  file: string,
  label: string
): void {
  const current = currentNode(snapshot, ref);
  if (
    !current ||
    current.node_id !== ref.node_id ||
    current.node_type !== ref.node_type ||
    current.name !== ref.name
  ) {
    addError(errors, file, "guided_addition.state_stale", `${label} no longer identifies the same existing node`);
  }
}

function collectExistingRefs(proposal: CompletedAdditionProposalV1): Array<{ ref: ExistingNodeRefV1; label: string }> {
  const refs: Array<{ ref: ExistingNodeRefV1; label: string }> = [];
  const add = (ref: NodeRefV1 | undefined, label: string): void => {
    if (ref?.kind === "existing_node") refs.push({ ref, label });
  };
  if (proposal.addition.kind === "relationship") {
    add(proposal.addition.relationship.from, "Relationship source");
    add(proposal.addition.relationship.to, "Relationship target");
  }
  proposal.node_organization.forEach((organization, index) => {
    switch (organization.kind) {
      case "add_new_node_top_level":
        if (organization.order.kind === "before_existing" || organization.order.kind === "after_existing") {
          add(organization.order.node, `Organization ${index} order anchor`);
        }
        break;
      case "add_new_node_nested":
        add(organization.parent, `Organization ${index} parent`);
        break;
      case "place_new_source_at_target_position":
        add(organization.target, `Organization ${index} target`);
        break;
      case "keep_existing_node":
        add(organization.node, `Organization ${index} retained node`);
        break;
      case "move_existing_node":
        add(organization.node, `Organization ${index} moved node`);
        add(organization.destination_parent, `Organization ${index} destination parent`);
        break;
    }
  });
  proposal.accepted_material_effects.forEach((effect, index) => {
    add(effect.node, `Effect ${index} moved node`);
    add(effect.from_parent ?? undefined, `Effect ${index} original parent`);
    add(effect.destination_parent, `Effect ${index} destination parent`);
  });
  return refs;
}

function verifyNewRef(ref: NodeRefV1, errors: Diagnostic[], file: string, label: string): void {
  if (ref.kind === "new_node" && ref.local_node_id !== NEW_NODE_LOCAL_ID) {
    addError(errors, file, "guided_addition.choice_unavailable", `${label} has an unavailable proposal-local node`);
  }
}

function collectNodeRefs(proposal: CompletedAdditionProposalV1): NodeRefV1[] {
  const refs: NodeRefV1[] = [];
  if (proposal.addition.kind === "relationship") {
    refs.push(proposal.addition.relationship.from, proposal.addition.relationship.to);
  }
  for (const organization of proposal.node_organization) {
    switch (organization.kind) {
      case "add_new_node_top_level":
        refs.push(organization.node);
        if (organization.order.kind === "before_existing" || organization.order.kind === "after_existing") {
          refs.push(organization.order.node);
        }
        break;
      case "add_new_node_nested":
        refs.push(organization.node, organization.parent);
        break;
      case "place_new_source_at_target_position":
        refs.push(organization.source, organization.target);
        break;
      case "keep_existing_node":
        refs.push(organization.node);
        break;
      case "move_existing_node":
        refs.push(organization.node, organization.destination_parent);
        break;
    }
  }
  for (const effect of proposal.accepted_material_effects) {
    refs.push(effect.node, effect.destination_parent);
    if (effect.from_parent) refs.push(effect.from_parent);
  }
  return refs;
}

function parseNodeFields(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  node: ProposedNodeV1,
  profileId: string,
  errors: Diagnostic[],
  file: string
): ParsedNodeFields | undefined {
  const nodeType = catalog.getNodeType(node.node_type);
  if (!nodeType) {
    addError(errors, file, "guided_addition.choice_unavailable", `Node type '${node.node_type}' is unavailable`);
    return undefined;
  }
  const seen = new Set<string>();
  const properties: Array<{ key: string; value_kind: "quoted_string" | "bare_value"; raw_value: string }> = [];
  let nodeId: GuidedFieldValueV1 | undefined;
  let name: GuidedFieldValueV1 | undefined;
  for (const field of node.fields) {
    if (seen.has(field.field_id)) {
      addError(errors, file, "guided_addition.choice_unavailable", `Node field '${field.field_id}' is duplicated`);
      continue;
    }
    seen.add(field.field_id);
    if (field.field_id === "node_id") {
      nodeId = field;
    } else if (field.field_id === "name") {
      name = field;
    } else if (field.field_id.startsWith("node_property:")) {
      properties.push({
        key: field.field_id.slice("node_property:".length),
        value_kind: field.value_kind,
        raw_value: field.raw_value
      });
    } else {
      addError(errors, file, "guided_addition.choice_unavailable", `Node field '${field.field_id}' is unavailable`);
    }
  }
  if (!nodeId || nodeId.value_kind !== "bare_value" || nodeId.raw_value !== node.node_id) {
    addError(errors, file, "guided_addition.choice_unavailable", "Proposal node ID field does not match its node header");
  }
  if (!name || name.value_kind !== "quoted_string" || name.raw_value !== node.name) {
    addError(errors, file, "guided_addition.choice_unavailable", "Proposal node name field does not match its node header");
  }
  const normalized = normalizeAndValidateNodeFields(
    catalog,
    snapshot,
    nodeType,
    { node_id: node.node_id, name: node.name, properties },
    profileId
  );
  errors.push(...normalized.diagnostics.filter((item) => item.severity === "error"));
  if (!canonicalSame(normalized.fields.properties, properties)) {
    addError(errors, file, "guided_addition.choice_unavailable", "Proposal node fields are not canonical for the current bundle");
  }
  return {
    properties: normalized.fields.properties,
    diagnostics: normalized.diagnostics.filter((item) => item.severity !== "error")
  };
}

function parseEdgeFields(
  snapshot: GuidedDocumentSnapshot,
  relationship: GuidanceRelationshipRecord,
  fields: GuidedFieldValueV1[],
  errors: Diagnostic[],
  file: string
): ParsedEdgeFields {
  const seen = new Set<string>();
  const annotations: Record<"event" | "guard" | "effect", string | null> = {
    event: null,
    guard: null,
    effect: null
  };
  const props: Record<string, string> = {};
  for (const field of fields) {
    if (seen.has(field.field_id)) {
      addError(errors, file, "guided_addition.choice_unavailable", `Relationship field '${field.field_id}' is duplicated`);
      continue;
    }
    seen.add(field.field_id);
    if (field.value_kind !== "quoted_string") {
      addError(errors, file, "guided_addition.invalid_field_value", `Relationship field '${field.field_id}' must be quoted text`);
    }
    if (field.field_id.startsWith("edge_annotation:")) {
      const annotation = field.field_id.slice("edge_annotation:".length);
      if (annotation === "event" || annotation === "guard" || annotation === "effect") {
        annotations[annotation] = field.raw_value;
      } else {
        addError(errors, file, "guided_addition.choice_unavailable", `Relationship annotation '${annotation}' is unavailable`);
      }
    } else if (field.field_id.startsWith("edge_property:")) {
      props[field.field_id.slice("edge_property:".length)] = field.raw_value;
    } else {
      addError(errors, file, "guided_addition.choice_unavailable", `Relationship field '${field.field_id}' is unavailable`);
    }
  }
  const normalized = normalizeAndValidateEdgeFields(snapshot, relationship, { ...annotations, props });
  errors.push(...normalized.diagnostics.filter((item) => item.severity === "error"));
  const canonicalFields = [
    ...(["event", "guard", "effect"] as const).flatMap((key) => normalized.fields[key]
      ? [{ field_id: `edge_annotation:${key}`, value_kind: "quoted_string", raw_value: normalized.fields[key]! }]
      : []),
    ...Object.entries(normalized.fields.props).map(([key, raw_value]) => ({
      field_id: `edge_property:${key}`,
      value_kind: "quoted_string",
      raw_value
    }))
  ];
  if (!canonicalSame(canonicalFields, fields)) {
    addError(errors, file, "guided_addition.choice_unavailable", "Proposal relationship fields are not canonical for the current bundle");
  }
  return {
    event: normalized.fields.event ?? null,
    guard: normalized.fields.guard ?? null,
    effect: normalized.fields.effect ?? null,
    props: normalized.fields.props,
    diagnostics: normalized.diagnostics.filter((item) => item.severity !== "error")
  };
}

function sameNewRef(ref: NewNodeRefV1): boolean {
  return ref.local_node_id === NEW_NODE_LOCAL_ID;
}

function exactOrganization(
  actual: SemanticNodeOrganizationV1[],
  expected: SemanticNodeOrganizationV1[]
): boolean {
  return canonicalSame(actual, expected);
}

function topLevelPlacement(
  snapshot: GuidedDocumentSnapshot,
  order: SemanticSameLevelOrderV1,
  errors: Diagnostic[],
  file: string
): Placement | undefined {
  if (order.kind === "top_level_first") return { mode: "first", stream: "top_level" };
  if (order.kind === "top_level_last") return { mode: "last", stream: "top_level" };
  const anchor = currentNode(snapshot, order.node);
  if (!anchor || anchor.parent_handle !== null) {
    addError(errors, file, "guided_addition.choice_unavailable", "Top-level organization anchor is not currently top level");
    return undefined;
  }
  return {
    mode: order.kind === "before_existing" ? "before" : "after",
    stream: "top_level",
    anchor_handle: order.node.handle
  };
}

function relationTopOrderIsValid(
  order: SemanticSameLevelOrderV1,
  direction: "outgoing" | "incoming",
  anchor: ExistingNodeRefV1
): boolean {
  return direction === "outgoing"
    ? order.kind === "top_level_last" || (order.kind === "after_existing" && canonicalSame(order.node, anchor))
    : order.kind === "top_level_first" || (order.kind === "before_existing" && canonicalSame(order.node, anchor));
}

function childCount(snapshot: GuidedDocumentSnapshot, parent: NodeRefV1): number {
  return parent.kind === "new_node"
    ? 0
    : snapshot.nodes.filter((node) => node.parent_handle === parent.handle).length;
}

function nestedOrderIsValid(snapshot: GuidedDocumentSnapshot, parent: NodeRefV1, order: "only" | "first" | "last"): boolean {
  const count = childCount(snapshot, parent);
  return order === "only" ? count === 0 : count > 0;
}

function nestedPlacement(parent: NodeRefV1, order: "only" | "first" | "last", newHandle: Handle): Placement {
  return {
    mode: order === "first" ? "first" : "last",
    stream: "body",
    parent_handle: parent.kind === "existing_node" ? parent.handle : newHandle
  };
}

function verifyAcceptedEffect(
  snapshot: GuidedDocumentSnapshot,
  effect: MaterialEffectV1 | undefined,
  organization: Extract<SemanticNodeOrganizationV1, { kind: "move_existing_node" }>,
  errors: Diagnostic[],
  file: string
): void {
  if (!effect || organization.accepted_effect_id !== effect.effect_id) {
    addError(errors, file, "guided_addition.confirmation_required", "Moving an existing node requires its exact accepted material effect");
    return;
  }
  const expected = createMoveEffect(
    snapshot,
    snapshot.bundle_fingerprint,
    organization.node,
    organization.destination_parent,
    organization.order
  );
  if (!canonicalSame(effect, { ...expected, accepted: true })) {
    addError(errors, file, "guided_addition.confirmation_stale", "Accepted material effect no longer matches the exact move");
  }
}

function verifyStandaloneOrganization(
  proposal: CompletedAdditionProposalV1,
  newNode: ProposedNodeV1,
  errors: Diagnostic[],
  file: string
): Extract<SemanticNodeOrganizationV1, { kind: "add_new_node_top_level" }> | undefined {
  const organization = proposal.node_organization[0];
  if (
    proposal.node_organization.length !== 1 ||
    organization?.kind !== "add_new_node_top_level" ||
    !sameNewRef(organization.node) ||
    (organization.order.kind !== "top_level_first" && organization.order.kind !== "top_level_last")
  ) {
    addError(errors, file, "guided_addition.choice_unavailable", "Standalone proposal has an unavailable node organization");
    return undefined;
  }
  if (proposal.accepted_material_effects.length !== 0 || newNode.ref.local_node_id !== NEW_NODE_LOCAL_ID) {
    addError(errors, file, "guided_addition.confirmation_stale", "Standalone proposal contains an unexpected material effect");
  }
  return organization;
}

function verifyRelationshipOrganization(
  snapshot: GuidedDocumentSnapshot,
  proposal: CompletedAdditionProposalV1,
  relationship: ProposedRelationshipV1,
  relationshipRecord: GuidanceRelationshipRecord,
  newNode: ProposedNodeV1 | undefined,
  errors: Diagnostic[],
  file: string
): void {
  const direction = proposal.intent.direction!;
  const anchorRef = direction === "outgoing" ? relationship.from : relationship.to;
  if (anchorRef.kind !== "existing_node") {
    addError(errors, file, "guided_addition.choice_unavailable", "Relationship direction does not identify an existing starting node");
    return;
  }
  const remoteRef = direction === "outgoing" ? relationship.to : relationship.from;
  const usesNewRef = relationship.from.kind === "new_node" || relationship.to.kind === "new_node";
  if (usesNewRef !== Boolean(newNode) || (newNode && !sameNewRef(newNode.ref))) {
    addError(errors, file, "guided_addition.choice_unavailable", "Relationship new-node content does not match its endpoints");
    return;
  }
  if (relationship.from.kind === "new_node" && relationship.to.kind === "new_node") {
    addError(errors, file, "guided_addition.choice_unavailable", "A guided relationship cannot create both endpoints");
    return;
  }

  const structural =
    relationshipRecord.authoring.graph_role === "structural" &&
    relationshipRecord.authoring.source_organization === "nest_target_under_source";
  const organizations = proposal.node_organization;
  let move: Extract<SemanticNodeOrganizationV1, { kind: "move_existing_node" }> | undefined;

  if (!structural) {
    if (remoteRef.kind === "existing_node") {
      const expected: SemanticNodeOrganizationV1[] = [{ kind: "keep_existing_node", node: remoteRef }];
      if (!exactOrganization(organizations, expected)) {
        addError(errors, file, "guided_addition.choice_unavailable", "Non-structural existing endpoint must remain in its current location");
      }
    } else {
      const organization = organizations[0];
      if (
        organizations.length !== 1 ||
        organization?.kind !== "add_new_node_top_level" ||
        !sameNewRef(organization.node) ||
        !relationTopOrderIsValid(organization.order, direction, anchorRef)
      ) {
        addError(errors, file, "guided_addition.choice_unavailable", "Non-structural new endpoint has an unavailable top-level organization");
      }
    }
  } else if (relationship.from.kind === "existing_node" && relationship.to.kind === "new_node") {
    const organization = organizations[0];
    const validNested =
      organizations.length === 1 &&
      organization?.kind === "add_new_node_nested" &&
      sameNewRef(organization.node) &&
      canonicalSame(organization.parent, relationship.from) &&
      nestedOrderIsValid(snapshot, organization.parent, organization.order);
    const validTop =
      organizations.length === 1 &&
      organization?.kind === "add_new_node_top_level" &&
      sameNewRef(organization.node) &&
      relationTopOrderIsValid(organization.order, direction, anchorRef);
    if (!validNested && !validTop) {
      addError(errors, file, "guided_addition.choice_unavailable", "Structural new target has an unavailable organization or sibling order");
    }
  } else if (relationship.from.kind === "existing_node" && relationship.to.kind === "existing_node") {
    const keep: SemanticNodeOrganizationV1[] = [{ kind: "keep_existing_node", node: relationship.to }];
    const candidate = organizations[0];
    if (exactOrganization(organizations, keep)) {
      // The accepted no-move choice is fully represented by the keep assertion.
    } else if (
      organizations.length === 1 &&
      candidate?.kind === "move_existing_node" &&
      canonicalSame(candidate.node, relationship.to) &&
      canonicalSame(candidate.destination_parent, relationship.from) &&
      nestedOrderIsValid(snapshot, candidate.destination_parent, candidate.order) &&
      currentNode(snapshot, candidate.node)?.parent_handle !== relationship.from.handle
    ) {
      move = candidate;
    } else {
      addError(errors, file, "guided_addition.choice_unavailable", "Structural existing target has an unavailable keep or move organization");
    }
  } else if (relationship.from.kind === "new_node" && relationship.to.kind === "existing_node") {
    const place = organizations[0];
    const candidateMove = organizations[1];
    const validWrapper =
      organizations.length === 2 &&
      place?.kind === "place_new_source_at_target_position" &&
      sameNewRef(place.source) &&
      canonicalSame(place.target, relationship.to) &&
      candidateMove?.kind === "move_existing_node" &&
      canonicalSame(candidateMove.node, relationship.to) &&
      candidateMove.destination_parent.kind === "new_node" &&
      sameNewRef(candidateMove.destination_parent) &&
      candidateMove.order === "only";
    if (validWrapper) {
      move = candidateMove;
    } else {
      const keep = organizations[0];
      const add = organizations[1];
      const validLeave =
        organizations.length === 2 &&
        keep?.kind === "keep_existing_node" &&
        canonicalSame(keep.node, relationship.to) &&
        add?.kind === "add_new_node_top_level" &&
        sameNewRef(add.node) &&
        relationTopOrderIsValid(add.order, direction, anchorRef);
      if (!validLeave) {
        addError(errors, file, "guided_addition.choice_unavailable", "Structural new source has an unavailable wrap or leave organization");
      }
    }
  } else {
    addError(errors, file, "guided_addition.choice_unavailable", "Relationship endpoint organization is unavailable");
  }

  if (move) {
    if (proposal.accepted_material_effects.length !== 1) {
      addError(errors, file, "guided_addition.confirmation_required", "Exactly one accepted material effect is required for the move");
    }
    verifyAcceptedEffect(snapshot, proposal.accepted_material_effects[0], move, errors, file);
  } else if (proposal.accepted_material_effects.length !== 0) {
    addError(errors, file, "guided_addition.confirmation_stale", "Proposal contains a material effect without an existing-node move");
  }
}

function placementForNewNode(
  snapshot: GuidedDocumentSnapshot,
  organizations: SemanticNodeOrganizationV1[],
  newHandle: Handle,
  errors: Diagnostic[],
  file: string
): Placement | undefined {
  const wrapper = organizations.find((item) => item.kind === "place_new_source_at_target_position");
  if (wrapper?.kind === "place_new_source_at_target_position") {
    const target = currentNode(snapshot, wrapper.target);
    if (!target) return undefined;
    return target.parent_handle === null
      ? { mode: "before", stream: "top_level", anchor_handle: target.handle }
      : { mode: "before", stream: "body", parent_handle: target.parent_handle, anchor_handle: target.handle };
  }
  const organization = organizations.find(
    (item): item is Extract<SemanticNodeOrganizationV1, { kind: "add_new_node_top_level" | "add_new_node_nested" }> =>
      item.kind === "add_new_node_top_level" || item.kind === "add_new_node_nested"
  );
  if (!organization) {
    addError(errors, file, "guided_addition.choice_unavailable", "Proposal does not place its new node");
    return undefined;
  }
  return organization.kind === "add_new_node_top_level"
    ? topLevelPlacement(snapshot, organization.order, errors, file)
    : nestedPlacement(organization.parent, organization.order, newHandle);
}

function handleForRef(ref: NodeRefV1, newHandle: Handle | undefined): Handle | undefined {
  return ref.kind === "existing_node" ? ref.handle : newHandle;
}

function verifyProposal(
  catalog: GuidanceCatalog,
  snapshot: GuidedDocumentSnapshot,
  proposal: CompletedAdditionProposalV1,
  file: string
): VerifiedProposalV1 {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  if (proposal.kind !== "sdd-addition-proposal" || proposal.proposal_version !== "1.0") {
    addError(errors, file, "guided_addition.unsupported_version", "Guided Addition proposal version must be 1.0");
  }
  const expectedId = createGuidedOpaqueId("addp", proposalWithoutId(proposal));
  if (proposal.proposal_id !== expectedId) {
    addError(errors, file, "guided_addition.choice_unavailable", "Proposal ID does not match its canonical proposal content");
  }
  for (const { ref, label } of collectExistingRefs(proposal)) verifyExistingRef(snapshot, ref, errors, file, label);
  for (const [index, ref] of collectNodeRefs(proposal).entries()) verifyNewRef(ref, errors, file, `Reference ${index}`);

  if (proposal.guidance_context.display_profile_id !== catalog.default_display_profile_id) {
    addError(errors, file, "guided_addition.state_stale", "Proposal display profile no longer matches the Guided Addition default");
  }
  const browseIds = new Set<string>();
  for (const filter of proposal.guidance_context.diagram_filters) {
    if (browseIds.has(filter.browse_id)) {
      addError(errors, file, "guided_addition.choice_unavailable", `Diagram filter '${filter.browse_id}' is duplicated`);
    }
    browseIds.add(filter.browse_id);
    if (filter.diagram_id !== null && !catalog.getView(filter.diagram_id)) {
      addError(errors, file, "guided_addition.state_stale", `Diagram filter '${filter.diagram_id}' is unavailable`);
    }
  }

  let newNode: ProposedNodeV1 | undefined;
  if (proposal.addition.kind === "standalone_node") {
    if (
      proposal.intent.addition_kind !== "standalone_node" ||
      proposal.intent.direction !== undefined ||
      proposal.intent.selection_order !== undefined
    ) {
      addError(errors, file, "guided_addition.choice_unavailable", "Standalone proposal intent is inconsistent with its addition");
    }
    newNode = proposal.addition.node;
    const organization = verifyStandaloneOrganization(proposal, newNode, errors, file);
    if (organization) topLevelPlacement(snapshot, organization.order, errors, file);
  } else {
    if (
      proposal.intent.addition_kind !== "relationship" ||
      (proposal.intent.direction !== "outgoing" && proposal.intent.direction !== "incoming") ||
      (proposal.intent.selection_order !== "relationship_first" && proposal.intent.selection_order !== "existing_node_first")
    ) {
      addError(errors, file, "guided_addition.choice_unavailable", "Relationship proposal intent is incomplete or inconsistent");
    }
    newNode = proposal.addition.new_node;
  }

  let parsedNode: ParsedNodeFields | undefined;
  if (newNode) {
    if (snapshot.nodes.some((node) => node.node_id === newNode!.node_id)) {
      addError(errors, file, "guided_addition.node_id_collision", `Node ID '${newNode.node_id}' already exists`);
    }
    parsedNode = parseNodeFields(
      catalog,
      snapshot,
      newNode,
      proposal.guidance_context.display_profile_id,
      errors,
      file
    );
    if (parsedNode) warnings.push(...parsedNode.diagnostics);
  }

  let relationshipRecord: GuidanceRelationshipRecord | undefined;
  let parsedEdge: ParsedEdgeFields | undefined;
  if (proposal.addition.kind === "relationship") {
    const relationship = proposal.addition.relationship;
    const typeFor = (ref: NodeRefV1): string | undefined => ref.kind === "existing_node"
      ? currentNode(snapshot, ref)?.node_type
      : newNode?.node_type;
    const fromType = typeFor(relationship.from);
    const toType = typeFor(relationship.to);
    if (
      fromType !== relationship.triple.from_type ||
      toType !== relationship.triple.to_type
    ) {
      addError(errors, file, "guided_addition.choice_unavailable", "Relationship endpoint types do not match its literal triple");
    }
    relationshipRecord = catalog.getRelationship({
      from: relationship.triple.from_type,
      type: relationship.triple.relationship_type,
      to: relationship.triple.to_type
    });
    if (!relationshipRecord) {
      addError(errors, file, "guided_addition.choice_unavailable", "Relationship endpoint triple is unavailable in the current bundle");
    } else {
      parsedEdge = parseEdgeFields(snapshot, relationshipRecord, relationship.fields, errors, file);
      warnings.push(...parsedEdge.diagnostics);
      verifyRelationshipOrganization(snapshot, proposal, relationship, relationshipRecord, newNode, errors, file);
    }
  }

  if (errors.length > 0) return { operations: [], createdTargets: [], diagnostics: sortDiagnostics([...warnings, ...errors]) };

  const operations: ChangeOperation[] = [];
  const createdTargets: InternalOperationTarget[] = [];
  const newHandle = newNode ? temporaryHandle("node", proposal.proposal_id, NEW_NODE_LOCAL_ID) : undefined;
  if (newNode && newHandle && parsedNode) {
    const placement = placementForNewNode(snapshot, proposal.node_organization, newHandle, errors, file)!;
    operations.push({
      kind: "insert_node_block",
      node_type: newNode.node_type,
      node_id: newNode.node_id,
      name: newNode.name,
      placement,
      __internal_handle: newHandle
    } as ChangeOperation);
    createdTargets.push({ local_id: NEW_NODE_LOCAL_ID, kind: "node", temp_handle: newHandle });
    for (const property of parsedNode.properties) {
      operations.push({
        kind: "set_node_property",
        node_handle: newHandle,
        key: property.key,
        value_kind: property.value_kind,
        raw_value: property.raw_value
      });
    }
  }

  if (proposal.addition.kind === "relationship" && relationshipRecord && parsedEdge) {
    const relationship = proposal.addition.relationship;
    const parentHandle = handleForRef(relationship.from, newHandle)!;
    const edgeHandle = temporaryHandle("edge", proposal.proposal_id, NEW_EDGE_LOCAL_ID);
    const toName = relationship.to.kind === "existing_node" ? relationship.to.name : newNode!.name;
    operations.push({
      kind: "insert_edge_line",
      parent_handle: parentHandle,
      rel_type: relationship.triple.relationship_type,
      to: relationship.to.kind === "existing_node" ? relationship.to.node_id : newNode!.node_id,
      to_name: toName,
      event: parsedEdge.event,
      guard: parsedEdge.guard,
      effect: parsedEdge.effect,
      props: { ...parsedEdge.props },
      __internal_handle: edgeHandle
    } as ChangeOperation);
    createdTargets.push({
      local_id: NEW_EDGE_LOCAL_ID,
      kind: "edge",
      temp_handle: edgeHandle,
      ...(relationship.from.kind === "new_node" ? { parent_local_id: NEW_NODE_LOCAL_ID } : {})
    });
  }

  for (const organization of proposal.node_organization) {
    if (organization.kind !== "move_existing_node") continue;
    operations.push({
      kind: "reparent_node_block",
      node_handle: organization.node.handle,
      placement: nestedPlacement(organization.destination_parent, organization.order, newHandle!)
    });
  }
  return { operations, createdTargets, diagnostics: sortDiagnostics(warnings) };
}

function diagnosticsFromUnknown(error: unknown): Diagnostic[] | undefined {
  if (!error || typeof error !== "object" || !("diagnostics" in error)) return undefined;
  const diagnostics = (error as { diagnostics?: unknown }).diagnostics;
  return Array.isArray(diagnostics) ? diagnostics as Diagnostic[] : undefined;
}

export async function applyAdditionProposalV1(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: ApplyAdditionProposalV1Args,
  journal = createChangeSetJournal(workspace)
): Promise<ApplyAdditionProposalV1Result> {
  const proposal = args.proposal;
  const proposalPath = proposal.document_context.path;
  if (!proposalPath) {
    return rejectedResult(journal, proposal.document_context.document_ref, args, [
      diagnostic(proposal.document_context.document_ref, "guided_addition.choice_unavailable", "The file-backed v1 proposal executor requires document_context.path")
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
      diagnostic(resolved.publicPath, "guided_addition.unsupported_bundle", "The loaded bundle does not support Guided Addition")
    ]);
  }

  let text: string;
  try {
    text = normalizeTextToLf(await readFile(resolved.absolutePath, "utf8"));
  } catch {
    return rejectedResult(journal, resolved.publicPath, args, [
      diagnostic(resolved.publicPath, "sdd.document_missing", `Document '${resolved.publicPath}' does not exist.`)
    ]);
  }
  if (computeDocumentRevision(text) !== proposal.document_context.base_revision) {
    return rejectedResult(journal, resolved.publicPath, args, [
      diagnostic(resolved.publicPath, "guided_addition.state_stale", "Proposal base revision does not match the current document")
    ]);
  }
  if (computeBundleFingerprint(bundle) !== proposal.document_context.bundle_fingerprint) {
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
    const diagnostics = diagnosticsFromUnknown(error);
    if (diagnostics) return rejectedResult(journal, resolved.publicPath, args, diagnostics);
    throw error;
  }

  const verified = verifyProposal(createGuidanceCatalog(bundle), snapshot, proposal, resolved.publicPath);
  if (verified.diagnostics.some((item) => item.severity === "error")) {
    return rejectedResult(journal, resolved.publicPath, args, verified.diagnostics);
  }
  const mode = args.mode ?? "dry_run";
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
    return handle ? [{
      local_id: target.local_id,
      kind: target.kind,
      handle,
      ...(target.parent_local_id ? { parent_local_id: target.parent_local_id } : {})
    }] : [];
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
