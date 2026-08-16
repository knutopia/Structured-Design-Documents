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

  it("completes the public cutover without legacy workflow files or exports", () => {
    for (const file of [
      "src/authoring/additionProposals.ts",
      "src/authoring/guidedAddition/contracts.ts",
      "src/authoring/guidedAddition/placement.ts",
      "src/authoring/guidedAddition/planner.ts"
    ]) {
      expect(fs.existsSync(path.join(repoRoot, file)), file).toBe(false);
    }
    const index = fs.readFileSync(path.join(repoRoot, "src/index.ts"), "utf8");
    expect(index).toContain("createGuidedAdditionRuntimeV1");
    expect(index).toContain("applyAdditionProposalV1");
    expect(index).toContain("GuidedAdditionV1DomainError");
    expect(index).not.toMatch(/createGuidedAdditionRuntime[}\s]|applyAdditionProposal[}\s]|GuidedAdditionDomainError/);

    const sources = fs.readdirSync(path.join(repoRoot, "src"), { recursive: true })
      .filter((file): file is string => typeof file === "string" && file.endsWith(".ts"))
      .map((file) => fs.readFileSync(path.join(repoRoot, "src", file), "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/additionProposals\.js|guidedAddition\/(contracts|placement|planner)\.js/);
  });
});
