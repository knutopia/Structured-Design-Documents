import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Bundle } from "../bundle/types.js";
import { formatPrettyDiagnostics } from "../diagnostics/formatPretty.js";
import { hasErrors, type Diagnostic } from "../diagnostics/types.js";
import type { SourceInput } from "../types.js";
import type { AuthoringWorkspace } from "../authoring/workspace.js";
import type {
  ApplyAdditionProposalArgs,
  ApplyAdditionProposalResult,
  CompletedAdditionProposal,
  ConfirmedProposalEffect,
  ExistingNodeRef,
  GuidedAdditionAction,
  GuidedAdditionFilter,
  GuidedAdditionResult,
  GuidedAdditionRuntime,
  GuidedDocumentSnapshot,
  GuidedEdgeFieldValues,
  GuidedEndpointChoice,
  GuidedFieldDefinition,
  GuidedNodeFieldValues,
  GuidedOperationSelection,
  GuidedRelationshipPresence,
  GuidedRelationshipRole,
  GuidedStep,
  PlacementRecommendation,
  ProposedPlacement,
  RelationshipChoice
} from "../authoring/guidedAddition/contracts.js";
import { GuidedAdditionDomainError } from "../authoring/guidedAddition/contracts.js";

export interface GuidedPromptChoice<T> {
  value: T;
  label: string;
  description?: string;
}

export interface GuidedPromptAdapter {
  select<T>(request: {
    id: string;
    message: string;
    choices: GuidedPromptChoice<T>[];
  }): Promise<T>;
  input(request: {
    id: string;
    message: string;
    defaultValue?: string;
    required?: boolean;
  }): Promise<string>;
  confirm(request: {
    id: string;
    message: string;
    defaultValue?: boolean;
  }): Promise<boolean>;
  close(): void | Promise<void>;
}

export interface GuidedAdditionCliDeps {
  cwd: () => string;
  loadBundle: (manifestPath: string) => Promise<Bundle>;
  readSourceInput: (filePath: string) => Promise<SourceInput>;
  findAuthoringRepoRoot: (startDir: string) => Promise<string | null>;
  createAuthoringWorkspace: (repoRoot: string) => AuthoringWorkspace;
  createGuidedDocumentSnapshot: (
    bundle: Bundle,
    input: { document_ref: string; path?: string; text: string }
  ) => GuidedDocumentSnapshot;
  createGuidedAdditionRuntime: (bundle: Bundle) => GuidedAdditionRuntime;
  applyAdditionProposal: (
    workspace: AuthoringWorkspace,
    bundle: Bundle,
    args: ApplyAdditionProposalArgs
  ) => Promise<ApplyAdditionProposalResult>;
  createGuidedPrompt: () => GuidedPromptAdapter;
  stdout: (content: string) => void;
  stderr: (content: string) => void;
}

export interface GuidedAdditionCliOptions {
  node?: string;
  view?: string;
  bundle?: string;
}

function appendLine(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function numberedChoiceText<T>(choices: GuidedPromptChoice<T>[]): string {
  return choices.map((choice, index) => {
    const description = choice.description ? ` — ${choice.description}` : "";
    return `  ${index + 1}. ${choice.label}${description}`;
  }).join("\n");
}

function parseChoiceIndex(answer: string, choiceCount: number): number | undefined {
  if (!/^\d+$/.test(answer.trim())) return undefined;
  const index = Number(answer.trim()) - 1;
  return index >= 0 && index < choiceCount ? index : undefined;
}

export function createReadlineGuidedPrompt(): GuidedPromptAdapter {
  const readline = createInterface({ input, output });
  return {
    async select<T>(request: { id: string; message: string; choices: GuidedPromptChoice<T>[] }): Promise<T> {
      if (request.choices.length === 0) {
        throw new Error(`No choices are available for '${request.id}'.`);
      }
      for (;;) {
        output.write(`${request.message}\n${numberedChoiceText(request.choices)}\n`);
        const answer = await readline.question("Choose a number: ");
        const index = parseChoiceIndex(answer, request.choices.length);
        if (index !== undefined) return request.choices[index]!.value;
        output.write("Enter one of the listed numbers.\n");
      }
    },
    async input(request): Promise<string> {
      for (;;) {
        const suffix = request.defaultValue !== undefined ? ` [${request.defaultValue}]` : "";
        const answer = await readline.question(`${request.message}${suffix}: `);
        const value = answer.length === 0 && request.defaultValue !== undefined ? request.defaultValue : answer;
        if (!request.required || value.trim().length > 0) return value;
        output.write("A value is required.\n");
      }
    },
    async confirm(request): Promise<boolean> {
      const defaultText = request.defaultValue === false ? "y/N" : "Y/n";
      for (;;) {
        const answer = (await readline.question(`${request.message} [${defaultText}]: `)).trim().toLowerCase();
        if (answer.length === 0) return request.defaultValue !== false;
        if (answer === "y" || answer === "yes") return true;
        if (answer === "n" || answer === "no") return false;
        output.write("Answer yes or no.\n");
      }
    },
    close(): void {
      readline.close();
    }
  };
}

function writeDiagnostics(deps: Pick<GuidedAdditionCliDeps, "stderr">, diagnostics: Diagnostic[]): void {
  if (diagnostics.length > 0) deps.stderr(appendLine(formatPrettyDiagnostics(diagnostics)));
}

function existingNodeRef(node: GuidedDocumentSnapshot["nodes"][number]): ExistingNodeRef {
  return { kind: "existing_node", handle: node.handle, node_id: node.node_id, node_type: node.node_type };
}

function exactAnchor(snapshot: GuidedDocumentSnapshot, nodeId: string | undefined): ExistingNodeRef | undefined {
  if (!nodeId) return undefined;
  const matches = snapshot.nodes.filter((node) => node.node_id === nodeId);
  if (matches.length !== 1) {
    const detail = matches.length === 0 ? "was not found" : "is ambiguous";
    throw new Error(`Anchor node '${nodeId}' ${detail} in the document snapshot.`);
  }
  return existingNodeRef(matches[0]!);
}

async function chooseWrapperAddition(
  prompt: GuidedPromptAdapter,
  snapshot: GuidedDocumentSnapshot
): Promise<{ kind: "standalone" } | { kind: "relationship"; anchor: ExistingNodeRef }> {
  const kind = await prompt.select<"standalone" | "relationship">({
    id: "addition_kind",
    message: "What would you like to add?",
    choices: [
      {
        value: "standalone",
        label: "Add a standalone node",
        description: "Create a node without a relationship"
      },
      ...(snapshot.nodes.length > 0
        ? [{
            value: "relationship" as const,
            label: "Add a relationship",
            description: "Choose an existing starting node, then connect it"
          }]
        : [])
    ]
  });
  if (kind === "standalone") return { kind };

  const anchor = await prompt.select<ExistingNodeRef>({
    id: "starting_node",
    message: "Choose starting node",
    choices: snapshot.nodes.map((node) => ({
      value: existingNodeRef(node),
      label: `${node.node_id}: ${node.name}`,
      description: node.node_type
    }))
  });
  return { kind, anchor };
}

function operationLabel(selection: GuidedOperationSelection, anchor?: ExistingNodeRef): string {
  if (selection.kind === "add_node") return "Add a standalone node";
  const endpoint = selection.endpoint_strategy === "existing_only" ? "an existing node" : "an existing or new node";
  return selection.direction === "outgoing"
    ? `Connect ${anchor?.node_id} to ${endpoint}`
    : `Connect ${endpoint} to ${anchor?.node_id}`;
}

function relationshipDescription(choice: RelationshipChoice, filter: GuidedAdditionFilter): string {
  const role = filter.view_id ? choice.role_by_view[filter.view_id] : undefined;
  const display = filter.view_id && filter.display_profile_id
    ? choice.display_by_view[filter.view_id]?.[filter.display_profile_id]
    : undefined;
  return [
    choice.meaning,
    role ? `role: ${role}${role === "bridge" ? " (bridge)" : ""}` : undefined,
    display ? `presence: ${display.presence}; label: ${display.label}` : undefined,
    `${choice.existing_endpoint_count} existing endpoint${choice.existing_endpoint_count === 1 ? "" : "s"}`
  ].filter(Boolean).join(" · ");
}

function placementLabel(placement: ProposedPlacement): string {
  const location = placement.stream === "top_level"
    ? "top level"
    : `body of ${placement.parent?.kind === "existing_node" ? placement.parent.node_id : placement.parent?.local_id ?? "parent"}`;
  const anchor = placement.anchor ? ` ${placement.mode} ${placement.anchor.node_id}` : ` ${placement.mode}`;
  return `${location},${anchor}`;
}

function placementChoices(recommendation: PlacementRecommendation): GuidedPromptChoice<ProposedPlacement>[] {
  return [recommendation.recommended, ...recommendation.alternatives].map((placement, index) => ({
    value: placement,
    label: placementLabel(placement),
    description: index === 0 ? `Recommended: ${recommendation.reason_code}` : "Alternative placement"
  }));
}

function currentNodeValue(values: GuidedNodeFieldValues, field: GuidedFieldDefinition): string {
  if (field.source === "node_id") return values.node_id;
  if (field.source === "name") return values.name;
  return values.properties.find((property) => property.key === field.property)?.raw_value ?? "";
}

async function promptField(
  prompt: GuidedPromptAdapter,
  field: GuidedFieldDefinition,
  currentValue: string
): Promise<string> {
  const label = field.label ?? field.property ?? field.field_id;
  if (field.allowed_values && field.allowed_values.length > 0) {
    const choices: GuidedPromptChoice<string>[] = field.allowed_values.map((value) => ({ value, label: value }));
    if (!field.required) choices.push({ value: "", label: "Leave blank" });
    return prompt.select({ id: `field:${field.field_id}`, message: label, choices });
  }
  return prompt.input({
    id: `field:${field.field_id}`,
    message: field.description ? `${label} — ${field.description}` : label,
    ...(currentValue ? { defaultValue: currentValue } : {}),
    required: field.required
  });
}

async function promptNodeFields(
  prompt: GuidedPromptAdapter,
  step: Extract<GuidedStep, { kind: "edit_new_node" }>
): Promise<GuidedNodeFieldValues> {
  const primary = step.fields.filter((field) => field.prominence === "primary");
  const advanced = step.fields.filter((field) => field.prominence === "advanced");
  const includeAdvanced = advanced.length > 0 && await prompt.confirm({
    id: "disclose_node_advanced",
    message: "Show advanced node fields?",
    defaultValue: false
  });
  const selected = [...primary, ...(includeAdvanced ? advanced : [])];
  const fields: GuidedNodeFieldValues = { node_id: step.values.node_id, name: step.values.name, properties: [] };
  for (const field of selected) {
    const value = await promptField(prompt, field, currentNodeValue(step.values, field));
    if (field.source === "node_id") fields.node_id = value;
    else if (field.source === "name") fields.name = value;
    else if (field.property && value.length > 0) {
      fields.properties.push({ key: field.property, value_kind: field.value_kind, raw_value: value });
    }
  }
  return fields;
}

function currentEdgeValue(values: GuidedEdgeFieldValues, field: GuidedFieldDefinition): string {
  if (field.source === "edge_event") return values.event ?? "";
  if (field.source === "edge_guard") return values.guard ?? "";
  if (field.source === "edge_effect") return values.effect ?? "";
  return field.property ? values.props[field.property] ?? "" : "";
}

async function promptEdgeFields(
  prompt: GuidedPromptAdapter,
  step: Extract<GuidedStep, { kind: "edit_edge_fields" }>
): Promise<GuidedEdgeFieldValues> {
  const required = step.fields.filter((field) => field.required);
  const optional = step.fields.filter((field) => !field.required);
  const includeOptional = optional.length > 0 && await prompt.confirm({
    id: "disclose_edge_advanced",
    message: "Show optional advanced relationship fields?",
    defaultValue: false
  });
  const values: GuidedEdgeFieldValues = { event: null, guard: null, effect: null, props: {} };
  for (const field of [...required, ...(includeOptional ? optional : [])]) {
    const value = await promptField(prompt, field, currentEdgeValue(step.values, field));
    if (field.source === "edge_event") values.event = value || null;
    else if (field.source === "edge_guard") values.guard = value || null;
    else if (field.source === "edge_effect") values.effect = value || null;
    else if (field.property && value.length > 0) values.props[field.property] = value;
  }
  return values;
}

async function promptFilter(
  prompt: GuidedPromptAdapter,
  current: GuidedAdditionFilter
): Promise<GuidedAdditionFilter> {
  const role = await prompt.select<GuidedRelationshipRole | "all">({
    id: "filter_role",
    message: "Filter relationships by view role",
    choices: [
      { value: "all", label: "All roles" },
      { value: "primary", label: "Primary" },
      { value: "supporting", label: "Supporting" },
      { value: "bridge", label: "Bridge" }
    ]
  });
  const presence = await prompt.select<GuidedRelationshipPresence | "all">({
    id: "filter_presence",
    message: "Filter relationships by display presence",
    choices: [
      { value: "all", label: "All presences" },
      { value: "connector", label: "Connector" },
      { value: "structural", label: "Structural" },
      { value: "annotation", label: "Annotation" },
      { value: "hidden", label: "Hidden" }
    ]
  });
  return {
    ...(current.view_id ? { view_id: current.view_id } : {}),
    ...(current.display_profile_id ? { display_profile_id: current.display_profile_id } : {}),
    ...(role === "all" ? {} : { roles: [role] }),
    ...(presence === "all" ? {} : { presences: [presence] })
  };
}

function proposalSummary(proposal: CompletedAdditionProposal): string {
  const lines = [`Proposal ${proposal.proposal_id}`];
  for (const node of proposal.new_nodes) lines.push(`  Add ${node.node_type} ${node.node_id}: ${node.name}`);
  for (const edge of proposal.new_edges) {
    const from = edge.from.kind === "existing_node" ? edge.from.node_id : edge.from.node_id;
    const to = edge.to.kind === "existing_node" ? edge.to.node_id : edge.to.node_id;
    lines.push(`  Connect ${from} -[${edge.type}]-> ${to}`);
  }
  for (const placement of proposal.placements) lines.push(`  Place ${placement.target.kind} at ${placementLabel(placement.selected)}`);
  if (proposal.confirmed_effects.length > 0) lines.push(`  Reparent ${proposal.confirmed_effects.length} existing node block(s)`);
  return lines.join("\n");
}

function changeSummary(result: ApplyAdditionProposalResult): string {
  const summary = result.change_set.summary;
  return [
    `${result.mode === "dry_run" ? "Dry run" : "Commit"}: ${result.status}`,
    `  Nodes added: ${summary.node_insertions.length}`,
    `  Edges added: ${summary.edge_insertions.length}`,
    `  Reorder/reparent changes: ${summary.ordering_changes.length}`
  ].join("\n");
}

async function actionForStep(
  prompt: GuidedPromptAdapter,
  result: Extract<GuidedAdditionResult, { kind: "sdd-guided-addition-step" }>,
  lastPlacement: { recommendation?: PlacementRecommendation }
): Promise<GuidedAdditionAction | "cancel"> {
  const { step, state } = result;
  switch (step.kind) {
    case "choose_operation": {
      const selection = await prompt.select({
        id: "operation",
        message: state.anchor ? "Choose a relationship route" : "What would you like to add?",
        choices: step.options.map((option) => ({ value: option, label: operationLabel(option, state.anchor) }))
      });
      return { kind: "choose_operation", selection };
    }
    case "choose_node_type": {
      const selected = await prompt.select<string>({
        id: "node_type",
        message: "Choose a node type",
        choices: step.options.map((option) => ({
          value: option.node_type,
          label: `${option.node_type}${option.view_role === "bridge" ? " (bridge)" : ""}`,
          description: option.description
        }))
      });
      return { kind: "choose_node_type", node_type: selected };
    }
    case "choose_relationship": {
      const selected = await prompt.select<string>({
        id: "relationship",
        message: "Choose a relationship",
        choices: [
          ...step.options.map((choice) => ({
            value: choice.choice_id,
            label: `${choice.from_type} ${choice.relationship_type} ${choice.to_type}`,
            description: relationshipDescription(choice, state.filter)
          })),
          ...(state.filter.view_id ? [{ value: "change_filters", label: "Change view filters" }] : [])
        ]
      });
      if (selected === "change_filters") {
        return { kind: "set_filter", filter: await promptFilter(prompt, state.filter) };
      }
      return { kind: "choose_relationship", choice_id: selected };
    }
    case "choose_endpoint": {
      const selected = await prompt.select<GuidedEndpointChoice>({
        id: "endpoint",
        message: "Choose the other endpoint",
        choices: step.options.map((option) => option.kind === "existing"
          ? {
              value: option,
              label: `${option.node.node_id} (${option.node.node_type})`,
              description: option.existing_edge_count_for_triple_and_endpoints > 0
                ? `${option.existing_edge_count_for_triple_and_endpoints} matching relationship(s) already exist`
                : undefined
            }
          : { value: option, label: `Create a new ${option.node_type}` })
      });
      return selected.kind === "existing"
        ? { kind: "choose_existing_endpoint", node: selected.node }
        : { kind: "create_new_endpoint" };
    }
    case "edit_new_node":
      return { kind: "set_new_node_fields", fields: await promptNodeFields(prompt, step) };
    case "edit_edge_fields":
      return { kind: "set_edge_fields", fields: await promptEdgeFields(prompt, step) };
    case "review_placement": {
      const recommendation = step.recommendations.find(
        (candidate) => !state.selections.placements.some(
          (selection) => selection.recommendation_id === candidate.recommendation_id
        )
      );
      if (!recommendation) throw new Error("The planner did not provide a pending placement.");
      lastPlacement.recommendation = step.recommendations.find((candidate) => candidate.required_effect) ?? recommendation;
      const selected = await prompt.select({
        id: "placement",
        message: `Choose placement (${recommendation.reason_code})`,
        choices: placementChoices(recommendation)
      });
      return { kind: "select_placement", selection: { recommendation_id: recommendation.recommendation_id, selected } };
    }
    case "confirm_effect": {
      const accepted = await prompt.confirm({
        id: "confirm_effect",
        message: `Move existing node ${step.effect.target.node_id} under ${step.effect.new_parent.kind === "existing_node" ? step.effect.new_parent.node_id : "the new node"}?`,
        defaultValue: false
      });
      if (accepted) {
        const effect: ConfirmedProposalEffect = { ...step.effect, confirmed: true };
        return { kind: "confirm_effect", effect };
      }
      const recommendation = lastPlacement.recommendation;
      if (!recommendation || recommendation.alternatives.length === 0) return "cancel";
      const selected = await prompt.select<ProposedPlacement | "cancel">({
        id: "reparent_refusal",
        message: "Choose an alternative placement or Cancel",
        choices: [
          ...recommendation.alternatives.map((placement) => ({ value: placement, label: placementLabel(placement) })),
          { value: "cancel", label: "Cancel" }
        ]
      });
      if (selected === "cancel") return "cancel";
      return { kind: "select_placement", selection: { recommendation_id: recommendation.recommendation_id, selected } };
    }
    case "review_proposal":
      return { kind: "complete" };
  }
}

async function saveProposal(
  deps: GuidedAdditionCliDeps,
  prompt: GuidedPromptAdapter,
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  proposal: CompletedAdditionProposal
): Promise<number> {
  deps.stdout(appendLine(proposalSummary(proposal)));
  const decision = await prompt.select<"save" | "cancel">({
    id: "save_or_cancel",
    message: "Review complete",
    choices: [{ value: "save", label: "Save" }, { value: "cancel", label: "Cancel" }]
  });
  if (decision === "cancel") {
    deps.stdout("Cancelled. No changes were written.\n");
    return 0;
  }

  const dryRun = await deps.applyAdditionProposal(workspace, bundle, {
    proposal,
    mode: "dry_run",
    validate_profile: "simple"
  });
  deps.stdout(appendLine(changeSummary(dryRun)));
  writeDiagnostics(deps, dryRun.diagnostics);
  if (dryRun.status === "rejected" || hasErrors(dryRun.diagnostics)) return 1;

  const warnings = dryRun.diagnostics.filter((diagnostic) => diagnostic.severity === "warn");
  if (warnings.length > 0 && !await prompt.confirm({
    id: "accept_warnings",
    message: `Continue with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}?`,
    defaultValue: false
  })) {
    deps.stdout("Cancelled. No changes were written.\n");
    return 0;
  }
  if (!await prompt.confirm({ id: "confirm_commit", message: "Commit these exact reviewed changes?", defaultValue: false })) {
    deps.stdout("Cancelled. No changes were written.\n");
    return 0;
  }

  const committed = await deps.applyAdditionProposal(workspace, bundle, {
    proposal,
    mode: "commit",
    validate_profile: "simple"
  });
  deps.stdout(appendLine(changeSummary(committed)));
  writeDiagnostics(deps, committed.diagnostics);
  if (committed.status === "rejected" || hasErrors(committed.diagnostics)) {
    deps.stderr("The document or bundle changed after review. Restart `sdd add` before saving.\n");
    return 1;
  }
  deps.stdout(`Saved ${proposal.document_context.document_ref}.\n`);
  return 0;
}

export async function runGuidedAdditionCommand(
  deps: GuidedAdditionCliDeps,
  documentPath: string,
  options: GuidedAdditionCliOptions
): Promise<number> {
  const prompt = deps.createGuidedPrompt();
  try {
    const absoluteDocumentPath = path.resolve(deps.cwd(), documentPath);
    const repoRoot = await deps.findAuthoringRepoRoot(path.dirname(absoluteDocumentPath));
    if (!repoRoot) throw new Error(`Could not find an SDD repository root for '${documentPath}'.`);
    const workspace = deps.createAuthoringWorkspace(repoRoot);
    const publicPath = workspace.normalizeDocumentPath(workspace.toPublicPath(absoluteDocumentPath));
    const bundlePath = options.bundle ? path.resolve(deps.cwd(), options.bundle) : path.join(repoRoot, "bundle/v0.1/manifest.yaml");
    const bundle = await deps.loadBundle(bundlePath);
    const source = await deps.readSourceInput(absoluteDocumentPath);
    const snapshot = deps.createGuidedDocumentSnapshot(bundle, {
      document_ref: publicPath,
      path: publicPath,
      text: source.text
    });
    const runtime = deps.createGuidedAdditionRuntime(bundle);
    const initialFilter = options.view ? { initial_filter: { view_id: options.view } } : {};
    const explicitAnchor = exactAnchor(snapshot, options.node);
    let result: GuidedAdditionResult;

    if (explicitAnchor) {
      result = runtime.begin(snapshot, { anchor: explicitAnchor, ...initialFilter });
    } else {
      const unanchored = runtime.begin(snapshot, initialFilter);
      const wrapperAddition = await chooseWrapperAddition(prompt, snapshot);
      if (wrapperAddition.kind === "relationship") {
        result = runtime.begin(snapshot, { anchor: wrapperAddition.anchor, ...initialFilter });
      } else {
        if (unanchored.kind !== "sdd-guided-addition-step" || unanchored.step.kind !== "choose_operation") {
          throw new Error("The guided planner did not offer an initial standalone operation.");
        }
        const standalone = unanchored.step.options.find((option) => option.kind === "add_node");
        if (!standalone) throw new Error("The guided planner did not offer a standalone-node operation.");
        result = runtime.advance(snapshot, unanchored.state, { kind: "choose_operation", selection: standalone });
      }
    }
    const lastPlacement: { recommendation?: PlacementRecommendation } = {};

    for (;;) {
      if (result.kind === "sdd-guided-addition-complete") {
        return await saveProposal(deps, prompt, workspace, bundle, result.proposal);
      }
      const action = await actionForStep(prompt, result, lastPlacement);
      if (action === "cancel") {
        deps.stdout("Cancelled. No changes were written.\n");
        return 0;
      }
      try {
        result = runtime.advance(snapshot, result.state, action);
      } catch (error) {
        if (!(error instanceof GuidedAdditionDomainError)) throw error;
        writeDiagnostics(deps, error.diagnostics);
      }
    }
  } catch (error) {
    if (error instanceof GuidedAdditionDomainError) writeDiagnostics(deps, error.diagnostics);
    else deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return 1;
  } finally {
    await prompt.close();
  }
}
