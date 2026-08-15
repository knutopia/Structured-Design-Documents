import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const v1Root = path.join(repoRoot, "src/authoring/guidedAddition/v1");

function v1Sources(): Array<{ file: string; source: string }> {
  return fs.readdirSync(v1Root)
    .filter((file) => file.endsWith(".ts"))
    .sort()
    .map((file) => ({ file, source: fs.readFileSync(path.join(v1Root, file), "utf8") }));
}

describe("Guided Addition v1 architecture boundary", () => {
  it("keeps the pure v1 graph independent of legacy workflow, placement, mutation, and client modules", () => {
    const prohibitedImports = [
      /from ["']\.\.\/planner\.js["']/,
      /from ["']\.\.\/contracts\.js["']/,
      /from ["'][^"']*\/placement\.js["']/,
      /from ["'][^"']*\/additionProposals\.js["']/,
      /from ["'][^"']*\/mutations\//,
      /from ["'][^"']*\/cli\//,
      /from ["'][^"']*\/workspace\//
    ];
    for (const { file, source } of v1Sources()) {
      for (const pattern of prohibitedImports) {
        expect(source, `${file} crosses the v1 import boundary`).not.toMatch(pattern);
      }
    }
  });

  it("does not reintroduce rejected workflow and placement contract vocabulary", () => {
    const contracts = fs.readFileSync(path.join(v1Root, "contracts.ts"), "utf8");
    expect(contracts).not.toMatch(/endpoint_strategy|PlacementSelection|review_proposal|edge_placement|reason_code/);
    expect(contracts).not.toMatch(/kind: "complete"/);
  });
});
