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
    const skillAndWorkflow = `${skillMarkdown}\n${workflowMarkdown}`;

    expect(skillMarkdown.split(/\r?\n/).length).toBeLessThanOrEqual(120);
    expect(skillMarkdown).toContain("skills/sdd-skill/scripts/run_helper.sh capabilities");
    expect(skillMarkdown).toContain("skills/sdd-skill/scripts/run_helper.sh contract");
    expect(skillMarkdown).toContain(
      "For helper commands whose contract reports a JSON request body through `--request`, pass a request file path by default. Use `--request -` only when the JSON is piped in the same shell command."
    );
    expect(skillMarkdown).toContain(
      "`scripts/run_helper.sh` relative to the installed skill directory"
    );
    expect(skillMarkdown).toContain("references/workflow.md");
    expect(skillMarkdown).toContain("references/change-set-recipes.md");
    expect(skillMarkdown).toContain("references/current-helper-gaps.md");
    expect(skillMarkdown).toContain("First choose one branch: create a new document; edit an existing document; read, validate, project, or render an existing document; diagnose helper failure; or use helper git commands.");
    expect(skillMarkdown).toContain("### Create New Document");
    expect(skillMarkdown).toContain("### Edit Existing Document");
    expect(skillMarkdown).toContain("### Read, Validate, Project, Or Render Existing Document");
    expect(skillMarkdown).toContain("### Diagnose Helper Failure");
    expect(skillMarkdown).toContain("### Use Helper Git Commands");
    expect(skillMarkdown).toContain("## Hard Stops");
    expect(skillMarkdown).toContain("Do not hand-edit `.sdd` structure when the helper supports the operation.");
    expect(skillMarkdown).toContain("Use request files by default for helper commands whose contract reports a JSON body through `--request`.");
    expect(skillMarkdown).toContain("Use `--request -` only when JSON is piped in the same shell command.");
    expect(skillMarkdown).toContain("Inspect before handle-based edits to existing documents.");
    expect(skillMarkdown).toContain("Use the `revision` returned by `create` for fresh-document bootstrap follow-on authoring.");
    expect(skillMarkdown).toContain("Dry-run mutations before commit.");
    expect(skillMarkdown).toContain("Do not render before clean committed validation and persisted-state assessment.");
    expect(skillMarkdown).toContain("Defer acceptance judgment to shared `assessment`.");
    expect(skillMarkdown).toContain("assessment.can_commit");
    expect(skillMarkdown).toContain("assessment.can_render");
    expect(skillMarkdown).toContain("assessment.should_stop");
    expect(skillMarkdown).toContain("assessment.next_action");
    expect(skillMarkdown).toContain("assessment.blocking_diagnostics");
    expect(skillMarkdown).toContain("Do not treat result `status` as the acceptance gate.");
    expect(skillMarkdown).toContain("If an expected `assessment` is missing from a relevant helper payload, stop and verify helper/contract surface instead of reimplementing acceptance logic in the skill.");

    expect(workflowMarkdown).toContain("In the repo source tree, use `skills/sdd-skill/scripts/run_helper.sh`;");
    expect(workflowMarkdown).toContain(
      "in an installed skill copy, the same wrapper is available as `scripts/run_helper.sh` relative to the installed skill folder."
    );
    expect(workflowMarkdown).toContain("skills/sdd-skill/scripts/run_helper.sh capabilities");
    expect(workflowMarkdown).toContain("skills/sdd-skill/scripts/run_helper.sh contract");
    expect(workflowMarkdown).toContain("--resolve bundle");
    expect(workflowMarkdown).toContain("capabilities -> contract -> code/docs only if still insufficient");
    expect(workflowMarkdown).toContain("## 3. Read Outcome Assessment");
    expect(workflowMarkdown).toContain("Use `status`, `summary`, `diagnostics`, and `projection_results` as supporting detail for review and explanation. Do not treat result `status` as the acceptance gate.");
    expect(workflowMarkdown).toContain("Review assessment first:");
    expect(workflowMarkdown).toContain("if `assessment.should_stop` is true, stop and follow `assessment.next_action`");
    expect(workflowMarkdown).toContain("if `assessment.blocking_diagnostics` is non-empty, report those diagnostics as the blocker");
    expect(workflowMarkdown).toContain("if `assessment.can_commit` is true and the user wants the real mutation, the request is commit-eligible");
    expect(workflowMarkdown).toContain("Read the returned assessment before proceeding. Use `assessment.can_render` as the render gate for persisted-state preview work.");
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
    expect(skillAndWorkflow).not.toMatch(/status alone|infer acceptance from status|dry run is acceptable.*status/is);
    expect(skillAndWorkflow).not.toContain("--view ia_place_map");
    expect(skillAndWorkflow).not.toContain("--profile strict");
    expect(skillAndWorkflow).not.toContain("CONTAINS");
    expect(skillAndWorkflow).not.toContain("COMPOSED_OF");
    expect(skillAndWorkflow).not.toContain("TRANSITIONS_TO");
    expect(skillAndWorkflow).not.toContain("Area -> Place");
    expect(skillAndWorkflow).not.toContain("Place -> ViewState");

    await expectExists(path.join(skillRoot, "scripts/run_helper.sh"));
    await expectExists(path.join(skillRoot, "references/workflow.md"));
    await expectExists(path.join(skillRoot, "references/change-set-recipes.md"));
    await expectExists(path.join(skillRoot, "references/current-helper-gaps.md"));
  });
});
