import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Bundle } from "../bundle/types.js";
import { sortDiagnostics, type Diagnostic } from "../diagnostics/types.js";
import type {
  ApplyAuthoringIntentArgs,
  ApplyAuthoringIntentResult,
  AuthoringIntent,
  AuthoringIntentDiagnostic,
  ChangeOperation,
  ChangeSetMode,
  ChangeSetResult,
  ChangeSetSummary,
  DocumentPath,
  DocumentRevision,
  Handle,
  InsertNodeScaffoldIntent,
  NodeRef
} from "./contracts.js";
import { inspectDocumentText, type InspectedDocument } from "./inspect.js";
import { createChangeSetJournal, type ChangeSetJournal } from "./journal.js";
import { executeChangeOperations, remapOperationHandles } from "./mutations.js";
import { computeDocumentRevision, normalizeTextToLf } from "./revisions.js";
import type { AuthoringWorkspace } from "./workspace.js";

const EMPTY_TEMPLATE_TEXT = "SDD-TEXT 0.1\n";
const MINIMUM_TOP_LEVEL_BLOCKS_CODE = "parse.minimum_top_level_blocks";
const TEMP_HANDLE_PREFIX = "tmp_authoring_";

interface LocalTargetDescriptor {
  local_id: string;
  kind: "node" | "edge";
  temp_handle: Handle;
  parent_local_id?: string;
  parent_handle?: Handle;
}

interface ResolvedNodeTarget {
  handle: Handle;
  parent_handle: Handle | null;
}

interface CompileContext {
  path: DocumentPath;
  operations: ChangeOperation[];
  createdTargets: LocalTargetDescriptor[];
  localTargetsById: Map<string, LocalTargetDescriptor>;
  intentDiagnostics: AuthoringIntentDiagnostic[];
  persistedInspect?: InspectedDocument;
}

function createDiagnostic(file: string, code: string, message: string, relatedIds: string[] = []): Diagnostic {
  return {
    stage: "cli",
    code,
    severity: "error",
    message,
    file,
    relatedIds: relatedIds.length > 0 ? relatedIds : undefined
  };
}

function createEmptySummary(): ChangeSetSummary {
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

function createTemporaryHandle(kind: "node" | "edge", localId: string): Handle {
  const digest = createHash("sha256").update(`${kind}|${localId}`, "utf8").digest("hex");
  return `${TEMP_HANDLE_PREFIX}${digest}`;
}

function isEmptyTemplateBootstrapFailure(text: string, diagnostics: Diagnostic[]): boolean {
  return (
    text === EMPTY_TEMPLATE_TEXT &&
    diagnostics.length > 0 &&
    diagnostics.every((diagnostic) => diagnostic.code === MINIMUM_TOP_LEVEL_BLOCKS_CODE)
  );
}

function createBaseChangeSet(
  journal: ChangeSetJournal,
  path: DocumentPath,
  baseRevision: DocumentRevision,
  mode: ChangeSetMode,
  operations: ChangeOperation[]
): ChangeSetResult {
  return {
    kind: "sdd-change-set",
    change_set_id: journal.createChangeSetId(),
    path,
    origin: "apply_authoring_intent",
    document_effect: "updated",
    base_revision: baseRevision,
    mode,
    status: "rejected",
    undo_eligible: false,
    operations: remapOperationHandles(operations, new Map()),
    summary: createEmptySummary(),
    diagnostics: []
  };
}

function createAuthoringResult(
  args: ApplyAuthoringIntentArgs,
  changeSet: ChangeSetResult,
  createdTargets: Array<{ local_id: string; kind: "node" | "edge"; handle: Handle; parent_local_id?: string }>,
  intentDiagnostics: AuthoringIntentDiagnostic[] = []
): ApplyAuthoringIntentResult {
  return {
    kind: "sdd-authoring-intent-result",
    path: args.path,
    base_revision: args.base_revision,
    resulting_revision: changeSet.resulting_revision,
    mode: changeSet.mode,
    status: changeSet.status,
    intents: args.intents,
    change_set: changeSet,
    created_targets: createdTargets,
    diagnostics: changeSet.diagnostics,
    intent_diagnostics: intentDiagnostics.length > 0 ? intentDiagnostics : undefined
  };
}

function relatedIds(intentIndex: number, localId: string | undefined, fieldPath: string): string[] {
  return [
    `intent_index:${intentIndex}`,
    localId ? `local_id:${localId}` : undefined,
    `field_path:${fieldPath}`
  ].filter((value): value is string => value !== undefined);
}

function addIntentDiagnostic(
  context: CompileContext,
  intentIndex: number,
  localId: string | undefined,
  fieldPath: string,
  code: string,
  message: string
): { diagnostic: Diagnostic; intentDiagnostic: AuthoringIntentDiagnostic } {
  const intentDiagnostic: AuthoringIntentDiagnostic = {
    intent_index: intentIndex,
    local_id: localId,
    field_path: fieldPath,
    code,
    message
  };
  context.intentDiagnostics.push(intentDiagnostic);
  return {
    diagnostic: createDiagnostic(context.path, code, message, relatedIds(intentIndex, localId, fieldPath)),
    intentDiagnostic
  };
}

function persistedNodeByHandle(
  persistedInspect: InspectedDocument | undefined,
  handle: Handle
): ResolvedNodeTarget | undefined {
  const match = persistedInspect?.resource.nodes.find((node) => node.handle === handle);
  if (!match) {
    return undefined;
  }

  return {
    handle: match.handle,
    parent_handle: match.parent_handle
  };
}

function resolveNodeRef(
  context: CompileContext,
  ref: NodeRef,
  intentIndex: number,
  localId: string | undefined,
  fieldPath: string
): { ok: true; target: ResolvedNodeTarget } | { ok: false; diagnostic: Diagnostic } {
  if (ref.by === "local_id") {
    const localTarget = context.localTargetsById.get(ref.local_id);
    if (!localTarget || localTarget.kind !== "node") {
      return {
        ok: false,
        diagnostic: addIntentDiagnostic(
          context,
          intentIndex,
          localId,
          fieldPath,
          "sdd.local_id_not_found",
          `Authoring intent reference '${ref.local_id}' is not available for ${fieldPath}.`
        ).diagnostic
      };
    }

    return {
      ok: true,
      target: {
        handle: localTarget.temp_handle,
        parent_handle: localTarget.parent_handle ?? null
      }
    };
  }

  if (ref.by === "handle") {
    const persistedTarget = persistedNodeByHandle(context.persistedInspect, ref.handle);
    if (!persistedTarget) {
      return {
        ok: false,
        diagnostic: addIntentDiagnostic(
          context,
          intentIndex,
          localId,
          fieldPath,
          "sdd.invalid_handle",
          `Handle '${ref.handle}' is not valid for the persisted base revision.`
        ).diagnostic
      };
    }

    return {
      ok: true,
      target: persistedTarget
    };
  }

  const matches = context.persistedInspect?.resource.nodes.filter((node) => {
    return ref.selector.kind === "node_id" ? node.node_id === ref.selector.node_id : false;
  }) ?? [];

  if (matches.length === 0) {
    return {
      ok: false,
      diagnostic: addIntentDiagnostic(
        context,
        intentIndex,
        localId,
        fieldPath,
        "sdd.selector_not_found",
        `Selector for ${fieldPath} did not match any persisted node.`
      ).diagnostic
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      diagnostic: addIntentDiagnostic(
        context,
        intentIndex,
        localId,
        fieldPath,
        "sdd.selector_ambiguous",
        `Selector for ${fieldPath} matched multiple persisted nodes.`
      ).diagnostic
    };
  }

  return {
    ok: true,
    target: {
      handle: matches[0]!.handle,
      parent_handle: matches[0]!.parent_handle
    }
  };
}

function ensureUniqueLocalId(
  context: CompileContext,
  intentIndex: number,
  localId: string,
  fieldPath: string
): Diagnostic | undefined {
  if (!context.localTargetsById.has(localId)) {
    return undefined;
  }

  return addIntentDiagnostic(
    context,
    intentIndex,
    localId,
    fieldPath,
    "sdd.duplicate_local_id",
    `Authoring intent local_id '${localId}' must be unique within the request.`
  ).diagnostic;
}

function compileInsertNodeScaffold(
  context: CompileContext,
  intent: InsertNodeScaffoldIntent,
  intentIndex: number,
  fieldPath: string,
  enclosingParentLocalId?: string
): Diagnostic | undefined {
  const duplicateDiagnostic = ensureUniqueLocalId(context, intentIndex, intent.local_id, `${fieldPath}.local_id`);
  if (duplicateDiagnostic) {
    return duplicateDiagnostic;
  }

  const parentRef = intent.parent ?? (enclosingParentLocalId
    ? { by: "local_id", local_id: enclosingParentLocalId } as NodeRef
    : undefined);

  let resolvedParent: ResolvedNodeTarget | undefined;
  if (parentRef) {
    const parentResolution = resolveNodeRef(context, parentRef, intentIndex, intent.local_id, `${fieldPath}.parent`);
    if (!parentResolution.ok) {
      return parentResolution.diagnostic;
    }
    resolvedParent = parentResolution.target;
  }

  let resolvedAnchor: ResolvedNodeTarget | undefined;
  if (intent.placement.mode === "before" || intent.placement.mode === "after") {
    if (!intent.placement.anchor) {
      return addIntentDiagnostic(
        context,
        intentIndex,
        intent.local_id,
        `${fieldPath}.placement.anchor`,
        "sdd.invalid_placement",
        `Authoring intent ${fieldPath} requires placement.anchor for mode '${intent.placement.mode}'.`
      ).diagnostic;
    }

    const anchorResolution = resolveNodeRef(
      context,
      intent.placement.anchor,
      intentIndex,
      intent.local_id,
      `${fieldPath}.placement.anchor`
    );
    if (!anchorResolution.ok) {
      return anchorResolution.diagnostic;
    }
    resolvedAnchor = anchorResolution.target;
  } else if (intent.placement.anchor) {
    return addIntentDiagnostic(
      context,
      intentIndex,
      intent.local_id,
      `${fieldPath}.placement.anchor`,
      "sdd.invalid_placement",
      `Authoring intent ${fieldPath} must not provide placement.anchor for mode '${intent.placement.mode}'.`
    ).diagnostic;
  }

  if (resolvedParent) {
    if (resolvedAnchor && resolvedAnchor.parent_handle !== resolvedParent.handle) {
      return addIntentDiagnostic(
        context,
        intentIndex,
        intent.local_id,
        `${fieldPath}.placement.anchor`,
        "sdd.invalid_placement",
        `Authoring intent ${fieldPath} anchor must belong to the resolved parent node.`
      ).diagnostic;
    }
  } else if (resolvedAnchor && resolvedAnchor.parent_handle !== null) {
    return addIntentDiagnostic(
      context,
      intentIndex,
      intent.local_id,
      `${fieldPath}.placement.anchor`,
      "sdd.invalid_placement",
      `Authoring intent ${fieldPath} top-level anchor must refer to a top-level node.`
    ).diagnostic;
  }

  const nodeTempHandle = createTemporaryHandle("node", intent.local_id);
  context.operations.push({
    kind: "insert_node_block",
    node_type: intent.node.node_type,
    node_id: intent.node.node_id,
    name: intent.node.name,
    placement: {
      mode: intent.placement.mode,
      stream: resolvedParent ? "body" : "top_level",
      anchor_handle: resolvedAnchor?.handle,
      parent_handle: resolvedParent?.handle
    },
    __internal_handle: nodeTempHandle
  } as ChangeOperation);

  const localTarget: LocalTargetDescriptor = {
    local_id: intent.local_id,
    kind: "node",
    temp_handle: nodeTempHandle,
    parent_local_id: enclosingParentLocalId,
    parent_handle: resolvedParent?.handle
  };
  context.localTargetsById.set(intent.local_id, localTarget);
  context.createdTargets.push(localTarget);

  for (const [propertyIndex, property] of (intent.node.props ?? []).entries()) {
    context.operations.push({
      kind: "set_node_property",
      node_handle: nodeTempHandle,
      key: property.key,
      value_kind: property.value_kind,
      raw_value: property.raw_value
    });
  }

  for (const [edgeIndex, edge] of (intent.node.edges ?? []).entries()) {
    const edgeFieldPath = `${fieldPath}.node.edges[${edgeIndex}]`;
    const duplicateEdgeDiagnostic = ensureUniqueLocalId(context, intentIndex, edge.local_id, `${edgeFieldPath}.local_id`);
    if (duplicateEdgeDiagnostic) {
      return duplicateEdgeDiagnostic;
    }

    if (edge.placement && edge.placement.mode !== "first" && edge.placement.mode !== "last") {
      return addIntentDiagnostic(
        context,
        intentIndex,
        edge.local_id,
        `${edgeFieldPath}.placement.mode`,
        "sdd.invalid_placement",
        `Authoring intent ${edgeFieldPath} only supports edge placement mode 'first' or 'last'.`
      ).diagnostic;
    }

    const edgeTempHandle = createTemporaryHandle("edge", edge.local_id);
    context.operations.push({
      kind: "insert_edge_line",
      parent_handle: nodeTempHandle,
      rel_type: edge.rel_type,
      to: edge.to,
      to_name: edge.to_name,
      event: edge.event,
      guard: edge.guard,
      effect: edge.effect,
      props: edge.props,
      placement: edge.placement
        ? {
            mode: edge.placement.mode,
            stream: "body",
            parent_handle: nodeTempHandle
          }
        : undefined,
      __internal_handle: edgeTempHandle
    } as ChangeOperation);

    const edgeTarget: LocalTargetDescriptor = {
      local_id: edge.local_id,
      kind: "edge",
      temp_handle: edgeTempHandle,
      parent_local_id: intent.local_id,
      parent_handle: nodeTempHandle
    };
    context.localTargetsById.set(edge.local_id, edgeTarget);
    context.createdTargets.push(edgeTarget);
  }

  for (const [childIndex, child] of (intent.node.children ?? []).entries()) {
    const childDiagnostic = compileInsertNodeScaffold(
      context,
      child,
      intentIndex,
      `${fieldPath}.node.children[${childIndex}]`,
      intent.local_id
    );
    if (childDiagnostic) {
      return childDiagnostic;
    }
  }

  return undefined;
}

function compileAuthoringIntents(
  path: DocumentPath,
  intents: AuthoringIntent[],
  persistedInspect?: InspectedDocument
): { operations: ChangeOperation[]; createdTargets: LocalTargetDescriptor[]; intentDiagnostics: AuthoringIntentDiagnostic[]; diagnostic?: Diagnostic } {
  const context: CompileContext = {
    path,
    operations: [],
    createdTargets: [],
    localTargetsById: new Map(),
    intentDiagnostics: [],
    persistedInspect
  };

  for (const [intentIndex, intent] of intents.entries()) {
    if (intent.kind !== "insert_node_scaffold") {
      return {
        operations: context.operations,
        createdTargets: context.createdTargets,
        intentDiagnostics: context.intentDiagnostics,
        diagnostic: addIntentDiagnostic(
          context,
          intentIndex,
          undefined,
          `intents[${intentIndex}].kind`,
          "sdd.unsupported_authoring_intent",
          `Unsupported authoring intent '${(intent as { kind?: string }).kind ?? "<missing>"}'.`
        ).diagnostic
      };
    }

    const diagnostic = compileInsertNodeScaffold(context, intent, intentIndex, `intents[${intentIndex}]`);
    if (diagnostic) {
      return {
        operations: context.operations,
        createdTargets: context.createdTargets,
        intentDiagnostics: context.intentDiagnostics,
        diagnostic
      };
    }
  }

  return {
    operations: context.operations,
    createdTargets: context.createdTargets,
    intentDiagnostics: context.intentDiagnostics
  };
}

export async function applyAuthoringIntent(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: ApplyAuthoringIntentArgs,
  journal = createChangeSetJournal(workspace)
): Promise<ApplyAuthoringIntentResult> {
  const resolvedPath = workspace.resolveDocumentPath(args.path);
  const mode = args.mode ?? "dry_run";
  let rawText: string;
  try {
    rawText = await readFile(resolvedPath.absolutePath, "utf8");
  } catch {
    const changeSet = createBaseChangeSet(journal, resolvedPath.publicPath, args.base_revision, mode, []);
    changeSet.diagnostics = sortDiagnostics([
      createDiagnostic(
        resolvedPath.publicPath,
        "sdd.document_missing",
        `Document '${resolvedPath.publicPath}' does not exist.`
      )
    ]);

    return createAuthoringResult(args, changeSet, []);
  }

  const canonicalText = normalizeTextToLf(rawText);
  const currentRevision = computeDocumentRevision(canonicalText);

  if (currentRevision !== args.base_revision) {
    const changeSet = createBaseChangeSet(journal, resolvedPath.publicPath, args.base_revision, mode, []);
    changeSet.diagnostics = sortDiagnostics([
      createDiagnostic(
        resolvedPath.publicPath,
        "sdd.revision_mismatch",
        `Document revision '${currentRevision}' does not match base revision '${args.base_revision}'.`
      )
    ]);

    if (mode === "dry_run") {
      await journal.recordChangeSet(changeSet);
    }

    return createAuthoringResult(args, changeSet, []);
  }

  const inspectResult = inspectDocumentText(bundle, resolvedPath.publicPath, canonicalText);
  if (
    inspectResult.kind === "sdd-inspect-load-failure" &&
    !isEmptyTemplateBootstrapFailure(canonicalText, inspectResult.diagnostics)
  ) {
    const changeSet = createBaseChangeSet(journal, resolvedPath.publicPath, args.base_revision, mode, []);
    changeSet.diagnostics = sortDiagnostics([
      ...inspectResult.diagnostics,
      createDiagnostic(
        resolvedPath.publicPath,
        "sdd.parse_invalid_for_author",
        "Document could not be inspected for apply_authoring_intent."
      )
    ]);

    if (mode === "dry_run") {
      await journal.recordChangeSet(changeSet);
    }

    return createAuthoringResult(args, changeSet, []);
  }

  const compiled = compileAuthoringIntents(
    resolvedPath.publicPath,
    args.intents,
    inspectResult.kind === "sdd-inspected-document" ? inspectResult : undefined
  );

  if (compiled.diagnostic) {
    const changeSet = createBaseChangeSet(journal, resolvedPath.publicPath, args.base_revision, mode, compiled.operations);
    changeSet.diagnostics = sortDiagnostics([compiled.diagnostic]);

    if (mode === "dry_run") {
      await journal.recordChangeSet(changeSet);
    }

    return createAuthoringResult(args, changeSet, [], compiled.intentDiagnostics);
  }

  const executed = await executeChangeOperations(
    workspace,
    bundle,
    {
      path: resolvedPath.publicPath,
      base_revision: args.base_revision,
      mode,
      operations: compiled.operations,
      validate_profile: args.validate_profile,
      projection_views: args.projection_views,
      origin: "apply_authoring_intent",
      allowEmptyTemplateBootstrap: true
    },
    journal
  );

  const createdTargets = compiled.createdTargets.flatMap((target) => {
    const resolvedHandle = executed.tempHandleMapping.get(target.temp_handle);
    return resolvedHandle
      ? [{
          local_id: target.local_id,
          kind: target.kind,
          handle: resolvedHandle,
          parent_local_id: target.parent_local_id
        }]
      : [];
  });

  return createAuthoringResult(args, executed.changeSet, createdTargets, compiled.intentDiagnostics);
}
