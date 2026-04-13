import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = path.join(repoRoot, "skills/sdd-skill");

async function expectExists(targetPath: string): Promise<void> {
  await expect(access(targetPath)).resolves.toBeUndefined();
}

describe("canonical sdd-skill source", () => {
  it("contains the expected repo-tracked skill files", async () => {
    await expectExists(path.join(skillRoot, "SKILL.md"));
    await expectExists(path.join(skillRoot, "references/workflow.md"));
    await expectExists(path.join(skillRoot, "references/change-set-recipes.md"));
    await expectExists(path.join(skillRoot, "references/current-helper-gaps.md"));
    await expectExists(path.join(skillRoot, "scripts/run_helper.sh"));
  });

  it("references only companion skill files that exist in the repo skill tree", async () => {
    const skillMarkdown = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");

    expect(skillMarkdown).toContain("scripts/run_helper.sh");
    expect(skillMarkdown).toContain("references/workflow.md");
    expect(skillMarkdown).toContain("references/change-set-recipes.md");
    expect(skillMarkdown).toContain("references/current-helper-gaps.md");

    await expectExists(path.join(skillRoot, "scripts/run_helper.sh"));
    await expectExists(path.join(skillRoot, "references/workflow.md"));
    await expectExists(path.join(skillRoot, "references/change-set-recipes.md"));
    await expectExists(path.join(skillRoot, "references/current-helper-gaps.md"));
  });
});
