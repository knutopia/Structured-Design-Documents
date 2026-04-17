import { writeSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import type { Bundle } from "../bundle/types.js";
import { loadBundle } from "../bundle/loadBundle.js";
import type {
  ApplyAuthoringIntentArgs,
  ApplyChangeSetArgs,
  AuthoringIntent,
  ChangeOperation,
  ChangeSetResult,
  ContractSubjectId,
  CreateDocumentArgs,
  HelperErrorResult,
  NodeRef,
  ProjectDocumentArgs,
  RenderPreviewArgs,
  SearchGraphArgs,
  ValidateDocumentArgs,
  UndoChangeSetArgs
} from "../authoring/contracts.js";
import { applyAuthoringIntent } from "../authoring/authoringIntents.js";
import { getContractSubjectDetail } from "../authoring/contractMetadata.js";
import { AuthoringGitError, getGitStatus, gitCommit } from "../authoring/git.js";
import { inspectDocument } from "../authoring/inspect.js";
import { listDocuments, searchGraph } from "../authoring/listing.js";
import { applyChangeSet, AuthoringMutationError, createDocument } from "../authoring/mutations.js";
import { AuthoringPreviewError, renderPreview } from "../authoring/preview.js";
import { projectDocument, validateDocument } from "../authoring/readServices.js";
import { undoChangeSet } from "../authoring/undo.js";
import { stringifyCanonicalJson } from "../authoring/revisions.js";
import {
  createAuthoringWorkspace,
  findAuthoringRepoRoot,
  WorkspacePathError,
  type AuthoringWorkspace
} from "../authoring/workspace.js";
import type { Diagnostic } from "../diagnostics/types.js";
import { createHelperCapabilities, createHelperHelpStub, shouldReturnHelperHelp } from "./helperDiscovery.js";

export interface HelperCliDeps {
  cwd: () => string;
  stdout: (content: string) => void;
  stderr: (content: string) => void;
  findRepoRoot: (startDir: string) => Promise<string | null>;
  loadBundle: (manifestPath: string) => Promise<Bundle>;
  createWorkspace: (repoRoot: string) => AuthoringWorkspace;
  inspectDocument: typeof inspectDocument;
  listDocuments: typeof listDocuments;
  searchGraph: typeof searchGraph;
  createDocument: typeof createDocument;
  applyChangeSet: typeof applyChangeSet;
  applyAuthoringIntent: typeof applyAuthoringIntent;
  undoChangeSet: typeof undoChangeSet;
  validateDocument: typeof validateDocument;
  projectDocument: typeof projectDocument;
  renderPreview: typeof renderPreview;
  getGitStatus: typeof getGitStatus;
  gitCommit: typeof gitCommit;
  readTextFile: (filePath: string) => Promise<string>;
  readStdin: () => Promise<string>;
}

export interface RunHelperCliResult {
  exitCode: number;
}

class HelperCliError extends Error {
  readonly code: HelperErrorResult["code"];
  readonly diagnostics?: Diagnostic[];

  constructor(code: HelperErrorResult["code"], message: string, diagnostics?: Diagnostic[]) {
    super(message);
    this.name = "HelperCliError";
    this.code = code;
    if (diagnostics && diagnostics.length > 0) {
      this.diagnostics = diagnostics;
    }
  }
}

function createDefaultDeps(): HelperCliDeps {
  return {
    cwd: () => process.cwd(),
    stdout: (content) => {
      writeSync(process.stdout.fd, content);
    },
    stderr: (content) => {
      writeSync(process.stderr.fd, content);
    },
    findRepoRoot: findAuthoringRepoRoot,
    loadBundle,
    createWorkspace: createAuthoringWorkspace,
    inspectDocument,
    listDocuments,
    searchGraph,
    createDocument,
    applyChangeSet,
    applyAuthoringIntent,
    undoChangeSet,
    validateDocument,
    projectDocument,
    renderPreview,
    getGitStatus,
    gitCommit,
    readTextFile: async (filePath: string) => readFile(path.resolve(filePath), "utf8"),
    readStdin: async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString("utf8");
    }
  };
}

function withDefaults(overrides: Partial<HelperCliDeps> = {}): HelperCliDeps {
  return {
    ...createDefaultDeps(),
    ...overrides
  };
}

function helperErrorResult(
  code: HelperErrorResult["code"],
  message: string,
  diagnostics?: Diagnostic[]
): HelperErrorResult {
  return diagnostics && diagnostics.length > 0
    ? {
        kind: "sdd-helper-error",
        code,
        message,
        diagnostics
      }
    : {
    kind: "sdd-helper-error",
    code,
    message
      };
}

function writeJson(deps: Pick<HelperCliDeps, "stdout">, payload: unknown): void {
  deps.stdout(stringifyCanonicalJson(payload));
}

function parseIntegerOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new InvalidArgumentError(`Expected a non-negative integer, got '${value}'.`);
  }
  return parsed;
}

async function loadRequestText(
  deps: Pick<HelperCliDeps, "readTextFile" | "readStdin">,
  requestSource: string
): Promise<string> {
  return requestSource === "-" ? deps.readStdin() : deps.readTextFile(requestSource);
}

type RequestValidator = (value: unknown) => string | undefined;

function parseJsonRequest<T>(rawText: string, requestName: string, validate: RequestValidator): T {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new HelperCliError(
      "invalid_json",
      error instanceof Error ? error.message : "Request body is not valid JSON."
    );
  }

  const validationError = validate(parsed);
  if (validationError) {
    throw new HelperCliError("invalid_args", `Request body does not match ${requestName}: ${validationError}`);
  }

  return parsed as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function validateMode(value: unknown, fieldPath: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === "dry_run" || value === "commit"
    ? undefined
    : `${fieldPath} must be one of "dry_run" or "commit".`;
}

function validateProfile(value: unknown, fieldPath: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === "simple" || value === "permissive" || value === "strict"
    ? undefined
    : `${fieldPath} must be one of "simple", "permissive", or "strict".`;
}

function validateValueKind(value: unknown, fieldPath: string): string | undefined {
  if (value === "quoted_string" || value === "bare_value") {
    return undefined;
  }
  return `${fieldPath} must be one of "quoted_string" or "bare_value".`;
}

function validatePlacement(value: unknown, fieldPath: string): string | undefined {
  if (!isRecord(value)) {
    return `${fieldPath} must be an object.`;
  }
  if (!["before", "after", "first", "last"].includes(String(value.mode))) {
    return `${fieldPath}.mode must be one of "before", "after", "first", or "last".`;
  }
  if (value.stream !== "top_level" && value.stream !== "body") {
    return `${fieldPath}.stream must be either "top_level" or "body".`;
  }
  if (value.anchor_handle !== undefined && typeof value.anchor_handle !== "string") {
    return `${fieldPath}.anchor_handle must be a string when provided.`;
  }
  if (value.parent_handle !== undefined && typeof value.parent_handle !== "string") {
    return `${fieldPath}.parent_handle must be a string when provided.`;
  }
  return undefined;
}

function requireStringField(record: Record<string, unknown>, fieldName: string, fieldPath: string): string | undefined {
  return typeof record[fieldName] === "string" ? undefined : `${fieldPath}.${fieldName} must be a string.`;
}

function validateOptionalNullableString(record: Record<string, unknown>, fieldName: string, fieldPath: string): string | undefined {
  const value = record[fieldName];
  return value === undefined || value === null || typeof value === "string"
    ? undefined
    : `${fieldPath}.${fieldName} must be a string or null when provided.`;
}

function validateChangeOperation(value: unknown, fieldPath: string): string | undefined {
  if (!isRecord(value)) {
    return `${fieldPath} must be an object.`;
  }
  if (typeof value.kind !== "string") {
    return `${fieldPath}.kind must be a string.`;
  }

  switch (value.kind as ChangeOperation["kind"]) {
    case "insert_node_block":
      return (
        requireStringField(value, "node_type", fieldPath) ??
        requireStringField(value, "node_id", fieldPath) ??
        requireStringField(value, "name", fieldPath) ??
        validatePlacement(value.placement, `${fieldPath}.placement`)
      );
    case "delete_node_block":
      return requireStringField(value, "node_handle", fieldPath);
    case "set_node_name":
      return requireStringField(value, "node_handle", fieldPath) ?? requireStringField(value, "name", fieldPath);
    case "set_node_property":
      return (
        requireStringField(value, "node_handle", fieldPath) ??
        requireStringField(value, "key", fieldPath) ??
        validateValueKind(value.value_kind, `${fieldPath}.value_kind`) ??
        requireStringField(value, "raw_value", fieldPath)
      );
    case "remove_node_property":
      return requireStringField(value, "node_handle", fieldPath) ?? requireStringField(value, "key", fieldPath);
    case "insert_edge_line":
      return (
        requireStringField(value, "parent_handle", fieldPath) ??
        requireStringField(value, "rel_type", fieldPath) ??
        requireStringField(value, "to", fieldPath) ??
        validateOptionalNullableString(value, "to_name", fieldPath) ??
        validateOptionalNullableString(value, "event", fieldPath) ??
        validateOptionalNullableString(value, "guard", fieldPath) ??
        validateOptionalNullableString(value, "effect", fieldPath) ??
        (value.props !== undefined && !isStringRecord(value.props)
          ? `${fieldPath}.props must be an object with string values.`
          : undefined) ??
        (value.placement !== undefined ? validatePlacement(value.placement, `${fieldPath}.placement`) : undefined)
      );
    case "remove_edge_line":
      return requireStringField(value, "edge_handle", fieldPath);
    case "reposition_top_level_node":
      return requireStringField(value, "node_handle", fieldPath) ?? validatePlacement(value.placement, `${fieldPath}.placement`);
    case "reposition_structural_edge":
      return requireStringField(value, "edge_handle", fieldPath) ?? validatePlacement(value.placement, `${fieldPath}.placement`);
    case "move_nested_node_block":
      return requireStringField(value, "node_handle", fieldPath) ?? validatePlacement(value.placement, `${fieldPath}.placement`);
    default:
      return `${fieldPath}.kind '${String(value.kind)}' is not supported.`;
  }
}

function validateApplyChangeSetArgs(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return "expected an object.";
  }
  if (typeof value.path !== "string") {
    return "path must be a string.";
  }
  if (typeof value.base_revision !== "string") {
    return "base_revision must be a string.";
  }
  if (!Array.isArray(value.operations)) {
    return "operations must be an array.";
  }
  const modeError = validateMode(value.mode, "mode");
  if (modeError) {
    return modeError;
  }
  const validateProfileError = validateProfile(value.validate_profile, "validate_profile");
  if (validateProfileError) {
    return validateProfileError;
  }
  if (value.projection_views !== undefined && !isStringArray(value.projection_views)) {
    return "projection_views must be an array of strings when provided.";
  }
  for (const [index, operation] of value.operations.entries()) {
    const operationError = validateChangeOperation(operation, `operations[${index}]`);
    if (operationError) {
      return operationError;
    }
  }
  return undefined;
}

function validateNodeRef(value: unknown, fieldPath: string, availableNodeLocalIds: ReadonlySet<string>): string | undefined {
  if (!isRecord(value)) {
    return `${fieldPath} must be an object.`;
  }
  if (value.by === "handle") {
    return typeof value.handle === "string" ? undefined : `${fieldPath}.handle must be a string.`;
  }
  if (value.by === "local_id") {
    if (typeof value.local_id !== "string") {
      return `${fieldPath}.local_id must be a string.`;
    }
    return availableNodeLocalIds.has(value.local_id)
      ? undefined
      : `${fieldPath}.local_id must refer to a node created earlier in the same request.`;
  }
  if (value.by === "selector") {
    if (!isRecord(value.selector)) {
      return `${fieldPath}.selector must be an object.`;
    }
    if (value.selector.kind !== "node_id") {
      return `${fieldPath}.selector.kind must be "node_id".`;
    }
    return typeof value.selector.node_id === "string"
      ? undefined
      : `${fieldPath}.selector.node_id must be a string.`;
  }
  return `${fieldPath}.by must be one of "handle", "local_id", or "selector".`;
}

function validateInsertNodeScaffoldIntent(
  value: unknown,
  fieldPath: string,
  seenLocalIds: Set<string>,
  availableNodeLocalIds: Set<string>
): string | undefined {
  if (!isRecord(value)) {
    return `${fieldPath} must be an object.`;
  }
  if (value.kind !== "insert_node_scaffold") {
    return `${fieldPath}.kind must be "insert_node_scaffold".`;
  }
  if (typeof value.local_id !== "string") {
    return `${fieldPath}.local_id must be a string.`;
  }
  if (seenLocalIds.has(value.local_id)) {
    return `${fieldPath}.local_id must be unique within the request.`;
  }
  if (value.parent !== undefined) {
    const parentError = validateNodeRef(value.parent, `${fieldPath}.parent`, availableNodeLocalIds);
    if (parentError) {
      return parentError;
    }
  }
  if (!isRecord(value.placement)) {
    return `${fieldPath}.placement must be an object.`;
  }
  if (!["before", "after", "first", "last"].includes(String(value.placement.mode))) {
    return `${fieldPath}.placement.mode must be one of "before", "after", "first", or "last".`;
  }
  if ((value.placement.mode === "before" || value.placement.mode === "after") && value.placement.anchor === undefined) {
    return `${fieldPath}.placement.anchor is required for mode "${String(value.placement.mode)}".`;
  }
  if ((value.placement.mode === "first" || value.placement.mode === "last") && value.placement.anchor !== undefined) {
    return `${fieldPath}.placement.anchor is only allowed for mode "before" or "after".`;
  }
  if (value.placement.anchor !== undefined) {
    const anchorError = validateNodeRef(value.placement.anchor, `${fieldPath}.placement.anchor`, availableNodeLocalIds);
    if (anchorError) {
      return anchorError;
    }
  }
  if (!isRecord(value.node)) {
    return `${fieldPath}.node must be an object.`;
  }
  if (typeof value.node.node_type !== "string") {
    return `${fieldPath}.node.node_type must be a string.`;
  }
  if (typeof value.node.node_id !== "string") {
    return `${fieldPath}.node.node_id must be a string.`;
  }
  if (typeof value.node.name !== "string") {
    return `${fieldPath}.node.name must be a string.`;
  }

  seenLocalIds.add(value.local_id);
  availableNodeLocalIds.add(value.local_id);

  if (value.node.props !== undefined) {
    if (!Array.isArray(value.node.props)) {
      return `${fieldPath}.node.props must be an array when provided.`;
    }
    for (const [index, prop] of value.node.props.entries()) {
      if (!isRecord(prop)) {
        return `${fieldPath}.node.props[${index}] must be an object.`;
      }
      const propPath = `${fieldPath}.node.props[${index}]`;
      if (typeof prop.key !== "string") {
        return `${propPath}.key must be a string.`;
      }
      const valueKindError = validateValueKind(prop.value_kind, `${propPath}.value_kind`);
      if (valueKindError) {
        return valueKindError;
      }
      if (typeof prop.raw_value !== "string") {
        return `${propPath}.raw_value must be a string.`;
      }
    }
  }

  if (value.node.edges !== undefined) {
    if (!Array.isArray(value.node.edges)) {
      return `${fieldPath}.node.edges must be an array when provided.`;
    }
    for (const [index, edge] of value.node.edges.entries()) {
      if (!isRecord(edge)) {
        return `${fieldPath}.node.edges[${index}] must be an object.`;
      }
      const edgePath = `${fieldPath}.node.edges[${index}]`;
      if (typeof edge.local_id !== "string") {
        return `${edgePath}.local_id must be a string.`;
      }
      if (seenLocalIds.has(edge.local_id)) {
        return `${edgePath}.local_id must be unique within the request.`;
      }
      if (typeof edge.rel_type !== "string") {
        return `${edgePath}.rel_type must be a string.`;
      }
      if (typeof edge.to !== "string") {
        return `${edgePath}.to must be a string.`;
      }
      const toNameError = validateOptionalNullableString(edge, "to_name", edgePath);
      if (toNameError) {
        return toNameError;
      }
      const eventError = validateOptionalNullableString(edge, "event", edgePath);
      if (eventError) {
        return eventError;
      }
      const guardError = validateOptionalNullableString(edge, "guard", edgePath);
      if (guardError) {
        return guardError;
      }
      const effectError = validateOptionalNullableString(edge, "effect", edgePath);
      if (effectError) {
        return effectError;
      }
      if (edge.props !== undefined && !isStringRecord(edge.props)) {
        return `${edgePath}.props must be an object with string values.`;
      }
      if (edge.placement !== undefined) {
        if (!isRecord(edge.placement)) {
          return `${edgePath}.placement must be an object when provided.`;
        }
        if (edge.placement.mode !== "first" && edge.placement.mode !== "last") {
          return `${edgePath}.placement.mode must be "first" or "last".`;
        }
      }
      seenLocalIds.add(edge.local_id);
    }
  }

  if (value.node.children !== undefined) {
    if (!Array.isArray(value.node.children)) {
      return `${fieldPath}.node.children must be an array when provided.`;
    }
    for (const [index, child] of value.node.children.entries()) {
      const childError = validateInsertNodeScaffoldIntent(
        child,
        `${fieldPath}.node.children[${index}]`,
        seenLocalIds,
        availableNodeLocalIds
      );
      if (childError) {
        return childError;
      }
    }
  }

  return undefined;
}

function validateApplyAuthoringIntentArgs(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return "expected an object.";
  }
  if (typeof value.path !== "string") {
    return "path must be a string.";
  }
  if (typeof value.base_revision !== "string") {
    return "base_revision must be a string.";
  }
  if (!Array.isArray(value.intents)) {
    return "intents must be an array.";
  }
  const modeError = validateMode(value.mode, "mode");
  if (modeError) {
    return modeError;
  }
  const validateProfileError = validateProfile(value.validate_profile, "validate_profile");
  if (validateProfileError) {
    return validateProfileError;
  }
  if (value.projection_views !== undefined && !isStringArray(value.projection_views)) {
    return "projection_views must be an array of strings when provided.";
  }
  const seenLocalIds = new Set<string>();
  const availableNodeLocalIds = new Set<string>();
  for (const [index, intent] of value.intents.entries()) {
    const intentError = validateInsertNodeScaffoldIntent(
      intent,
      `intents[${index}]`,
      seenLocalIds,
      availableNodeLocalIds
    );
    if (intentError) {
      return intentError;
    }
  }
  return undefined;
}

function validateUndoChangeSetArgs(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return "expected an object.";
  }
  if (typeof value.change_set_id !== "string") {
    return "change_set_id must be a string.";
  }
  const modeError = validateMode(value.mode, "mode");
  if (modeError) {
    return modeError;
  }
  return validateProfile(value.validate_profile, "validate_profile");
}

async function loadWorkspaceContext(
  deps: HelperCliDeps
): Promise<{ repoRoot: string; workspace: AuthoringWorkspace }> {
  const currentDir = deps.cwd();
  const repoRoot = await deps.findRepoRoot(currentDir);
  if (!repoRoot) {
    throw new HelperCliError(
      "runtime_error",
      `sdd-helper could not locate the SDD repo root from '${currentDir}'.`
    );
  }
  return {
    repoRoot,
    workspace: deps.createWorkspace(repoRoot)
  };
}

async function loadBundleContext(
  deps: HelperCliDeps
): Promise<{ bundle: Bundle; workspace: AuthoringWorkspace }> {
  const { repoRoot, workspace } = await loadWorkspaceContext(deps);
  const bundle = await deps.loadBundle(path.join(repoRoot, "bundle/v0.1/manifest.yaml"));
  return { workspace, bundle };
}

function normalizeDocumentArgs(
  workspace: AuthoringWorkspace,
  paths: string[]
): string[] {
  return paths.map((documentPath) => workspace.normalizeDocumentPath(documentPath));
}

function rethrowDomainCreateRejection(error: unknown): never {
  if (error instanceof AuthoringMutationError && error.changeSet) {
    throw error;
  }

  throw error;
}

function classifyHelperError(error: unknown): HelperCliError {
  if (error instanceof HelperCliError) {
    return error;
  }

  if (error instanceof CommanderError) {
    return new HelperCliError("invalid_args", error.message);
  }

  if (error instanceof WorkspacePathError) {
    return new HelperCliError("invalid_args", error.message);
  }

  if (error instanceof AuthoringGitError) {
    return new HelperCliError("runtime_error", error.message);
  }

  if (error instanceof AuthoringPreviewError) {
    return new HelperCliError("runtime_error", error.message, error.diagnostics);
  }

  return new HelperCliError(
    "runtime_error",
    error instanceof Error ? error.message : String(error)
  );
}

export function createHelperProgram(overrides: Partial<HelperCliDeps> = {}): Command {
  const deps = withDefaults(overrides);
  const program = new Command();

  program
    .name("sdd-helper")
    .description("JSON-first helper CLI for SDD authoring workflows")
    .helpOption(false)
    .addHelpCommand(false)
    .configureOutput({
      writeOut: () => undefined,
      writeErr: () => undefined
    });

  program.command("capabilities").action(() => {
    writeJson(deps, createHelperCapabilities());
  });

  program
    .command("contract")
    .argument("<subject_id>", "shared contract subject id")
    .action((subjectId: string) => {
      const detail = getContractSubjectDetail(subjectId as ContractSubjectId);
      if (!detail) {
        throw new HelperCliError(
          "invalid_args",
          `Unknown contract subject_id '${subjectId}'. Use 'sdd-helper capabilities' to discover valid subjects.`
        );
      }

      writeJson(deps, detail);
    });

  program
    .command("inspect")
    .argument("<document_path>", "repo-relative .sdd document path")
    .action(async (documentPath: string) => {
      const { workspace, bundle } = await loadBundleContext(deps);
      const normalizedPath = workspace.normalizeDocumentPath(documentPath);
      const inspected = await deps.inspectDocument(workspace, bundle, normalizedPath);
      if (inspected.kind !== "sdd-inspected-document") {
        throw new HelperCliError(
          "runtime_error",
          `Document '${normalizedPath}' is not parseable for inspect.`
        );
      }

      writeJson(deps, inspected.resource);
    });

  program
    .command("search")
    .option("--query <query>", "query text")
    .option("--node-type <node_type>", "node type filter")
    .option("--node-id <node_id>", "node id filter")
    .option("--under <path>", "repo-relative directory prefix")
    .option("--limit <count>", "result limit", parseIntegerOption)
    .action(async (options: SearchGraphArgs) => {
      if (!options.query && !options.node_type && !options.node_id) {
        throw new HelperCliError("invalid_args", "At least one of --query, --node-type, or --node-id is required.");
      }

      const { workspace, bundle } = await loadBundleContext(deps);
      if (options.under) {
        workspace.normalizePublicPath(options.under, { allowDirectory: true });
      }

      writeJson(deps, await deps.searchGraph(workspace, bundle, options));
    });

  program
    .command("create")
    .argument("<document_path>", "repo-relative .sdd document path")
    .option("--version <version>", "document version")
    .action(async (documentPath: string, options: { version?: CreateDocumentArgs["version"] }) => {
      const { workspace, bundle } = await loadBundleContext(deps);
      const normalizedPath = workspace.normalizeDocumentPath(documentPath);

      try {
        writeJson(
          deps,
          await deps.createDocument(workspace, bundle, {
            path: normalizedPath,
            version: options.version
          })
        );
      } catch (error) {
        rethrowDomainCreateRejection(error);
      }
    });

  program
    .command("apply")
    .requiredOption("--request <file-or-stdin>", "JSON request source or '-' for stdin")
    .action(async (options: { request: string }) => {
      const { workspace, bundle } = await loadBundleContext(deps);
      const rawRequest = await loadRequestText(deps, options.request);
      const request = parseJsonRequest<ApplyChangeSetArgs>(rawRequest, "ApplyChangeSetArgs", validateApplyChangeSetArgs);
      workspace.normalizeDocumentPath(request.path);
      writeJson(deps, await deps.applyChangeSet(workspace, bundle, request));
    });

  program
    .command("author")
    .requiredOption("--request <file-or-stdin>", "JSON request source or '-' for stdin")
    .action(async (options: { request: string }) => {
      const { workspace, bundle } = await loadBundleContext(deps);
      const rawRequest = await loadRequestText(deps, options.request);
      const request = parseJsonRequest<ApplyAuthoringIntentArgs>(
        rawRequest,
        "ApplyAuthoringIntentArgs",
        validateApplyAuthoringIntentArgs
      );
      workspace.normalizeDocumentPath(request.path);
      writeJson(deps, await deps.applyAuthoringIntent(workspace, bundle, request));
    });

  program
    .command("undo")
    .requiredOption("--request <file-or-stdin>", "JSON request source or '-' for stdin")
    .action(async (options: { request: string }) => {
      const { workspace, bundle } = await loadBundleContext(deps);
      const rawRequest = await loadRequestText(deps, options.request);
      const request = parseJsonRequest<UndoChangeSetArgs>(rawRequest, "UndoChangeSetArgs", validateUndoChangeSetArgs);
      writeJson(deps, await deps.undoChangeSet(workspace, bundle, request));
    });

  program
    .command("validate")
    .argument("<document_path>", "repo-relative .sdd document path")
    .requiredOption("--profile <profile_id>", "profile id")
    .action(async (documentPath: string, options: { profile: ValidateDocumentArgs["profile_id"] }) => {
      const { workspace, bundle } = await loadBundleContext(deps);
      const normalizedPath = workspace.normalizeDocumentPath(documentPath);
      writeJson(deps, await deps.validateDocument(workspace, bundle, {
        path: normalizedPath,
        profile_id: options.profile
      }));
    });

  program
    .command("project")
    .argument("<document_path>", "repo-relative .sdd document path")
    .requiredOption("--view <view_id>", "view id")
    .action(async (documentPath: string, options: { view: ProjectDocumentArgs["view_id"] }) => {
      const { workspace, bundle } = await loadBundleContext(deps);
      const normalizedPath = workspace.normalizeDocumentPath(documentPath);
      writeJson(deps, await deps.projectDocument(workspace, bundle, {
        path: normalizedPath,
        view_id: options.view
      }));
    });

  program
    .command("preview")
    .argument("<document_path>", "repo-relative .sdd document path")
    .requiredOption("--view <view_id>", "view id")
    .requiredOption("--profile <profile_id>", "profile id")
    .requiredOption("--format <format>", "preview format")
    .option("--backend <backend_id>", "preview backend id")
    .action(async (
      documentPath: string,
      options: {
        view: string;
        profile: RenderPreviewArgs["profile_id"];
        format: RenderPreviewArgs["format"];
        backend?: RenderPreviewArgs["backend_id"];
      }
    ) => {
      const { workspace, bundle } = await loadBundleContext(deps);
      const normalizedPath = workspace.normalizeDocumentPath(documentPath);
      writeJson(
        deps,
        await deps.renderPreview(workspace, bundle, {
          path: normalizedPath,
          view_id: options.view,
          profile_id: options.profile,
          format: options.format,
          backend_id: options.backend
        })
      );
    });

  program
    .command("git-status")
    .argument("[document_paths...]", "repo-relative .sdd document paths")
    .action(async (documentPaths: string[] = []) => {
      const { workspace } = await loadWorkspaceContext(deps);
      const normalizedPaths = normalizeDocumentArgs(workspace, documentPaths);
      writeJson(deps, await deps.getGitStatus(workspace, normalizedPaths));
    });

  program
    .command("git-commit")
    .requiredOption("--message <message>", "commit message")
    .argument("[document_paths...]", "repo-relative .sdd document paths")
    .action(async (documentPaths: string[] = [], options: { message: string }) => {
      const { workspace } = await loadWorkspaceContext(deps);
      if (documentPaths.length === 0) {
        throw new HelperCliError("invalid_args", "git-commit requires at least one explicit .sdd path.");
      }

      const normalizedPaths = normalizeDocumentArgs(workspace, documentPaths);
      writeJson(deps, await deps.gitCommit(workspace, options.message, normalizedPaths));
    });

  return program;
}

function applyExitOverride(command: Command): void {
  command.exitOverride();
  for (const subcommand of command.commands) {
    applyExitOverride(subcommand);
  }
}

export async function runHelperCli(
  argv: string[] = process.argv,
  overrides: Partial<HelperCliDeps> = {}
): Promise<RunHelperCliResult> {
  const deps = withDefaults(overrides);
  const args = argv.slice(2);

  if (shouldReturnHelperHelp(args)) {
    writeJson(deps, createHelperHelpStub());
    return { exitCode: 0 };
  }

  const program = createHelperProgram(deps);
  applyExitOverride(program);

  try {
    await program.parseAsync(argv);
    return { exitCode: 0 };
  } catch (error) {
    if (error instanceof AuthoringMutationError && error.changeSet) {
      writeJson(deps, error.changeSet);
      return { exitCode: 0 };
    }

    const helperError = classifyHelperError(error);
    writeJson(deps, helperErrorResult(helperError.code, helperError.message, helperError.diagnostics));
    return { exitCode: 1 };
  }
}
