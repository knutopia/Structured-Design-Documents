import { readFile } from "node:fs/promises";
import path from "node:path";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import type { Bundle } from "../bundle/types.js";
import { loadBundle } from "../bundle/loadBundle.js";
import type {
  ApplyChangeSetArgs,
  ChangeSetResult,
  CreateDocumentArgs,
  HelperErrorResult,
  RenderPreviewArgs,
  SearchGraphArgs,
  UndoChangeSetArgs
} from "../authoring/contracts.js";
import { AuthoringGitError, getGitStatus, gitCommit } from "../authoring/git.js";
import { inspectDocument } from "../authoring/inspect.js";
import { listDocuments, searchGraph } from "../authoring/listing.js";
import { applyChangeSet, AuthoringMutationError, createDocument } from "../authoring/mutations.js";
import { AuthoringPreviewError, renderPreview } from "../authoring/preview.js";
import { undoChangeSet } from "../authoring/undo.js";
import { stringifyCanonicalJson } from "../authoring/revisions.js";
import { createAuthoringWorkspace, WorkspacePathError, type AuthoringWorkspace } from "../authoring/workspace.js";
import { createHelperCapabilities, createHelperHelpStub, shouldReturnHelperHelp } from "./helperDiscovery.js";

const defaultManifestPath = path.resolve("bundle/v0.1/manifest.yaml");

export interface HelperCliDeps {
  cwd: () => string;
  stdout: (content: string) => void;
  stderr: (content: string) => void;
  loadBundle: (manifestPath: string) => Promise<Bundle>;
  createWorkspace: (repoRoot: string) => AuthoringWorkspace;
  inspectDocument: typeof inspectDocument;
  listDocuments: typeof listDocuments;
  searchGraph: typeof searchGraph;
  createDocument: typeof createDocument;
  applyChangeSet: typeof applyChangeSet;
  undoChangeSet: typeof undoChangeSet;
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

  constructor(code: HelperErrorResult["code"], message: string) {
    super(message);
    this.name = "HelperCliError";
    this.code = code;
  }
}

function createDefaultDeps(): HelperCliDeps {
  return {
    cwd: () => process.cwd(),
    stdout: (content) => {
      process.stdout.write(content);
    },
    stderr: (content) => {
      process.stderr.write(content);
    },
    loadBundle,
    createWorkspace: createAuthoringWorkspace,
    inspectDocument,
    listDocuments,
    searchGraph,
    createDocument,
    applyChangeSet,
    undoChangeSet,
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

function helperErrorResult(code: HelperErrorResult["code"], message: string): HelperErrorResult {
  return {
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

function parseJsonRequest<T>(
  rawText: string,
  validate: (value: unknown) => value is T
): T {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new HelperCliError(
      "invalid_json",
      error instanceof Error ? error.message : "Request body is not valid JSON."
    );
  }

  if (!validate(parsed)) {
    throw new HelperCliError("invalid_args", "Request body does not match the expected top-level shape.");
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApplyChangeSetArgs(value: unknown): value is ApplyChangeSetArgs {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    typeof value.base_revision === "string" &&
    Array.isArray(value.operations)
  );
}

function isUndoChangeSetArgs(value: unknown): value is UndoChangeSetArgs {
  return isRecord(value) && typeof value.change_set_id === "string";
}

async function loadHelperContext(
  deps: HelperCliDeps
): Promise<{ bundle: Bundle; workspace: AuthoringWorkspace }> {
  const workspace = deps.createWorkspace(deps.cwd());
  const bundle = await deps.loadBundle(defaultManifestPath);
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

  if (error instanceof AuthoringGitError || error instanceof AuthoringPreviewError) {
    return new HelperCliError("runtime_error", error.message);
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
    .command("inspect")
    .argument("<document_path>", "repo-relative .sdd document path")
    .action(async (documentPath: string) => {
      const { workspace, bundle } = await loadHelperContext(deps);
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

      const { workspace, bundle } = await loadHelperContext(deps);
      if (options.under) {
        workspace.normalizePublicPath(options.under, { allowDirectory: true });
      }

      writeJson(deps, await deps.searchGraph(workspace, bundle, options));
    });

  program
    .command("create")
    .argument("<document_path>", "repo-relative .sdd document path")
    .requiredOption("--template <template_id>", "document template id")
    .option("--version <version>", "document version")
    .action(async (documentPath: string, options: Pick<CreateDocumentArgs, "template_id" | "version">) => {
      const { workspace, bundle } = await loadHelperContext(deps);
      const normalizedPath = workspace.normalizeDocumentPath(documentPath);

      try {
        writeJson(
          deps,
          await deps.createDocument(workspace, bundle, {
            path: normalizedPath,
            template_id: options.template_id,
            version: options.version as CreateDocumentArgs["version"] | undefined
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
      const { workspace, bundle } = await loadHelperContext(deps);
      const rawRequest = await loadRequestText(deps, options.request);
      const request = parseJsonRequest(rawRequest, isApplyChangeSetArgs);
      workspace.normalizeDocumentPath(request.path);
      writeJson(deps, await deps.applyChangeSet(workspace, bundle, request));
    });

  program
    .command("undo")
    .requiredOption("--request <file-or-stdin>", "JSON request source or '-' for stdin")
    .action(async (options: { request: string }) => {
      const { workspace, bundle } = await loadHelperContext(deps);
      const rawRequest = await loadRequestText(deps, options.request);
      const request = parseJsonRequest(rawRequest, isUndoChangeSetArgs);
      writeJson(deps, await deps.undoChangeSet(workspace, bundle, request));
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
      const { workspace, bundle } = await loadHelperContext(deps);
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
      const { workspace } = await loadHelperContext(deps);
      const normalizedPaths = normalizeDocumentArgs(workspace, documentPaths);
      writeJson(deps, await deps.getGitStatus(workspace, normalizedPaths));
    });

  program
    .command("git-commit")
    .requiredOption("--message <message>", "commit message")
    .argument("[document_paths...]", "repo-relative .sdd document paths")
    .action(async (documentPaths: string[] = [], options: { message: string }) => {
      const { workspace } = await loadHelperContext(deps);
      if (documentPaths.length === 0) {
        throw new HelperCliError("invalid_args", "git-commit requires at least one explicit .sdd path.");
      }

      const normalizedPaths = normalizeDocumentArgs(workspace, documentPaths);
      writeJson(deps, await deps.gitCommit(workspace, options.message, normalizedPaths));
    });

  return program;
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

  program.exitOverride();

  try {
    await program.parseAsync(argv);
    return { exitCode: 0 };
  } catch (error) {
    if (error instanceof AuthoringMutationError && error.changeSet) {
      writeJson(deps, error.changeSet);
      return { exitCode: 0 };
    }

    const helperError = classifyHelperError(error);
    writeJson(deps, helperErrorResult(helperError.code, helperError.message));
    return { exitCode: 1 };
  }
}
