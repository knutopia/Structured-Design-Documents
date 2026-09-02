import type { Bundle } from "../src/bundle/types.js";
import type { CompiledGraph } from "../src/compiler/types.js";
import { describe, expect, it, vi } from "vitest";
import { createProgram, runCli, type CliDeps } from "../src/cli/program.js";
import { createMockSyntaxConfig } from "./mockSyntaxConfig.js";

const bundle: Bundle = {
  rootDir: "/repo/bundle/v0.1",
  manifestPath: "/repo/bundle/v0.1/manifest.yaml",
  manifest: {
    bundle_name: "test",
    bundle_version: "0.1.0",
    language: "sdd",
    language_version: "0.1",
    core: {
      vocab: "core/vocab.yaml",
      syntax: "core/syntax.yaml",
      schema: "core/schema.json",
      contracts: "core/contracts.yaml",
      projection_schema: "core/projection_schema.json",
      views: "core/views.yaml"
    },
    tool_defaults: {
      validation_profile_id: "simple",
      render_detail_id: "compact",
      node_decorator_mode_id: "none"
    },
    profiles: [
      { id: "simple", path: "profiles/simple.yaml", intent: "drafting" },
      { id: "permissive", path: "profiles/permissive.yaml", intent: "warning-first" },
      { id: "strict", path: "profiles/strict.yaml", intent: "governance" }
    ],
    render_details: [
      { id: "compact", intent: "low noise" },
      { id: "detailed", intent: "full detail" }
    ],
    node_decorator_modes: [
      { id: "none", intent: "no decorators", show_node_type: false, show_node_id: false },
      { id: "type", intent: "node type", show_node_type: true, show_node_id: false },
      { id: "id", intent: "node id", show_node_type: false, show_node_id: true },
      { id: "type,id", intent: "node type and id", show_node_type: true, show_node_id: true }
    ],
    examples: [],
    compatibility: {
      requires_compiler_min: "0.1.0",
      notes: []
    }
  },
  vocab: {
    version: "0.1",
    closed_vocab: true,
    node_types: [],
    relationship_types: []
  },
  syntax: createMockSyntaxConfig(),
  schema: {},
  projectionSchema: {},
  contracts: {
    version: "0.1",
    common_rules: [],
    relationships: []
  },
  views: {
    version: "0.1",
    preview_defaults: {
      dot: {
        font_family: "Public Sans",
        svg_font_asset: "assets/fonts/PublicSans-Regular.woff",
        png_font_asset: "assets/fonts/PublicSans-Regular.otf",
        dpi: 192
      }
    },
    views: [
      {
        id: "outcome_opportunity_map",
        name: "Outcome-Opportunity Map",
        status: "operational",
        projection: {
          include_node_types: [],
          include_edge_types: [],
          hierarchy_edges: [],
          ordering_edges: []
        },
        conventions: {
          renderer_defaults: {
            batch_applicability: { kind: "visible_semantic_node_count", minimum: 1 }
          }
        }
      },
      {
        id: "ia_place_map",
        name: "IA Place Map",
        status: "operational",
        projection: {
          include_node_types: [],
          include_edge_types: [],
          hierarchy_edges: [],
          ordering_edges: []
        },
        conventions: {
          renderer_defaults: {
            batch_applicability: { kind: "visible_semantic_node_count", minimum: 1 }
          }
        }
      },
      {
        id: "service_blueprint",
        name: "Service Blueprint",
        status: "operational",
        projection: {
          include_node_types: [],
          include_edge_types: [],
          hierarchy_edges: [],
          ordering_edges: []
        },
        conventions: {
          renderer_defaults: {
            batch_applicability: { kind: "visible_semantic_node_count", minimum: 1 }
          }
        }
      },
      {
        id: "scenario_flow",
        name: "Scenario Flow",
        status: "operational",
        projection: {
          include_node_types: [],
          include_edge_types: [],
          hierarchy_edges: [],
          ordering_edges: []
        },
        conventions: {
          renderer_defaults: {
            batch_applicability: { kind: "visible_semantic_node_count", minimum: 1 }
          }
        }
      },
      {
        id: "journey_map",
        name: "Journey Map",
        status: "operational",
        projection: {
          include_node_types: [],
          include_edge_types: [],
          hierarchy_edges: [],
          ordering_edges: []
        },
        conventions: {
          renderer_defaults: {
            batch_applicability: { kind: "visible_semantic_node_count", minimum: 1 }
          }
        }
      },
      {
        id: "ui_contracts",
        name: "UI Contracts",
        status: "operational",
        projection: {
          include_node_types: [],
          include_edge_types: [],
          hierarchy_edges: [],
          ordering_edges: []
        },
        conventions: {
          renderer_defaults: {
            batch_applicability: { kind: "visible_semantic_node_count", minimum: 1 }
          }
        }
      }
    ]
  },
  profiles: {}
};

function createCompiledGraph(nodeCount: number, edgeCount: number): CompiledGraph {
  return {
    schema: "sdd-text",
    version: "0.1",
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `P-${String(index + 1).padStart(3, "0")}`,
      type: "Place",
      name: `Place ${index + 1}`,
      props: {}
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      from: "P-001",
      type: "NAVIGATES_TO",
      to: `P-${String(index + 2).padStart(3, "0")}`,
      to_name: null,
      event: null,
      guard: null,
      effect: null,
      props: {}
    }))
  };
}

function createDeps(overrides: Partial<CliDeps> = {}): {
  deps: Partial<CliDeps>;
  stdout: string[];
  stderr: string[];
  renderSourceMock: ReturnType<typeof vi.fn>;
  renderSourcePreviewMock: ReturnType<typeof vi.fn>;
  renderPreviewArtifactMock: ReturnType<typeof vi.fn>;
  writeTextFileMock: ReturnType<typeof vi.fn>;
  writeBinaryFileMock: ReturnType<typeof vi.fn>;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const renderSourceMock = vi.fn((_input, _bundle, options) => ({
    viewId: options.viewId,
    format: options.format,
    profileId: options.profileId,
    detailId: options.detailId,
    text: options.format === "dot" ? "digraph G {}" : "flowchart TD",
    notes: [],
    diagnostics: []
  }));
  const renderPreviewArtifactMock = vi.fn(async (request) => {
    if (request.format === "svg") {
      return {
        format: "svg" as const,
        text: "<svg>embedded</svg>",
        sourceArtifacts: {
          dot: "digraph G {}"
        }
      };
    }

    return {
      format: "png" as const,
      bytes: Uint8Array.from(Buffer.from("png")),
      sourceArtifacts: {
        dot: "digraph G {}"
      }
    };
  });
  const renderSourcePreviewMock = vi.fn(async (_input, _bundle, options) => {
    const backendId = options.backendId
      ?? (options.viewId === "ia_place_map"
        ? "staged_ia_place_map_preview"
        : options.viewId === "journey_map"
          ? "staged_journey_map_preview"
        : options.viewId === "ui_contracts"
          ? "staged_ui_contracts_preview"
          : options.viewId === "service_blueprint"
          ? "staged_service_blueprint_preview"
          : options.viewId === "scenario_flow"
            ? "staged_scenario_flow_preview"
            : options.viewId === "outcome_opportunity_map"
              ? "staged_outcome_opportunity_map_preview"
              : "legacy_graphviz_preview");
    const artifact = options.format === "svg"
      ? {
        format: "svg" as const,
        text: backendId.startsWith("staged_") ? "<svg>staged</svg>" : "<svg>embedded</svg>",
        ...(backendId === "legacy_graphviz_preview" ? {
          sourceArtifacts: {
            dot: "digraph G {}"
          }
        } : {})
      }
      : {
        format: "png" as const,
        bytes: Uint8Array.from(Buffer.from("png")),
        ...(backendId === "legacy_graphviz_preview" ? {
          sourceArtifacts: {
            dot: "digraph G {}"
          }
        } : {})
      };

    return {
      profileId: options.profileId,
      detailId: options.detailId,
      view: bundle.views.views.find((candidate) => candidate.id === options.viewId)!,
      capability: {
        textArtifacts: [],
        previewArtifacts: [],
        defaultPreviewFormat: "svg" as const
      },
      previewCapability: {
        format: options.format,
        backendId,
        backendClass: backendId === "legacy_graphviz_preview" ? "legacy" as const : "staged" as const
      },
      artifact,
      notes: [],
      diagnostics: []
    };
  });
  const writeTextFileMock = vi.fn(async () => undefined);
  const writeBinaryFileMock = vi.fn(async () => undefined);

  return {
    stdout,
    stderr,
    renderSourceMock,
    renderSourcePreviewMock,
    renderPreviewArtifactMock,
    writeTextFileMock,
    writeBinaryFileMock,
    deps: {
      cwd: () => "/repo",
      defaultsConfig: {
        getGlobalConfigPath: () => "/user/sdd/config.yaml",
        read: vi.fn(async () => undefined),
        set: vi.fn(async (filePath: string) => ({ changed: true, path: filePath })),
        unset: vi.fn(async (filePath: string) => ({ changed: true, path: filePath }))
      },
      loadBundle: vi.fn(async () => bundle),
      readSourceInput: vi.fn(async (filePath: string) => ({
        path: filePath.startsWith("/") ? filePath : `/repo/${filePath}`,
        text: "PLACE home"
      })),
      compileSource: vi.fn(() => ({
        diagnostics: [],
        graph: {
          schema: "sdd-text",
          version: "0.1",
          nodes: [],
          edges: []
        }
      })),
      validateGraph: vi.fn(() => ({
        diagnostics: [],
        errorCount: 0,
        warningCount: 0
      })),
      renderSource: renderSourceMock,
      renderSourcePreview: renderSourcePreviewMock,
      writeTextFile: writeTextFileMock,
      writeBinaryFile: writeBinaryFileMock,
      renderPreviewArtifact: renderPreviewArtifactMock,
      stdout: (content: string) => {
        stdout.push(content);
      },
      stderr: (content: string) => {
        stderr.push(content);
      },
      ...overrides
    }
  };
}

function countOccurrences(text: string, pattern: string): number {
  return text.split(pattern).length - 1;
}

function createBatchPreviewMocks(
  visibleByView: Record<string, string[]>,
  failingViewId?: string
): {
  prepare: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
} {
  const prepare = vi.fn((_sourcePath, _graph, loadedBundle, options) => {
    const view = loadedBundle.views.views.find((candidate) => candidate.id === options.viewId)!;
    const visibleSemanticNodeIds = visibleByView[options.viewId] ?? [];
    return {
      profileId: options.profileId,
      detailId: options.detailId,
      view,
      capability: {
        textArtifacts: [],
        previewArtifacts: [],
        defaultPreviewFormat: "svg" as const
      },
      previewCapability: {
        format: options.format,
        backendId: options.backendId,
        backendClass: options.backendId === "legacy_graphviz_preview" ? "legacy" as const : "staged" as const
      },
      prepared: {
        projection: {
          schema: "sdd-text-view-projection" as const,
          version: "0.1",
          view_id: options.viewId,
          source_example: "example",
          nodes: visibleSemanticNodeIds.map((id) => ({ id, type: "Place", name: id })),
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
        visibleSemanticNodeIds,
        notes: []
      },
      diagnostics: []
    };
  });
  const render = vi.fn(async (_sourcePath, _graph, _bundle, prepared) => {
    const diagnostics = prepared.view.id === failingViewId
      ? [{
        stage: "render" as const,
        code: "render.synthetic_failure",
        severity: "error" as const,
        message: `Failed ${prepared.view.id}`,
        file: "/repo/example.sdd"
      }]
      : [];
    return {
      profileId: prepared.profileId,
      detailId: prepared.detailId,
      view: prepared.view,
      capability: prepared.capability,
      previewCapability: prepared.previewCapability,
      artifact: diagnostics.length > 0
        ? undefined
        : prepared.previewCapability.format === "png"
          ? { format: "png" as const, bytes: Uint8Array.from([1, 2, 3]) }
          : { format: "svg" as const, text: `<svg>${prepared.view.id}</svg>` },
      notes: [],
      diagnostics
    };
  });
  return { prepare, render };
}

const jsonDiagnosticsHint = "Hint: rerun with --diagnostics json for machine-readable diagnostics.";

describe("CLI wrappers", () => {
  it("suggests the registered long option for an unambiguous single-dash typo", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();

    const result = await runCli(
      ["node", "sdd", "show", "arbitrary.sdd", "-view", "arbitrary_value"],
      deps
    );

    expect(result.exitCode).toBe(1);
    expect(stderr.join("")).toBe(
      "error: unknown option '-view'. Did you mean '--view'?\n"
      + "Run 'sdd show --help' for usage.\n"
    );
    expect(renderSourcePreviewMock).not.toHaveBeenCalled();
  });

  it("aggregates multiple unambiguous single-dash option typos in authored order", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();

    const result = await runCli(
      [
        "node", "sdd", "show", "arbitrary.sdd",
        "-view", "arbitrary_view",
        "-detail", "arbitrary_detail"
      ],
      deps
    );

    expect(result.exitCode).toBe(1);
    expect(stderr.join("")).toBe(
      "errors:\n"
      + "  unknown option '-view'. Did you mean '--view'?\n"
      + "  unknown option '-detail'. Did you mean '--detail'?\n"
      + "Run 'sdd show --help' for usage.\n"
    );
    expect(renderSourcePreviewMock).not.toHaveBeenCalled();
  });

  it("keeps genuine missing-option errors concise", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();

    const result = await runCli(["node", "sdd", "show", "arbitrary.sdd"], deps);

    expect(result.exitCode).toBe(1);
    expect(stderr.join("")).toBe(
      "error: required option '--view <view>' not specified\n"
      + "Run 'sdd show --help' for usage.\n"
    );
    expect(renderSourcePreviewMock).not.toHaveBeenCalled();
  });

  it("does not suggest a single-dash correction for ambiguous or non-option tokens", async () => {
    for (const argv of [
      ["node", "sdd", "show", "arbitrary.sdd", "-view", "arbitrary_value", "--bogus"],
      ["node", "sdd", "show", "arbitrary.sdd", "-view", "first_value", "-view", "second_value"],
      ["node", "sdd", "show", "arbitrary.sdd", "--out", "-view"],
      ["node", "sdd", "show", "arbitrary.sdd", "--", "-view", "arbitrary_value"]
    ]) {
      const { deps, stderr, renderSourcePreviewMock } = createDeps();
      const result = await runCli(argv, deps);
      const error = stderr.join("");

      expect(result.exitCode).toBe(1);
      expect(error).toContain("required option '--view <view>' not specified");
      expect(error).toContain("Run 'sdd show --help' for usage.");
      expect(error).not.toContain("Did you mean '--view'?");
      expect(error).not.toContain("Usage:");
      expect(renderSourcePreviewMock).not.toHaveBeenCalled();
    }
  });

  it("uses concise command-specific hints while preserving Commander long-option suggestions", async () => {
    const singleDash = createDeps();
    const singleDashResult = await runCli(
      ["node", "sdd", "compile", "arbitrary.sdd", "-bundle", "manifest.yaml"],
      singleDash.deps
    );

    expect(singleDashResult.exitCode).toBe(1);
    expect(singleDash.stderr.join("")).toBe(
      "error: unknown option '-bundle'. Did you mean '--bundle'?\n"
      + "Run 'sdd compile --help' for usage.\n"
    );

    const compile = createDeps();
    const compileResult = await runCli(
      ["node", "sdd", "compile", "arbitrary.sdd", "--bundl", "manifest.yaml"],
      compile.deps
    );
    const compileError = compile.stderr.join("");

    expect(compileResult.exitCode).toBe(1);
    expect(compileError).toContain("error: unknown option '--bundl'");
    expect(compileError).toContain("Did you mean --bundle?");
    expect(compileError).toContain("Run 'sdd compile --help' for usage.");
    expect(compileError).not.toContain("Usage:");
    expect(compileError).not.toContain("Examples:");

    const nested = createDeps();
    const nestedResult = await runCli(
      ["node", "sdd", "defaults", "show", "--global"],
      nested.deps
    );
    const nestedError = nested.stderr.join("");

    expect(nestedResult.exitCode).toBe(1);
    expect(nestedError).toContain("error: unknown option '--global'");
    expect(nestedError).toContain("Run 'sdd defaults show --help' for usage.");
    expect(nestedError).not.toContain("Usage:");
  });

  it("keeps explicit command help comprehensive", async () => {
    const { deps, stdout, stderr } = createDeps();

    const result = await runCli(["node", "sdd", "show", "--help"], deps);
    const help = stdout.join("");

    expect(result.exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(help).toContain("Usage: sdd show [options] <input>");
    expect(help).toContain("Options:");
    expect(help).toContain("Examples:");
  });

  it("resolves the bundle fallback and explicit override for all five profile-consuming commands", async () => {
    const cases = [
      {
        name: "validate",
        argv: ["node", "sdd", "validate", "bundle/v0.1/examples/outcome_to_ia_trace.sdd"],
        profileFrom: (deps: Partial<CliDeps>) => vi.mocked(deps.validateGraph!).mock.calls[0]?.[2]
      },
      {
        name: "render",
        argv: [
          "node", "sdd", "render", "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
          "--view", "ia_place_map", "--format", "dot"
        ],
        profileFrom: (deps: Partial<CliDeps>) => vi.mocked(deps.renderSource!).mock.calls[0]?.[2].profileId
      },
      {
        name: "dot",
        argv: ["node", "sdd", "dot", "bundle/v0.1/examples/outcome_to_ia_trace.sdd"],
        profileFrom: (deps: Partial<CliDeps>) => vi.mocked(deps.renderSource!).mock.calls[0]?.[2].profileId
      },
      {
        name: "mmd",
        argv: ["node", "sdd", "mmd", "bundle/v0.1/examples/outcome_to_ia_trace.sdd"],
        profileFrom: (deps: Partial<CliDeps>) => vi.mocked(deps.renderSource!).mock.calls[0]?.[2].profileId
      },
      {
        name: "show",
        argv: [
          "node", "sdd", "show", "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
          "--view", "ia_place_map", "--out", "/tmp/default-profile.svg"
        ],
        profileFrom: (deps: Partial<CliDeps>) => vi.mocked(deps.renderSourcePreview!).mock.calls[0]?.[2].profileId
      }
    ] as const;

    for (const testCase of cases) {
      const fallback = createDeps();
      const fallbackResult = await runCli([...testCase.argv], fallback.deps);
      expect(fallbackResult.exitCode, testCase.name).toBe(0);
      expect(testCase.profileFrom(fallback.deps), testCase.name).toBe("simple");

      const explicit = createDeps();
      const explicitResult = await runCli([...testCase.argv, "--profile", "strict"], explicit.deps);
      expect(explicitResult.exitCode, testCase.name).toBe(0);
      expect(testCase.profileFrom(explicit.deps), testCase.name).toBe("strict");
    }
  });

  it("rejects an unknown explicit profile before validation and does not fall through", async () => {
    const { deps, stderr } = createDeps({
      validateGraph: vi.fn((_graph, _bundle, profileId) => ({
        diagnostics: [{
          stage: "validate",
          code: "validate.unknown_profile",
          severity: "error",
          message: `Unknown profile '${profileId}'`,
          file: "/repo/example.sdd"
        }],
        errorCount: 1,
        warningCount: 0
      }))
    });

    const result = await runCli([
      "node", "sdd", "validate", "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--profile", "recommended"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(deps.validateGraph).not.toHaveBeenCalled();
    expect(stderr.join("")).toContain("Unknown value 'recommended'");
    expect(stderr.join("")).toContain("cli source");
    expect(stderr.join("")).toContain(bundle.manifestPath);
  });

  it("dot emits DOT text for a valid example", async () => {
    const { deps, stdout, renderSourceMock } = createDeps();
    const result = await runCli([
      "node", "sdd", "dot", "bundle/v0.1/examples/outcome_to_ia_trace.sdd", "--profile", "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(stdout.join("")).toContain("digraph G {}");
    expect(renderSourceMock.mock.calls[0][2]).toMatchObject({
      viewId: "ia_place_map",
      format: "dot"
    });
  });

  it("mmd emits Mermaid text for a valid example", async () => {
    const { deps, stdout, renderSourceMock } = createDeps();
    const result = await runCli([
      "node", "sdd", "mmd", "bundle/v0.1/examples/outcome_to_ia_trace.sdd", "--profile", "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(stdout.join("")).toContain("flowchart TD");
    expect(renderSourceMock.mock.calls[0][2]).toMatchObject({
      viewId: "ia_place_map",
      format: "mermaid"
    });
  });

  it("show derives a sibling SVG path with the bundle detail fallback", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "ia_place_map",
      format: "svg",
      profileId: "simple",
      detailId: "compact",
      backendId: "staged_ia_place_map_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith(
      "/repo/bundle/v0.1/examples/outcome_to_ia_trace.ia_place_map.compact.svg",
      "<svg>staged</svg>"
    );
    expect(stderr.join("")).toContain("Wrote /repo/bundle/v0.1/examples/outcome_to_ia_trace.ia_place_map.compact.svg");
  });

  it("show derives different default output paths for different views of the same source", async () => {
    const { deps, writeTextFileMock } = createDeps();

    const iaResult = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--profile",
      "strict"
    ], deps);
    const journeyResult = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "journey_map",
      "--profile",
      "strict"
    ], deps);

    expect(iaResult.exitCode).toBe(0);
    expect(journeyResult.exitCode).toBe(0);
    expect(writeTextFileMock.mock.calls[0]?.[0]).toBe("/repo/bundle/v0.1/examples/outcome_to_ia_trace.ia_place_map.compact.svg");
    expect(writeTextFileMock.mock.calls[1]?.[0]).toBe("/repo/bundle/v0.1/examples/outcome_to_ia_trace.journey_map.compact.svg");
    expect(writeTextFileMock.mock.calls[0]?.[0]).not.toBe(writeTextFileMock.mock.calls[1]?.[0]);
  });

  it("show derives different default output paths for different details of the same source and view", async () => {
    const { deps, writeTextFileMock } = createDeps();

    const strictResult = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--profile",
      "strict",
      "--detail",
      "detailed"
    ], deps);
    const simpleResult = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--profile",
      "strict",
      "--detail",
      "compact"
    ], deps);

    expect(strictResult.exitCode).toBe(0);
    expect(simpleResult.exitCode).toBe(0);
    expect(writeTextFileMock.mock.calls[0]?.[0]).toBe("/repo/bundle/v0.1/examples/outcome_to_ia_trace.ia_place_map.detailed.svg");
    expect(writeTextFileMock.mock.calls[1]?.[0]).toBe("/repo/bundle/v0.1/examples/outcome_to_ia_trace.ia_place_map.compact.svg");
    expect(writeTextFileMock.mock.calls[0]?.[0]).not.toBe(writeTextFileMock.mock.calls[1]?.[0]);
  });

  it("show --view all compiles once and writes only applicable views using explicit view modifiers", async () => {
    const batch = createBatchPreviewMocks({
      ia_place_map: ["P-001"],
      journey_map: ["J-001"]
    });
    const { deps, stderr, writeTextFileMock } = createDeps({
      prepareCompiledGraphPreview: batch.prepare,
      renderPreparedCompiledGraphPreview: batch.render
    });

    const result = await runCli([
      "node", "sdd", "show", "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view", "all", "--out", "/tmp/diagram.svg"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(deps.compileSource).toHaveBeenCalledTimes(1);
    expect(deps.validateGraph).toHaveBeenCalledTimes(1);
    expect(batch.prepare).toHaveBeenCalledTimes(6);
    expect(batch.render.mock.calls.map((call) => call[3].view.id)).toEqual(["ia_place_map", "journey_map"]);
    expect(writeTextFileMock.mock.calls.map((call) => call[0])).toEqual([
      "/tmp/diagram.ia_place_map.svg",
      "/tmp/diagram.journey_map.svg"
    ]);
    expect(stderr.join("")).toContain("Generated 2 diagram(s).");
    expect(stderr.join("")).toContain("Skipped 4 without visible content");
  });

  it("show --view all preserves automatic detail naming for PNG artifacts", async () => {
    const batch = createBatchPreviewMocks({ outcome_opportunity_map: ["O-001"] });
    const { deps, writeBinaryFileMock } = createDeps({
      prepareCompiledGraphPreview: batch.prepare,
      renderPreparedCompiledGraphPreview: batch.render
    });

    const result = await runCli([
      "node", "sdd", "show", "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view", "all", "--format", "png"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(writeBinaryFileMock).toHaveBeenCalledWith(
      "/repo/bundle/v0.1/examples/outcome_to_ia_trace.outcome_opportunity_map.compact.png",
      Uint8Array.from([1, 2, 3])
    );
  });

  it("show --view all passes decorators to preparation and automatic artifact identity", async () => {
    const batch = createBatchPreviewMocks({ outcome_opportunity_map: ["O-001"] });
    const { deps, writeTextFileMock } = createDeps({
      prepareCompiledGraphPreview: batch.prepare,
      renderPreparedCompiledGraphPreview: batch.render
    });

    const result = await runCli([
      "node", "sdd", "show", "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view", "all", "--decorators", "type,id"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(batch.prepare.mock.calls.every((call) => call[3].nodeDecoratorModeId === "type,id")).toBe(true);
    expect(writeTextFileMock).toHaveBeenCalledWith(
      "/repo/bundle/v0.1/examples/outcome_to_ia_trace.outcome_opportunity_map.compact.decorators-type-id.svg",
      "<svg>outcome_opportunity_map</svg>"
    );
  });

  it("show --view all succeeds without writes when no view meets bundle applicability", async () => {
    const batch = createBatchPreviewMocks({ ia_place_map: ["P-001"] });
    const thresholdBundle = structuredClone(bundle) as Bundle;
    thresholdBundle.views.views.find((view) => view.id === "ia_place_map")!
      .conventions.renderer_defaults!.batch_applicability!.minimum = 2;
    const { deps, stderr, writeTextFileMock, writeBinaryFileMock } = createDeps({
      loadBundle: vi.fn(async () => thresholdBundle),
      prepareCompiledGraphPreview: batch.prepare,
      renderPreparedCompiledGraphPreview: batch.render
    });

    const result = await runCli([
      "node", "sdd", "show", "bundle/v0.1/examples/outcome_to_ia_trace.sdd", "--view", "all"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(batch.render).not.toHaveBeenCalled();
    expect(writeTextFileMock).not.toHaveBeenCalled();
    expect(writeBinaryFileMock).not.toHaveBeenCalled();
    expect(stderr.join("")).toContain("No applicable diagrams found for detail 'compact'");
  });

  it("show --view all rejects an incompatible explicit backend before compiling", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node", "sdd", "show", "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view", "all", "--backend", "staged_ia_place_map_preview"
    ], deps);

    expect(result.exitCode).toBe(2);
    expect(deps.compileSource).not.toHaveBeenCalled();
    expect(stderr.join("")).toContain("Incompatible views:");
    expect(stderr.join("")).toContain("journey_map");
  });

  it("show --view all rejects --dot-out", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node", "sdd", "show", "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view", "all", "--dot-out", "/tmp/all.dot"
    ], deps);

    expect(result.exitCode).toBe(2);
    expect(deps.readSourceInput).not.toHaveBeenCalled();
    expect(stderr.join("")).toContain("--dot-out cannot be used with '--view all'");
  });

  it("show --view all writes no partial batch when an applicable renderer fails", async () => {
    const batch = createBatchPreviewMocks({
      ia_place_map: ["P-001"],
      journey_map: ["J-001"]
    }, "journey_map");
    const { deps, stderr, writeTextFileMock } = createDeps({
      prepareCompiledGraphPreview: batch.prepare,
      renderPreparedCompiledGraphPreview: batch.render
    });

    const result = await runCli([
      "node", "sdd", "show", "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view", "all", "--out", "/tmp/diagram.svg"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(batch.render).toHaveBeenCalledTimes(2);
    expect(writeTextFileMock).not.toHaveBeenCalled();
    expect(stderr.join("")).toContain("render.synthetic_failure");
  });

  it("show appends an explicit backend override to the default output path", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--backend",
      "legacy_graphviz_preview",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "ia_place_map",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith(
      "/repo/bundle/v0.1/examples/outcome_to_ia_trace.ia_place_map.compact.legacy_graphviz_preview.svg",
      "<svg>embedded</svg>"
    );
    expect(stderr.join("")).toContain("Wrote /repo/bundle/v0.1/examples/outcome_to_ia_trace.ia_place_map.compact.legacy_graphviz_preview.svg");
  });

  it("show respects an explicit SVG output path", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--out",
      "/tmp/custom.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/custom.svg", "<svg>staged</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/custom.svg");
  });

  it("show allows ia_place_map to opt back into the legacy preview backend", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--backend",
      "legacy_graphviz_preview",
      "--out",
      "/tmp/legacy.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "ia_place_map",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/legacy.svg", "<svg>embedded</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/legacy.svg");
  });

  it("show writes --dot-out from backend-declared source artifacts by auto-selecting the legacy backend", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--out",
      "/tmp/custom.svg",
      "--dot-out",
      "/tmp/custom.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "ia_place_map",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/custom.dot", "digraph G {}");
    expect(stderr.join("")).toContain("Wrote /tmp/custom.dot");
  });

  it("show rejects explicit staged --backend with --dot-out", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--backend",
      "staged_ia_place_map_preview",
      "--dot-out",
      "/tmp/custom.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(2);
    expect(stderr.join("")).toContain("does not expose a DOT intermediate");
    expect(renderSourcePreviewMock).not.toHaveBeenCalled();
  });

  it("show can render PNG through the SVG intermediary pipeline", async () => {
    const { deps, stderr, renderSourcePreviewMock, writeBinaryFileMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--format",
      "png",
      "--out",
      "/tmp/custom.png",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "ia_place_map",
      format: "png",
      backendId: "staged_ia_place_map_preview"
    });
    expect(writeBinaryFileMock).toHaveBeenCalledWith("/tmp/custom.png", expect.any(Uint8Array));
    expect(stderr.join("")).toContain("Wrote /tmp/custom.png");
  });

  it("show defaults journey_map previews to the staged backend", async () => {
    const { deps, renderSourcePreviewMock, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "journey_map",
      "--out",
      "/tmp/journey.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "journey_map",
      format: "svg",
      backendId: "staged_journey_map_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/journey.svg", "<svg>staged</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/journey.svg");
  });

  it("show keeps explicit legacy journey previews and DOT-source fallback available", async () => {
    const { deps, renderSourcePreviewMock } = createDeps();
    const legacyResult = await runCli([
      "node", "sdd", "show", "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view", "journey_map", "--backend", "legacy_graphviz_preview",
      "--out", "/tmp/journey-legacy.svg", "--profile", "strict"
    ], deps);
    const dotFallbackResult = await runCli([
      "node", "sdd", "show", "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view", "journey_map", "--out", "/tmp/journey-dot.svg",
      "--dot-out", "/tmp/journey.dot", "--profile", "strict"
    ], deps);

    expect(legacyResult.exitCode).toBe(0);
    expect(dotFallbackResult.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "journey_map",
      backendId: "legacy_graphviz_preview"
    });
    expect(renderSourcePreviewMock.mock.calls[1][2]).toMatchObject({
      viewId: "journey_map",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/journey.dot", "digraph G {}");
  });

  it("show defaults outcome_opportunity_map previews to the staged backend", async () => {
    const { deps, renderSourcePreviewMock, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "outcome_opportunity_map",
      "--out",
      "/tmp/outcome-opportunity.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "outcome_opportunity_map",
      format: "svg",
      backendId: "staged_outcome_opportunity_map_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/outcome-opportunity.svg", "<svg>staged</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/outcome-opportunity.svg");
  });

  it("show allows outcome_opportunity_map to opt back into the legacy preview backend", async () => {
    const { deps, renderSourcePreviewMock, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "outcome_opportunity_map",
      "--backend",
      "legacy_graphviz_preview",
      "--out",
      "/tmp/outcome-opportunity-legacy.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "outcome_opportunity_map",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/outcome-opportunity-legacy.svg", "<svg>embedded</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/outcome-opportunity-legacy.svg");
  });

  it("show writes outcome_opportunity_map --dot-out by auto-selecting the legacy backend", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "outcome_opportunity_map",
      "--out",
      "/tmp/outcome-opportunity.svg",
      "--dot-out",
      "/tmp/outcome-opportunity.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "outcome_opportunity_map",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/outcome-opportunity.dot", "digraph G {}");
    expect(stderr.join("")).toContain("Wrote /tmp/outcome-opportunity.dot");
  });

  it("show defaults service_blueprint previews to the staged backend", async () => {
    const { deps, renderSourcePreviewMock, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/service_blueprint_slice.sdd",
      "--view",
      "service_blueprint",
      "--out",
      "/tmp/blueprint.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "service_blueprint",
      format: "svg",
      backendId: "staged_service_blueprint_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/blueprint.svg", "<svg>staged</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/blueprint.svg");
  });

  it("show allows service_blueprint to opt back into the legacy preview backend", async () => {
    const { deps, renderSourcePreviewMock, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/service_blueprint_slice.sdd",
      "--view",
      "service_blueprint",
      "--backend",
      "legacy_graphviz_preview",
      "--out",
      "/tmp/blueprint-legacy.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "service_blueprint",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/blueprint-legacy.svg", "<svg>embedded</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/blueprint-legacy.svg");
  });

  it("show defaults scenario_flow previews to the staged backend", async () => {
    const { deps, renderSourcePreviewMock, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/scenario_branching.sdd",
      "--view",
      "scenario_flow",
      "--out",
      "/tmp/scenario.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "scenario_flow",
      format: "svg",
      backendId: "staged_scenario_flow_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/scenario.svg", "<svg>staged</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/scenario.svg");
  });

  it("show allows scenario_flow to opt back into the legacy preview backend", async () => {
    const { deps, renderSourcePreviewMock, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/scenario_branching.sdd",
      "--view",
      "scenario_flow",
      "--backend",
      "legacy_graphviz_preview",
      "--out",
      "/tmp/scenario-legacy.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "scenario_flow",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/scenario-legacy.svg", "<svg>embedded</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/scenario-legacy.svg");
  });

  it("show writes scenario_flow --dot-out by auto-selecting the legacy backend", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/scenario_branching.sdd",
      "--view",
      "scenario_flow",
      "--out",
      "/tmp/scenario.svg",
      "--dot-out",
      "/tmp/scenario.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "scenario_flow",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/scenario.dot", "digraph G {}");
    expect(stderr.join("")).toContain("Wrote /tmp/scenario.dot");
  });

  it("show defaults ui_contracts previews to the staged backend", async () => {
    const { deps, renderSourcePreviewMock, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/place_viewstate_transition.sdd",
      "--view",
      "ui_contracts",
      "--out",
      "/tmp/ui-contracts.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "ui_contracts",
      format: "svg",
      backendId: "staged_ui_contracts_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/ui-contracts.svg", "<svg>staged</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/ui-contracts.svg");
  });

  it("show allows ui_contracts to opt back into the legacy preview backend", async () => {
    const { deps, renderSourcePreviewMock, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/place_viewstate_transition.sdd",
      "--view",
      "ui_contracts",
      "--backend",
      "legacy_graphviz_preview",
      "--out",
      "/tmp/ui-contracts-legacy.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "ui_contracts",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/ui-contracts-legacy.svg", "<svg>embedded</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/ui-contracts-legacy.svg");
  });

  it("show writes ui_contracts --dot-out from backend-declared source artifacts by auto-selecting the legacy backend", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/place_viewstate_transition.sdd",
      "--view",
      "ui_contracts",
      "--out",
      "/tmp/ui-contracts.svg",
      "--dot-out",
      "/tmp/ui-contracts.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "ui_contracts",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/ui-contracts.dot", "digraph G {}");
    expect(stderr.join("")).toContain("Wrote /tmp/ui-contracts.dot");
  });

  it("show rejects explicit staged ui_contracts --backend with --dot-out", async () => {
    const { deps, stderr, renderSourcePreviewMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/place_viewstate_transition.sdd",
      "--view",
      "ui_contracts",
      "--backend",
      "staged_ui_contracts_preview",
      "--dot-out",
      "/tmp/ui-contracts.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(2);
    expect(stderr.join("")).toContain("does not expose a DOT intermediate");
    expect(renderSourcePreviewMock).not.toHaveBeenCalled();
  });

  it("announces DOT files written via --out", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "dot",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--out",
      "/tmp/outcome.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/outcome.dot", "digraph G {}");
    expect(stderr.join("")).toContain("Wrote /tmp/outcome.dot");
  });

  it("dot can render PNG through the SVG intermediary pipeline", async () => {
    const { deps, stderr, renderPreviewArtifactMock, writeBinaryFileMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "dot",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--png",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderPreviewArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        backendId: "legacy_graphviz_preview",
        format: "png",
        source: {
          kind: "text",
          format: "dot",
          text: "digraph G {}"
        }
      })
    );
    expect(writeBinaryFileMock).toHaveBeenCalledWith(
      "/repo/bundle/v0.1/examples/outcome_to_ia_trace.png",
      expect.any(Uint8Array)
    );
    expect(stderr.join("")).toContain("Wrote /repo/bundle/v0.1/examples/outcome_to_ia_trace.png");
  });

  it("show stops before Graphviz when validation fails", async () => {
    const { deps, stderr } = createDeps({
      renderSourcePreview: vi.fn(async () => ({
        view: bundle.views.views.find((candidate) => candidate.id === "ia_place_map")!,
        capability: {
          textArtifacts: [],
          previewArtifacts: [],
          defaultPreviewFormat: "svg" as const
        },
        previewCapability: {
          format: "svg" as const,
          backendId: "staged_ia_place_map_preview" as const,
          backendClass: "staged" as const
        },
        diagnostics: [
          {
            stage: "validate",
            code: "validate.failed",
            severity: "error",
            message: "validation failed",
            file: "/repo/example.sdd"
          },
          {
            stage: "validate",
            code: "validate.failed",
            severity: "error",
            message: "validation failed",
            file: "/repo/example.sdd"
          }
        ]
      }))
    });

    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(deps.renderPreviewArtifact).not.toHaveBeenCalled();
    const stderrText = stderr.join("");
    expect(stderrText).toContain("ERROR validate.failed (2 instances): validation failed");
    expect(countOccurrences(stderrText, "/repo/example.sdd")).toBe(1);
    expect(countOccurrences(stderrText, jsonDiagnosticsHint)).toBe(1);
  });

  it("validate pretty diagnostics include the json hint exactly once", async () => {
    const { deps, stdout, stderr } = createDeps({
      validateGraph: vi.fn(() => ({
        diagnostics: [
          {
            stage: "validate",
            code: "validate.warning",
            severity: "warn",
            message: "warning text",
            file: "/repo/example.sdd"
          }
        ],
        errorCount: 0,
        warningCount: 1
      }))
    });

    const result = await runCli([
      "node",
      "sdd",
      "validate",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    const stderrText = stderr.join("");
    expect(stderrText).toContain("WARN validate.warning (1 instance): warning text");
    expect(stderrText).toContain(`\n\n${jsonDiagnosticsHint}\n`);
    expect(countOccurrences(stderrText, jsonDiagnosticsHint)).toBe(1);
    expect(stdout.join("")).toBe("Validated 0 nodes and 0 edges.\n");
  });

  it.each([
    [0, 0, "Validated 0 nodes and 0 edges.\n"],
    [1, 1, "Validated 1 node and 1 edge.\n"],
    [12, 17, "Validated 12 nodes and 17 edges.\n"]
  ] as const)("summarizes a successful graph with %i nodes and %i edges", async (nodeCount, edgeCount, expected) => {
    const { deps, stdout, stderr } = createDeps({
      compileSource: vi.fn(() => ({
        diagnostics: [],
        graph: createCompiledGraph(nodeCount, edgeCount)
      }))
    });
    const result = await runCli([
      "node",
      "sdd",
      "validate",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(stdout.join("")).toBe(expected);
    expect(stderr.join("")).not.toContain(jsonDiagnosticsHint);
  });

  it("does not summarize a validation error", async () => {
    const { deps, stdout } = createDeps({
      validateGraph: vi.fn(() => ({
        diagnostics: [{
          stage: "validate",
          code: "validate.failed",
          severity: "error",
          message: "validation failed",
          file: "/repo/example.sdd"
        }],
        errorCount: 1,
        warningCount: 0
      }))
    });

    const result = await runCli([
      "node",
      "sdd",
      "validate",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(stdout.join("")).toBe("");
  });

  it.each([false, true])(
    "keeps json validation free of a human summary when warnings=%s",
    async (withWarning) => {
      const diagnostics = withWarning
        ? [{
          stage: "validate" as const,
          code: "validate.warning",
          severity: "warn" as const,
          message: "warning text",
          file: "/repo/example.sdd"
        }]
        : [];
      const { deps, stdout, stderr } = createDeps({
        validateGraph: vi.fn(() => ({
          diagnostics,
          errorCount: 0,
          warningCount: diagnostics.length
        }))
      });

      const result = await runCli([
        "node",
        "sdd",
        "validate",
        "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
        "--diagnostics",
        "json"
      ], deps);

      expect(result.exitCode).toBe(0);
      expect(stdout.join("")).toBe("");
      expect(stderr.join("")).toBe(withWarning ? `${JSON.stringify(diagnostics, null, 2)}\n` : "");
    }
  );

  it("render supports json diagnostics output", async () => {
    const { deps, stderr } = createDeps({
      renderSource: vi.fn((_input, _bundle, options) => ({
        viewId: options.viewId,
        format: options.format,
        profileId: options.profileId,
        text: "flowchart TD",
        notes: [],
        diagnostics: [
          {
            stage: "validate",
            code: "validate.warning",
            severity: "warn",
            message: "warning text",
            file: "/repo/example.sdd"
          }
        ]
      }))
    });

    const result = await runCli([
      "node",
      "sdd",
      "render",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "journey_map",
      "--format",
      "mermaid",
      "--diagnostics",
      "json",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    const stderrText = stderr.join("");
    expect(stderrText).toContain("\"code\": \"validate.warning\"");
    expect(stderrText).not.toContain(jsonDiagnosticsHint);
  });

  it("show supports json diagnostics output", async () => {
    const { deps, stderr } = createDeps({
      renderSourcePreview: vi.fn(async (_input, _bundle, options) => ({
        view: bundle.views.views.find((candidate) => candidate.id === options.viewId)!,
        capability: {
          textArtifacts: [],
          previewArtifacts: [],
          defaultPreviewFormat: "svg" as const
        },
        previewCapability: {
          format: options.format,
          backendId: "staged_ia_place_map_preview" as const,
          backendClass: "staged" as const
        },
        artifact: {
          format: "svg" as const,
          text: "<svg>staged</svg>"
        },
        notes: [],
        diagnostics: [
          {
            stage: "validate",
            code: "validate.warning",
            severity: "warn",
            message: "warning text",
            file: "/repo/example.sdd"
          }
        ]
      }))
    });

    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--diagnostics",
      "json",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(stderr.join("")).toContain("\"code\": \"validate.warning\"");
  });

  it("dot supports json diagnostics output", async () => {
    const { deps, stderr } = createDeps({
      renderSource: vi.fn((_input, _bundle, options) => ({
        viewId: options.viewId,
        format: options.format,
        profileId: options.profileId,
        text: "digraph G {}",
        notes: [],
        diagnostics: [
          {
            stage: "validate",
            code: "validate.warning",
            severity: "warn",
            message: "warning text",
            file: "/repo/example.sdd"
          }
        ]
      }))
    });

    const result = await runCli([
      "node",
      "sdd",
      "dot",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--diagnostics",
      "json",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(stderr.join("")).toContain("\"code\": \"validate.warning\"");
  });

  it("mmd supports json diagnostics output", async () => {
    const { deps, stderr } = createDeps({
      renderSource: vi.fn((_input, _bundle, options) => ({
        viewId: options.viewId,
        format: options.format,
        profileId: options.profileId,
        text: "flowchart TD",
        notes: [],
        diagnostics: [
          {
            stage: "validate",
            code: "validate.warning",
            severity: "warn",
            message: "warning text",
            file: "/repo/example.sdd"
          }
        ]
      }))
    });

    const result = await runCli([
      "node",
      "sdd",
      "mmd",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--diagnostics",
      "json",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(stderr.join("")).toContain("\"code\": \"validate.warning\"");
  });

  it("rejects mismatched DOT output extensions", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "dot",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--out",
      "/tmp/outcome.mmd",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(2);
    expect(stderr.join("")).toContain("--out expects a .dot file");
    expect(deps.renderSource).not.toHaveBeenCalled();
  });

  it("rejects mismatched Mermaid output extensions", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "mmd",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--out",
      "/tmp/outcome.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(2);
    expect(stderr.join("")).toContain("--out expects a .mmd file");
    expect(deps.renderSource).not.toHaveBeenCalled();
  });

  it("rejects mismatched default SVG output extensions", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--out",
      "/tmp/outcome.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(2);
    expect(stderr.join("")).toContain("--out expects a .svg file");
    expect(deps.renderSourcePreview).not.toHaveBeenCalled();
  });

  it("rejects mismatched PNG output extensions when png format is requested", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--format",
      "png",
      "--out",
      "/tmp/outcome.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(2);
    expect(stderr.join("")).toContain("--out expects a .png file");
    expect(deps.renderSourcePreview).not.toHaveBeenCalled();
  });

  it("rejects mismatched png-out extensions", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "dot",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--png-out",
      "/tmp/outcome.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(2);
    expect(stderr.join("")).toContain("--png-out expects a .png file");
    expect(deps.renderSource).not.toHaveBeenCalled();
  });

  it("render accepts Mermaid output for non-IA views", async () => {
    const { deps, stdout, renderSourceMock } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "render",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "journey_map",
      "--format",
      "mermaid",
      "--out",
      "/tmp/journey.mmd",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourceMock.mock.calls[0][2]).toMatchObject({
      viewId: "journey_map",
      format: "mermaid"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/journey.mmd", "flowchart TD");
    expect(stdout.join("")).not.toContain("error");
  });

  it("prints render notes before the output file announcement", async () => {
    const coverageNote =
      "Omitted empty ui_contracts containers in simple profile: Behavior Details, Dataset Details, Projects by Period.";
    const { deps, stderr, renderSourceMock } = createDeps();
    renderSourceMock.mockImplementationOnce((_input, _bundle, options) => ({
      viewId: options.viewId,
      format: options.format,
      profileId: options.profileId,
      text: "digraph G {}",
      notes: [coverageNote],
      diagnostics: []
    }));

    const result = await runCli([
      "node",
      "sdd",
      "render",
      "bundle/v0.1/examples/place_viewstate_transition.sdd",
      "--view",
      "ui_contracts",
      "--format",
      "dot",
      "--out",
      "/tmp/ui-contracts.dot",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    const stderrText = stderr.join("");
    expect(stderrText).toContain(coverageNote);
    expect(stderrText).toContain("Wrote /tmp/ui-contracts.dot");
    expect(stderrText.indexOf(coverageNote)).toBeLessThan(stderrText.indexOf("Wrote /tmp/ui-contracts.dot"));
  });

  it("prints show notes before preview file announcements", async () => {
    const coverageNote =
      "Omitted empty ui_contracts containers in simple profile: Behavior Details, Dataset Details, Projects by Period.";
    const { deps, stderr, renderSourcePreviewMock } = createDeps();
    renderSourcePreviewMock.mockImplementationOnce(async (_input, _bundle, options) => ({
      view: bundle.views.views.find((candidate) => candidate.id === options.viewId)!,
      capability: {
        textArtifacts: [],
        previewArtifacts: [],
        defaultPreviewFormat: "svg" as const
      },
      previewCapability: {
        format: options.format,
        backendId: "staged_ui_contracts_preview",
        backendClass: "staged" as const
      },
      artifact: {
        format: "svg" as const,
        text: "<svg>staged</svg>"
      },
      notes: [coverageNote],
      diagnostics: []
    }));

    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/place_viewstate_transition.sdd",
      "--view",
      "ui_contracts",
      "--out",
      "/tmp/ui-contracts.svg",
      "--profile",
      "strict"
    ], deps);

    expect(result.exitCode).toBe(0);
    const stderrText = stderr.join("");
    expect(stderrText).toContain(coverageNote);
    expect(stderrText).toContain("Wrote /tmp/ui-contracts.svg");
    expect(stderrText.indexOf(coverageNote)).toBeLessThan(stderrText.indexOf("Wrote /tmp/ui-contracts.svg"));
  });

  it("top-level help emphasizes show and hides internal text commands", () => {
    const { deps, stdout } = createDeps();
    const program = createProgram(deps);

    program.outputHelp();

    const help = stdout.join("");
    expect(help).not.toContain("sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd");
    expect(help).not.toContain("sdd mmd bundle/v0.1/examples/outcome_to_ia_trace.sdd");
    expect(help).not.toContain("sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view journey_map --format mermaid --out ./journey.mmd");
    expect(help).not.toContain("sdd render bundle/v0.1/examples/scenario_branching.sdd --view scenario_flow --format dot --out ./scenario.dot");
    expect(help).not.toContain("sdd render bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --format dot --out ./ui-contracts.dot");
    expect(help).not.toContain("sdd help render");
    expect(help).not.toContain("sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view outcome_opportunity_map --out ./outcome-map.svg");
    expect(help).toContain("sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view journey_map --out ./journey.svg");
    expect(help).not.toContain("sdd show bundle/v0.1/examples/scenario_branching.sdd --view scenario_flow --out ./scenario.svg");
    expect(help).not.toContain("--dot-out ./outcome.dot");
    expect(help).not.toMatch(/\n\s+render\s+/);
    expect(help).not.toMatch(/\n\s+dot\s+/);
    expect(help).not.toMatch(/\n\s+mmd\s+/);
    expect(help).toContain("show");
    expect(help).toContain("Validation profiles (bundle-declared; shipped v0.1 profiles shown):");
    expect(help).toContain("simple");
    expect(help).toContain("strict       strict governance");
    expect(help).toContain("Omit --profile to resolve your user default, then the selected-bundle fallback.");
    expect(help).toContain("Render detail (bundle-declared; shipped v0.1 values shown):");
    expect(help).toContain("Omit --detail to resolve your user default, then the selected-bundle fallback.");
    expect(help).toContain("Node decorators (bundle-declared; shipped v0.1 values shown):");
    expect(help).toContain("type,id      semantic node type and stable node ID");
    expect(help).toContain("Omit --decorators to resolve your user default, then the selected-bundle fallback.");
    expect(help).toContain("Common flows:");
    expect(help).toContain("sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map");
    expect(help).toContain("sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view all");
    expect(help).toContain("sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view outcome_opportunity_map --out ./outcome-opportunity.svg");
    expect(help).toContain("sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --out ./blueprint.svg");
    expect(help).toContain("sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --out ./ui-contracts.svg");
    expect(help).toContain("sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format png --out ./outcome.png");
    expect(help).toContain("Use `--view all` to save every applicable view after render-detail filtering.");
    expect(help).toContain("`ia_place_map`, `journey_map`, `outcome_opportunity_map`, `service_blueprint`, `scenario_flow`, and `ui_contracts` select staged preview backends by default");
    expect(help).toContain("Internal DOT and Mermaid text artifacts remain available for tests and debugging.");
    expect(help).toContain("sdd validate real_world_exploration/billSage_example/billSage_simple_structure.sdd --profile simple");

    for (const commandName of ["validate", "render", "dot", "mmd", "show"]) {
      const commandHelp = program.commands.find((command) => command.name() === commandName)!.helpInformation();
      expect(commandHelp, commandName).toContain("profile id override; omission uses the resolved");
      expect(commandHelp, commandName).toContain("user/bundle default");
    }

    const showHelp = program.commands.find((command) => command.name() === "show")!.helpInformation();
    expect(showHelp).toContain("--decorators <mode>");
    expect(showHelp).toContain("node decorator mode override; omission uses the");
    expect(showHelp).toContain("resolved user/bundle default");
    expect(showHelp).toContain("[.decorators-<mode>]");
  });

  it("render help labels DOT and Mermaid output as internal/debug artifacts", () => {
    const { deps } = createDeps();
    const program = createProgram(deps);
    const help = program.commands.find((command) => command.name() === "render")!.helpInformation();

    expect(help).toContain("Internal/debug renderer command.");
    expect(help).toContain("These text artifacts are retained for tests,");
    expect(help).toContain("supported SVG/PNG preview");
    expect(help).toContain("internal text render format (dot or mermaid)");
  });

  it("dot help labels the command as internal/debug", () => {
    const { deps } = createDeps();
    const program = createProgram(deps);
    const help = program.commands.find((command) => command.name() === "dot")!.helpInformation();

    expect(help).toContain("Internal convenience wrapper");
    expect(help).toContain("write internal DOT output to a file instead of stdout");
    expect(help).toContain("supported preview output");
  });

  it("mmd help labels the command as internal/debug", () => {
    const { deps } = createDeps();
    const program = createProgram(deps);
    const help = program.commands.find((command) => command.name() === "mmd")!.helpInformation();

    expect(help).toContain("Internal convenience wrapper");
    expect(help).toContain("write internal Mermaid output to a file instead of");
    expect(help).toContain("stdout");
    expect(help).toContain("supported preview output");
  });

  it("show help labels --dot-out as internal/debug", () => {
    const { deps } = createDeps();
    const program = createProgram(deps);
    const help = program.commands.find((command) => command.name() === "show")!.helpInformation();

    expect(help).not.toContain("journey.svg");
    expect(help).not.toContain("scenario.svg");
    expect(help).not.toContain("outcome-map.svg");
    expect(help).toContain("Preferred preview command for renderable views.");
    expect(help).toContain("select staged preview");
    expect(help).toContain("backends by default");
    expect(help).toContain("Legacy Graphviz");
    expect(help).toContain("preview remains available");
    expect(help).toContain("internal/debug: also keep the intermediate DOT source");
    expect(help).toContain("incompatible with --view all");
    expect(help).not.toContain("--dot-out ./outcome.dot");
  });
});
