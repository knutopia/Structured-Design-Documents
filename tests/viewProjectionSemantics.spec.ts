import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSource, loadBundle } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("view projection semantics", () => {
  it("maps service blueprint lane aliases and type defaults into derived lanes", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = {
      path: path.join(repoRoot, "tests/fixtures/render/service_blueprint_aliases.sdd"),
      text: `SDD-TEXT 0.1

Step J-100 "Start Claim"
END

Process PR-100 "Validate Claim"
  visibility=customer-visible
END

Process PR-101 "Review Claim History"
  visibility=not-visible
END

Process PR-102 "Notify Customer"
  visibility=support
END

SystemAction SA-100 "Store Claim"
END

DataEntity D-100 "Claim"
END

Policy PL-100 "Retention Policy"
END
`
    };

    const compiled = compileSource(input, bundle);
    expect(compiled.diagnostics).toEqual([]);

    const projected = projectView(compiled.graph!, bundle, "service_blueprint");

    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection?.derived.node_groups).toEqual([
      {
        id: "lane:01:customer",
        role: "lane",
        label: "customer",
        node_ids: ["J-100"]
      },
      {
        id: "lane:02:frontstage",
        role: "lane",
        label: "frontstage",
        node_ids: ["PR-100"]
      },
      {
        id: "lane:03:backstage",
        role: "lane",
        label: "backstage",
        node_ids: ["PR-101"]
      },
      {
        id: "lane:04:support",
        role: "lane",
        label: "support",
        node_ids: ["PR-102"]
      },
      {
        id: "lane:05:system",
        role: "lane",
        label: "system",
        node_ids: ["D-100", "SA-100"]
      },
      {
        id: "lane:06:policy",
        role: "lane",
        label: "policy",
        node_ids: ["PL-100"]
      }
    ]);
  });

  it("derives scenario flow branch labels with guard, event, then target-name precedence", async () => {
    const bundle = await loadBundle(manifestPath);
    const examplePath = path.join(bundle.rootDir, "examples/scenario_branching.sdd");
    const input = {
      path: examplePath,
      text: await readFile(examplePath, "utf8")
    };

    const compiled = compileSource(input, bundle);
    expect(compiled.diagnostics).toEqual([]);

    const projected = projectView(compiled.graph!, bundle, "scenario_flow");

    expect(projected.diagnostics).toEqual([]);
    expect(projected.projection?.derived.node_annotations).toEqual([
      {
        node_id: "J-030",
        display: {
          shape: "diamond"
        }
      },
      {
        node_id: "J-033",
        display: {
          shape: "diamond"
        }
      }
    ]);
    expect(projected.projection?.derived.edge_annotations).toEqual([
      {
        from: "J-030",
        type: "PRECEDES",
        to: "J-031",
        role: "branch_label",
        display_label: "delivery_selected",
        label_source: "guard"
      },
      {
        from: "J-030",
        type: "PRECEDES",
        to: "J-032",
        role: "branch_label",
        display_label: "pickup_selected",
        label_source: "guard"
      },
      {
        from: "J-033",
        type: "PRECEDES",
        to: "J-034",
        role: "branch_label",
        display_label: "E-032",
        label_source: "event"
      },
      {
        from: "J-033",
        type: "PRECEDES",
        to: "J-035",
        role: "branch_label",
        display_label: "Review Pickup Instructions",
        label_source: "to_name"
      }
    ]);
  });
});
