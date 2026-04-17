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

function createContractResolutionBundle(): Bundle {
  return {
    manifest: {
      bundle_name: "sdd-text-spec-bundle",
      bundle_version: "0.1",
      profiles: [
        {
          id: "simple",
          path: "profiles/simple.yaml",
          intent: "Low-noise drafting with strict structural validation."
        },
        {
          id: "permissive",
          path: "profiles/permissive.yaml",
          intent: "Warning-first governance with strict structural validation."
        },
        {
          id: "strict",
          path: "profiles/strict.yaml",
          intent: "Strict governance for production-ready authoring."
        }
      ]
    },
    views: {
      version: "0.1",
      views: [
        {
          id: "journey_map",
          name: "Journey Map",
          status: "operational"
        },
        {
          id: "ia_place_map",
          name: "IA Place Map",
          status: "operational"
        },
        {
          id: "ui_contracts",
          name: "UI Contracts",
          status: "operational"
        }
      ]
    }
  } as Bundle;
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
      commands: [
        "inspect",
        "search",
        "create",
        "apply",
        "author",
        "undo",
        "validate",
        "project",
        "preview",
        "git-status",
        "git-commit",
        "contract",
        "capabilities"
      ]
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
          result_kind: "sdd-helper-capabilities",
          subject_id: "helper.command.capabilities",
          output_shape_id: "shared.shape.helper_capabilities_result",
          has_deep_introspection: true,
          detail_modes: ["static"]
        }),
        expect.objectContaining({
          name: "contract",
          invocation: "sdd-helper contract <subject_id> [--resolve bundle]",
          result_kind: "sdd-contract-subject-detail",
          subject_id: "helper.command.contract",
          input_shape_id: "shared.shape.helper_contract_args",
          output_shape_id: "shared.shape.contract_subject_detail",
          has_deep_introspection: true,
          detail_modes: ["static", "bundle_resolved"],
          options: [
            {
              flag: "--resolve",
              required: false,
              value_name: "mode",
              description: "Optional resolution mode. Supported value: bundle."
            }
          ]
        }),
        expect.objectContaining({
          name: "author",
          result_kind: "sdd-authoring-intent-result",
          subject_id: "helper.command.author",
          input_shape_id: "shared.shape.apply_authoring_intent_args",
          output_shape_id: "shared.shape.apply_authoring_intent_result",
          has_deep_introspection: true,
          detail_modes: ["static"]
        }),
        expect.objectContaining({
          name: "create",
          invocation: "sdd-helper create <document_path> [--version <version>]",
          subject_id: "helper.command.create",
          input_shape_id: "shared.shape.create_document_args",
          output_shape_id: "shared.shape.create_document_result",
          has_deep_introspection: true,
          detail_modes: ["static"],
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
          name: "project",
          result_kind: "sdd-projection",
          subject_id: "helper.command.project",
          detail_modes: ["static", "bundle_resolved"]
        }),
        expect.objectContaining({
          name: "preview",
          invocation:
            "sdd-helper preview <document_path> --view <view_id> --profile <profile_id> --format <svg|png> [--backend <backend_id>] [--display-copy-name <basename>]",
          result_kind: "sdd-preview",
          subject_id: "helper.command.preview",
          input_shape_id: "shared.shape.render_preview_args",
          output_shape_id: "shared.shape.render_preview_result",
          has_deep_introspection: true,
          detail_modes: ["static", "bundle_resolved"],
          mutates_repo_state: "never",
          options: expect.arrayContaining([
            expect.objectContaining({
              flag: "--display-copy-name",
              value_name: "basename"
            })
          ])
        }),
        expect.objectContaining({
          name: "validate",
          result_kind: "sdd-validation",
          subject_id: "helper.command.validate",
          input_shape_id: "shared.shape.validate_document_args",
          output_shape_id: "shared.shape.validation_resource",
          has_deep_introspection: true,
          detail_modes: ["static", "bundle_resolved"]
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

  it("returns static contract detail without loading bundle state", async () => {
    const { deps, stdout, stderr, loadBundleMock } = createDeps();
    const result = await runHelperCli(["node", "sdd-helper", "contract", "helper.command.author"], deps);

    expect(result.exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(loadBundleMock).not.toHaveBeenCalled();
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-contract-subject-detail",
      subject: {
        subject_id: "helper.command.author",
        input_shape_id: "shared.shape.apply_authoring_intent_args",
        output_shape_id: "shared.shape.apply_authoring_intent_result"
      },
      input_shape: {
        shape_id: "shared.shape.apply_authoring_intent_args"
      },
      output_shape: {
        shape_id: "shared.shape.apply_authoring_intent_result"
      },
      resolution: {
        mode: "static"
      }
    });
  });

  it("returns create bootstrap continuation semantics through contract detail", async () => {
    const { deps, stdout } = createDeps();
    const result = await runHelperCli(["node", "sdd-helper", "contract", "helper.command.create"], deps);

    expect(result.exitCode).toBe(0);
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-contract-subject-detail",
      subject: {
        subject_id: "helper.command.create"
      },
      continuation: [
        {
          kind: "create_revision_is_bootstrap_continuation_surface"
        },
        {
          kind: "inspect_may_fail_on_empty_bootstrap"
        }
      ],
      resolution: {
        mode: "static"
      }
    });
  });

  it("returns unresolved binding references in static contract detail", async () => {
    const { deps, stdout } = createDeps();
    const result = await runHelperCli(["node", "sdd-helper", "contract", "helper.command.preview"], deps);

    expect(result.exitCode).toBe(0);
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-contract-subject-detail",
      subject: {
        subject_id: "helper.command.preview"
      },
      bindings: [
        {
          binding_id: "shared.binding.render_preview.view_id"
        },
        {
          binding_id: "shared.binding.render_preview.profile_id"
        }
      ],
      resolution: {
        mode: "static",
        unresolved_binding_ids: [
          "shared.binding.render_preview.view_id",
          "shared.binding.render_preview.profile_id"
        ]
      }
    });
  });

  it("loads bundle state only when bundle resolution is requested", async () => {
    const loadBundle = vi.fn(async () => createContractResolutionBundle());
    const { deps, stdout, loadBundleMock } = createDeps({
      loadBundle
    });

    const result = await runHelperCli(
      ["node", "sdd-helper", "contract", "helper.command.preview", "--resolve", "bundle"],
      deps
    );

    expect(result.exitCode).toBe(0);
    expect(loadBundleMock).toHaveBeenCalledTimes(1);
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-contract-subject-detail",
      subject: {
        subject_id: "helper.command.preview"
      },
      bindings: [
        {
          binding_id: "shared.binding.render_preview.view_id",
          resolved_values: [
            {
              value: "journey_map",
              label: "Journey Map",
              metadata: {
                status: "operational"
              }
            },
            {
              value: "ia_place_map",
              label: "IA Place Map",
              metadata: {
                status: "operational"
              }
            },
            {
              value: "ui_contracts",
              label: "UI Contracts",
              metadata: {
                status: "operational"
              }
            }
          ]
        },
        {
          binding_id: "shared.binding.render_preview.profile_id",
          resolved_values: [
            {
              value: "simple",
              metadata: {
                intent: "Low-noise drafting with strict structural validation."
              }
            },
            {
              value: "permissive",
              metadata: {
                intent: "Warning-first governance with strict structural validation."
              }
            },
            {
              value: "strict",
              metadata: {
                intent: "Strict governance for production-ready authoring."
              }
            }
          ]
        }
      ],
      resolution: {
        mode: "bundle_resolved",
        bundle_name: "sdd-text-spec-bundle",
        bundle_version: "0.1"
      }
    });
  });

  it("resolves project and validate bindings independently", async () => {
    const { deps, stdout } = createDeps({
      loadBundle: vi.fn(async () => createContractResolutionBundle())
    });

    const validateResult = await runHelperCli(
      ["node", "sdd-helper", "contract", "helper.command.validate", "--resolve", "bundle"],
      deps
    );

    expect(validateResult.exitCode).toBe(0);
    expect(parseStdoutPayload(stdout)).toMatchObject({
      subject: {
        subject_id: "helper.command.validate"
      },
      bindings: [
        {
          binding_id: "shared.binding.validate_document.profile_id",
          resolved_values: [
            { value: "simple" },
            { value: "permissive" },
            { value: "strict" }
          ]
        }
      ]
    });

    stdout.length = 0;
    const projectResult = await runHelperCli(
      ["node", "sdd-helper", "contract", "helper.command.project", "--resolve", "bundle"],
      deps
    );

    expect(projectResult.exitCode).toBe(0);
    expect(parseStdoutPayload(stdout)).toMatchObject({
      subject: {
        subject_id: "helper.command.project"
      },
      bindings: [
        {
          binding_id: "shared.binding.project_document.view_id",
          resolved_values: [
            { value: "journey_map" },
            { value: "ia_place_map" },
            { value: "ui_contracts" }
          ]
        }
      ]
    });
  });

  it("returns invalid_args for unsupported contract resolution modes", async () => {
    const { deps, stdout, loadBundleMock } = createDeps();
    const result = await runHelperCli(
      ["node", "sdd-helper", "contract", "helper.command.preview", "--resolve", "invalid"],
      deps
    );

    expect(result.exitCode).toBe(1);
    expect(loadBundleMock).not.toHaveBeenCalled();
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "invalid_args",
      message: "Unsupported --resolve mode 'invalid'. The only supported value is 'bundle'."
    });
  });

  it("returns invalid_args for unknown contract subjects", async () => {
    const { deps, stdout, loadBundleMock } = createDeps();
    const result = await runHelperCli(["node", "sdd-helper", "contract", "helper.command.unknown"], deps);

    expect(result.exitCode).toBe(1);
    expect(loadBundleMock).not.toHaveBeenCalled();
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "invalid_args",
      message:
        "Unknown contract subject_id 'helper.command.unknown'. Use 'sdd-helper capabilities' to discover valid subjects."
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

  it("forwards display-copy-name to preview and returns display_copy_path when requested", async () => {
    const renderPreview = vi.fn(async (): Promise<RenderPreviewResult> => ({
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
      display_copy_path: "/tmp/unique-previews/20260417-foo/example.ia_place_map.strict.svg",
      notes: [],
      diagnostics: []
    }));
    const { deps, stdout } = createDeps({ renderPreview });
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
      "svg",
      "--display-copy-name",
      "example.ia_place_map.strict.svg"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderPreview).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      path: "docs/example.sdd",
      view_id: "ia_place_map",
      profile_id: "strict",
      format: "svg",
      backend_id: undefined,
      display_copy_name: "example.ia_place_map.strict.svg"
    });
    expect(parseStdoutPayload(stdout)).toMatchObject({
      kind: "sdd-preview",
      display_copy_path: "/tmp/unique-previews/20260417-foo/example.ia_place_map.strict.svg"
    });
  });

  it("rejects preview display-copy names with path separators", async () => {
    const { deps, stdout, renderPreviewMock } = createDeps();
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
      "svg",
      "--display-copy-name",
      "../example.svg"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(renderPreviewMock).not.toHaveBeenCalled();
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "invalid_args",
      message: "display_copy_name must be a basename without path separators."
    });
  });

  it("rejects preview display-copy names whose extension does not match the format", async () => {
    const { deps, stdout, renderPreviewMock } = createDeps();
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
      "svg",
      "--display-copy-name",
      "example.png"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(renderPreviewMock).not.toHaveBeenCalled();
    expect(parseStdoutPayload(stdout)).toEqual({
      kind: "sdd-helper-error",
      code: "invalid_args",
      message: "display_copy_name must end with '.svg' to match format 'svg'."
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
