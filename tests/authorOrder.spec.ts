import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getSourceOrderedChildrenForRelationship, getSourceOrderedStructuralStream, getTopLevelNodeIdsInAuthorOrder } from "../src/compiler/authorOrder.js";
import { compileSource, loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("compiled graph author order", () => {
  it("captures top-level declaration order and typed structural edge order without serializing metadata", async () => {
    const bundle = await loadBundle(manifestPath);
    const input = {
      path: "/virtual/source_order.sdd",
      text: `SDD-TEXT 0.1

Place P-300 "Shell"
  CONTAINS P-200 "Second"
  COMPOSED_OF C-200 "Panel"
  CONTAINS P-100 "First"
  + Place P-200 "Second"
  END
  + Component C-200 "Panel"
  END
  + Place P-100 "First"
  END
END

Area A-500 "Later"
END
`
    };

    const compiled = compileSource(input, bundle);

    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.graph).toBeDefined();
    expect(getTopLevelNodeIdsInAuthorOrder(compiled.graph!, ["A-500", "P-300"])).toEqual(["P-300", "A-500"]);
    expect(getSourceOrderedChildrenForRelationship(compiled.graph!, "P-300", "CONTAINS")).toEqual(["P-200", "P-100"]);
    expect(getSourceOrderedStructuralStream(compiled.graph!, "P-300", ["CONTAINS", "COMPOSED_OF"])).toEqual([
      { type: "CONTAINS", to: "P-200" },
      { type: "COMPOSED_OF", to: "C-200" },
      { type: "CONTAINS", to: "P-100" }
    ]);
    expect(Object.keys(compiled.graph!)).toEqual(["schema", "version", "nodes", "edges"]);
    expect(JSON.stringify(compiled.graph)).not.toContain("topLevelNodeIds");
    expect(JSON.stringify(compiled.graph)).not.toContain("edgeLineOrderByParentId");
  });
});
