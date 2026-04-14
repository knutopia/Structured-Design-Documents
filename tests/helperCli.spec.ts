import { describe, expect, it, vi } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import type {
  ApplyAuthoringIntentArgs,
  ApplyChangeSetArgs,
  ChangeSetResult,
  CreateDocumentArgs,
  CreateDocumentResult,
  HelperGitCommitResult,
  HelperGitStatusResult,
  ProjectionResource,
  RenderPreviewResult,
  SearchGraphResult,
  ValidationResource,
  UndoChangeSetArgs
} from "../src/authoring/contracts.js";
import { AuthoringMutationError } from "../src/authoring/mutations.js";
import { AuthoringPreviewError } from "../src/authoring/preview.js";
import { runHelperCli, type HelperCliDeps } from "../src/cli/helperProgram.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";

function createRejectedChangeSet(path: string): ChangeSetResult {
  return {
    kind: "sdd-change-set",
    change_set_id: "chg_rejected_001",
    path,
    origin: "apply_change_set",
    document_effect: "updated",
    base_revision: "rev_base",
    mode: "dry_run",
    status: "rejected",
    undo_eligible: false,
    operations: [],
    summary: {
      node_insertions: [],
      node_deletions: [],
      node_renames: [],
      property_changes: [],
      edge_insertions: [],
      edge_deletions: [],
      ordering_changes: []
    },
    diagnostics: [
      {
        stage: "cli",
        code: "sdd.example_rejection",
        severity: "error",
        message: "Example rejected payload.",
        file: path
      }
    ]
  };
}

function createDeps(overrides: Partial<HelperCliDeps> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const inspectDocumentMock = vi.fn(async () => ({
    kind: "sdd-inspected-document" as const,
    resource: {
      kind: "sdd-document-inspect" as const,
      uri: "sdd://document/docs/example.sdd/inspect",
      path: "docs/example.sdd",
      revision: "rev_example",
      effective_version: "0.1",
      top_level_order: [],
      nodes: [],
      body_items: [],
      diagnostics: []
    },
    document: {} as never,
    handleIndex: new Map(),
    rewriteOwnership: {
      byHandle: new Map()
    },
    source: {
      text: "",
      lineOffsets: [0],
      sliceSpan: () => "",
      lineText: () => ""
    }
  }));
  const searchGraphMock = vi.fn(async (): Promise<SearchGraphResult> => ({
    kind: "sdd-search-results",
    matches: [
      {
        path: "docs/example.sdd",
        uri: "sdd://document/docs/example.sdd",
        revision: "rev_example",
        node_id: "P-001",
        node_type: "Place",
        name: "Home",
        matched_on: ["query"]
      }
    ],
    diagnostics: []
  }));
  const createDocumentMock = vi.fn(async (): Promise<CreateDocumentResult> => ({
    kind: "sdd-create-document",
    path: "docs/new.sdd",
    uri: "sdd://document/docs/new.sdd",
    revision: "rev_new",
    change_set: {
      ...createRejectedChangeSet("docs/new.sdd"),
      origin: "create_document",
      document_effect: "created",
      base_revision: null,
      mode: "commit",
      status: "applied",
      undo_eligible: true,
      diagnostics: [],
      resulting_revision: "rev_new"
    }
  }));
  const applyChangeSetMock = vi.fn(async (_workspace, _bundle, request: ApplyChangeSetArgs): Promise<ChangeSetResult> => ({
    ...createRejectedChangeSet(request.path),
    change_set_id: "chg_apply_001",
    path: request.path,
    base_revision: request.base_revision,
    mode: request.mode ?? "dry_run",
    operations: request.operations
  }));
  const applyAuthoringIntentMock = vi.fn(async (_workspace, _bundle, request: ApplyAuthoringIntentArgs) => ({
    kind: "sdd-authoring-intent-result" as const,
    path: request.path,
    base_revision: request.base_revision,
    resulting_revision: "rev_authored",
    mode: request.mode ?? "dry_run",
    status: "applied" as const,
    intents: request.intents,
    change_set: {
      ...createRejectedChangeSet(request.path),
      change_set_id: "chg_author_001",
      origin: "apply_authoring_intent" as const,
      base_revision: request.base_revision,
      mode: request.mode ?? "dry_run",
      status: "applied" as const,
      diagnostics: [],
      resulting_revision: "rev_authored"
    },
    created_targets: [
      {
        local_id: "place-root",
        kind: "node" as const,
        handle: "hdl_created_root"
      }
    ],
    diagnostics: []
  }));
  const undoChangeSetMock = vi.fn(async (): Promise<ChangeSetResult> => ({
    ...createRejectedChangeSet("docs/example.sdd"),
    change_set_id: "chg_undo_001",
    origin: "undo_change_set",
    document_effect: "updated"
  }));
  const validateDocumentMock = vi.fn(async (): Promise<ValidationResource> => ({
    kind: "sdd-validation",
    uri: "sdd://document/docs/example.sdd/validation/strict",
    path: "docs/example.sdd",
    revision: "rev_validation",
    profile_id: "strict",
    report: {
      error_count: 1,
      warning_count: 0
    },
    diagnostics: []
  }));
  const projectDocumentMock = vi.fn(async (): Promise<ProjectionResource> => ({
    kind: "sdd-projection",
    uri: "sdd://document/docs/example.sdd/projection/ia_place_map",
    path: "docs/example.sdd",
    revision: "rev_projection",
    view_id: "ia_place_map",
    projection: {
      schema: "sdd-text-view-projection",
      version: "0.1",
      view_id: "ia_place_map",
      source_example: "docs/example.sdd",
      nodes: [],
      edges: [],
      derived: {
        node_annotations: [],
        edge_annotations: [],
        node_groups: [],
        view_metadata: {}
      },
      omissions: [],
      notes: []
    },
    diagnostics: []
  }));
  const renderPreviewMock = vi.fn(async (): Promise<RenderPreviewResult> => ({
    kind: "sdd-preview",
    path: "docs/example.sdd",
    revision: "rev_preview",
    view_id: "ia_place_map",
    profile_id: "strict",
    backend_id: "staged_ia_place_map_preview",
    artifact: {
      format: "svg",
      mime_type: "image/svg+xml",
      text: "<svg>preview</svg>"
    },
    notes: [],
    diagnostics: []
  }));
  const getGitStatusMock = vi.fn(async (): Promise<HelperGitStatusResult> => ({
    kind: "sdd-git-status",
    paths: ["docs/example.sdd"],
    status: [
      {
        path: "docs/example.sdd",
        index_status: "M",
        worktree_status: " "
      }
    ]
  }));
  const gitCommitMock = vi.fn(async (): Promise<HelperGitCommitResult> => ({
    kind: "sdd-git-commit",
    committed_paths: ["docs/example.sdd"],
    commit_sha: "abc123"
  }));

  const deps: Partial<HelperCliDeps> = {
    cwd: () => "/repo",
    stdout: (content: string) => {
      stdout.push(content);
    },
    stderr: (content: string) => {
      stderr.push(content);
    },
    findRepoRoot: vi.fn(async (startDir: string) => startDir),
    loadBundle: vi.fn(async () => ({} as Bundle)),
    createWorkspace: createAuthoringWorkspace,
    inspectDocument: inspectDocumentMock,
    listDocuments: vi.fn(),
    searchGraph: searchGraphMock,
    createDocument: createDocumentMock,
    applyChangeSet: applyChangeSetMock,
    applyAuthoringIntent: applyAuthoringIntentMock,
    undoChangeSet: undoChangeSetMock,
    validateDocument: validateDocumentMock,
    projectDocument: projectDocumentMock,
    renderPreview: renderPreviewMock,
    getGitStatus: getGitStatusMock,
    gitCommit: gitCommitMock,
    readTextFile: vi.fn(async () => JSON.stringify({
      path: "docs/example.sdd",
      base_revision: "rev_base",
      operations: []
    })),
    readStdin: vi.fn(async () => JSON.stringify({
      path: "docs/example.sdd",
      base_revision: "rev_base",
      operations: [],
      mode: "commit"
    }))
  };

  Object.assign(deps, overrides);

  return {
    stdout,
    stderr,
    deps: deps as Partial<HelperCliDeps>,
    loadBundleMock: deps.loadBundle as ReturnType<typeof vi.fn>,
    inspectDocumentMock,
    searchGraphMock,
    createDocumentMock,
    applyChangeSetMock,
    applyAuthoringIntentMock,
    undoChangeSetMock,
    validateDocumentMock,
    projectDocumentMock,
    renderPreviewMock,
    getGitStatusMock,
    gitCommitMock
  };
}

function parseStdoutPayload(stdout: string[]): unknown {
  return JSON.parse(stdout.join(""));
}

describe("sdd-helper CLI", () => {
  it("returns the JSON help stub for bare invocation without loading repo state", async () => {
    const { deps, stdout, stderr, loadBundleMock } = createDeps();
    const result = await runHelperCli(["node", "sdd-helper"], deps);

    expect(result.exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(loadBundleMock).not.toHaveBeenCalled();
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-help",
      helper_name: "sdd-helper",
      summary: "JSON-first helper CLI for SDD authoring workflows.",
      note: "This is machine business: the helper is intended primarily for machine and LLM automation, and it returns JSON rather than text help.",
      capabilities_command: "sdd-helper capabilities",
      commands: ["inspect", "search", "create", "apply", "author", "undo", "validate", "project", "preview", "git-status", "git-commit", "capabilities"]
    });
  });

  it("returns the same JSON help stub for --help anywhere in argv", async () => {
    const { deps, stdout, loadBundleMock } = createDeps();
    const result = await runHelperCli(["node", "sdd-helper", "create", "--help"], deps);

    expect(result.exitCode).toBe(0);
    expect(loadBundleMock).not.toHaveBeenCalled();
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-helper-help",
      capabilities_command: "sdd-helper capabilities"
    });
  });

  it("returns static capabilities JSON for machine discovery", async () => {
    const { deps, stdout, loadBundleMock } = createDeps();
    const result = await runHelperCli(["node", "sdd-helper", "capabilities"], deps);

    expect(result.exitCode).toBe(0);
    expect(loadBundleMock).not.toHaveBeenCalled();
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-helper-capabilities",
      helper_name: "sdd-helper",
      discovery: {
        bare_invocation: "returns_help_stub",
        help_flag: "returns_help_stub",
        canonical_introspection_command: "sdd-helper capabilities"
      },
      conventions: {
        stdout_success: "exactly_one_json_payload",
        path_scope: "repo_relative_sdd_paths"
      },
      commands: expect.arrayContaining([
        expect.objectContaining({
          name: "capabilities",
          result_kind: "sdd-helper-capabilities"
        }),
        expect.objectContaining({
          name: "author",
          result_kind: "sdd-authoring-intent-result"
        }),
        expect.objectContaining({
          name: "create",
          invocation: "sdd-helper create <document_path> [--version <version>]",
          options: [
            {
              flag: "--version",
              required: false,
              value_name: "version",
              description: "Document language version."
            }
          ],
          constraints: expect.arrayContaining([
            "Create always bootstraps an empty document skeleton.",
            "Current implementation supports version 0.1."
          ])
        }),
        expect.objectContaining({
          name: "validate",
          result_kind: "sdd-validation"
        }),
        expect.objectContaining({
          name: "project",
          result_kind: "sdd-projection"
        }),
        expect.objectContaining({
          name: "git-status",
          constraints: expect.arrayContaining([
            "The paths field is the exhaustive .sdd reporting scope.",
            "The status field is the sparse list of actual git status entries for that scope."
          ])
        })
      ])
    });
  });

  it("writes inspect results as a single JSON payload on stdout", async () => {
    const { deps, stdout, stderr } = createDeps();
    const result = await runHelperCli(["node", "sdd-helper", "inspect", "docs/example.sdd"], deps);

    expect(result.exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-document-inspect",
      path: "docs/example.sdd"
    });
  });

  it("returns runtime_error for parse-invalid inspect targets", async () => {
    const { deps, stdout } = createDeps({
      inspectDocument: vi.fn(async () => ({
        kind: "sdd-inspect-load-failure" as const,
        path: "docs/example.sdd",
        revision: "rev_bad",
        diagnostics: []
      }))
    });

    const result = await runHelperCli(["node", "sdd-helper", "inspect", "docs/example.sdd"], deps);
    expect(result.exitCode).toBe(1);
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "runtime_error",
      message: "Document 'docs/example.sdd' is not parseable for inspect."
    });
  });

  it("returns invalid_args for search with no filters", async () => {
    const { deps, stdout } = createDeps();
    const result = await runHelperCli(["node", "sdd-helper", "search"], deps);

    expect(result.exitCode).toBe(1);
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "invalid_args",
      message: "At least one of --query, --node-type, or --node-id is required."
    });
  });

  it("passes search filters through and returns structured JSON", async () => {
    const { deps, stdout, searchGraphMock } = createDeps();
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "search",
      "--query",
      "home",
      "--under",
      "docs",
      "--limit",
      "5"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(searchGraphMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      query: "home",
      under: "docs",
      limit: 5
    });
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-search-results"
    });
  });

  it("keeps create domain rejections structured and exit-zero", async () => {
    const rejection = createRejectedChangeSet("docs/new.sdd");
    const createDocument = vi.fn(async (_workspace, _bundle, _args: CreateDocumentArgs) => {
      throw new AuthoringMutationError("rejected", rejection.diagnostics, rejection);
    });
    const { deps, stdout } = createDeps({
      createDocument
    });

    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "create",
      "docs/new.sdd",
      "--version",
      "0.1"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(createDocument).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      path: "docs/new.sdd",
      version: "0.1"
    });
    expect(parseStdoutPayload(stdout)).toEqual(rejection);
  });

  it("returns invalid_args for legacy create template flags", async () => {
    const { deps, stdout } = createDeps();
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "create",
      "docs/new.sdd",
      "--template",
      "empty"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "invalid_args",
      message: "error: unknown option '--template'"
    });
  });

  it("supports apply requests from a file and domain rejections remain structured", async () => {
    const { deps, stdout, applyChangeSetMock } = createDeps();
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "apply",
      "--request",
      "/tmp/request.json"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(applyChangeSetMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      path: "docs/example.sdd",
      base_revision: "rev_base",
      operations: []
    });
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-change-set",
      status: "rejected"
    });
  });

  it("supports apply requests from stdin", async () => {
    const { deps, applyChangeSetMock } = createDeps();
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "apply",
      "--request",
      "-"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(applyChangeSetMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      path: "docs/example.sdd",
      base_revision: "rev_base",
      operations: [],
      mode: "commit"
    });
  });

  it("supports author requests from a file and returns structured authoring results", async () => {
    const { deps, stdout, applyAuthoringIntentMock } = createDeps({
      readTextFile: vi.fn(async () => JSON.stringify({
        path: "docs/example.sdd",
        base_revision: "rev_base",
        intents: [
          {
            kind: "insert_node_scaffold",
            local_id: "place-root",
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-001",
              name: "Root"
            }
          }
        ]
      }))
    });
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "author",
      "--request",
      "/tmp/author.json"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(applyAuthoringIntentMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      path: "docs/example.sdd",
      base_revision: "rev_base",
      intents: [
        {
          kind: "insert_node_scaffold",
          local_id: "place-root",
          placement: {
            mode: "last"
          },
          node: {
            node_type: "Place",
            node_id: "P-001",
            name: "Root"
          }
        }
      ]
    });
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-authoring-intent-result",
      status: "applied"
    });
  });

  it("returns invalid_args for malformed author requests", async () => {
    const { deps, stdout, applyAuthoringIntentMock } = createDeps({
      readTextFile: vi.fn(async () => JSON.stringify({
        path: "docs/example.sdd",
        base_revision: "rev_base",
        intents: [
          {
            kind: "insert_node_scaffold",
            local_id: "place-root",
            placement: {
              mode: "before"
            },
            node: {
              node_type: "Place",
              node_id: "P-001",
              name: "Root"
            }
          }
        ]
      }))
    });
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "author",
      "--request",
      "/tmp/author-bad.json"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(applyAuthoringIntentMock).not.toHaveBeenCalled();
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "invalid_args",
      message: "Request body does not match ApplyAuthoringIntentArgs: intents[0].placement.anchor is required for mode \"before\"."
    });
  });

  it("returns invalid_json for malformed request bodies", async () => {
    const { deps, stdout } = createDeps({
      readTextFile: vi.fn(async () => "{")
    });
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "apply",
      "--request",
      "/tmp/bad.json"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-helper-error",
      code: "invalid_json"
    });
  });

  it("returns invalid_args for malformed top-level request bodies", async () => {
    const { deps, stdout } = createDeps({
      readTextFile: vi.fn(async () => JSON.stringify({ path: "docs/example.sdd" }))
    });
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "apply",
      "--request",
      "/tmp/bad-shape.json"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "invalid_args",
      message: "Request body does not match ApplyChangeSetArgs: base_revision must be a string."
    });
  });

  it("returns invalid_args for malformed nested apply operations", async () => {
    const { deps, stdout, applyChangeSetMock } = createDeps({
      readTextFile: vi.fn(async () => JSON.stringify({
        path: "docs/example.sdd",
        base_revision: "rev_base",
        operations: [
          {
            kind: "reposition_top_level_node",
            node_handle: "hdl_node"
          }
        ]
      }))
    });
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "apply",
      "--request",
      "/tmp/bad-nested-shape.json"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(applyChangeSetMock).not.toHaveBeenCalled();
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "invalid_args",
      message: "Request body does not match ApplyChangeSetArgs: operations[0].placement must be an object."
    });
  });

  it("returns undo payloads directly on stdout", async () => {
    const { deps, stdout } = createDeps({
      readTextFile: vi.fn(async () => JSON.stringify({ change_set_id: "chg_target_001" }))
    });
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "undo",
      "--request",
      "/tmp/undo.json"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-change-set",
      origin: "undo_change_set"
    });
  });

  it("returns invalid_args for malformed undo options", async () => {
    const { deps, stdout, undoChangeSetMock } = createDeps({
      readTextFile: vi.fn(async () => JSON.stringify({
        change_set_id: "chg_target_001",
        mode: "later",
        validate_profile: "strictish"
      }))
    });
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "undo",
      "--request",
      "/tmp/undo-bad.json"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(undoChangeSetMock).not.toHaveBeenCalled();
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "invalid_args",
      message: "Request body does not match UndoChangeSetArgs: mode must be one of \"dry_run\" or \"commit\"."
    });
  });

  it("returns validate and project payloads directly on stdout", async () => {
    const { deps, stdout, validateDocumentMock, projectDocumentMock } = createDeps();
    const validateResult = await runHelperCli([
      "node",
      "sdd-helper",
      "validate",
      "docs/example.sdd",
      "--profile",
      "strict"
    ], deps);

    expect(validateResult.exitCode).toBe(0);
    expect(validateDocumentMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      path: "docs/example.sdd",
      profile_id: "strict"
    });
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-validation",
      profile_id: "strict"
    });

    stdout.length = 0;
    const projectResult = await runHelperCli([
      "node",
      "sdd-helper",
      "project",
      "docs/example.sdd",
      "--view",
      "ia_place_map"
    ], deps);

    expect(projectResult.exitCode).toBe(0);
    expect(projectDocumentMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      path: "docs/example.sdd",
      view_id: "ia_place_map"
    });
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-projection",
      view_id: "ia_place_map"
    });
  });

  it("returns preview payloads directly on stdout", async () => {
    const { deps, stdout } = createDeps();
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "preview",
      "docs/example.sdd",
      "--view",
      "ia_place_map",
      "--profile",
      "strict",
      "--format",
      "svg"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-preview",
      artifact: {
        format: "svg"
      }
    });
  });

  it("returns runtime_error with diagnostics when preview fails before producing an artifact", async () => {
    const diagnostics = [
      {
        stage: "validate" as const,
        code: "validate.required_props_by_type",
        severity: "error" as const,
        message: "Node 'P-001' is missing required property 'owner'.",
        file: "docs/example.sdd"
      }
    ];
    const { deps, stdout } = createDeps({
      renderPreview: vi.fn(async () => {
        throw new AuthoringPreviewError(
          "Preview validate failure for 'docs/example.sdd' (view_id=ia_place_map, profile_id=strict): Node 'P-001' is missing required property 'owner'.",
          diagnostics
        );
      })
    });
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "preview",
      "docs/example.sdd",
      "--view",
      "ia_place_map",
      "--profile",
      "strict",
      "--format",
      "svg"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "runtime_error",
      message: "Preview validate failure for 'docs/example.sdd' (view_id=ia_place_map, profile_id=strict): Node 'P-001' is missing required property 'owner'.",
      diagnostics
    });
  });

  it("does not load the bundle for git-only commands", async () => {
    const { deps, stdout, loadBundleMock } = createDeps();

    const statusResult = await runHelperCli(["node", "sdd-helper", "git-status"], deps);
    expect(statusResult.exitCode).toBe(0);

    stdout.length = 0;
    const commitResult = await runHelperCli([
      "node",
      "sdd-helper",
      "git-commit",
      "--message",
      "Save changes",
      "docs/example.sdd"
    ], deps);

    expect(statusResult.exitCode).toBe(0);
    expect(commitResult.exitCode).toBe(0);
    expect(loadBundleMock).not.toHaveBeenCalled();
  });

  it("supports git-status with and without explicit paths", async () => {
    const { deps, stdout, getGitStatusMock } = createDeps();
    const explicit = await runHelperCli([
      "node",
      "sdd-helper",
      "git-status",
      "docs/example.sdd"
    ], deps);
    expect(explicit.exitCode).toBe(0);
    expect(getGitStatusMock).toHaveBeenNthCalledWith(1, expect.anything(), ["docs/example.sdd"]);
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-git-status"
    });

    stdout.length = 0;
    const allPaths = await runHelperCli(["node", "sdd-helper", "git-status"], deps);
    expect(allPaths.exitCode).toBe(0);
    expect(getGitStatusMock).toHaveBeenNthCalledWith(2, expect.anything(), []);
  });

  it("requires explicit paths for git-commit", async () => {
    const { deps, stdout } = createDeps();
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "git-commit",
      "--message",
      "Save changes"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "invalid_args",
      message: "git-commit requires at least one explicit .sdd path."
    });
  });

  it("returns git-commit results for explicit paths", async () => {
    const { deps, stdout, gitCommitMock } = createDeps();
    const result = await runHelperCli([
      "node",
      "sdd-helper",
      "git-commit",
      "--message",
      "Save changes",
      "docs/example.sdd"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(gitCommitMock).toHaveBeenCalledWith(expect.anything(), "Save changes", ["docs/example.sdd"]);
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-git-commit",
      committed_paths: ["docs/example.sdd"],
      commit_sha: "abc123"
    });
  });
});
