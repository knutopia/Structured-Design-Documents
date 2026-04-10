import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  compileSource,
  loadBundle,
  projectSource,
  projectView,
  type Projection,
  type ProjectionEdge,
  type ProjectionEdgeAnnotation,
  type ProjectionNode,
  type ProjectionNodeAnnotation,
  type ProjectionNodeGroup,
  type ProjectionOmission,
  type ProjectionResult
} from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

function assertProjectionTypeExports(
  value: Projection,
  node: ProjectionNode,
  edge: ProjectionEdge,
  nodeAnnotation: ProjectionNodeAnnotation,
  edgeAnnotation: ProjectionEdgeAnnotation,
  nodeGroup: ProjectionNodeGroup,
  omission: ProjectionOmission,
  result: ProjectionResult
): void {
  expect(value.schema).toBe("sdd-text-view-projection");
  expect(node.id).toBeTypeOf("string");
  expect(edge.type).toBeTypeOf("string");
  expect(nodeAnnotation.node_id).toBeTypeOf("string");
  expect(edgeAnnotation.display_label).toBeTypeOf("string");
  expect(nodeGroup.node_ids).toBeInstanceOf(Array);
  expect(omission.reason).toBeTypeOf("string");
  expect(result.diagnostics).toBeInstanceOf(Array);
}

async function loadExampleInput(fileName: string): Promise<{ path: string; text: string }> {
  const filePath = path.join(repoRoot, "bundle/v0.1/examples", fileName);
  return {
    path: filePath,
    text: await readFile(filePath, "utf8")
  };
}

describe("projection service public API", () => {
  it("exports projectView and projectSource from the root package entrypoint", () => {
    expect(projectView).toBeTypeOf("function");
    expect(projectSource).toBeTypeOf("function");
  });

  it("exports the required projection types from the root package entrypoint", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput("outcome_to_ia_trace.sdd");
    const projected = projectSource(input, bundle, "ia_place_map");

    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection).toBeDefined();

    assertProjectionTypeExports(
      projected.projection!,
      projected.projection!.nodes[0]!,
      projected.projection!.edges[0]!,
      projected.projection!.derived.node_annotations[0]!,
      {
        from: "A",
        type: "REL",
        to: "B",
        role: "role",
        display_label: "label",
        label_source: "derived"
      },
      {
        id: "group",
        role: "role",
        label: "label",
        node_ids: ["A"]
      },
      {
        kind: "edge",
        from: "A",
        type: "REL",
        to: "B",
        reason: "relationship_not_in_scope"
      },
      projected
    );
  });

  it("projects source through the same compile and project path as compileSource plus projectView", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput("outcome_to_ia_trace.sdd");
    const compiled = compileSource(input, bundle);
    const projected = projectView(compiled.graph!, bundle, "ia_place_map");
    const fromSource = projectSource(input, bundle, "ia_place_map");

    expect(compiled.diagnostics).toEqual([]);
    expect(projected.diagnostics).toEqual([]);
    expect(fromSource).toEqual(projected);
  });

  it("returns compile diagnostics without a projection when compilation fails", async () => {
    const bundle = await loadBundle(manifestPath);
    const result = projectSource(
      {
        path: path.join(repoRoot, "tests/fixtures/invalid_projection_input.sdd"),
        text: [
          "SDD-TEXT 0.1",
          "",
          "Place P-001 \"First\"",
          "END",
          "",
          "Place P-001 \"Duplicate\"",
          "END"
        ].join("\n")
      },
      bundle,
      "ia_place_map"
    );

    expect(result.projection).toBeUndefined();
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.stage === "compile" &&
          diagnostic.severity === "error" &&
          diagnostic.code === "compile.duplicate_node_id"
      )
    ).toBe(true);
  });

  it("surfaces project.unknown_view from the public source-to-projection API", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = await loadExampleInput("outcome_to_ia_trace.sdd");
    const result = projectSource(input, bundle, "missing_view");

    expect(result.projection).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        stage: "project",
        code: "project.unknown_view",
        severity: "error",
        file: input.path
      })
    ]);
  });

  it("surfaces project.schema_validation_failed from the public source-to-projection API", async () => {
    const bundle = await loadBundle(manifestPath);
    const rejectingBundle = {
      ...bundle,
      projectionSchema: {
        type: "object",
        properties: {
          schema: {
            const: "__reject_valid_projection__"
          }
        },
        required: ["schema"]
      }
    };
    const input = await loadExampleInput("outcome_to_ia_trace.sdd");
    const result = projectSource(input, rejectingBundle, "ia_place_map");

    expect(result.projection).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        stage: "project",
        code: "project.schema_validation_failed",
        severity: "error",
        file: input.path
      })
    ]);
  });
});
