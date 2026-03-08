import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("projectView ia_place_map", () => {
  it("projects the outcome_to_ia_trace IA slice with node annotations", async () => {
    const bundle = await loadBundle(manifestPath);
    const examplePath = path.join(bundle.rootDir, "examples/outcome_to_ia_trace.sdd");
    const input = {
      path: examplePath,
      text: await readFile(examplePath, "utf8")
    };

    const compiled = compileSource(input, bundle);
    const projected = projectView(compiled.graph!, bundle, "ia_place_map");

    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection?.nodes.map((node) => node.id)).toEqual(["A-001", "P-001", "P-002"]);
    expect(projected.projection?.edges).toEqual([
      { from: "A-001", type: "CONTAINS", to: "P-001" },
      { from: "A-001", type: "CONTAINS", to: "P-002" },
      { from: "P-001", type: "NAVIGATES_TO", to: "P-002" }
    ]);
    expect(projected.projection?.derived.node_annotations).toEqual([
      {
        node_id: "P-001",
        display: {
          subtitle: "/checkout/billing",
          badge: "auth",
          metadata: []
        }
      },
      {
        node_id: "P-002",
        display: {
          subtitle: "/checkout/review",
          badge: "auth",
          metadata: []
        }
      }
    ]);
  });

  it("projects the place_viewstate_transition IA slice with omissions and metadata annotations", async () => {
    const bundle = await loadBundle(manifestPath);
    const examplePath = path.join(bundle.rootDir, "examples/place_viewstate_transition.sdd");
    const input = {
      path: examplePath,
      text: await readFile(examplePath, "utf8")
    };

    const compiled = compileSource(input, bundle);
    const projected = projectView(compiled.graph!, bundle, "ia_place_map");

    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection?.nodes.map((node) => node.id)).toEqual(["P-010", "P-011"]);
    expect(projected.projection?.edges).toEqual([{ from: "P-010", type: "NAVIGATES_TO", to: "P-011" }]);
    expect(projected.projection?.derived.node_annotations).toEqual([
      {
        node_id: "P-010",
        display: {
          subtitle: "/billing",
          badge: "auth",
          metadata: [
            {
              key: "entry_points",
              value: "link:/billing,notification:payment_failed"
            },
            {
              key: "primary_nav",
              value: "true"
            }
          ]
        }
      },
      {
        node_id: "P-011",
        display: {
          subtitle: "/confirmation",
          badge: "role:billing_agent",
          metadata: []
        }
      }
    ]);
    expect(projected.projection?.omissions).toEqual([
      {
        kind: "edge",
        from: "P-010",
        type: "COMPOSED_OF",
        to: "C-010",
        reason: "relationship_not_in_scope",
        detail: "COMPOSED_OF is outside the ia_place_map edge scope."
      },
      {
        kind: "edge",
        from: "P-010",
        type: "CONSTRAINED_BY",
        to: "PL-010",
        reason: "relationship_not_in_scope",
        detail: "CONSTRAINED_BY is outside the ia_place_map edge scope."
      },
      {
        kind: "edge",
        from: "P-010",
        type: "CONTAINS",
        to: "VS-010a",
        reason: "endpoint_out_of_scope",
        detail: "Target node type ViewState is outside the ia_place_map node scope."
      },
      {
        kind: "edge",
        from: "P-010",
        type: "CONTAINS",
        to: "VS-010b",
        reason: "endpoint_out_of_scope",
        detail: "Target node type ViewState is outside the ia_place_map node scope."
      }
    ]);
  });
});
