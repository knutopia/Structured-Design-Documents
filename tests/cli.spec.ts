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
    views: [
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
  renderDotToPngMock: ReturnType<typeof vi.fn>;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const renderSourceMock = vi.fn((_input, _bundle, options) => ({
    viewId: options.viewId,
    format: options.format,
    text: options.format === "dot" ? "digraph G {}" : "flowchart TD",
    diagnostics: []
  }));
  const renderDotToPngMock = vi.fn(async () => undefined);

  return {
    stdout,
    stderr,
    renderSourceMock,
    renderDotToPngMock,
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
      writeTextFile: vi.fn(async () => undefined),
      renderDotToPng: renderDotToPngMock,
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

  it("show derives a sibling PNG path by default", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(deps.renderDotToPng).toHaveBeenCalledWith(
      "digraph G {}",
      "/repo/bundle/v0.1/examples/outcome_to_ia_trace.png"
    );
    expect(stderr.join("")).toContain("Wrote /repo/bundle/v0.1/examples/outcome_to_ia_trace.png");
  });

  it("show respects an explicit preview output path", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "ia_place_map",
      "--out",
      "/tmp/custom.png"
    ], deps);

    expect(result.exitCode).toBe(0);
    expect(deps.renderDotToPng).toHaveBeenCalledWith("digraph G {}", "/tmp/custom.png");
    expect(stderr.join("")).toContain("Wrote /tmp/custom.png");
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

  it("show stops before Graphviz when validation fails", async () => {
    const { deps, stderr } = createDeps({
      renderSource: vi.fn(() => ({
        viewId: "ia_place_map",
        format: "dot",
        diagnostics: [
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
    expect(deps.renderDotToPng).not.toHaveBeenCalled();
    expect(stderr.join("")).toContain("validate.failed");
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

  it("rejects mismatched PNG output extensions", async () => {
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
    expect(stderr.join("")).toContain("--out expects a .png file");
    expect(deps.renderSource).not.toHaveBeenCalled();
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

  it("show reports a known-but-not-yet-renderable view clearly", async () => {
    const { deps, stderr } = createDeps();
    const result = await runCli([
      "node",
      "sdd",
      "show",
      "bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "--view",
      "journey_map"
    ], deps);

    expect(result.exitCode).toBe(2);
    expect(stderr.join("")).toContain("defined in the bundle but is not renderable yet");
    expect(deps.renderSource).not.toHaveBeenCalled();
  });

  it("help output includes the new commands and guidance", () => {
    const { deps, stdout } = createDeps();
    const program = createProgram(deps);

    program.outputHelp();

    const help = stdout.join("");
    expect(help).toContain("dot");
    expect(help).toContain("mmd");
    expect(help).toContain("show");
    expect(help).toContain("Profiles:");
    expect(help).toContain("simple");
    expect(help).toContain("recommended  strict governance (default)");
    expect(help).toContain("Common flows:");
    expect(help).toContain("sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map");
    expect(help).toContain("sdd validate real_world_exploration/billSage_simple_structure.sdd --profile simple");
  });
});
