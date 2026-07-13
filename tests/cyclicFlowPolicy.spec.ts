import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { compileSource, loadBundle, validateGraph } from "../src/index.js";
import type { Bundle, RuleLogic } from "../src/bundle/types.js";
import type { CompiledGraph } from "../src/compiler/types.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

interface StepSource {
  id: string;
  properties?: string[];
  edges: string[];
}

function buildSource(steps: StepSource[]): string {
  const lines = ["SDD-TEXT 0.1", ""];
  for (const step of steps) {
    lines.push(
      `Step ${step.id} "${step.id} proof step"`,
      "  owner=Design",
      `  description="Cycle policy proof for ${step.id}"`,
      "  actor=User",
      `  intent="Exercise ${step.id}"`,
      `  success_criteria="${step.id} completes"`,
      ...(step.properties ?? []).map((property) => `  ${property}`),
      ...step.edges.map((edge) => `  ${edge}`),
      "  REALIZED_BY P-900 \"Cycle proof surface\"",
      "END",
      ""
    );
  }
  lines.push(
    "Place P-900 \"Cycle proof surface\"",
    "  owner=Design",
    "  description=\"Surface used only to satisfy strict Step realization\"",
    "  surface=web",
    "  route_or_key=/cycle-proof",
    "  access=auth",
    "END"
  );
  return lines.join("\n");
}

function compileGraph(bundle: Bundle, steps: StepSource[]): CompiledGraph {
  const compiled = compileSource({
    path: path.join(repoRoot, "tests/fixtures/cyclic-flow-policy.sdd"),
    text: buildSource(steps)
  }, bundle);
  expect(compiled.diagnostics).toEqual([]);
  expect(compiled.graph).toBeDefined();
  return compiled.graph!;
}

function cycleDiagnostics(bundle: Bundle, graph: CompiledGraph, profileId = "strict") {
  return validateGraph(graph, bundle, profileId).diagnostics.filter(
    (diagnostic) => diagnostic.code === "validate.precedes_cycle_policy"
  );
}

function withCycleRuleLogic(bundle: Bundle, patch: Partial<RuleLogic>): Bundle {
  return {
    ...bundle,
    contracts: {
      ...bundle.contracts,
      relationships: bundle.contracts.relationships.map((relationship) => relationship.type === "PRECEDES"
        ? {
            ...relationship,
            constraints: relationship.constraints.map((constraint) => constraint.id === "precedes_cycle_policy"
              ? {
                  ...constraint,
                  rule_logic: {
                    ...constraint.rule_logic!,
                    ...patch
                  }
                }
              : constraint)
          }
        : relationship)
    }
  };
}

describe("bundle-driven cyclic_flow_policy", () => {
  let bundle: Bundle;

  beforeAll(async () => {
    bundle = await loadBundle(manifestPath);
  });

  it("recognizes an internal PRECEDES edge annotation under strict without a Step.kind workaround", () => {
    const graph = compileGraph(bundle, [
      { id: "J-001", edges: ["PRECEDES J-002 kind=loop"] },
      { id: "J-002", edges: ["PRECEDES J-001"] }
    ]);

    const validation = validateGraph(graph, bundle, "strict");
    expect(validation.errorCount).toBe(0);
    expect(validation.diagnostics.some((diagnostic) => diagnostic.code === "validate.precedes_cycle_policy")).toBe(false);
    expect(validation.diagnostics.some((diagnostic) => diagnostic.code === "validate.step_kind_enum")).toBe(false);
  });

  it("diagnoses an unannotated component with deterministic related IDs", () => {
    const graph = compileGraph(bundle, [
      { id: "J-003", edges: ["PRECEDES J-004"] },
      { id: "J-004", edges: ["PRECEDES J-003"] }
    ]);

    const first = cycleDiagnostics(bundle, graph);
    const second = cycleDiagnostics(bundle, graph);
    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0]?.relatedIds).toEqual(["J-003", "J-004"]);
  });

  it("handles annotated and unannotated self-loops independently", () => {
    const annotated = compileGraph(bundle, [
      { id: "J-010", edges: ["PRECEDES J-010 kind=loop"] }
    ]);
    const unannotated = compileGraph(bundle, [
      { id: "J-011", edges: ["PRECEDES J-011"] }
    ]);

    expect(cycleDiagnostics(bundle, annotated)).toEqual([]);
    expect(cycleDiagnostics(bundle, unannotated)).toHaveLength(1);
    expect(cycleDiagnostics(bundle, unannotated)[0]?.relatedIds).toEqual(["J-011"]);
  });

  it("requires an internal annotation in every cyclic component", () => {
    const graph = compileGraph(bundle, [
      { id: "J-020", edges: ["PRECEDES J-021 kind=loop"] },
      { id: "J-021", edges: ["PRECEDES J-020", "PRECEDES J-030 kind=loop"] },
      { id: "J-030", edges: ["PRECEDES J-031"] },
      { id: "J-031", edges: ["PRECEDES J-030"] }
    ]);

    const diagnostics = cycleDiagnostics(bundle, graph, "simple");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.relatedIds).toEqual(["J-030", "J-031"]);
  });

  it("orders multiple unannotated component diagnostics deterministically", () => {
    const graph = compileGraph(bundle, [
      { id: "J-090", edges: ["PRECEDES J-091"] },
      { id: "J-091", edges: ["PRECEDES J-090"] },
      { id: "J-080", edges: ["PRECEDES J-081"] },
      { id: "J-081", edges: ["PRECEDES J-080"] }
    ]);

    const first = cycleDiagnostics(bundle, graph, "simple");
    const second = cycleDiagnostics(bundle, graph, "simple");
    expect(first).toEqual(second);
    expect(first.map((diagnostic) => diagnostic.relatedIds)).toEqual([
      ["J-080", "J-081"],
      ["J-090", "J-091"]
    ]);
  });

  it("preserves the omitted-field legacy fallback as one relationship-wide diagnostic", () => {
    const graph = compileGraph(bundle, [
      { id: "J-100", edges: ["PRECEDES J-101"] },
      { id: "J-101", edges: ["PRECEDES J-100"] },
      { id: "J-110", edges: ["PRECEDES J-111"] },
      { id: "J-111", edges: ["PRECEDES J-110"] }
    ]);
    const legacyBundle = withCycleRuleLogic(bundle, {
      loop_annotation_target: undefined,
      loop_annotation_coverage: undefined
    });

    const diagnostics = cycleDiagnostics(legacyBundle, graph, "simple");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.relatedIds).toEqual(["J-100", "J-101", "J-110", "J-111"]);
  });

  it("does not accept the former strict-invalid Step.kind loop workaround", () => {
    const graph = compileGraph(bundle, [
      { id: "J-120", properties: ["kind=loop"], edges: ["PRECEDES J-121"] },
      { id: "J-121", edges: ["PRECEDES J-120"] }
    ]);

    const validation = validateGraph(graph, bundle, "strict");
    expect(validation.diagnostics.some((diagnostic) => diagnostic.code === "validate.precedes_cycle_policy")).toBe(true);
    expect(validation.diagnostics.some((diagnostic) => diagnostic.code === "validate.step_kind_enum")).toBe(true);
  });

  it("has no false positive for an acyclic diamond", () => {
    const graph = compileGraph(bundle, [
      { id: "J-040", edges: ["PRECEDES J-041", "PRECEDES J-042"] },
      { id: "J-041", edges: ["PRECEDES J-043"] },
      { id: "J-042", edges: ["PRECEDES J-043"] },
      { id: "J-043", edges: [] }
    ]);

    expect(cycleDiagnostics(bundle, graph, "simple")).toEqual([]);
  });

  it("changes behavior when bundle annotation target, marker, or coverage changes", () => {
    const annotatedGraph = compileGraph(bundle, [
      { id: "J-050", edges: ["PRECEDES J-051 kind=loop"] },
      { id: "J-051", edges: ["PRECEDES J-050"] }
    ]);
    expect(cycleDiagnostics(bundle, annotatedGraph)).toEqual([]);
    expect(cycleDiagnostics(withCycleRuleLogic(bundle, { loop_annotation_target: "node" }), annotatedGraph)).toHaveLength(1);

    const changedMarkerBundle = withCycleRuleLogic(bundle, {
      loop_annotation_prop: "cycle_marker",
      loop_annotation_value: "intentional"
    });
    expect(cycleDiagnostics(changedMarkerBundle, annotatedGraph)).toHaveLength(1);
    const changedMarkerGraph = compileGraph(bundle, [
      { id: "J-052", edges: ["PRECEDES J-053 cycle_marker=intentional"] },
      { id: "J-053", edges: ["PRECEDES J-052"] }
    ]);
    expect(cycleDiagnostics(changedMarkerBundle, changedMarkerGraph)).toEqual([]);

    const nodeMarkerGraph = compileGraph(bundle, [
      { id: "J-054", properties: ["cycle_marker=intentional"], edges: ["PRECEDES J-055"] },
      { id: "J-055", edges: ["PRECEDES J-054"] }
    ]);
    expect(cycleDiagnostics(changedMarkerBundle, nodeMarkerGraph)).toHaveLength(1);
    expect(cycleDiagnostics(withCycleRuleLogic(changedMarkerBundle, {
      loop_annotation_target: "node"
    }), nodeMarkerGraph)).toEqual([]);

    const twoComponentGraph = compileGraph(bundle, [
      { id: "J-060", edges: ["PRECEDES J-061 kind=loop"] },
      { id: "J-061", edges: ["PRECEDES J-060"] },
      { id: "J-070", edges: ["PRECEDES J-071"] },
      { id: "J-071", edges: ["PRECEDES J-070"] }
    ]);
    expect(cycleDiagnostics(bundle, twoComponentGraph)).toHaveLength(1);
    expect(cycleDiagnostics(withCycleRuleLogic(bundle, {
      loop_annotation_coverage: "any_cyclic_component"
    }), twoComponentGraph)).toEqual([]);
  });
});
