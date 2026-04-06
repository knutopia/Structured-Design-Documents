import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { formatJsonDiagnostics } from "../src/diagnostics/formatJson.js";
import { formatPrettyDiagnostics } from "../src/diagnostics/formatPretty.js";
import type { Diagnostic } from "../src/types.js";
import { validateGraph } from "../src/validator/validateGraph.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

async function fixtureInput(name: string) {
  const filePath = path.join(repoRoot, "tests/fixtures/invalid", name);
  return {
    path: filePath,
    text: await readFile(filePath, "utf8")
  };
}

function createDiagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    stage: "validate",
    code: "validate.sample",
    severity: "error",
    message: "Sample diagnostic",
    file: "/repo/example.sdd",
    span: {
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 2,
      startOffset: 0,
      endOffset: 1
    },
    ...overrides
  };
}

describe("diagnostics", () => {
  it("reports syntax diagnostics for missing END", async () => {
    const bundle = await loadBundle(manifestPath);
    const result = compileSource(await fixtureInput("missing_end.sdd"), bundle);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "parse.missing_end")).toBe(true);
  });

  it("reports compile diagnostics for duplicate node ids", async () => {
    const bundle = await loadBundle(manifestPath);
    const result = compileSource(await fixtureInput("duplicate_node_id.sdd"), bundle);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "compile.duplicate_node_id")).toBe(true);
  });

  it("reports validation diagnostics for invalid place access", async () => {
    const bundle = await loadBundle(manifestPath);
    const compiled = compileSource(await fixtureInput("invalid_place_access.sdd"), bundle);
    expect(compiled.graph).toBeDefined();
    const validation = validateGraph(compiled.graph!, bundle, "recommended");
    expect(validation.diagnostics.some((diagnostic) => diagnostic.code === "validate.place_access_format")).toBe(true);
    expect(formatPrettyDiagnostics(validation.diagnostics)).toContain("validate.place_access_format");
    expect(formatJsonDiagnostics(validation.diagnostics)).toContain("\"validate.place_access_format\"");
  });

  it("formats a single diagnostic under a file header", () => {
    expect(formatPrettyDiagnostics([
      createDiagnostic({
        code: "validate.place_access_format",
        ruleId: "place_access_format",
        message: "Invalid place access format",
        span: {
          line: 4,
          column: 7,
          endLine: 4,
          endColumn: 18,
          startOffset: 20,
          endOffset: 31
        }
      })
    ])).toBe([
      "/repo/example.sdd",
      "  ERROR validate.place_access_format [place_access_format] (1 instance) Invalid place access format",
      "    4:7"
    ].join("\n"));
  });

  it("hoists a shared message once for repeated identical diagnostics", () => {
    expect(formatPrettyDiagnostics([
      createDiagnostic({
        code: "validate.required_props_by_type",
        ruleId: "required_props_by_type",
        message: "Node 'A-100' is missing required property 'owner'",
        span: {
          line: 10,
          column: 2,
          endLine: 10,
          endColumn: 6,
          startOffset: 48,
          endOffset: 52
        }
      }),
      createDiagnostic({
        code: "validate.required_props_by_type",
        ruleId: "required_props_by_type",
        message: "Node 'A-100' is missing required property 'owner'",
        span: {
          line: 12,
          column: 2,
          endLine: 12,
          endColumn: 6,
          startOffset: 61,
          endOffset: 65
        }
      })
    ])).toBe([
      "/repo/example.sdd",
      "  ERROR validate.required_props_by_type [required_props_by_type] (2 instances) Node 'A-100' is missing required property 'owner'",
      "    10:2",
      "    12:2"
    ].join("\n"));
  });

  it("keeps per-instance messages when a bucket contains different text", () => {
    expect(formatPrettyDiagnostics([
      createDiagnostic({
        code: "validate.required_props_by_type",
        ruleId: "required_props_by_type",
        message: "Node 'A-100' is missing required property 'owner'",
        span: {
          line: 10,
          column: 2,
          endLine: 10,
          endColumn: 6,
          startOffset: 48,
          endOffset: 52
        }
      }),
      createDiagnostic({
        code: "validate.required_props_by_type",
        ruleId: "required_props_by_type",
        message: "Node 'A-100' is missing required property 'scope'",
        span: {
          line: 11,
          column: 2,
          endLine: 11,
          endColumn: 6,
          startOffset: 53,
          endOffset: 57
        }
      })
    ])).toBe([
      "/repo/example.sdd",
      "  ERROR validate.required_props_by_type [required_props_by_type] (2 instances)",
      "    10:2 Node 'A-100' is missing required property 'owner'",
      "    11:2 Node 'A-100' is missing required property 'scope'"
    ].join("\n"));
  });

  it("shows <no span> for diagnostics without source locations", () => {
    expect(formatPrettyDiagnostics([
      createDiagnostic({
        code: "validate.unknown_profile",
        message: "Unknown profile 'strict'",
        span: undefined
      })
    ])).toBe([
      "/repo/example.sdd",
      "  ERROR validate.unknown_profile (1 instance) Unknown profile 'strict'",
      "    <no span>"
    ].join("\n"));
  });

  it("groups multi-file input deterministically by file", () => {
    expect(formatPrettyDiagnostics([
      createDiagnostic({
        file: "/repo/zeta.sdd",
        code: "validate.place_access_format",
        message: "Zeta diagnostic",
        span: {
          line: 9,
          column: 3,
          endLine: 9,
          endColumn: 8,
          startOffset: 40,
          endOffset: 45
        }
      }),
      createDiagnostic({
        file: "/repo/alpha.sdd",
        code: "validate.place_access_format",
        message: "Alpha diagnostic",
        span: {
          line: 2,
          column: 5,
          endLine: 2,
          endColumn: 10,
          startOffset: 7,
          endOffset: 12
        }
      })
    ])).toBe([
      "/repo/alpha.sdd",
      "  ERROR validate.place_access_format (1 instance) Alpha diagnostic",
      "    2:5",
      "",
      "/repo/zeta.sdd",
      "  ERROR validate.place_access_format (1 instance) Zeta diagnostic",
      "    9:3"
    ].join("\n"));
  });
});
