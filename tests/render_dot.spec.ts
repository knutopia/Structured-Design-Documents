import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadBundle, renderSource } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

describe("renderSource dot", () => {
  it("renders the IA proof examples to stable DOT output", async () => {
    const bundle = await loadBundle(manifestPath);

    for (const [exampleName, goldenName] of [
      ["outcome_to_ia_trace.sdd", "outcome_to_ia_trace.dot"],
      ["place_viewstate_transition.sdd", "place_viewstate_transition.dot"]
    ] as const) {
      const examplePath = path.join(bundle.rootDir, "examples", exampleName);
      const input = {
        path: examplePath,
        text: await readFile(examplePath, "utf8")
      };
      const golden = await readFile(path.join(repoRoot, "tests/goldens", goldenName), "utf8");
      const result = renderSource(input, bundle, {
        viewId: "ia_place_map",
        format: "dot"
      });
      expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(result.text).toBe(golden.trimEnd());
    }
  });
});

