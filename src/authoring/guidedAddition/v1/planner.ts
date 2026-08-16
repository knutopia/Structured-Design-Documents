import { stringifyCanonicalJson } from "../../../bundle/fingerprint.js";
import type { Bundle } from "../../../bundle/types.js";
import { sortDiagnostics } from "../../../diagnostics/types.js";
import type { Diagnostic } from "../../../types.js";
import { createGuidanceCatalog, type GuidanceCatalog, type GuidanceRelationshipRecord } from "../catalog.js";
import {
  createEdgeFieldDefinitions,
  createNodeFieldDefinitions,
  normalizeAndValidateEdgeFields,
  normalizeAndValidateNodeFields,
  suggestNodeId
} from "../forms.js";
import { createGuidedOpaqueId } from "../identifiers.js";
import { deepFreeze } from "../immutability.js";
import type { GuidedDocumentSnapshot, GuidedExistingNode } from "../sharedContracts.js";
import { nodeLabel, relationshipSentence } from "./content.js";
import {
  rankRelationshipsForDiagram,
  orderedTypesForDiagram,
  relationshipBrowseId,
  relationshipCandidates,
  relationshipsForEndpoint,
  typesForDiagram
} from "./filters.js";
import { childrenOf, createMoveEffect, relationshipRefs } from "./organization.js";
import {
  GuidedAdditionV1DomainError,
  type BeginGuidedAdditionRequestV1,
  type CompletedAdditionProposalV1,
  type EndpointTripleV1,
  type ExistingNodeRefV1,
  type GuidedAdditionActionV1,
  type GuidedAdditionResultV1,
  type GuidedAdditionRuntimeV1,
  type GuidedAdditionStateV1,
  type GuidedChoicePageKindV1,
  type GuidedChoicePageV1,
  type GuidedChoiceV1,
  type GuidedFieldDefinitionV1,
  type GuidedFieldValueV1,
  type GuidedFormPageV1,
  type GuidedPageV1,
  type GuidedProgressV1,
  type NewNodeRefV1,
  type ProposedNodeV1,
  type RelationshipDraftV1,
  type RelationshipRouteV1,
  type SemanticNodeOrganizationV1,
  type SemanticSameLevelOrderV1
} from "./contracts.js";

const NEW_NODE: NewNodeRefV1 = { kind: "new_node", local_node_id: "node_1" };

function sameJson(left: unknown, right: unknown): boolean {
  return stringifyCanonicalJson(left) === stringifyCanonicalJson(right);
}

function diagnostic(snapshot: GuidedDocumentSnapshot, code: string, message: string): Diagnostic {
  return { stage: "authoring", code, severity: "error", message, file: snapshot.path ?? snapshot.document_ref };
}

function reject(
  snapshot: GuidedDocumentSnapshot,
  state: GuidedAdditionStateV1 | undefined,
  code: string,
  message: string,
  extras: Diagnostic[] = []
): never {
  throw new GuidedAdditionV1DomainError(
    code,
    message,
    sortDiagnostics([...extras, diagnostic(snapshot, code, message)]),
    state
  );
}

function existingRef(node: GuidedExistingNode): ExistingNodeRefV1 {
  return {
    kind: "existing_node",
    handle: node.handle,
    node_id: node.node_id,
    node_type: node.node_type,
    name: node.name
  };
}

function triple(record: GuidanceRelationshipRecord): EndpointTripleV1 {
  return { from_type: record.from, relationship_type: record.type, to_type: record.to };
}

function catalogTriple(value: EndpointTripleV1) {
  return { from: value.from_type, type: value.relationship_type, to: value.to_type };
}

function choicePrefix(action: GuidedAdditionActionV1): "relc" | "ntc" | "epc" {
  if (action.kind.includes("relationship")) return "relc";
  if (action.kind.includes("node_type")) return "ntc";
  return "epc";
}

function choice(
  snapshot: GuidedDocumentSnapshot,
  display: string,
  chosen: string,
  action: GuidedAdditionActionV1,
  recommended = false,
  description?: string
): GuidedChoiceV1 {
  return {
    choice_id: createGuidedOpaqueId(choicePrefix(action), {
      bundle_fingerprint: snapshot.bundle_fingerprint,
      revision: snapshot.revision,
      ...(snapshot.document_precondition ? { document_precondition: snapshot.document_precondition } : {}),
      display,
      action
    }),
    display,
    ...(description ? { description } : {}),
    chosen,
    recommended,
    action
  };
}

function choicePage(
  kind: GuidedChoicePageKindV1,
  title: string,
  choices: GuidedChoiceV1[],
  prompt?: string
): GuidedChoicePageV1 {
  return {
    page_id: `guided-v1:${kind}`,
    page_kind: kind,
    content: { title, ...(prompt !== undefined ? { prompt } : {}), lines: [] },
    choices
  };
}

function proposedName(node: ProposedNodeV1 | undefined): string {
  return node ? `${node.node_id}: ${node.name}` : "new node";
}

class GuidedAdditionPlannerV1 implements GuidedAdditionRuntimeV1 {
  readonly #catalog: GuidanceCatalog;

  constructor(catalog: GuidanceCatalog) {
    this.#catalog = catalog;
    Object.freeze(this);
  }

  begin(snapshot: GuidedDocumentSnapshot, request: BeginGuidedAdditionRequestV1): GuidedAdditionResultV1 {
    this.#assertSnapshot(snapshot);
    if ((request as { workflow_version?: string }).workflow_version !== "1.0") {
      reject(snapshot, undefined, "guided_addition.unsupported_version", "Guided Addition workflow version must be 1.0");
    }
    const anchor = request.anchor ? this.#resolveRef(snapshot, request.anchor) : undefined;
    const state: GuidedAdditionStateV1 = {
      kind: "sdd-guided-addition-state",
      workflow_version: "1.0",
      document_context: {
        document_ref: snapshot.document_ref,
        ...(snapshot.document_precondition ? { document_precondition: snapshot.document_precondition } : {}),
        revision: snapshot.revision,
        bundle_fingerprint: snapshot.bundle_fingerprint
      },
      ...(anchor ? { anchor } : {}),
      browse_filters: {},
      progress: anchor
        ? { kind: "choose_relationship_route", anchor }
        : snapshot.document_precondition === "must_not_exist"
          ? { kind: "standalone.browse_node_type" }
          : { kind: "choose_addition_kind" },
      accepted_material_effects: []
    };
    return this.#result(snapshot, state);
  }

  advance(
    snapshot: GuidedDocumentSnapshot,
    stateInput: GuidedAdditionStateV1,
    action: GuidedAdditionActionV1
  ): GuidedAdditionResultV1 {
    this.#assertCurrent(snapshot, stateInput);
    const current = this.#result(snapshot, stateInput);
    if (current.kind !== "sdd-guided-addition-step") {
      reject(snapshot, stateInput, "guided_addition.choice_unavailable", "A completed workflow cannot advance");
    }
    const state = structuredClone(stateInput);
    const page = current.page;

    if (!("choices" in page)) {
      this.#applyForm(snapshot, state, page, action);
      return this.#result(snapshot, state);
    }

    const offered = page.choices.find((candidate) => sameJson(candidate.action, action));
    if (!offered) {
      reject(snapshot, stateInput, "guided_addition.choice_unavailable", "The action was not offered by the current Guided Addition page");
    }
    this.#applyChoice(snapshot, state, action);
    return this.#result(snapshot, state);
  }

  #assertSnapshot(snapshot: GuidedDocumentSnapshot): void {
    if (snapshot.bundle_fingerprint !== this.#catalog.bundle_fingerprint) {
      reject(snapshot, undefined, "guided_addition.state_stale", "Snapshot bundle fingerprint does not match the v1 runtime");
    }
  }

  #assertCurrent(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionStateV1): void {
    this.#assertSnapshot(snapshot);
    if (state.workflow_version !== "1.0") {
      reject(snapshot, state, "guided_addition.unsupported_version", "Guided Addition workflow state must use version 1.0");
    }
    if (
      state.document_context.document_ref !== snapshot.document_ref ||
      state.document_context.document_precondition !== snapshot.document_precondition ||
      state.document_context.revision !== snapshot.revision ||
      state.document_context.bundle_fingerprint !== snapshot.bundle_fingerprint
    ) {
      reject(snapshot, state, "guided_addition.state_stale", "Workflow state no longer matches the supplied document snapshot");
    }
    if (state.anchor) this.#resolveRef(snapshot, state.anchor, state);
    for (const value of Object.values(state.browse_filters)) {
      if (value.diagram_id !== null && !this.#catalog.getView(value.diagram_id)) {
        reject(snapshot, state, "guided_addition.choice_unavailable", "Workflow contains an unavailable diagram filter");
      }
    }
  }

  #resolveRef(
    snapshot: GuidedDocumentSnapshot,
    ref: ExistingNodeRefV1,
    state?: GuidedAdditionStateV1
  ): ExistingNodeRefV1 {
    const node = snapshot.nodes.find((candidate) => candidate.handle === ref.handle);
    const resolved = node ? existingRef(node) : undefined;
    if (!resolved || !sameJson(resolved, ref)) {
      reject(snapshot, state, "guided_addition.choice_unavailable", `Existing node '${ref.node_id}' is unavailable`);
    }
    return resolved;
  }

  #result(snapshot: GuidedDocumentSnapshot, stateInput: GuidedAdditionStateV1): GuidedAdditionResultV1 {
    const state = structuredClone(stateInput);
    if (state.progress.kind === "standalone.ready") return this.#completeStandalone(snapshot, state, state.progress);
    if (state.progress.kind === "relationship.ready") return this.#completeRelationship(snapshot, state, state.progress.draft);
    const page = this.#page(snapshot, state);
    return deepFreeze({
      kind: "sdd-guided-addition-step" as const,
      api_version: "1.0" as const,
      state,
      page,
      diagnostics: []
    });
  }

  #page(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionStateV1): GuidedPageV1 {
    const progress = state.progress;
    switch (progress.kind) {
      case "choose_addition_kind":
        return choicePage("choose_addition_kind", "What would you like to add?", [
          choice(snapshot, "Add a standalone node", "Chosen: Add a standalone node", {
            kind: "choose_addition_kind", addition_kind: "standalone_node"
          }),
          choice(snapshot, "Add a relationship", "Chosen: Add a relationship", {
            kind: "choose_addition_kind", addition_kind: "relationship"
          })
        ]);
      case "browse_starting_node":
        return this.#startingNodePage(snapshot, state);
      case "choose_relationship_route":
        return this.#routePage(snapshot, progress.anchor);
      case "browse_diagram_filter":
        return this.#diagramFilterPage(snapshot, state, progress.browse_id);
      case "standalone.browse_node_type":
        return this.#nodeTypePage(snapshot, state);
      case "standalone.edit_primary":
        return this.#nodeFormPage(snapshot, progress.node_type, undefined, "primary");
      case "standalone.choose_details":
        return this.#nodeDetailsPage(snapshot, progress.node);
      case "standalone.edit_additional":
        return this.#nodeFormPage(snapshot, progress.node.node_type, progress.node, "additional");
      case "standalone.choose_order":
        return this.#standaloneOrderPage(snapshot, progress.node);
      case "standalone.ready":
        throw new Error("Ready progress completes before page construction");
      case "relationship_first.browse_combination":
        return this.#relationshipCombinationPage(snapshot, state, progress.route, progress.anchor);
      case "relationship_first.browse_endpoint":
        return this.#relationshipEndpointPage(snapshot, progress.draft);
      case "existing_node_first.browse_endpoint":
        return this.#existingEndpointPage(snapshot, state, progress.route, progress.anchor);
      case "existing_node_first.choose_relationship":
        return this.#relationshipForEndpointPage(snapshot, progress.draft);
      case "relationship.edit_new_node":
        return this.#nodeFormPage(snapshot, progress.node_type, progress.draft.new_node, "primary");
      case "relationship.choose_node_details":
        return this.#nodeDetailsPage(snapshot, progress.draft.new_node!);
      case "relationship.edit_node_details":
        return this.#nodeFormPage(snapshot, progress.draft.new_node!.node_type, progress.draft.new_node, "additional");
      case "relationship.choose_details":
        return this.#relationshipDetailsDisclosurePage(snapshot, progress.draft);
      case "relationship.edit_details":
        return this.#relationshipFormPage(snapshot, progress.draft);
      case "relationship.choose_organization":
        return this.#organizationPage(snapshot, progress.draft);
      case "relationship.choose_order":
        return this.#relationshipOrderPage(snapshot, progress.draft, progress.order_context);
      case "relationship.confirm_effect":
        return this.#confirmationPage(snapshot, progress.draft);
      case "relationship.ready":
        throw new Error("Ready progress completes before page construction");
    }
  }

  #filterChoice(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionStateV1, browseId: string, noun: string): GuidedChoiceV1 {
    const diagramId = state.browse_filters[browseId]?.diagram_id ?? null;
    const name = diagramId ? this.#catalog.getView(diagramId)!.name : "All diagram types";
    return choice(snapshot, `[Filter ${noun} by diagram type: ${name}]`, "Chosen: Change filter", {
      kind: "open_diagram_filter", browse_id: browseId
    });
  }

  #diagramFilterPage(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionStateV1, browseId: string): GuidedChoicePageV1 {
    const current = state.browse_filters[browseId]?.diagram_id ?? null;
    return choicePage("browse_diagram_filter", "Choose a diagram type to filter nodes by", [
      choice(
        snapshot,
        `All diagram types${current === null ? " (current)" : ""}`,
        "Chosen: All diagram types filter",
        { kind: "clear_diagram_filter", browse_id: browseId }
      ),
      ...this.#catalog.views.map((view) => choice(
        snapshot,
        `${view.name}${current === view.view_id ? " (current)" : ""}`,
        `Chosen: ${view.name} filter`,
        { kind: "set_diagram_filter", browse_id: browseId, diagram_id: view.view_id },
        false,
        view.scope_description
      ))
    ]);
  }

  #startingNodePage(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionStateV1): GuidedChoicePageV1 {
    const browseId = "starting_node";
    const diagramId = state.browse_filters[browseId]?.diagram_id ?? null;
    const allowed = typesForDiagram(this.#catalog, diagramId);
    const nodes = snapshot.nodes.filter((node) => !allowed || allowed.has(node.node_type));
    return choicePage("browse_starting_node", "Choose a node to add the relationship to", [
      this.#filterChoice(snapshot, state, browseId, "nodes"),
      ...nodes.map((node) => {
        const ref = existingRef(node);
        return choice(snapshot, `${nodeLabel(ref)} (${ref.node_type})`, `Chosen: ${nodeLabel(ref)}`, {
          kind: "choose_starting_node", node: ref
        });
      })
    ]);
  }

  #routePage(snapshot: GuidedDocumentSnapshot, anchor: ExistingNodeRefV1): GuidedChoicePageV1 {
    return choicePage("choose_relationship_route", "Choose a connection direction", [
      choice(snapshot, `Outgoing: ${anchor.node_id} connects to another node [choose by relationship type]`,
        `Chosen: ${anchor.node_id} connects to another node [choose by relationship type]`,
        { kind: "choose_relationship_route", direction: "outgoing", selection_order: "relationship_first" }),
      choice(snapshot, `Outgoing: ${anchor.node_id} connects to another node [choose by existing destination node]`,
        `Chosen: ${anchor.node_id} connects to another node [choose by existing destination node]`,
        { kind: "choose_relationship_route", direction: "outgoing", selection_order: "existing_node_first" }),
      choice(snapshot, `Incoming: another node connects to ${anchor.node_id} [choose by relationship type]`,
        `Chosen: another node connects to ${anchor.node_id} [choose by relationship type]`,
        { kind: "choose_relationship_route", direction: "incoming", selection_order: "relationship_first" }),
      choice(snapshot, `Incoming: another node connects to ${anchor.node_id} [choose by existing origin node]`,
        `Chosen: another node connects to ${anchor.node_id} [choose by existing origin node]`,
        { kind: "choose_relationship_route", direction: "incoming", selection_order: "existing_node_first" })
    ]);
  }

  #nodeTypePage(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionStateV1): GuidedChoicePageV1 {
    const browseId = "standalone_node_type";
    const diagramId = state.browse_filters[browseId]?.diagram_id ?? null;
    return choicePage("browse_standalone_node_type", "Choose a node type", [
      this.#filterChoice(snapshot, state, browseId, "nodes"),
      ...orderedTypesForDiagram(this.#catalog, diagramId).map((nodeType) => this.#catalog.getNodeType(nodeType)!).map((node) => choice(
        snapshot,
        `${node.node_type}${node.description ? ` — ${node.description}` : ""}`,
        `Chosen: node type ${node.node_type}`,
        { kind: "choose_standalone_node_type", node_type: node.node_type }
      ))
    ]);
  }

  #relationshipCombinationPage(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    route: RelationshipRouteV1,
    anchor: ExistingNodeRefV1
  ): GuidedChoicePageV1 {
    const browseId = relationshipBrowseId(route);
    const diagramId = state.browse_filters[browseId]?.diagram_id ?? null;
    return choicePage("browse_relationship_combination", "Choose a relationship type", [
      this.#filterChoice(snapshot, state, browseId, "relationships"),
      ...rankRelationshipsForDiagram(this.#catalog, relationshipCandidates(this.#catalog, route, anchor), diagramId).map(({ record, bridge }) => {
        const value = triple(record);
        const core = route.direction === "outgoing"
          ? `${anchor.node_id} ${record.type} ${record.to}`
          : `${record.from} ${record.type} ${anchor.node_id}`;
        const explanation = bridge ? "Cross-diagram connection" : relationshipSentence(record, value, anchor, route.direction);
        return choice(snapshot, `${core} — ${explanation}`, `Chosen: ${core}`, {
          kind: "choose_relationship_combination", triple: value
        });
      })
    ]);
  }

  #relationshipEndpointPage(snapshot: GuidedDocumentSnapshot, draft: RelationshipDraftV1): GuidedChoicePageV1 {
    const selected = draft.triple!;
    const remoteType = draft.route.direction === "outgoing" ? selected.to_type : selected.from_type;
    const nodes = snapshot.nodes.filter((node) => node.node_type === remoteType && node.handle !== draft.anchor.handle);
    const title = draft.route.direction === "outgoing"
      ? `Choose destination for ${draft.anchor.node_id} ${selected.relationship_type} ${remoteType}`
      : `Choose starting point (origin) for ${remoteType} ${selected.relationship_type} ${draft.anchor.node_id}`;
    return choicePage("browse_relationship_endpoint", title, [
      ...nodes.map((node) => {
        const ref = existingRef(node);
        const refs = draft.route.direction === "outgoing" ? { from: draft.anchor, to: ref } : { from: ref, to: draft.anchor };
        const count = snapshot.edges.filter((edge) =>
          edge.from === refs.from.node_id && edge.type === selected.relationship_type && edge.to === refs.to.node_id
        ).length;
        const annotation = count ? ` — ${count} matching relationship${count === 1 ? "" : "s"} already exist${count === 1 ? "s" : ""}` : "";
        const chosen = draft.route.direction === "outgoing"
          ? `${draft.anchor.node_id} ${selected.relationship_type} ${ref.node_id}`
          : `${ref.node_id} ${selected.relationship_type} ${draft.anchor.node_id}`;
        return choice(snapshot, `${nodeLabel(ref)} (${ref.node_type})${annotation}`, `Chosen: ${chosen}`, {
          kind: "choose_existing_endpoint", node: ref
        });
      }),
      choice(snapshot, `Create a new ${remoteType}`, draft.route.direction === "outgoing"
        ? `Chosen: ${draft.anchor.node_id} ${selected.relationship_type} new ${remoteType}`
        : `Chosen: new ${remoteType} ${selected.relationship_type} ${draft.anchor.node_id}`, {
        kind: "create_new_endpoint", node_type: remoteType
      })
    ]);
  }

  #existingEndpointPage(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    route: RelationshipRouteV1,
    anchor: ExistingNodeRefV1
  ): GuidedChoicePageV1 {
    const browseId = relationshipBrowseId(route);
    const diagramId = state.browse_filters[browseId]?.diagram_id ?? null;
    const title = route.direction === "outgoing"
      ? `Choose relationship from ${anchor.node_id} to existing destination`
      : `Choose relationship from existing origin to ${anchor.node_id}`;
    const options: GuidedChoiceV1[] = [this.#filterChoice(snapshot, state, browseId, "nodes")];
    const endpoints = snapshot.nodes
      .filter((node) => node.handle !== anchor.handle)
      .map((node) => ({ node, ref: existingRef(node) }))
      .map((value) => ({ ...value, candidates: relationshipsForEndpoint(this.#catalog, route, anchor, value.ref) }))
      .filter((value) => value.candidates.length > 0)
      .sort((left, right) => {
        const first = (records: GuidanceRelationshipRecord[]) => records.reduce((best, record) =>
          record.relationship_order < best.relationship_order ||
          (record.relationship_order === best.relationship_order && record.endpoint_order < best.endpoint_order)
            ? record
            : best
        );
        const leftFirst = first(left.candidates);
        const rightFirst = first(right.candidates);
        return leftFirst.relationship_order - rightFirst.relationship_order ||
          leftFirst.endpoint_order - rightFirst.endpoint_order ||
          left.node.source_order - right.node.source_order;
      });
    for (const { ref, candidates } of endpoints) {
      const groups: Array<{ records: GuidanceRelationshipRecord[]; bridge: boolean }> = [];
      if (!diagramId) {
        groups.push({ records: candidates, bridge: false });
      } else {
        const regular = candidates.filter((record) => this.#catalog.getViewRelationship(diagramId, record)?.role !== "bridge");
        if (regular.length) groups.push({ records: regular, bridge: false });
        for (const record of candidates.filter((value) => this.#catalog.getViewRelationship(diagramId, value)?.role === "bridge")) {
          groups.push({ records: [record], bridge: true });
        }
      }
      for (const group of groups) {
        const rels = group.records.map((record) => record.type).join(" / ");
        const core = route.direction === "outgoing"
          ? `${anchor.node_id} ${rels} ${ref.node_id}: ${ref.name} (${ref.node_type})`
          : `${ref.node_id}: ${ref.name} (${ref.node_type}) ${rels} ${anchor.node_id}`;
        const selectedCore = route.direction === "outgoing"
          ? `${anchor.node_id} ${rels} ${ref.node_id}`
          : `${ref.node_id} ${rels} ${anchor.node_id}`;
        options.push(choice(snapshot, `${core}${group.bridge ? " — Cross-diagram connection" : ""}`, `Chosen: ${selectedCore}`, {
          kind: "choose_existing_endpoint",
          node: ref,
          ...(group.records.length === 1 ? { triple: triple(group.records[0]) } : {})
        }));
      }
    }
    return choicePage("browse_existing_endpoint", title, options);
  }

  #relationshipForEndpointPage(snapshot: GuidedDocumentSnapshot, draft: RelationshipDraftV1): GuidedChoicePageV1 {
    const remote = draft.remote_endpoint as ExistingNodeRefV1;
    const title = draft.route.direction === "outgoing"
      ? `Choose how ${nodeLabel(draft.anchor)} connects to ${nodeLabel(remote)}`
      : `Choose how ${nodeLabel(remote)} connects to ${nodeLabel(draft.anchor)}`;
    return choicePage("choose_relationship_for_endpoint", title, draft.candidate_triples!.map((value) => {
      const record = this.#catalog.getRelationship(catalogTriple(value))!;
      const core = draft.route.direction === "outgoing"
        ? `${draft.anchor.node_id} ${value.relationship_type} ${remote.node_id}`
        : `${remote.node_id} ${value.relationship_type} ${draft.anchor.node_id}`;
      return choice(snapshot, `${core} — ${relationshipSentence(record, value, draft.anchor, draft.route.direction, remote)}`, `Chosen: ${core}`, {
        kind: "choose_relationship_for_endpoint", triple: value
      });
    }));
  }

  #fieldDefinitions(nodeType: string, group: "primary" | "additional", snapshot: GuidedDocumentSnapshot): GuidedFieldDefinitionV1[] {
    const record = this.#catalog.getNodeType(nodeType)!;
    const suggested = suggestNodeId(snapshot, record);
    return createNodeFieldDefinitions(this.#catalog, record, this.#catalog.default_display_profile_id)
      .filter((field) => field.prominence === (group === "primary" ? "primary" : "advanced"))
      .map((field) => {
        const label = field.label ?? field.property ?? field.source;
        return {
        field_id: field.field_id,
        label: group === "primary" ? `New node ${label}` : label,
        ...(field.description ? { description: field.description } : {}),
        required: field.required,
        prominence: field.prominence,
        value_kind: field.value_kind,
        ...(field.field_id === "node_id" ? { suggested_raw_value: suggested } : {}),
        ...(field.allowed_values ? { allowed_values: [...field.allowed_values] } : {})
      };
      });
  }

  #nodeFormPage(
    snapshot: GuidedDocumentSnapshot,
    nodeType: string,
    node: ProposedNodeV1 | undefined,
    group: "primary" | "additional"
  ): GuidedFormPageV1 {
    return {
      page_id: `guided-v1:edit_new_node:${group}`,
      page_kind: "edit_new_node",
      content: { title: group === "primary" ? `Create new ${nodeType}` : `Add more details about ${proposedName(node)}`, lines: [] },
      fields: this.#fieldDefinitions(nodeType, group, snapshot),
      submit_action: { kind: "submit_new_node_fields", local_node_id: "node_1", field_group: group }
    };
  }

  #nodeDetailsPage(snapshot: GuidedDocumentSnapshot, node: ProposedNodeV1): GuidedChoicePageV1 {
    return choicePage("choose_node_detail_disclosure", `Add more details about ${proposedName(node)}?`, [
      choice(snapshot, "Yes", `Chosen: Add more details about ${proposedName(node)}`, {
        kind: "set_node_detail_disclosure", disclose: true
      }),
      choice(snapshot, "No", "Chosen: No additional node details", {
        kind: "set_node_detail_disclosure", disclose: false
      })
    ]);
  }

  #standaloneOrderPage(snapshot: GuidedDocumentSnapshot, node: ProposedNodeV1): GuidedChoicePageV1 {
    return choicePage("choose_same_level_order", `Where to place ${proposedName(node)}`, [
      choice(snapshot, "Last position — Recommended", "Chosen: Last position", {
        kind: "choose_same_level_order", order: { kind: "top_level_last" }
      }, true),
      choice(snapshot, "First position", "Chosen: First position", {
        kind: "choose_same_level_order", order: { kind: "top_level_first" }
      })
    ]);
  }

  #relationshipRecord(draft: RelationshipDraftV1): GuidanceRelationshipRecord {
    return this.#catalog.getRelationship(catalogTriple(draft.triple!))!;
  }

  #relationshipDetailsDisclosurePage(snapshot: GuidedDocumentSnapshot, draft: RelationshipDraftV1): GuidedChoicePageV1 {
    const record = this.#relationshipRecord(draft);
    const label = record.type === "NAVIGATES_TO"
      ? "Add an event trigger or guard condition to this navigation?"
      : `Add optional details to this ${record.type} relationship?`;
    return choicePage("choose_relationship_detail_disclosure", label, [
      choice(snapshot, "Yes", "Chosen: Add relationship details", { kind: "set_relationship_detail_disclosure", disclose: true }),
      choice(snapshot, "No", "Chosen: No additional relationship details", { kind: "set_relationship_detail_disclosure", disclose: false })
    ]);
  }

  #relationshipFormPage(snapshot: GuidedDocumentSnapshot, draft: RelationshipDraftV1): GuidedFormPageV1 {
    const relationship = this.#relationshipRecord(draft);
    const fields = createEdgeFieldDefinitions(relationship).map((field) => ({
      field_id: field.field_id,
      label: field.property ? relationship.edge_field_labels[field.property]! : field.source,
      required: field.required,
      prominence: field.prominence,
      value_kind: field.value_kind
    }));
    return {
      page_id: "guided-v1:edit_relationship_details",
      page_kind: "edit_relationship_details",
      content: { title: "Add relationship details", lines: [] },
      fields,
      submit_action: { kind: "submit_relationship_fields", local_edge_id: "edge_1", field_group: "additional" }
    };
  }

  #organizationPage(snapshot: GuidedDocumentSnapshot, draft: RelationshipDraftV1): GuidedChoicePageV1 {
    const refs = relationshipRefs(draft);
    const sourceName = refs.from.kind === "existing_node" ? nodeLabel(refs.from) : proposedName(draft.new_node);
    const targetName = refs.to.kind === "existing_node" ? nodeLabel(refs.to) : proposedName(draft.new_node);
    if (refs.to.kind === "new_node") {
      return choicePage("choose_new_target_organization", `Nest ${targetName} in ${sourceName}?`, [
        choice(snapshot, `Yes: place ${targetName} in ${sourceName}`, `Chosen: Yes: place ${targetName} in ${sourceName}`, {
          kind: "choose_new_target_organization", organization: "nested"
        }),
        choice(snapshot, `No: place ${targetName} at top level`, `Chosen: No: place ${targetName} at top level`, {
          kind: "choose_new_target_organization", organization: "top_level"
        })
      ]);
    }
    if (refs.from.kind === "new_node") {
      return choicePage("choose_new_source_organization", `Nest ${targetName} in ${sourceName}?`, [
        choice(snapshot, `Yes: move ${targetName} into ${sourceName}`, `Chosen: Yes: move ${targetName} into ${sourceName}`, {
          kind: "choose_new_source_organization", organization: "wrap_target"
        }),
        choice(snapshot, `No: leave ${targetName} where it is`, `Chosen: No: leave ${targetName} where it is`, {
          kind: "choose_new_source_organization", organization: "leave_target_current"
        })
      ]);
    }
    return choicePage("choose_existing_target_organization", `Nest ${targetName} in ${sourceName}?`, [
      choice(snapshot, `Yes: move ${targetName} into ${sourceName}`, `Chosen: Yes: move ${targetName} into ${sourceName}`, {
        kind: "choose_existing_target_organization", organization: "move_under_source"
      }),
      choice(snapshot, `No: leave ${targetName} where it is`, `Chosen: No: leave ${targetName} where it is`, {
        kind: "choose_existing_target_organization", organization: "leave_current"
      })
    ]);
  }

  #relationshipOrderPage(
    snapshot: GuidedDocumentSnapshot,
    draft: RelationshipDraftV1,
    context: "nested" | "top_level"
  ): GuidedChoicePageV1 {
    const refs = relationshipRefs(draft);
    const newName = proposedName(draft.new_node);
    if (context === "nested") {
      const parent = refs.from as ExistingNodeRefV1;
      const siblings = childrenOf(snapshot, parent);
      return choicePage("choose_sibling_order", `Where to place ${refs.to.kind === "new_node" ? newName : nodeLabel(refs.to)} within ${nodeLabel(parent)}`, [
        choice(snapshot, `Last position, after ${nodeLabel(siblings.at(-1)!)} — Recommended`, `Chosen: Last position, after ${nodeLabel(siblings.at(-1)!)}`, {
          kind: "choose_sibling_order", order: "last"
        }, true),
        choice(snapshot, `First position, before ${nodeLabel(siblings[0])}`, `Chosen: First position, before ${nodeLabel(siblings[0])}`, {
          kind: "choose_sibling_order", order: "first"
        })
      ]);
    }
    const anchor = draft.anchor;
    const outgoing = draft.route.direction === "outgoing";
    const recommended: SemanticSameLevelOrderV1 = outgoing
      ? { kind: "after_existing", node: anchor }
      : { kind: "before_existing", node: anchor };
    const alternative: SemanticSameLevelOrderV1 = outgoing ? { kind: "top_level_last" } : { kind: "top_level_first" };
    return choicePage("choose_same_level_order", `Where to place ${newName}`, [
      choice(snapshot, `${outgoing ? "Immediately after" : "Immediately before"} ${nodeLabel(anchor)} at top level — Recommended`,
        `Chosen: ${outgoing ? "Immediately after" : "Immediately before"} ${nodeLabel(anchor)} at top level`,
        { kind: "choose_same_level_order", order: recommended }, true),
      choice(snapshot, `At top level, ${outgoing ? "last" : "first"}`, `Chosen: At top level, ${outgoing ? "last" : "first"}`, {
        kind: "choose_same_level_order", order: alternative
      })
    ]);
  }

  #confirmationPage(snapshot: GuidedDocumentSnapshot, draft: RelationshipDraftV1): GuidedChoicePageV1 {
    const effect = draft.pending_effect!;
    const destination = effect.destination_parent.kind === "existing_node"
      ? nodeLabel(effect.destination_parent)
      : proposedName(draft.new_node);
    const from = effect.from_parent ? `within ${nodeLabel(effect.from_parent)}` : "top level";
    const destinationChildren = effect.destination_parent.kind === "existing_node"
      ? childrenOf(snapshot, effect.destination_parent)
      : [];
    const order = effect.order === "only"
      ? "as its only child"
      : effect.order === "first"
        ? `before ${nodeLabel(destinationChildren[0])}`
        : `after ${nodeLabel(destinationChildren.at(-1)!)}`;
    const replacement = draft.node_organization.find((value) => value.kind === "place_new_source_at_target_position");
    const retainsNestedContent = childrenOf(snapshot, effect.node).length > 0;
    return {
      ...choicePage("confirm_material_effect", `Confirm Moving ${nodeLabel(effect.node)}`, [
        choice(snapshot, "Move it", `Chosen: Move ${effect.node.node_id}`, {
          kind: "confirm_material_effect", effect_id: effect.effect_id
        }),
        choice(snapshot, "Go back", "Chosen: Go back", { kind: "go_back", target_page_id: "organization" })
      ], "Move this node?"),
      content: {
        title: `Confirm Moving ${nodeLabel(effect.node)}`,
        prompt: "Move this node?",
        lines: [
          `From ${from}`,
          `To within ${destination}, ${order}`,
          ...(replacement && draft.new_node
            ? [`${proposedName(draft.new_node)} will take ${effect.node.node_id}'s current ${effect.from_parent ? "nested" : "top-level"} position.`]
            : []),
          retainsNestedContent
            ? "Existing relationships and nested content remain unchanged."
            : "Existing relationships remain unchanged."
        ]
      }
    };
  }

  #applyChoice(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionStateV1, action: GuidedAdditionActionV1): void {
    const progress = state.progress;
    switch (action.kind) {
      case "choose_addition_kind":
        state.progress = action.addition_kind === "standalone_node"
          ? { kind: "standalone.browse_node_type" }
          : { kind: "browse_starting_node" };
        return;
      case "choose_starting_node": {
        const anchor = this.#resolveRef(snapshot, action.node, state);
        state.anchor = anchor;
        state.progress = { kind: "choose_relationship_route", anchor };
        return;
      }
      case "choose_relationship_route": {
        const anchor = state.anchor!;
        const route: RelationshipRouteV1 = { addition_kind: "relationship", ...action };
        state.progress = route.selection_order === "relationship_first"
          ? { kind: "relationship_first.browse_combination", route, anchor }
          : { kind: "existing_node_first.browse_endpoint", route, anchor };
        return;
      }
      case "open_diagram_filter":
        state.progress = { kind: "browse_diagram_filter", browse_id: action.browse_id, return_progress: progress as Exclude<GuidedProgressV1, { kind: "browse_diagram_filter" }> };
        return;
      case "set_diagram_filter":
      case "clear_diagram_filter": {
        if (progress.kind !== "browse_diagram_filter" || progress.browse_id !== action.browse_id) {
          reject(snapshot, state, "guided_addition.choice_unavailable", "Diagram filter action does not match the open filter page");
        }
        state.browse_filters[action.browse_id] = { diagram_id: action.kind === "set_diagram_filter" ? action.diagram_id : null };
        state.progress = progress.return_progress;
        return;
      }
      case "choose_standalone_node_type":
        state.progress = { kind: "standalone.edit_primary", node_type: action.node_type };
        return;
      case "choose_relationship_combination": {
        if (progress.kind !== "relationship_first.browse_combination") throw new Error("invalid progress");
        state.progress = {
          kind: "relationship_first.browse_endpoint",
          draft: {
            route: progress.route, anchor: progress.anchor, triple: action.triple,
            relationship_fields: [], node_organization: []
          }
        };
        return;
      }
      case "choose_existing_endpoint": {
        const node = this.#resolveRef(snapshot, action.node, state);
        if (progress.kind === "relationship_first.browse_endpoint") {
          const draft = { ...progress.draft, remote_endpoint: node };
          this.#afterEndpoint(snapshot, state, draft);
          return;
        }
        if (progress.kind === "existing_node_first.browse_endpoint") {
          const records = relationshipsForEndpoint(this.#catalog, progress.route, progress.anchor, node);
          const candidates = action.triple ? [action.triple] : records.map(triple);
          const draft: RelationshipDraftV1 = {
            route: progress.route, anchor: progress.anchor, remote_endpoint: node,
            candidate_triples: candidates, relationship_fields: [], node_organization: []
          };
          if (candidates.length === 1) {
            draft.triple = candidates[0];
            this.#afterEndpoint(snapshot, state, draft);
          } else {
            state.progress = { kind: "existing_node_first.choose_relationship", draft };
          }
          return;
        }
        throw new Error("invalid progress");
      }
      case "create_new_endpoint": {
        if (progress.kind !== "relationship_first.browse_endpoint") throw new Error("invalid progress");
        state.progress = {
          kind: "relationship.edit_new_node",
          draft: { ...progress.draft, remote_endpoint: NEW_NODE },
          node_type: action.node_type
        };
        return;
      }
      case "choose_relationship_for_endpoint": {
        if (progress.kind !== "existing_node_first.choose_relationship") throw new Error("invalid progress");
        this.#afterEndpoint(snapshot, state, { ...progress.draft, triple: action.triple });
        return;
      }
      case "set_node_detail_disclosure":
        if (progress.kind === "standalone.choose_details") {
          state.progress = action.disclose
            ? { kind: "standalone.edit_additional", node: progress.node }
            : this.#afterStandaloneNode(snapshot, progress.node);
        } else if (progress.kind === "relationship.choose_node_details") {
          state.progress = action.disclose
            ? { kind: "relationship.edit_node_details", draft: progress.draft }
            : this.#afterNodeDetails(progress.draft);
        }
        return;
      case "set_relationship_detail_disclosure":
        if (progress.kind !== "relationship.choose_details") throw new Error("invalid progress");
        state.progress = action.disclose
          ? { kind: "relationship.edit_details", draft: progress.draft }
          : this.#afterRelationshipFields(snapshot, progress.draft);
        return;
      case "choose_new_target_organization":
        this.#chooseNewTargetOrganization(snapshot, state, progress, action.organization);
        return;
      case "choose_existing_target_organization":
        this.#chooseExistingTargetOrganization(snapshot, state, progress, action.organization);
        return;
      case "choose_new_source_organization":
        this.#chooseNewSourceOrganization(snapshot, state, progress, action.organization);
        return;
      case "choose_sibling_order":
        this.#chooseSiblingOrder(snapshot, state, progress, action.order);
        return;
      case "choose_same_level_order":
        this.#chooseSameLevelOrder(snapshot, state, progress, action.order);
        return;
      case "confirm_material_effect": {
        if (progress.kind !== "relationship.confirm_effect" || progress.draft.pending_effect?.effect_id !== action.effect_id) {
          reject(snapshot, state, "guided_addition.confirmation_stale", "Material-effect confirmation is stale");
        }
        const accepted = { ...progress.draft.pending_effect, accepted: true };
        state.accepted_material_effects = [accepted];
        const organization = progress.draft.node_organization.map((entry) =>
          entry.kind === "move_existing_node" ? { ...entry, accepted_effect_id: accepted.effect_id } : entry
        );
        state.progress = { kind: "relationship.ready", draft: { ...progress.draft, node_organization: organization, pending_effect: accepted } };
        return;
      }
      case "go_back":
        if (progress.kind !== "relationship.confirm_effect") throw new Error("invalid progress");
        state.progress = { kind: "relationship.choose_organization", draft: { ...progress.draft, pending_effect: undefined, node_organization: [] } };
        state.accepted_material_effects = [];
        return;
      case "submit_new_node_fields":
      case "submit_relationship_fields":
        throw new Error("Form actions are handled separately");
    }
  }

  #applyForm(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    page: GuidedFormPageV1,
    action: GuidedAdditionActionV1
  ): void {
    if (page.page_kind === "edit_new_node") {
      if (
        action.kind !== "submit_new_node_fields" ||
        page.submit_action.kind !== "submit_new_node_fields" ||
        action.local_node_id !== page.submit_action.local_node_id ||
        action.field_group !== page.submit_action.field_group
      ) {
        reject(snapshot, state, "guided_addition.choice_unavailable", "New-node form action does not match the current form");
      }
      this.#assertFormValues(snapshot, state, page, action.values);
      this.#submitNodeFields(snapshot, state, action.field_group, action.values);
      return;
    }
    if (
      action.kind !== "submit_relationship_fields" ||
      page.submit_action.kind !== "submit_relationship_fields" ||
      action.local_edge_id !== page.submit_action.local_edge_id ||
      action.field_group !== page.submit_action.field_group
    ) {
      reject(snapshot, state, "guided_addition.choice_unavailable", "Relationship form action does not match the current form");
    }
    this.#assertFormValues(snapshot, state, page, action.values);
    this.#submitRelationshipFields(snapshot, state, action.values);
  }

  #assertFormValues(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    page: GuidedFormPageV1,
    values: GuidedFieldValueV1[]
  ): void {
    const allowed = new Set(page.fields.map((field) => field.field_id));
    const submitted = values.map((value) => value.field_id);
    if (submitted.some((fieldId) => !allowed.has(fieldId)) || new Set(submitted).size !== submitted.length) {
      reject(snapshot, state, "guided_addition.choice_unavailable", "Submitted fields do not match the current form");
    }
  }

  #nodeValues(values: GuidedFieldValueV1[]) {
    return {
      node_id: values.find((value) => value.field_id === "node_id")?.raw_value ?? "",
      name: values.find((value) => value.field_id === "name")?.raw_value ?? "",
      properties: values.filter((value) => value.field_id.startsWith("node_property:")).map((value) => ({
        key: value.field_id.slice("node_property:".length), value_kind: value.value_kind, raw_value: value.raw_value
      }))
    };
  }

  #submitNodeFields(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    group: "primary" | "additional",
    values: GuidedFieldValueV1[]
  ): void {
    const progress = state.progress;
    let nodeType: string;
    let prior: ProposedNodeV1 | undefined;
    let relationshipDraft: RelationshipDraftV1 | undefined;
    if (progress.kind === "standalone.edit_primary") nodeType = progress.node_type;
    else if (progress.kind === "standalone.edit_additional") { nodeType = progress.node.node_type; prior = progress.node; }
    else if (progress.kind === "relationship.edit_new_node") { nodeType = progress.node_type; relationshipDraft = progress.draft; }
    else if (progress.kind === "relationship.edit_node_details") { nodeType = progress.draft.new_node!.node_type; prior = progress.draft.new_node; relationshipDraft = progress.draft; }
    else throw new Error("invalid node form progress");

    const merged = group === "primary" ? values : [...(prior?.fields ?? []), ...values];
    const normalized = normalizeAndValidateNodeFields(
      this.#catalog,
      snapshot,
      this.#catalog.getNodeType(nodeType)!,
      this.#nodeValues(merged),
      this.#catalog.default_display_profile_id
    );
    const error = normalized.diagnostics.find((item) => item.severity === "error");
    if (error) reject(snapshot, state, error.code, error.message, normalized.diagnostics.filter((item) => item !== error));
    const fields: GuidedFieldValueV1[] = [
      { field_id: "node_id", value_kind: "bare_value", raw_value: normalized.fields.node_id },
      { field_id: "name", value_kind: "quoted_string", raw_value: normalized.fields.name },
      ...normalized.fields.properties.map((value) => ({
        field_id: `node_property:${value.key}`, value_kind: value.value_kind, raw_value: value.raw_value
      }))
    ];
    const node: ProposedNodeV1 = {
      ref: NEW_NODE,
      node_type: nodeType,
      node_id: normalized.fields.node_id,
      name: normalized.fields.name,
      fields
    };
    const hasAdditional = this.#fieldDefinitions(nodeType, "additional", snapshot).length > 0;
    if (!relationshipDraft) {
      state.progress = group === "primary" && hasAdditional
        ? { kind: "standalone.choose_details", node }
        : this.#afterStandaloneNode(snapshot, node);
      return;
    }
    const draft = { ...relationshipDraft, new_node: node };
    state.progress = group === "primary" && hasAdditional
      ? { kind: "relationship.choose_node_details", draft }
      : this.#afterNodeDetails(draft);
  }

  #afterStandaloneNode(snapshot: GuidedDocumentSnapshot, node: ProposedNodeV1): GuidedProgressV1 {
    return snapshot.document_precondition === "must_not_exist"
      ? {
          kind: "standalone.ready",
          node,
          node_organization: [{
            kind: "add_new_node_top_level",
            node: NEW_NODE,
            order: { kind: "top_level_last" }
          }]
        }
      : { kind: "standalone.choose_order", node };
  }

  #submitRelationshipFields(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    values: GuidedFieldValueV1[]
  ): void {
    const progress = state.progress;
    if (progress.kind !== "relationship.edit_details") throw new Error("invalid relationship form progress");
    const edge = {
      event: values.find((value) => value.field_id === "edge_annotation:event")?.raw_value || null,
      guard: values.find((value) => value.field_id === "edge_annotation:guard")?.raw_value || null,
      effect: values.find((value) => value.field_id === "edge_annotation:effect")?.raw_value || null,
      props: Object.fromEntries(values.filter((value) => value.field_id.startsWith("edge_property:")).map((value) => [
        value.field_id.slice("edge_property:".length), value.raw_value
      ]))
    };
    const normalized = normalizeAndValidateEdgeFields(snapshot, this.#relationshipRecord(progress.draft), edge);
    const error = normalized.diagnostics.find((item) => item.severity === "error");
    if (error) reject(snapshot, state, error.code, error.message, normalized.diagnostics.filter((item) => item !== error));
    const fields: GuidedFieldValueV1[] = [
      ...(["event", "guard", "effect"] as const).flatMap((key) => normalized.fields[key]
        ? [{ field_id: `edge_annotation:${key}`, value_kind: "quoted_string" as const, raw_value: normalized.fields[key]! }]
        : []),
      ...Object.entries(normalized.fields.props).map(([key, raw_value]) => ({
        field_id: `edge_property:${key}`, value_kind: "quoted_string" as const, raw_value
      }))
    ];
    state.progress = this.#afterRelationshipFields(snapshot, { ...progress.draft, relationship_fields: fields });
  }

  #afterEndpoint(snapshot: GuidedDocumentSnapshot, state: GuidedAdditionStateV1, draft: RelationshipDraftV1): void {
    if (draft.remote_endpoint?.kind === "new_node") {
      const nodeType = draft.route.direction === "outgoing" ? draft.triple!.to_type : draft.triple!.from_type;
      state.progress = { kind: "relationship.edit_new_node", draft, node_type: nodeType };
    } else {
      state.progress = this.#afterNodeDetails(draft);
    }
  }

  #afterNodeDetails(draft: RelationshipDraftV1): GuidedProgressV1 {
    const definitions = createEdgeFieldDefinitions(this.#relationshipRecord(draft));
    return definitions.length > 0
      ? { kind: "relationship.choose_details", draft }
      : this.#afterRelationshipFields(undefined, draft);
  }

  #afterRelationshipFields(snapshot: GuidedDocumentSnapshot | undefined, draft: RelationshipDraftV1): GuidedProgressV1 {
    const record = this.#relationshipRecord(draft);
    if (record.authoring.graph_role !== "structural" || record.authoring.source_organization !== "nest_target_under_source") {
      if (draft.remote_endpoint?.kind === "existing_node") {
        return { kind: "relationship.ready", draft: {
          ...draft,
          node_organization: [{ kind: "keep_existing_node", node: draft.remote_endpoint }]
        } };
      }
      return { kind: "relationship.choose_order", draft, order_context: "top_level" };
    }
    return { kind: "relationship.choose_organization", draft };
  }

  #chooseNewTargetOrganization(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    progress: GuidedProgressV1,
    organization: "nested" | "top_level"
  ): void {
    if (progress.kind !== "relationship.choose_organization") throw new Error("invalid organization progress");
    const refs = relationshipRefs(progress.draft);
    if (refs.to.kind !== "new_node" || refs.from.kind !== "existing_node") throw new Error("invalid new-target organization");
    if (organization === "top_level") {
      state.progress = { kind: "relationship.choose_order", draft: progress.draft, order_context: "top_level" };
      return;
    }
    if (childrenOf(snapshot, refs.from).length === 0) {
      state.progress = { kind: "relationship.ready", draft: {
        ...progress.draft,
        node_organization: [{ kind: "add_new_node_nested", node: NEW_NODE, parent: refs.from, order: "only" }]
      } };
    } else {
      state.progress = { kind: "relationship.choose_order", draft: progress.draft, order_context: "nested" };
    }
  }

  #chooseExistingTargetOrganization(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    progress: GuidedProgressV1,
    organization: "move_under_source" | "leave_current"
  ): void {
    if (progress.kind !== "relationship.choose_organization") throw new Error("invalid organization progress");
    const refs = relationshipRefs(progress.draft);
    if (refs.from.kind !== "existing_node" || refs.to.kind !== "existing_node") throw new Error("invalid existing-target organization");
    if (organization === "leave_current") {
      state.progress = { kind: "relationship.ready", draft: {
        ...progress.draft, node_organization: [{ kind: "keep_existing_node", node: refs.to }]
      } };
      return;
    }
    if (childrenOf(snapshot, refs.from).length === 0) {
      const effect = createMoveEffect(snapshot, this.#catalog.bundle_fingerprint, refs.to, refs.from, "only");
      state.progress = { kind: "relationship.confirm_effect", draft: {
        ...progress.draft,
        node_organization: [{ kind: "move_existing_node", node: refs.to, destination_parent: refs.from, order: "only", accepted_effect_id: effect.effect_id }],
        pending_effect: effect
      } };
    } else {
      state.progress = { kind: "relationship.choose_order", draft: progress.draft, order_context: "nested" };
    }
  }

  #chooseNewSourceOrganization(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    progress: GuidedProgressV1,
    organization: "wrap_target" | "leave_target_current"
  ): void {
    if (progress.kind !== "relationship.choose_organization") throw new Error("invalid organization progress");
    const refs = relationshipRefs(progress.draft);
    if (refs.from.kind !== "new_node" || refs.to.kind !== "existing_node") throw new Error("invalid new-source organization");
    if (organization === "leave_target_current") {
      state.progress = { kind: "relationship.choose_order", order_context: "top_level", draft: {
        ...progress.draft, node_organization: [{ kind: "keep_existing_node", node: refs.to }]
      } };
      return;
    }
    const effect = createMoveEffect(snapshot, this.#catalog.bundle_fingerprint, refs.to, refs.from, "only");
    state.progress = { kind: "relationship.confirm_effect", draft: {
      ...progress.draft,
      node_organization: [
        { kind: "place_new_source_at_target_position", source: NEW_NODE, target: refs.to },
        { kind: "move_existing_node", node: refs.to, destination_parent: refs.from, order: "only", accepted_effect_id: effect.effect_id }
      ],
      pending_effect: effect
    } };
  }

  #chooseSiblingOrder(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    progress: GuidedProgressV1,
    order: "first" | "last"
  ): void {
    if (progress.kind !== "relationship.choose_order" || progress.order_context !== "nested") throw new Error("invalid sibling order progress");
    const refs = relationshipRefs(progress.draft);
    if (refs.to.kind === "new_node") {
      state.progress = { kind: "relationship.ready", draft: {
        ...progress.draft,
        node_organization: [{ kind: "add_new_node_nested", node: NEW_NODE, parent: refs.from, order }]
      } };
      return;
    }
    const effect = createMoveEffect(snapshot, this.#catalog.bundle_fingerprint, refs.to, refs.from, order);
    state.progress = { kind: "relationship.confirm_effect", draft: {
      ...progress.draft,
      node_organization: [{ kind: "move_existing_node", node: refs.to, destination_parent: refs.from, order, accepted_effect_id: effect.effect_id }],
      pending_effect: effect
    } };
  }

  #chooseSameLevelOrder(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    progress: GuidedProgressV1,
    order: SemanticSameLevelOrderV1
  ): void {
    if (progress.kind === "standalone.choose_order") {
      state.progress = {
        kind: "standalone.ready",
        node: progress.node,
        node_organization: [{ kind: "add_new_node_top_level", node: NEW_NODE, order }]
      };
      return;
    }
    if (progress.kind !== "relationship.choose_order" || progress.order_context !== "top_level") throw new Error("invalid same-level order progress");
    state.progress = { kind: "relationship.ready", draft: {
      ...progress.draft,
      node_organization: [...progress.draft.node_organization, { kind: "add_new_node_top_level", node: NEW_NODE, order }]
    } };
  }

  #completeStandalone(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    progress: Extract<GuidedProgressV1, { kind: "standalone.ready" }>
  ): GuidedAdditionResultV1 {
    const proposalWithoutId = {
      kind: "sdd-addition-proposal" as const,
      proposal_version: "1.0" as const,
      document_context: {
        document_ref: snapshot.document_ref,
        ...(snapshot.path ? { path: snapshot.path } : {}),
        ...(snapshot.document_precondition ? { document_precondition: snapshot.document_precondition } : {}),
        base_revision: snapshot.revision,
        bundle_fingerprint: snapshot.bundle_fingerprint
      },
      intent: { addition_kind: "standalone_node" as const },
      guidance_context: {
        diagram_filters: Object.entries(state.browse_filters).map(([browse_id, value]) => ({ browse_id, diagram_id: value.diagram_id })),
        display_profile_id: this.#catalog.default_display_profile_id
      },
      addition: { kind: "standalone_node" as const, node: progress.node },
      node_organization: progress.node_organization,
      accepted_material_effects: state.accepted_material_effects
    };
    const proposal: CompletedAdditionProposalV1 = {
      ...proposalWithoutId,
      proposal_id: createGuidedOpaqueId("addp", proposalWithoutId)
    };
    const description = progress.node.fields.find((field) => field.field_id === "node_property:description")?.raw_value;
    const organization = progress.node_organization[0];
    const order = organization?.kind === "add_new_node_top_level"
      ? organization.order.kind === "top_level_first"
        ? "first"
        : organization.order.kind === "top_level_last"
          ? "last"
          : organization.order.kind === "before_existing"
            ? `before ${nodeLabel(organization.order.node)}`
            : `after ${nodeLabel(organization.order.node)}`
      : undefined;
    return deepFreeze({
      kind: "sdd-guided-addition-complete" as const,
      api_version: "1.0" as const,
      state,
      proposal,
      review: {
        title: "Review proposed addition" as const,
        lines: [
          `Add ${progress.node.node_type} ${proposedName(progress.node)}`,
          ...(description ? [`Description: ${description}`] : []),
          snapshot.document_precondition === "must_not_exist"
            ? `Place ${progress.node.node_id} as the only top-level node`
            : order
              ? `Place ${progress.node.node_id} at top level, ${order}`
              : this.#organizationReview(progress.node_organization)
        ]
      },
      diagnostics: []
    });
  }

  #completeRelationship(
    snapshot: GuidedDocumentSnapshot,
    state: GuidedAdditionStateV1,
    draft: RelationshipDraftV1
  ): GuidedAdditionResultV1 {
    const addition = {
      kind: "relationship" as const,
      relationship: {
        ...relationshipRefs(draft),
        triple: draft.triple!,
        fields: draft.relationship_fields
      },
      ...(draft.new_node ? { new_node: draft.new_node } : {})
    };
    const proposalWithoutId = {
      kind: "sdd-addition-proposal" as const,
      proposal_version: "1.0" as const,
      document_context: {
        document_ref: snapshot.document_ref,
        ...(snapshot.path ? { path: snapshot.path } : {}),
        ...(snapshot.document_precondition ? { document_precondition: snapshot.document_precondition } : {}),
        base_revision: snapshot.revision,
        bundle_fingerprint: snapshot.bundle_fingerprint
      },
      intent: {
        addition_kind: "relationship" as const,
        direction: draft.route.direction,
        selection_order: draft.route.selection_order
      },
      guidance_context: {
        diagram_filters: Object.entries(state.browse_filters).map(([browse_id, value]) => ({ browse_id, diagram_id: value.diagram_id })),
        display_profile_id: this.#catalog.default_display_profile_id
      },
      addition,
      node_organization: draft.node_organization,
      accepted_material_effects: state.accepted_material_effects
    };
    const proposal: CompletedAdditionProposalV1 = {
      ...proposalWithoutId,
      proposal_id: createGuidedOpaqueId("addp", proposalWithoutId)
    };
    const reviewLines = [
      `Add relationship: ${this.#relationshipReview(draft)}`,
      ...draft.new_node ? [`Add ${draft.new_node.node_type} ${proposedName(draft.new_node)}`] : [],
      this.#relationshipOrganizationReview(draft)
    ];
    return deepFreeze({
      kind: "sdd-guided-addition-complete" as const,
      api_version: "1.0" as const,
      state,
      proposal,
      review: { title: "Review proposed addition" as const, lines: reviewLines.filter(Boolean) },
      diagnostics: []
    });
  }

  #relationshipReview(draft: RelationshipDraftV1): string {
    const refs = relationshipRefs(draft);
    const from = refs.from.kind === "existing_node" ? nodeLabel(refs.from) : proposedName(draft.new_node);
    const to = refs.to.kind === "existing_node" ? nodeLabel(refs.to) : proposedName(draft.new_node);
    return `${from} ${draft.triple!.relationship_type} ${to}`;
  }

  #organizationReview(values: SemanticNodeOrganizationV1[]): string {
    const value = values.at(-1);
    if (!value) return "Keep existing nodes where they are";
    switch (value.kind) {
      case "keep_existing_node": return `Leave ${nodeLabel(value.node)} where it is`;
      case "add_new_node_top_level": return "Place the new node at top level";
      case "add_new_node_nested": return `Place the new node within ${value.parent.kind === "existing_node" ? nodeLabel(value.parent) : "the new source"}`;
      case "place_new_source_at_target_position": return `Place the new source where ${nodeLabel(value.target)} is now`;
      case "move_existing_node": return `Move ${nodeLabel(value.node)} into its new source`;
    }
  }

  #relationshipOrganizationReview(draft: RelationshipDraftV1): string {
    const refs = relationshipRefs(draft);
    if (
      refs.from.kind === "existing_node" &&
      refs.to.kind === "existing_node" &&
      draft.node_organization.length === 1 &&
      draft.node_organization[0].kind === "keep_existing_node"
    ) {
      return "Leave both existing nodes where they are";
    }
    return this.#organizationReview(draft.node_organization);
  }
}

export function createGuidedAdditionRuntimeV1(bundle: Bundle): GuidedAdditionRuntimeV1 {
  return new GuidedAdditionPlannerV1(createGuidanceCatalog(bundle));
}
