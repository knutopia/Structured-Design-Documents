import type { Bundle } from "../src/bundle/types.js";
import { describe, expect, it, vi } from "vitest";
import { createProgram, runCli, type CliDeps } from "../src/cli/program.js";

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
    profiles: [],
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
  syntax: {
    version: "0.1",
    artifact: "sdd",
    lexical: {
      identifier_pattern: "",
      id_pattern: "",
      version_number_pattern: "",
      bare_value_pattern: ""
    },
    document: {
      version_declaration: {
        allowed: true,
        required: false,
        literal: "SDD",
        default_effective_version: "0.1",
        post_parse_supported_versions: ["0.1"]
      }
    },
    line_kinds: []
  },
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
          renderer_defaults: {}
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
          renderer_defaults: {}
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
          renderer_defaults: {}
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
          renderer_defaults: {}
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
          renderer_defaults: {}
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
          renderer_defaults: {}
        }
      }
    ]
  },
  profiles: {}
};

function createDeps(overrides: Partial<CliDeps> = {}): {
  deps: Partial<CliDeps>;
  stdout: string[];
  stderr: string[];
  renderSourceMock: ReturnType<typeof vi.fn>;
  renderSourcePreviewMock: ReturnType<typeof vi.fn>;
  renderPreviewArtifactMock: ReturnType<typeof vi.fn>;
  writeBinaryFileMock: ReturnType<typeof vi.fn>;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const renderSourceMock = vi.fn((_input, _bundle, options) => ({
    viewId: options.viewId,
    format: options.format,
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
        : options.viewId === "ui_contracts"
          ? "staged_ui_contracts_preview"
          : options.viewId === "service_blueprint"
            ? "staged_service_blueprint_preview"
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
  const writeBinaryFileMock = vi.fn(async () => undefined);

  return {
    stdout,
    stderr,
    renderSourceMock,
    renderSourcePreviewMock,
    renderPreviewArtifactMock,
    writeBinaryFileMock,
    deps: {
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
      writeTextFile: vi.fn(async () => undefined),
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

const jsonDiagnosticsHint = "Hint: rerun with --diagnostics json for machine-readable diagnostics.";

describe("CLI wrappers", () => {
  it("dot emits DOT text for a valid example", async () => {
    const { deps, stdout, renderSourceMock } = createDeps();
    const result = await runCli(["node", "sdd", "dot", "bundle/v0.1/examples/outcome_to_ia_trace.sdd"], deps);

    expect(result.exitCode).toBe(0);
    expect(stdout.join("")).toContain("digraph G {}");
    expect(renderSourceMock.mock.calls[0][2]).toMatchObject({
      viewId: "ia_place_map",
      format: "dot"
    });
  });

  it("mmd emits Mermaid text for a valid example", async () => {
    const { deps, stdout, renderSourceMock } = createDeps();
    const result = await runCli(["node", "sdd", "mmd", "bundle/v0.1/examples/outcome_to_ia_trace.sdd"], deps);

    expect(result.exitCode).toBe(0);
    expect(stdout.join("")).toContain("flowchart TD");
    expect(renderSourceMock.mock.calls[0][2]).toMatchObject({
      viewId: "ia_place_map",
      format: "mermaid"
    });
  });

  it("show derives a sibling SVG path by default", async () => {
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
      backendId: "staged_ia_place_map_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith(
      "/repo/bundle/v0.1/examples/outcome_to_ia_trace.svg",
      "<svg>staged</svg>"
    );
    expect(stderr.join("")).toContain("Wrote /repo/bundle/v0.1/examples/outcome_to_ia_trace.svg");
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
      "/tmp/custom.svg"
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
      "/tmp/legacy.svg"
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
      "/tmp/custom.dot"
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
      "/tmp/custom.dot"
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
      "/tmp/custom.png"
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

  it("show supports journey_map previews through the legacy backend", async () => {
    const { deps, renderSourcePreviewMock, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "journey_map",
      "--out",
      "/tmp/journey.svg"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "journey_map",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/journey.svg", "<svg>embedded</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/journey.svg");
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
      "/tmp/blueprint.svg"
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
      "/tmp/blueprint-legacy.svg"
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

  it("show supports scenario_flow previews through the legacy backend", async () => {
    const { deps, renderSourcePreviewMock, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/scenario_branching.sdd",
      "--view",
      "scenario_flow",
      "--out",
      "/tmp/scenario.svg"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(renderSourcePreviewMock.mock.calls[0][2]).toMatchObject({
      viewId: "scenario_flow",
      format: "svg",
      backendId: "legacy_graphviz_preview"
    });
    expect(deps.writeTextFile).toHaveBeenCalledWith("/tmp/scenario.svg", "<svg>embedded</svg>");
    expect(stderr.join("")).toContain("Wrote /tmp/scenario.svg");
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
      "/tmp/ui-contracts.svg"
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
      "/tmp/ui-contracts-legacy.svg"
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
      "/tmp/ui-contracts.dot"
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
      "/tmp/ui-contracts.dot"
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
      "/tmp/outcome.dot"
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
      "--png"
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
      "ia_place_map"
    ], deps);

    expect(result.exitCode).toBe(1);
    expect(deps.renderPreviewArtifact).not.toHaveBeenCalled();
    const stderrText = stderr.join("");
    expect(stderrText).toContain("ERROR validate.failed (2 instances): validation failed");
    expect(countOccurrences(stderrText, "/repo/example.sdd")).toBe(1);
    expect(countOccurrences(stderrText, jsonDiagnosticsHint)).toBe(1);
  });

  it("validate pretty diagnostics include the json hint exactly once", async () => {
    const { deps, stderr } = createDeps({
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
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd"
    ], deps);

    expect(result.exitCode).toBe(0);
    const stderrText = stderr.join("");
    expect(stderrText).toContain("WARN validate.warning (1 instance): warning text");
    expect(stderrText).toContain(`\n\n${jsonDiagnosticsHint}\n`);
    expect(countOccurrences(stderrText, jsonDiagnosticsHint)).toBe(1);
  });

  it("validate without diagnostics does not print the json hint", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "validate",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(stderr.join("")).not.toContain(jsonDiagnosticsHint);
  });

  it("render supports json diagnostics output", async () => {
    const { deps, stderr } = createDeps({
      renderSource: vi.fn((_input, _bundle, options) => ({
        viewId: options.viewId,
        format: options.format,
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
      "json"
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
      "json"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(stderr.join("")).toContain("\"code\": \"validate.warning\"");
  });

  it("dot supports json diagnostics output", async () => {
    const { deps, stderr } = createDeps({
      renderSource: vi.fn((_input, _bundle, options) => ({
        viewId: options.viewId,
        format: options.format,
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
      "json"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(stderr.join("")).toContain("\"code\": \"validate.warning\"");
  });

  it("mmd supports json diagnostics output", async () => {
    const { deps, stderr } = createDeps({
      renderSource: vi.fn((_input, _bundle, options) => ({
        viewId: options.viewId,
        format: options.format,
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
      "json"
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
      "/tmp/outcome.mmd"
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
      "/tmp/outcome.dot"
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
      "/tmp/outcome.dot"
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
      "/tmp/outcome.dot"
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
      "/tmp/outcome.dot"
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
      "/tmp/journey.mmd"
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
      "/tmp/ui-contracts.dot"
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
      "/tmp/ui-contracts.svg"
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
    expect(help).not.toContain("sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view journey_map --out ./journey.svg");
    expect(help).not.toContain("sdd show bundle/v0.1/examples/scenario_branching.sdd --view scenario_flow --out ./scenario.svg");
    expect(help).not.toContain("--dot-out ./outcome.dot");
    expect(help).not.toMatch(/\n\s+render\s+/);
    expect(help).not.toMatch(/\n\s+dot\s+/);
    expect(help).not.toMatch(/\n\s+mmd\s+/);
    expect(help).toContain("show");
    expect(help).toContain("Profiles:");
    expect(help).toContain("simple");
    expect(help).toContain("recommended  strict governance (default)");
    expect(help).toContain("Common flows:");
    expect(help).toContain("sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map");
    expect(help).toContain("sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --out ./blueprint.svg");
    expect(help).toContain("sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --out ./ui-contracts.svg");
    expect(help).toContain("sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format png --out ./outcome.png");
    expect(help).toContain("Internal DOT and Mermaid text artifacts remain available for tests and debugging.");
    expect(help).toContain("sdd validate real_world_exploration/billSage_simple_structure.sdd --profile simple");
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
    expect(help).toContain("staged preview backends by default");
    expect(help).toContain("internal/debug: also keep the intermediate DOT source");
    expect(help).toContain("in a file");
    expect(help).not.toContain("--dot-out ./outcome.dot");
  });
});
