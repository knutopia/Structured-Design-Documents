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
    const workflowMarkdown = await readFile(
      path.join(skillRoot, "references/workflow.md"),
      "utf8"
    );

    expect(skillMarkdown).toContain("skills/sdd-skill/scripts/run_helper.sh capabilities");
    expect(skillMarkdown).toContain("skills/sdd-skill/scripts/run_helper.sh contract");
    expect(skillMarkdown).toContain(
      "`scripts/run_helper.sh` relative to the installed skill directory"
    );
    expect(skillMarkdown).toContain("references/workflow.md");
    expect(skillMarkdown).toContain("references/change-set-recipes.md");
    expect(skillMarkdown).toContain("references/current-helper-gaps.md");
    expect(workflowMarkdown).toContain("In the repo source tree, use `skills/sdd-skill/scripts/run_helper.sh`;");
    expect(workflowMarkdown).toContain(
      "in an installed skill copy, the same wrapper is available as `scripts/run_helper.sh` relative to the installed skill folder."
    );
    expect(workflowMarkdown).toContain("skills/sdd-skill/scripts/run_helper.sh capabilities");
    expect(workflowMarkdown).toContain("skills/sdd-skill/scripts/run_helper.sh contract");
    expect(workflowMarkdown).toContain("--resolve bundle");
    expect(workflowMarkdown).toContain("capabilities -> contract -> code/docs only if still insufficient");
    expect(skillMarkdown).toContain("/tmp/unique-previews");
    expect(skillMarkdown).toContain("artifact_path");
    expect(skillMarkdown).toContain("Preview decision rules:");
    expect(skillMarkdown).toContain(
      "If the final response will embed an inline image, call helper `preview` and use the returned `artifact_path` as the Markdown image source."
    );
    expect(skillMarkdown).toContain(
      "Preview success payloads expose `format`, `mime_type`, and `artifact_path`; they do not include inline SVG text or base64 PNG data."
    );
    expect(skillMarkdown).toContain(
      "Canonical file links always point at the saved sibling artifact from `sdd show`; the temp `artifact_path` is never the canonical artifact."
    );
    expect(skillMarkdown).toContain(
      "helper gives each preview invocation a unique parent directory"
    );
    expect(skillMarkdown).toContain("Chat may cache local images by absolute path");
    expect(workflowMarkdown).toContain("/tmp/unique-previews");
    expect(workflowMarkdown).toContain("artifact_path");
    expect(workflowMarkdown).toContain("Use one of these branches and stop after the one that matches the final response:");
    expect(workflowMarkdown).toContain("stop there; do not call helper `preview`");
    expect(workflowMarkdown).toContain(
      "Preview success payloads do not include inline SVG text or base64 PNG data."
    );
    expect(workflowMarkdown).toContain(
      "use the returned `artifact_path` as the Markdown image source in the final response"
    );
    expect(workflowMarkdown).toContain(
      "consume the file at `artifact_path`"
    );
    expect(workflowMarkdown).toContain(
      "Do not present `artifact_path` as the real saved artifact."
    );
    expect(workflowMarkdown).toContain("Use the canonical sibling file for file links");

    await expectExists(path.join(skillRoot, "scripts/run_helper.sh"));
    await expectExists(path.join(skillRoot, "references/workflow.md"));
    await expectExists(path.join(skillRoot, "references/change-set-recipes.md"));
    await expectExists(path.join(skillRoot, "references/current-helper-gaps.md"));
  });
});
