import type { Bundle } from "../../bundle/types.js";
import { stringifyCanonicalJson } from "../../bundle/fingerprint.js";
import { GuidedAdditionUnsupportedBundleError } from "../../bundle/guidedAuthoring.js";
import { sortDiagnostics } from "../../diagnostics/types.js";
import type { Diagnostic } from "../../types.js";
import { createGuidanceCatalog, type GuidanceCatalog, type GuidanceRelationshipRecord } from "./catalog.js";
import type {
  BeginGuidedAdditionRequest,
  CompletedAdditionProposal,
  ConfirmedProposalEffect,
  ExistingNodeRef,
  ExistingOrNewNodeRef,
  GuidedAdditionAction,
  GuidedAdditionFilter,
  GuidedAdditionResult,
  GuidedAdditionRuntime,
  GuidedAdditionSelections,
  GuidedAdditionState,
  GuidedDocumentSnapshot,
  GuidedEdgeFieldValues,
  GuidedEndpointChoice,
  GuidedFieldDefinition,
  GuidedNodeFieldValues,
  GuidedNodeTypeChoice,
  GuidedOperationSelection,
  GuidedRelationshipPresence,
  GuidedRelationshipRole,
  GuidedStep,
  PlacementRecommendation,
  PlacementSelection,
  ProposedEdge,
  ProposedNode,
  ProposedRelationship,
  RelationshipChoice,
  RelationshipDisplay,
  SelectedPlacement
} from "./contracts.js";
import { GuidedAdditionDomainError } from "./contracts.js";
import {
  createEdgeFieldDefinitions,
  createNodeFieldDefinitions,
  normalizeAndValidateEdgeFields,
  normalizeAndValidateNodeFields,
  suggestNodeId
} from "./forms.js";
import { createGuidedOpaqueId } from "./identifiers.js";
import { deepFreeze } from "./immutability.js";
import {
  createPlacementRecommendations,
  effectForSelections,
  selectPlacement,
  type GuidedPlacementContext,
  type GuidedPlacementRecommendationRecord
} from "./placement.js";

const roleOrder: Record<GuidedRelationshipRole, number> = {
  primary: 0,
  supporting: 1,
  bridge: 2
};

const validRoles = new Set<GuidedRelationshipRole>(["primary", "supporting", "bridge"]);
const validPresences = new Set<GuidedRelationshipPresence>(["connector", "structural", "annotation", "hidden"]);

function existingRef(node: GuidedDocumentSnapshot["nodes"][number]): ExistingNodeRef {
  return {
    kind: "existing_node",
    handle: node.handle,
    node_id: node.node_id,
    node_type: node.node_type
  };
}

function sameExistingRef(left: ExistingNodeRef, right: ExistingNodeRef): boolean {
  return left.kind === right.kind &&
    left.handle === right.handle &&
    left.node_id === right.node_id &&
    left.node_type === right.node_type;
}

function sameJson(left: unknown, right: unknown): boolean {
  return stringifyCanonicalJson(left) === stringifyCanonicalJson(right);
}

function authoringDiagnostic(
  snapshot: GuidedDocumentSnapshot,
  code: string,
  message: string,
  severity: Diagnostic["severity"] = "error"
): Diagnostic {
  return {
    stage: "authoring",
    code,
    severity,
    message,
    file: snapshot.path ?? snapshot.document_ref
  };
}

function reject(
  snapshot: GuidedDocumentSnapshot,
  state: GuidedAdditionState | undefined,
  code: string,
  message: string,
  diagnostics: Diagnostic[] = []
): never {
  throw new GuidedAdditionDomainError(
    code,
    message,
    sortDiagnostics([...diagnostics, authoringDiagnostic(snapshot, code, message)]),
    state
  );
}

function cloneState(state: GuidedAdditionState): GuidedAdditionState {
  return structuredClone(state);
}

function operationOptions(anchor: ExistingNodeRef | undefined): GuidedOperationSelection[] {
  if (!anchor) {
    return [{ kind: "add_node" }];
  }
  return [
    { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_or_new" },
    { kind: "add_relationship", direction: "outgoing", endpoint_strategy: "existing_only" },
    { kind: "add_relationship", direction: "incoming", endpoint_strategy: "existing_or_new" },
    { kind: "add_relationship", direction: "incoming", endpoint_strategy: "existing_only" }
  ];
}

class GuidedAdditionPlanner implements GuidedAdditionRuntime {
  readonly #catalog: GuidanceCatalog;

  constructor(catalog: GuidanceCatalog) {
    this.#catalog = catalog;
    Object.freeze(this);
  }

  begin(snapshot: GuidedDocumentSnapshot, request: BeginGuidedAdditionRequest): GuidedAdditionResult {
    this.#assertSnapshot(snapshot);
    const anchor = request.anchor ? this.#resolveAnchor(snapshot, request.anchor) : undefined;
    const filter = this.#normalizeFilter(snapshot, request.initial_filter ?? {});
    const state: GuidedAdditionState = {
      kind: "sdd-guided-addition-state",
      workflow_version: "0.1",
      document_context: {
        document_ref: snapshot.document_ref,
        revision: snapshot.revision,
        bundle_fingerprint: snapshot.bundle_fingerprint
      },
      ...(anchor ? { anchor } : {}),
      filter,
      selections: { placements: [] },
      confirmed_effects: []
    };
    return this.#result(snapshot, state);
  }

  advance(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionState,
    action: GuidedAdditionAction
  ): GuidedAdditionResult {
    this.#assertCurrent(snapshot, state);
    const current = this.#result(snapshot, state);
    const currentStep = current.kind === "sdd-guided-addition-step" ? current.step : undefined;

    if (action.kind === "set_filter") {
      if (!currentStep) {
        reject(snapshot, state, "guided_addition.choice_unavailable", "A completed workflow cannot change filters");
      }
      const next = cloneState(state);
      next.filter = this.#normalizeFilter(snapshot, action.filter, state);
      this.#sanitizeSelections(snapshot, next);
      return this.#result(snapshot, next);
    }

    const next = cloneState(state);
    switch (action.kind) {
      case "choose_operation": {
        this.#requireStep(snapshot, state, currentStep, "choose_operation");
        if (!operationOptions(state.anchor).some((option) => sameJson(option, action.selection))) {
          reject(snapshot, state, "guided_addition.choice_unavailable", "The selected operation is not currently offered");
        }
        next.selections = { operation: structuredClone(action.selection), placements: [] };
        next.confirmed_effects = [];
        break;
      }
      case "choose_node_type": {
        this.#requireStep(snapshot, state, currentStep, "choose_node_type");
        const options = (currentStep as Extract<GuidedStep, { kind: "choose_node_type" }>).options;
        if (!options.some((option) => option.node_type === action.node_type)) {
          reject(snapshot, state, "guided_addition.choice_unavailable", "The selected node type is not currently offered");
        }
        next.selections.node_type = action.node_type;
        this.#clearAfterNodeType(next.selections);
        next.confirmed_effects = [];
        break;
      }
      case "choose_relationship": {
        this.#requireStep(snapshot, state, currentStep, "choose_relationship");
        const options = (currentStep as Extract<GuidedStep, { kind: "choose_relationship" }>).options;
        if (!options.some((option) => option.choice_id === action.choice_id)) {
          reject(snapshot, state, "guided_addition.choice_unavailable", "The selected relationship is not currently offered");
        }
        next.selections.relationship_choice_id = action.choice_id;
        this.#clearAfterRelationship(next.selections);
        next.confirmed_effects = [];
        break;
      }
      case "choose_existing_endpoint": {
        this.#requireStep(snapshot, state, currentStep, "choose_endpoint");
        const options = (currentStep as Extract<GuidedStep, { kind: "choose_endpoint" }>).options;
        const option = options.find((candidate) => candidate.kind === "existing" && sameExistingRef(candidate.node, action.node));
        if (!option || option.kind !== "existing") {
          reject(snapshot, state, "guided_addition.choice_unavailable", "The selected endpoint is not currently offered");
        }
        next.selections.endpoint = { kind: "existing", node: structuredClone(option.node) };
        this.#clearAfterEndpoint(next.selections);
        next.confirmed_effects = [];
        break;
      }
      case "create_new_endpoint": {
        this.#requireStep(snapshot, state, currentStep, "choose_endpoint");
        const options = (currentStep as Extract<GuidedStep, { kind: "choose_endpoint" }>).options;
        const option = options.find((candidate) => candidate.kind === "create_new");
        if (!option || option.kind !== "create_new") {
          reject(snapshot, state, "guided_addition.choice_unavailable", "Creating an endpoint is not currently offered");
        }
        next.selections.endpoint = { kind: "create_new", local_id: "node_1", node_type: option.node_type };
        this.#clearAfterEndpoint(next.selections);
        next.confirmed_effects = [];
        break;
      }
      case "set_new_node_fields": {
        this.#requireStep(snapshot, state, currentStep, "edit_new_node");
        const nodeType = this.#selectedNewNodeType(next.selections);
        const record = nodeType ? this.#catalog.getNodeType(nodeType) : undefined;
        if (!record) {
          reject(snapshot, state, "guided_addition.choice_unavailable", "The selected new-node form is unavailable");
        }
        const checked = normalizeAndValidateNodeFields(
          this.#catalog,
          snapshot,
          record,
          action.fields,
          next.filter.display_profile_id
        );
        const errors = checked.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
        if (errors.length > 0) {
          const primary = errors[0];
          reject(snapshot, state, primary.code, primary.message, checked.diagnostics.filter((item) => item !== primary));
        }
        next.selections.new_node_fields = checked.fields;
        next.selections.placements = [];
        next.confirmed_effects = [];
        break;
      }
      case "set_edge_fields": {
        this.#requireStep(snapshot, state, currentStep, "edit_edge_fields");
        const relationship = this.#selectedRelationship(snapshot, next);
        const checked = normalizeAndValidateEdgeFields(snapshot, relationship, action.fields);
        const errors = checked.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
        if (errors.length > 0) {
          const primary = errors[0];
          reject(snapshot, state, primary.code, primary.message, checked.diagnostics.filter((item) => item !== primary));
        }
        next.selections.edge_fields = checked.fields;
        next.selections.placements = [];
        next.confirmed_effects = [];
        break;
      }
      case "select_placement": {
        if (currentStep?.kind !== "review_placement" && currentStep?.kind !== "confirm_effect" && currentStep?.kind !== "review_proposal") {
          reject(snapshot, state, "guided_addition.choice_unavailable", "Placement selection is not currently offered");
        }
        const records = this.#placementRecords(snapshot, next);
        const selected = selectPlacement(records, action.selection.recommendation_id, action.selection.selected);
        if (!selected) {
          reject(snapshot, state, "guided_addition.choice_unavailable", "The selected placement is not currently offered");
        }
        next.selections.placements = [
          ...next.selections.placements.filter(
            (selection) => selection.recommendation_id !== action.selection.recommendation_id
          ),
          { recommendation_id: selected.recommendation_id, selected: selected.selected }
        ];
        next.confirmed_effects = [];
        break;
      }
      case "confirm_effect": {
        this.#requireStep(snapshot, state, currentStep, "confirm_effect");
        const effect = (currentStep as Extract<GuidedStep, { kind: "confirm_effect" }>).effect;
        if (!action.effect.confirmed || !sameJson({ ...action.effect, confirmed: undefined }, { ...effect, confirmed: undefined })) {
          reject(snapshot, state, "guided_addition.confirmation_stale", "The confirmation does not match the current effect");
        }
        next.confirmed_effects = [structuredClone(action.effect)];
        break;
      }
      case "complete": {
        this.#requireStep(snapshot, state, currentStep, "review_proposal");
        const proposal = (currentStep as Extract<GuidedStep, { kind: "review_proposal" }>).proposal;
        return deepFreeze({
          kind: "sdd-guided-addition-complete" as const,
          state: cloneState(state),
          proposal: structuredClone(proposal),
          diagnostics: this.#diagnostics(snapshot, state)
        });
      }
    }
    return this.#result(snapshot, next);
  }

  #assertSnapshot(snapshot: GuidedDocumentSnapshot): void {
    if (snapshot.bundle_fingerprint !== this.#catalog.bundle_fingerprint) {
      reject(snapshot, undefined, "guided_addition.state_stale", "Snapshot bundle fingerprint does not match the guided runtime");
    }
  }

  #assertCurrent(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionState): void {
    this.#assertSnapshot(snapshot);
    if (
      state.document_context.document_ref !== snapshot.document_ref ||
      state.document_context.revision !== snapshot.revision ||
      state.document_context.bundle_fingerprint !== snapshot.bundle_fingerprint
    ) {
      reject(snapshot, state, "guided_addition.state_stale", "Workflow state no longer matches the supplied document snapshot");
    }
    if (state.anchor) {
      this.#resolveAnchor(snapshot, state.anchor, state);
    }
    const normalizedFilter = this.#normalizeFilter(snapshot, state.filter, state);
    if (!sameJson(normalizedFilter, state.filter)) {
      reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow filter is not in its normalized offered form");
    }
    this.#assertSelectionsCurrent(snapshot, state);
  }

  #assertSelectionsCurrent(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionState): void {
    const operation = state.selections.operation;
    if (!operation) return;
    if (!operationOptions(state.anchor).some((candidate) => sameJson(candidate, operation))) {
      reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow operation is not currently offered");
    }
    if (operation.kind === "add_node") {
      if (state.selections.relationship_choice_id || state.selections.endpoint || state.selections.edge_fields) {
        reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow contains selections outside the standalone-node route");
      }
      if (
        state.selections.node_type &&
        !this.#nodeTypeChoices(snapshot, state.filter).some((choice) => choice.node_type === state.selections.node_type)
      ) {
        reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow node type is not currently offered");
      }
    } else if (state.selections.relationship_choice_id) {
      if (state.selections.node_type) {
        reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow contains a standalone node-type selection on a relationship route");
      }
      const choices = this.#relationshipChoices(snapshot, {
        ...state,
        selections: { ...state.selections, relationship_choice_id: undefined }
      });
      if (!choices.some((choice) => choice.choice_id === state.selections.relationship_choice_id)) {
        reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow relationship is not currently offered");
      }
      if (state.selections.endpoint) {
        const endpoint = state.selections.endpoint;
        const endpoints = this.#endpointChoices(snapshot, state);
        const available = endpoint.kind === "existing"
          ? endpoints.some((choice) => choice.kind === "existing" && sameExistingRef(choice.node, endpoint.node))
          : endpoints.some((choice) => choice.kind === "create_new" && choice.node_type === endpoint.node_type);
        if (!available) {
          reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow endpoint is not currently offered");
        }
      }
    }

    const nodeType = this.#selectedNewNodeType(state.selections);
    if (nodeType && state.selections.new_node_fields) {
      const record = this.#catalog.getNodeType(nodeType);
      if (!record) {
        reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow new-node type is unavailable");
      }
      const checked = normalizeAndValidateNodeFields(
        this.#catalog,
        snapshot,
        record,
        state.selections.new_node_fields,
        state.filter.display_profile_id
      );
      const error = checked.diagnostics.find((diagnostic) => diagnostic.severity === "error");
      if (error) {
        reject(snapshot, state, error.code, error.message, checked.diagnostics.filter((item) => item !== error));
      }
      if (!sameJson(checked.fields, state.selections.new_node_fields)) {
        reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow new-node fields are not normalized");
      }
    }
    if (operation.kind === "add_relationship" && state.selections.relationship_choice_id && state.selections.edge_fields) {
      const relationship = this.#selectedRelationship(snapshot, state);
      const checked = normalizeAndValidateEdgeFields(snapshot, relationship, state.selections.edge_fields);
      const error = checked.diagnostics.find((diagnostic) => diagnostic.severity === "error");
      if (error) {
        reject(snapshot, state, error.code, error.message, checked.diagnostics.filter((item) => item !== error));
      }
      if (!sameJson(checked.fields, state.selections.edge_fields)) {
        reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow edge fields are not normalized");
      }
    }
  }

  #resolveAnchor(
    snapshot: GuidedDocumentSnapshot,
    reference: ExistingNodeRef,
    state?: GuidedAdditionState
  ): ExistingNodeRef {
    const node = snapshot.nodes.find((candidate) => candidate.handle === reference.handle);
    if (!node || !sameExistingRef(existingRef(node), reference)) {
      reject(snapshot, state, "guided_addition.choice_unavailable", "Anchor does not exactly match the document snapshot");
    }
    return existingRef(node);
  }

  #normalizeFilter(
    snapshot: GuidedDocumentSnapshot,
    requested: GuidedAdditionFilter,
    state?: GuidedAdditionState
  ): GuidedAdditionFilter {
    const filter = structuredClone(requested);
    if (filter.view_id && !this.#catalog.getView(filter.view_id)) {
      reject(snapshot, state, "guided_addition.choice_unavailable", `Unknown guided view '${filter.view_id}'`);
    }
    if (filter.display_profile_id && !this.#catalog.getProfile(filter.display_profile_id)) {
      reject(snapshot, state, "guided_addition.choice_unavailable", `Unknown display profile '${filter.display_profile_id}'`);
    }
    if (!filter.view_id && (filter.display_profile_id || filter.roles || filter.presences)) {
      reject(snapshot, state, "guided_addition.choice_unavailable", "Display, role, and presence filters require a view");
    }
    if (filter.view_id && !filter.display_profile_id) {
      const defaultProfile = this.#catalog.profiles[0];
      if (!defaultProfile) {
        reject(snapshot, state, "guided_addition.invalid_bundle_guidance", "The bundle has no display profile");
      }
      filter.display_profile_id = defaultProfile.profile_id;
    }
    if (filter.roles && (new Set(filter.roles).size !== filter.roles.length || filter.roles.some((role) => !validRoles.has(role)))) {
      reject(snapshot, state, "guided_addition.choice_unavailable", "Role filter contains an unavailable value");
    }
    if (
      filter.presences &&
      (new Set(filter.presences).size !== filter.presences.length ||
        filter.presences.some((presence) => !validPresences.has(presence)))
    ) {
      reject(snapshot, state, "guided_addition.choice_unavailable", "Presence filter contains an unavailable value");
    }
    return filter;
  }

  #requireStep(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionState,
    step: GuidedStep | undefined,
    kind: GuidedStep["kind"]
  ): void {
    if (step?.kind !== kind) {
      reject(snapshot, state, "guided_addition.choice_unavailable", `Action requires the '${kind}' step`);
    }
  }

  #result(snapshot: GuidedDocumentSnapshot, stateInput: GuidedAdditionState): GuidedAdditionResult {
    const state = cloneState(stateInput);
    const step = this.#nextStep(snapshot, state);
    return deepFreeze({
      kind: "sdd-guided-addition-step" as const,
      state,
      step,
      diagnostics: this.#diagnostics(snapshot, state)
    });
  }

  #nextStep(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionState): GuidedStep {
    const operation = state.selections.operation;
    if (!operation) {
      return { kind: "choose_operation", options: operationOptions(state.anchor) };
    }
    if (operation.kind === "add_node") {
      if (!state.selections.node_type) {
        return { kind: "choose_node_type", options: this.#nodeTypeChoices(snapshot, state.filter) };
      }
      if (!state.selections.new_node_fields) {
        return this.#newNodeStep(snapshot, state, state.selections.node_type);
      }
    } else {
      if (!state.selections.relationship_choice_id) {
        return { kind: "choose_relationship", options: this.#relationshipChoices(snapshot, state) };
      }
      if (!state.selections.endpoint) {
        return { kind: "choose_endpoint", options: this.#endpointChoices(snapshot, state) };
      }
      if (state.selections.endpoint.kind === "create_new" && !state.selections.new_node_fields) {
        return this.#newNodeStep(snapshot, state, state.selections.endpoint.node_type);
      }
      const relationship = this.#selectedRelationship(snapshot, state);
      const edgeDefinitions = createEdgeFieldDefinitions(relationship);
      if (edgeDefinitions.length > 0 && !state.selections.edge_fields) {
        return {
          kind: "edit_edge_fields",
          local_id: "edge_1",
          fields: edgeDefinitions,
          values: { event: null, guard: null, effect: null, props: {} }
        };
      }
    }

    const records = this.#placementRecords(snapshot, state);
    const placementIds = state.selections.placements.map((selection) => selection.recommendation_id);
    if (
      new Set(placementIds).size !== placementIds.length ||
      state.selections.placements.some(
        (selection) => !selectPlacement(records, selection.recommendation_id, selection.selected)
      )
    ) {
      reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow contains a placement that is not currently offered");
    }
    const selected = this.#selectedPlacements(records, state.selections.placements);
    if (selected.length !== records.length) {
      return { kind: "review_placement", recommendations: records.map((record) => record.recommendation) };
    }
    const effect = effectForSelections(records, selected);
    if (effect) {
      const confirmation = state.confirmed_effects.find((candidate) => candidate.effect_id === effect.effect_id);
      if (!confirmation || !confirmation.confirmed || !sameJson({ ...confirmation, confirmed: undefined }, { ...effect, confirmed: undefined })) {
        return { kind: "confirm_effect", effect };
      }
    } else if (state.confirmed_effects.length > 0) {
      reject(snapshot, state, "guided_addition.confirmation_stale", "Workflow confirmation no longer matches a current effect");
    }
    return { kind: "review_proposal", proposal: this.#proposal(snapshot, state, selected, effect) };
  }

  #newNodeStep(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionState, nodeType: string): GuidedStep {
    const record = this.#catalog.getNodeType(nodeType);
    if (!record) {
      reject(snapshot, state, "guided_addition.choice_unavailable", "The selected node type is no longer offered");
    }
    const suggested = suggestNodeId(snapshot, record);
    return {
      kind: "edit_new_node",
      local_id: "node_1",
      fields: createNodeFieldDefinitions(this.#catalog, record, state.filter.display_profile_id),
      values: { node_id: suggested, name: "", properties: [] },
      suggested_node_id: suggested
    };
  }

  #nodeTypeChoices(snapshot: GuidedDocumentSnapshot, filter: GuidedAdditionFilter): GuidedNodeTypeChoice[] {
    const view = filter.view_id ? this.#catalog.getView(filter.view_id) : undefined;
    const documentTypes = snapshot.nodes.map((node) => node.node_type);
    const native = new Set<string>();
    if (view) {
      for (const relationship of view.relationships) {
        const display = this.#catalog.resolveDisplay(
          view.view_id,
          relationship,
          filter.display_profile_id!,
          { document_node_types: documentTypes }
        ).rule;
        if (
          relationship.role !== "bridge" &&
          (!filter.roles || filter.roles.includes(relationship.role)) &&
          (!filter.presences || filter.presences.includes(display.presence))
        ) {
          native.add(relationship.from);
          native.add(relationship.to);
        }
      }
    }
    return this.#catalog.node_types
      .map((record) => ({
        option_id: createGuidedOpaqueId("ntc", {
          bundle_fingerprint: this.#catalog.bundle_fingerprint,
          document_revision: snapshot.revision,
          node_type: record.node_type,
          filter
        }),
        node_type: record.node_type,
        ...(record.description ? { description: record.description } : {}),
        ...(view ? { view_role: native.has(record.node_type) ? "native" as const : "bridge" as const } : {})
      }))
      .sort((left, right) => {
        const role = (left.view_role === "bridge" ? 1 : 0) - (right.view_role === "bridge" ? 1 : 0);
        if (role !== 0) return role;
        return this.#catalog.getNodeType(left.node_type)!.node_type_order -
          this.#catalog.getNodeType(right.node_type)!.node_type_order;
      });
  }

  #relationshipChoices(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionState): RelationshipChoice[] {
    const operation = state.selections.operation;
    const anchor = state.anchor;
    if (!anchor || operation?.kind !== "add_relationship") {
      return [];
    }
    const candidates = this.#catalog.relationships
      .filter((relationship) =>
        operation.direction === "outgoing"
          ? relationship.from === anchor.node_type
          : relationship.to === anchor.node_type
      )
      .map((relationship) => {
        const endpointType = operation.direction === "outgoing" ? relationship.to : relationship.from;
        const existingCount = snapshot.nodes.filter(
          (node) => node.node_type === endpointType && node.handle !== anchor.handle
        ).length;
        return { relationship, existingCount };
      })
      .filter(({ existingCount }) => operation.endpoint_strategy !== "existing_only" || existingCount > 0);

    const view = state.filter.view_id ? this.#catalog.getView(state.filter.view_id) : undefined;
    const documentTypes = snapshot.nodes.map((node) => node.node_type);
    const filtered = candidates.filter(({ relationship }) => {
      if (!view) return true;
      const viewRelationship = this.#catalog.getViewRelationship(view.view_id, relationship)!;
      const display = this.#catalog.resolveDisplay(
        view.view_id,
        relationship,
        state.filter.display_profile_id!,
        { document_node_types: documentTypes }
      ).rule;
      return (!state.filter.roles || state.filter.roles.includes(viewRelationship.role)) &&
        (!state.filter.presences || state.filter.presences.includes(display.presence));
    });

    filtered.sort((left, right) => {
      if (view) {
        const leftRole = this.#catalog.getViewRelationship(view.view_id, left.relationship)!.role;
        const rightRole = this.#catalog.getViewRelationship(view.view_id, right.relationship)!.role;
        const role = roleOrder[leftRole] - roleOrder[rightRole];
        if (role !== 0) return role;
      }
      return left.relationship.relationship_order - right.relationship.relationship_order ||
        left.relationship.endpoint_order - right.relationship.endpoint_order;
    });

    return filtered.map(({ relationship, existingCount }) => {
      const definitions = createEdgeFieldDefinitions(relationship);
      return {
        choice_id: createGuidedOpaqueId("relc", {
          bundle_fingerprint: this.#catalog.bundle_fingerprint,
          from: relationship.from,
          type: relationship.type,
          to: relationship.to
        }),
        from_type: relationship.from,
        relationship_type: relationship.type,
        to_type: relationship.to,
        direction_relative_to_anchor: operation.direction,
        ...(relationship.meaning ? { meaning: relationship.meaning } : {}),
        role_by_view: Object.fromEntries(
          this.#catalog.views.map((catalogView) => [
            catalogView.view_id,
            this.#catalog.getViewRelationship(catalogView.view_id, relationship)!.role
          ])
        ),
        display_by_view: Object.fromEntries(
          this.#catalog.views.map((catalogView) => [
            catalogView.view_id,
            Object.fromEntries(
              this.#catalog.profiles.map((profile) => {
                const rule = this.#catalog.resolveDisplay(
                  catalogView.view_id,
                  relationship,
                  profile.profile_id,
                  { document_node_types: documentTypes }
                ).rule;
                const display: RelationshipDisplay = {
                  presence: rule.presence,
                  label: rule.label,
                  ...(rule.explanation ? { explanation: rule.explanation } : {})
                };
                return [profile.profile_id, display];
              })
            )
          ])
        ),
        existing_endpoint_count: existingCount,
        required_edge_fields: definitions.filter((definition) => definition.required),
        optional_edge_fields: definitions.filter((definition) => !definition.required)
      };
    });
  }

  #endpointChoices(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionState): GuidedEndpointChoice[] {
    const relationship = this.#selectedRelationship(snapshot, state);
    const operation = state.selections.operation;
    const anchor = state.anchor!;
    if (operation?.kind !== "add_relationship") return [];
    const endpointType = operation.direction === "outgoing" ? relationship.to : relationship.from;
    const existing = snapshot.nodes
      .filter((node) => node.node_type === endpointType && node.handle !== anchor.handle)
      .sort((left, right) => left.source_order - right.source_order)
      .map((node): GuidedEndpointChoice => {
        const nodeRef = existingRef(node);
        const from = operation.direction === "outgoing" ? anchor.node_id : node.node_id;
        const to = operation.direction === "outgoing" ? node.node_id : anchor.node_id;
        return {
          option_id: createGuidedOpaqueId("epc", {
            bundle_fingerprint: this.#catalog.bundle_fingerprint,
            document_revision: snapshot.revision,
            relationship_choice_id: state.selections.relationship_choice_id,
            node: nodeRef
          }),
          kind: "existing",
          node: nodeRef,
          existing_edge_count_for_triple_and_endpoints: snapshot.edges.filter(
            (edge) => edge.from === from && edge.type === relationship.type && edge.to === to
          ).length
        };
      });
    if (operation.endpoint_strategy === "existing_or_new") {
      existing.push({
        option_id: createGuidedOpaqueId("epc", {
          bundle_fingerprint: this.#catalog.bundle_fingerprint,
          document_revision: snapshot.revision,
          relationship_choice_id: state.selections.relationship_choice_id,
          create_new: endpointType
        }),
        kind: "create_new",
        node_type: endpointType,
        local_id: "node_1"
      });
    }
    return existing;
  }

  #selectedRelationship(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionState): GuidanceRelationshipRecord {
    const choice = this.#relationshipChoices(snapshot, {
      ...state,
      selections: { ...state.selections, relationship_choice_id: undefined }
    }).find((candidate) => candidate.choice_id === state.selections.relationship_choice_id);
    if (!choice) {
      reject(snapshot, state, "guided_addition.choice_unavailable", "The selected relationship is no longer offered");
    }
    return this.#catalog.getRelationship({
      from: choice.from_type,
      type: choice.relationship_type,
      to: choice.to_type
    })!;
  }

  #selectedNewNodeType(selections: GuidedAdditionSelections): string | undefined {
    return selections.operation?.kind === "add_node"
      ? selections.node_type
      : selections.endpoint?.kind === "create_new"
        ? selections.endpoint.node_type
        : undefined;
  }

  #placementContext(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionState): GuidedPlacementContext {
    const operation = state.selections.operation!;
    const nodeType = this.#selectedNewNodeType(state.selections);
    const fields = state.selections.new_node_fields;
    const newNode = nodeType && fields
      ? { kind: "new_node" as const, local_id: "node_1", node_id: fields.node_id, node_type: nodeType }
      : undefined;
    if (operation.kind === "add_node") {
      return { new_node: newNode };
    }
    const relationship = this.#selectedRelationship(snapshot, state);
    const endpoint: ExistingOrNewNodeRef = state.selections.endpoint!.kind === "existing"
      ? state.selections.endpoint!.node
      : newNode!;
    const from = operation.direction === "outgoing" ? state.anchor! : endpoint;
    const to = operation.direction === "outgoing" ? endpoint : state.anchor!;
    return {
      relationship,
      direction: operation.direction,
      anchor: state.anchor,
      new_node: newNode,
      from,
      to
    };
  }

  #placementRecords(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionState
  ): GuidedPlacementRecommendationRecord[] {
    return createPlacementRecommendations(this.#catalog, snapshot, this.#placementContext(snapshot, state));
  }

  #selectedPlacements(
    records: GuidedPlacementRecommendationRecord[],
    selections: PlacementSelection[]
  ): SelectedPlacement[] {
    return records.flatMap((record) => {
      const selection = selections.find(
        (candidate) => candidate.recommendation_id === record.recommendation.recommendation_id
      );
      if (!selection) return [];
      const selected = selectPlacement(records, selection.recommendation_id, selection.selected);
      return selected ? [selected] : [];
    });
  }

  #proposal(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionState,
    placements: SelectedPlacement[],
    effect: ReturnType<typeof effectForSelections>
  ): CompletedAdditionProposal {
    const context = this.#placementContext(snapshot, state);
    const operation = state.selections.operation!;
    const nodeType = this.#selectedNewNodeType(state.selections);
    const fields = state.selections.new_node_fields;
    const proposedNode: ProposedNode | undefined = nodeType && fields
      ? {
          local_id: "node_1",
          node_type: nodeType,
          node_id: fields.node_id,
          name: fields.name,
          properties: fields.properties.map((property) => ({ ...property }))
        }
      : undefined;
    const relationship: ProposedRelationship | undefined = operation.kind === "add_relationship" && context.from && context.to
      ? {
          type: context.relationship!.type,
          from: context.from,
          to: context.to,
          direction_relative_to_anchor: operation.direction
        }
      : undefined;
    const edgeFields: GuidedEdgeFieldValues = state.selections.edge_fields ?? {
      event: null,
      guard: null,
      effect: null,
      props: {}
    };
    const target = context.to;
    const targetName = target?.kind === "existing_node"
      ? snapshot.nodes.find((node) => node.handle === target.handle)?.name ?? null
      : proposedNode?.name ?? null;
    const edge: ProposedEdge | undefined = relationship
      ? {
          local_id: "edge_1",
          from: relationship.from,
          type: relationship.type,
          to: relationship.to,
          to_name: this.#catalog.placement_policy.edge_to_name_hint === "target_name" ? targetName : null,
          event: edgeFields.event ?? null,
          guard: edgeFields.guard ?? null,
          effect: edgeFields.effect ?? null,
          props: { ...edgeFields.props }
        }
      : undefined;
    const confirmedEffects: ConfirmedProposalEffect[] = effect
      ? state.confirmed_effects.filter((candidate) => candidate.effect_id === effect.effect_id).map((item) => ({ ...item }))
      : [];
    const withoutId = {
      kind: "sdd-addition-proposal" as const,
      proposal_version: "0.1" as const,
      document_context: {
        document_ref: snapshot.document_ref,
        ...(snapshot.path ? { path: snapshot.path } : {}),
        base_revision: snapshot.revision,
        bundle_fingerprint: snapshot.bundle_fingerprint
      },
      ...(state.anchor ? { anchor: state.anchor } : {}),
      guidance_context: {
        ...(state.filter.view_id ? { view_id: state.filter.view_id } : {}),
        ...(state.filter.display_profile_id ? { display_profile_id: state.filter.display_profile_id } : {}),
        ...(state.filter.view_id && context.relationship
          ? {
              relationship_role: this.#catalog.getViewRelationship(state.filter.view_id, context.relationship)!.role
            }
          : {})
      },
      ...(relationship ? { relationship } : {}),
      new_nodes: proposedNode ? [proposedNode] : [],
      new_edges: edge ? [edge] : [],
      placements,
      confirmed_effects: confirmedEffects
    };
    return {
      ...withoutId,
      proposal_id: createGuidedOpaqueId("addp", withoutId)
    };
  }

  #diagnostics(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionState): Diagnostic[] {
    const diagnostics = structuredClone(snapshot.diagnostics);
    const nodeType = this.#selectedNewNodeType(state.selections);
    if (nodeType && state.selections.new_node_fields) {
      const record = this.#catalog.getNodeType(nodeType)!;
      diagnostics.push(
        ...normalizeAndValidateNodeFields(
          this.#catalog,
          snapshot,
          record,
          state.selections.new_node_fields,
          state.filter.display_profile_id
        ).diagnostics.filter((diagnostic) => diagnostic.severity !== "error")
      );
    }
    return sortDiagnostics(diagnostics);
  }

  #sanitizeSelections(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionState): void {
    const operation = state.selections.operation;
    if (!operation || !operationOptions(state.anchor).some((candidate) => sameJson(candidate, operation))) {
      state.selections = { placements: [] };
      state.confirmed_effects = [];
      return;
    }
    if (operation.kind === "add_node") {
      const offered = this.#nodeTypeChoices(snapshot, state.filter);
      if (state.selections.node_type && !offered.some((choice) => choice.node_type === state.selections.node_type)) {
        state.selections = { operation, placements: [] };
        state.confirmed_effects = [];
      }
      return;
    }
    const offeredRelationships = this.#relationshipChoices(snapshot, {
      ...state,
      selections: { ...state.selections, relationship_choice_id: undefined }
    });
    if (
      state.selections.relationship_choice_id &&
      !offeredRelationships.some((choice) => choice.choice_id === state.selections.relationship_choice_id)
    ) {
      state.selections = { operation, placements: [] };
      state.confirmed_effects = [];
      return;
    }
    if (state.selections.relationship_choice_id && state.selections.endpoint) {
      const endpoints = this.#endpointChoices(snapshot, state);
      const endpoint = state.selections.endpoint;
      const available = endpoint.kind === "existing"
        ? endpoints.some((choice) => choice.kind === "existing" && sameExistingRef(choice.node, endpoint.node))
        : endpoints.some((choice) => choice.kind === "create_new" && choice.node_type === endpoint.node_type);
      if (!available) {
        this.#clearAfterRelationship(state.selections);
        state.confirmed_effects = [];
      }
    }
  }

  #clearAfterNodeType(selections: GuidedAdditionSelections): void {
    delete selections.new_node_fields;
    delete selections.edge_fields;
    delete selections.endpoint;
    selections.placements = [];
  }

  #clearAfterRelationship(selections: GuidedAdditionSelections): void {
    delete selections.endpoint;
    delete selections.new_node_fields;
    delete selections.edge_fields;
    selections.placements = [];
  }

  #clearAfterEndpoint(selections: GuidedAdditionSelections): void {
    delete selections.new_node_fields;
    delete selections.edge_fields;
    selections.placements = [];
  }
}

export function createGuidedAdditionRuntime(bundle: Bundle): GuidedAdditionRuntime {
  try {
    return new GuidedAdditionPlanner(createGuidanceCatalog(bundle));
  } catch (error) {
    if (error instanceof GuidedAdditionUnsupportedBundleError) {
      throw new GuidedAdditionDomainError(error.code, error.message, [
        {
          stage: "authoring",
          code: error.code,
          severity: "error",
          message: error.message,
          file: bundle.manifestPath
        }
      ]);
    }
    throw error;
  }
}
