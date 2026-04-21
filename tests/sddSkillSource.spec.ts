import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createHelperCapabilities } from "../src/cli/helperDiscovery.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = path.join(repoRoot, "skills/sdd-skill");
const helperReadmePath = path.join(repoRoot, "docs/readme_support_docs/sdd-helper/README.md");

async function expectExists(targetPath: string): Promise<void> {
  await expect(access(targetPath)).resolves.toBeUndefined();
}

function extractSupportedHelperCommands(markdown: string): string[] {
  const start = markdown.indexOf("The current helper exposes:");
  expect(start).toBeGreaterThanOrEqual(0);
  const listBlock = markdown.slice(start).split("\n\n")[1] ?? "";
  return Array.from(listBlock.matchAll(/^- `([^`]+)`$/gm), (match) => match[1]);
}

function extractHelperReadmeCommandNames(markdown: string): string[] {
  return Array.from(
    new Set(Array.from(markdown.matchAll(/^#### `sdd-helper ([^`\s]+)/gm), (match) => match[1]))
  );
}

type SkillSourceMarkdown = {
  skillMarkdown: string;
  workflowMarkdown: string;
  recipeMarkdown: string;
  helperGapsMarkdown: string;
};

async function readSkillSourceMarkdown(): Promise<SkillSourceMarkdown> {
  const [skillMarkdown, workflowMarkdown, recipeMarkdown, helperGapsMarkdown] =
    await Promise.all([
      readFile(path.join(skillRoot, "SKILL.md"), "utf8"),
      readFile(path.join(skillRoot, "references/workflow.md"), "utf8"),
      readFile(path.join(skillRoot, "references/change-set-recipes.md"), "utf8"),
      readFile(path.join(skillRoot, "references/current-helper-gaps.md"), "utf8"),
    ]);

  return { skillMarkdown, workflowMarkdown, recipeMarkdown, helperGapsMarkdown };
}

function extractMarkdownSection(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === heading);
  expect(startIndex).toBeGreaterThanOrEqual(0);

  const level = heading.match(/^#+/)?.[0].length;
  expect(level).toBeGreaterThan(0);

  const terminator = new RegExp(`^#{1,${level}}\\s+`);
  const endIndex = lines.findIndex(
    (line, index) => index > startIndex && terminator.test(line)
  );

  return lines.slice(startIndex + 1, endIndex === -1 ? undefined : endIndex).join("\n");
}

function expectNoLegacyGenericFallback(markdown: string): void {
  expect(markdown).not.toMatch(/capabilities\s*(?:->|=>|then)\s*contract\s*(?:->|=>|then)\s*(?:code|docs)/i);
  expect(markdown).not.toMatch(/code\/docs only if still insufficient/i);
  expect(markdown).not.toMatch(/only if still insufficient/i);
}

describe("canonical sdd-skill source", () => {
  it("contains the expected repo-tracked skill files", async () => {
    await expectExists(path.join(skillRoot, "SKILL.md"));
    await expectExists(path.join(skillRoot, "references/workflow.md"));
    await expectExists(path.join(skillRoot, "references/change-set-recipes.md"));
    await expectExists(path.join(skillRoot, "references/current-helper-gaps.md"));
    await expectExists(path.join(skillRoot, "scripts/run_helper.sh"));
  });

  it("keeps the helper gap inventory aligned with helper capabilities", async () => {
    const helperGapsMarkdown = await readFile(
      path.join(skillRoot, "references/current-helper-gaps.md"),
      "utf8"
    );
    const documentedCommands = extractSupportedHelperCommands(helperGapsMarkdown);
    const capabilityCommands = createHelperCapabilities().commands.map((command) => command.name);

    expect(documentedCommands).toEqual(capabilityCommands);
    expect(helperGapsMarkdown).toContain(
      "`capabilities` and `contract` are introspection commands"
    );
  });

  it("keeps the helper README aligned with helper authority routing", async () => {
    const helperReadme = await readFile(helperReadmePath, "utf8");
    const documentedCommands = extractHelperReadmeCommandNames(helperReadme).sort();
    const capabilityCommands = createHelperCapabilities().commands.map((command) => command.name).sort();

    expect(documentedCommands).toEqual(capabilityCommands);
    expect(helperReadme).toContain("`sdd-helper` is the JSON-first companion CLI");
    expect(helperReadme).toContain("Successful commands write exactly one JSON payload to `stdout`.");
    expect(helperReadme).toContain("`capabilities` is helper command discovery and remains static");
    expect(helperReadme).toContain("`contract` is deep helper contract detail");
    expect(helperReadme).toContain(
      "`contract --resolve bundle` expands active bundle-owned `view_id` and `profile_id` values"
    );
    expect(helperReadme).toContain("Helper mechanics are not SDD language authority");
    expect(helperReadme).toContain("Use `bundle/v0.1/` files for SDD language semantics");
    expect(helperReadme).toContain("Use docs to explain a surface or investigate a mismatch.");
    expect(helperReadme).toContain(
      "Use implementation code for implementation debugging, not normal helper request-shape recovery."
    );
    expect(helperReadme).toContain("For request-loading commands, request files remain the safest default.");
    expect(helperReadme).toContain("Domain rejections are structured helper success payloads");
    expect(helperReadme).toContain("Helper errors are `sdd-helper-error` payloads");
    expect(helperReadme).toContain("Diagnostics are structured evidence");
    expect(helperReadme).toContain("Persisted validation reads the on-disk document state");
    expect(helperReadme).toContain("Projection reads the on-disk document state");
    expect(helperReadme).toContain("Render failures happen in preview generation or materialization");
    expect(helperReadme).toContain(
      "Use `assessment.layer`, `assessment.should_stop`, `assessment.next_action`, and `assessment.blocking_diagnostics`"
    );
    expect(helperReadme).toContain(
      "Helper `preview` artifact paths are transient helper output and are not saved artifacts."
    );
    expect(helperReadme).toContain("TMPDIR=/tmp pnpm sdd show <document_path> --view <view_id> --profile <profile_id>");
    expect(helperReadme).toContain(
      "Use helper discovery for helper mechanics, bundle files for SDD language, docs for explanation or mismatch investigation, and implementation code for implementation debugging."
    );
    expect(helperReadme).not.toContain("capabilities -> contract -> code/docs only if still insufficient");
  });

  it("locks the top-level authority selectors", async () => {
    const { skillMarkdown } = await readSkillSourceMarkdown();
    const startHere = extractMarkdownSection(skillMarkdown, "## Start Here");

    expect(startHere).toContain("Helper discovery is the helper-command authority");
    expect(startHere).toContain("skills/sdd-skill/scripts/run_helper.sh capabilities");
    expect(startHere).toContain("which helper commands exist");
    expect(startHere).toContain("Helper contract detail is the helper request/result authority");
    expect(startHere).toContain("skills/sdd-skill/scripts/run_helper.sh contract <subject_id>");
    expect(startHere).toContain("exact request shape, result shape, continuation semantics");
    expect(startHere).toContain(
      "SDD language semantics come from `bundle/v0.1/manifest.yaml` plus the active core bundle files"
    );
    expect(startHere).toContain("bundle/v0.1/core/syntax.yaml");
    expect(startHere).toContain("bundle/v0.1/core/vocab.yaml");
    expect(startHere).toContain("bundle/v0.1/core/contracts.yaml");
    expect(startHere).toContain("bundle/v0.1/core/views.yaml");
    expect(startHere).toContain(
      "Shared `assessment` answers whether to stop, continue, commit, or render."
    );
    expectNoLegacyGenericFallback(startHere);
  });

  it("keeps authoring targeted instead of too ceremonial or too thin", async () => {
    const { skillMarkdown, workflowMarkdown } = await readSkillSourceMarkdown();
    const bundleSection = extractMarkdownSection(
      workflowMarkdown,
      "## 3. Targeted Bundle Reading And Language Authority"
    );
    const createSection = extractMarkdownSection(workflowMarkdown, "## 5. Create A New Document");
    const readSection = extractMarkdownSection(
      workflowMarkdown,
      "## 7. Read, Validate, Project, Or Render An Existing Document"
    );
    const mutationSection = extractMarkdownSection(
      workflowMarkdown,
      "## 8. Dry-Run A Helper Mutation"
    );

    expect(bundleSection).toContain(
      "Use helper `capabilities` and helper `contract` for helper mechanics"
    );
    expect(bundleSection).toContain("Use the active bundle files for SDD language semantics");
    expect(bundleSection).toContain("loads bundle data with `loadBundle(...)`");
    expect(bundleSection).toContain("consumes syntax through `createParserSyntaxRuntime(bundle)`");
    expect(bundleSection).toContain("not a normal authoring fallback for helper request shapes");
    expect(bundleSection).toContain("Do not turn this into a broad preflight for every task.");
    expect(bundleSection).toContain("Read only the bundle files that answer the current semantic question");
    expect(bundleSection).toContain("read `bundle/v0.1/manifest.yaml` first for fresh authoring");
    expect(bundleSection).toContain("read `bundle/v0.1/core/syntax.yaml`");
    expect(bundleSection).toContain("read `bundle/v0.1/core/vocab.yaml`");
    expect(bundleSection).toContain("read `bundle/v0.1/core/contracts.yaml`");
    expect(bundleSection).toContain("read `bundle/v0.1/core/views.yaml`");
    expect(createSection).toContain("For new-document authoring, do not use `search`");
    expect(createSection).toContain("Immediate `inspect` is not the normal next step after `create`");
    expect(createSection).toContain("Use the `revision` returned by `create`");
    expect(createSection).toContain("determine whether the intended result requires a bundle-defined relationship");
    expect(skillMarkdown).toContain('Do not let "nesting is not semantic" become "avoid nesting".');
    expect(skillMarkdown).toContain("prefer both the explicit semantic edge and nested source placement under the parent for readability");
    expect(skillMarkdown).toContain("Keep child nodes top-level only when nesting would mislead, such as reuse, multiple semantic parents, cross-cutting placement, or unclear ownership.");
    expect(workflowMarkdown).toContain("use `author` nested `children` by default for first-pass scaffold creation when a child has one clear local parent");
    expect(workflowMarkdown).toContain("Readable source pass:");
    expect(workflowMarkdown).toContain("choose node and edge semantics from bundle authority");
    expect(workflowMarkdown).toContain("author explicit semantic edges");
    expect(workflowMarkdown).toContain("nest singly-owned children under the local parent for readability");
    expect(workflowMarkdown).toContain("keep top-level placement when reuse, multiple semantic parents, cross-cutting placement, or misleading nesting makes local nesting inappropriate");
    expect(workflowMarkdown).toContain("nested source layout by itself is not semantic proof");
    expect(readSection).toContain(
      "If the document is already named and the user only needs a read, validation, projection, or preview result, do not `search`."
    );
    expect(readSection).toContain(
      "Use persisted-state semantic reads when you want confirmation without issuing a mutation request"
    );
    expect(mutationSection).toContain(
      "If the mutation depends on SDD language semantics, read the targeted bundle files in section 3"
    );
  });

  it("preserves request-file defaults and assessment gates", async () => {
    const { skillMarkdown, workflowMarkdown } = await readSkillSourceMarkdown();
    const hardStops = extractMarkdownSection(skillMarkdown, "## Hard Stops");
    const assessmentSection = extractMarkdownSection(workflowMarkdown, "## 4. Read Outcome Assessment");
    const failureSection = extractMarkdownSection(workflowMarkdown, "## 14. Diagnose Helper Failure");

    expect(hardStops).toContain(
      "Use request files by default for helper commands whose contract reports a JSON body through `--request`."
    );
    expect(hardStops).toContain("Use `--request -` only when JSON is piped in the same shell command.");
    expect(failureSection).toContain("For request-loading commands, request files remain the safest default.");
    expect(failureSection).toContain(
      "Use `--request -` only when the JSON body is piped in the same shell command"
    );
    expect(assessmentSection).toContain("`assessment.should_stop`");
    expect(assessmentSection).toContain("`assessment.can_commit`");
    expect(assessmentSection).toContain("`assessment.can_render`");
    expect(assessmentSection).toContain("Do not treat result `status` as the acceptance gate.");
    expect(`${skillMarkdown}\n${workflowMarkdown}`).not.toMatch(
      /status alone|infer acceptance from status|dry run is acceptable.*status/is
    );
  });

  it("makes diagram requests produce durable files by default and keeps helper preview transient", async () => {
    const { skillMarkdown, workflowMarkdown } = await readSkillSourceMarkdown();
    const renderBranch = extractMarkdownSection(
      skillMarkdown,
      "### Read, Validate, Project, Or Render Existing Document"
    );
    const previewSection = extractMarkdownSection(workflowMarkdown, "## 12. Produce A Diagram Artifact");

    expect(renderBranch).toContain("For create, make, generate, render, draw, show, display, or view diagram requests, produce a saved file artifact by default.");
    expect(renderBranch).toContain("Use `sdd show` for saved user-facing diagram artifacts.");
    expect(renderBranch).toContain("Use helper `preview` only for transient helper output");
    expect(renderBranch).toContain("If no output path is specified, save beside the `.sdd`; do not invent a new output directory.");
    expect(`${skillMarkdown}\n${workflowMarkdown}`).toContain("Do not finish a diagram/render request with only helper `preview` output unless the user explicitly requested preview-only or inline-only output.");
    expect(previewSection).toContain('General requests such as "create a diagram", "make a diagram", "generate a diagram", "render it", "draw it", "show it", "display it", or "view it" produce a saved user-facing diagram artifact by default.');
    expect(previewSection).toContain("A helper preview is a display aid; it is not the deliverable unless the user explicitly asks for preview-only, inline-only, or transient helper output.");
    expect(previewSection).toContain("Use `sdd show` after the last committed persisted-state assessment has `assessment.can_render` set to true:");
    expect(previewSection).toContain("TMPDIR=/tmp pnpm sdd show <document_path>");
    expect(previewSection).toContain("If the user did not request a specific output path, let `sdd show` write beside the `.sdd`");
    expect(previewSection).toContain("Do not create a new output directory unless the user explicitly named that directory in the requested output path.");
    expect(previewSection).toContain("If the current workflow already has a matching helper `preview` `artifact_path` and the user asks to save the diagram, copy that artifact to the durable output path instead of rerendering.");
    expect(previewSection).toContain("A preview matches only when it came from the same document, committed revision, view, profile, format, and backend in the same workflow context.");
    expect(previewSection).toContain("If matching metadata is unavailable, use `sdd show` instead of copying.");
    expect(previewSection).toContain("run `sdd show`");
    expect(previewSection).toContain("link the saved sibling artifact");
    expect(previewSection).toContain("Do not present `artifact_path` as the real saved artifact.");
    expect(previewSection).toContain("Use helper preview alone only when the user explicitly asks for preview-only, inline-only, transient raw artifact output");
    expect(previewSection).toContain(
      "Treat the returned `artifact_path` as a temp presentation/workflow path only"
    );
  });

  it("rejects prompt-specific rules, examples-as-authority, and bundle-owned value drift", async () => {
    const { skillMarkdown, workflowMarkdown, recipeMarkdown, helperGapsMarkdown } =
      await readSkillSourceMarkdown();
    const allSkillDocs = [
      skillMarkdown,
      workflowMarkdown,
      recipeMarkdown,
      helperGapsMarkdown,
    ].join("\n");
    const normativeSkillDocs = [skillMarkdown, workflowMarkdown, helperGapsMarkdown].join("\n");

    expect(allSkillDocs).not.toMatch(/show the information architecture|show the place map/i);
    expect(workflowMarkdown).toContain("Examples, snapshots, and goldens are downstream evidence only.");
    expect(workflowMarkdown).toContain("Do not inspect `.sdd` examples to infer language rules");
    expect(allSkillDocs).not.toMatch(
      /\b(?:examples|snapshots|goldens)\s+(?:are|remain)\s+(?:the\s+)?(?:language\s+)?(?:authority|authoritative|source of truth|normative)/i
    );
    expect(normativeSkillDocs).not.toContain("--view ia_place_map");
    expect(normativeSkillDocs).not.toContain("--profile strict");
    expect(normativeSkillDocs).not.toContain("CONTAINS");
    expect(normativeSkillDocs).not.toContain("COMPOSED_OF");
    expect(normativeSkillDocs).not.toContain("TRANSITIONS_TO");
    expect(normativeSkillDocs).not.toMatch(/\b[A-Z][A-Za-z]+ -> [A-Z][A-Za-z]+\b/);
    expect(normativeSkillDocs).not.toMatch(/\^\[A-Z]\{1,3}/);
    expect(recipeMarkdown).toContain("illustrative placeholders");
    expect(recipeMarkdown).toContain("choose real SDD language values from the active bundle files");
    expect(recipeMarkdown).not.toMatch(
      /(?:valid|supported)\s+(?:relationships|profiles|views)\s+are|must use `?(?:CONTAINS|COMPOSED_OF|ia_place_map|strict)/i
    );
    expectNoLegacyGenericFallback(allSkillDocs);
  });

  it("references only companion skill files that exist in the repo skill tree", async () => {
    const skillMarkdown = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
    const workflowMarkdown = await readFile(
      path.join(skillRoot, "references/workflow.md"),
      "utf8"
    );
    const recipeMarkdown = await readFile(
      path.join(skillRoot, "references/change-set-recipes.md"),
      "utf8"
    );
    const skillAndWorkflow = `${skillMarkdown}\n${workflowMarkdown}`;

    expect(skillMarkdown.split(/\r?\n/).length).toBeLessThanOrEqual(120);
    expect(skillMarkdown).toContain("Helper discovery is the helper-command authority");
    expect(skillMarkdown).toContain("skills/sdd-skill/scripts/run_helper.sh capabilities");
    expect(skillMarkdown).toContain(
      "Helper contract detail is the helper request/result authority"
    );
    expect(skillMarkdown).toContain("skills/sdd-skill/scripts/run_helper.sh contract");
    expect(skillMarkdown).toContain(
      "exact request shape, result shape, continuation semantics, helper constraints"
    );
    expect(skillMarkdown).toContain(
      "SDD language semantics come from `bundle/v0.1/manifest.yaml` plus the active core bundle files"
    );
    expect(skillMarkdown).toContain(
      "Determine any needed bundle-defined relationship from the active bundle files"
    );
    expect(skillMarkdown).not.toContain("relationship through helper contract");
    expect(skillMarkdown).not.toContain("helper contract/bundle-backed surfaces");
    expect(skillMarkdown).toContain("bundle/v0.1/core/syntax.yaml");
    expect(skillMarkdown).toContain("bundle/v0.1/core/vocab.yaml");
    expect(skillMarkdown).toContain("bundle/v0.1/core/contracts.yaml");
    expect(skillMarkdown).toContain("bundle/v0.1/core/views.yaml");
    expect(skillMarkdown).toContain(
      "Shared `assessment` answers whether to stop, continue, commit, or render."
    );
    expect(skillMarkdown).toContain("Use docs to explain a surface or investigate a mismatch.");
    expect(skillMarkdown).toContain(
      "Use implementation code for implementation debugging, not normal helper request-shape recovery."
    );
    expect(skillMarkdown).not.toContain(
      "capabilities -> contract -> code/docs only if still insufficient"
    );
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
    expect(workflowMarkdown).toContain("## 3. Targeted Bundle Reading And Language Authority");
    expect(workflowMarkdown).toContain(
      "Use helper `capabilities` and helper `contract` for helper mechanics"
    );
    expect(workflowMarkdown).toContain("Use the active bundle files for SDD language semantics");
    expect(workflowMarkdown).toContain("loads bundle data with `loadBundle(...)`");
    expect(workflowMarkdown).toContain(
      "consumes syntax through `createParserSyntaxRuntime(bundle)`"
    );
    expect(workflowMarkdown).toContain(
      "not a normal authoring fallback for helper request shapes"
    );
    expect(workflowMarkdown).toContain(
      "read `bundle/v0.1/manifest.yaml` first for fresh authoring"
    );
    expect(workflowMarkdown).toContain(
      "read `bundle/v0.1/core/syntax.yaml` for node IDs, node headers, edge lines, property lines, nesting, and source syntax"
    );
    expect(workflowMarkdown).toContain(
      "read `bundle/v0.1/core/vocab.yaml` for node and relationship token selection"
    );
    expect(workflowMarkdown).toContain(
      "read `bundle/v0.1/core/contracts.yaml` for relationship endpoint validity"
    );
    expect(workflowMarkdown).toContain(
      "read `bundle/v0.1/core/views.yaml` for projection scope, hierarchy edges, ordering edges, view-specific annotations, and rendered-view behavior"
    );
    expect(workflowMarkdown).toContain(
      "read profile files only when profile behavior is needed beyond profile IDs exposed by helper contract resolution"
    );
    expect(workflowMarkdown).toContain(
      "Prompt words are input language. Bundle vocabulary and contracts decide SDD language."
    );
    expect(workflowMarkdown).toContain("Nesting alone does not establish graph semantics.");
    expect(workflowMarkdown).toContain(
      "Projection checks and rendered views are checks and presentation boundaries; they do not replace graph authoring targets."
    );
    expect(workflowMarkdown).toContain("Examples, snapshots, and goldens are downstream evidence only.");
    expect(workflowMarkdown).toContain("Do not inspect `.sdd` examples to infer language rules");
    expect(workflowMarkdown).toContain(
      "`contract --resolve bundle` expands active helper-exposed values such as `view_id` and `profile_id`"
    );
    expect(workflowMarkdown).toContain("It does not replace the bundle files as the general authority");
    expect(workflowMarkdown).not.toContain(
      "capabilities -> contract -> code/docs only if still insufficient"
    );
    expect(workflowMarkdown).not.toContain("authoritative bundle/spec material");
    expect(recipeMarkdown).toContain("workflow guidance only for helper operation shape");
    expect(recipeMarkdown).toContain("illustrative placeholders");
    expect(recipeMarkdown).toContain("choose real SDD language values from the active bundle files");
    expect(workflowMarkdown).toContain("## 4. Read Outcome Assessment");
    expect(workflowMarkdown).toContain("Use `status`, `summary`, `diagnostics`, and `projection_results` as supporting detail for review and explanation. Do not treat result `status` as the acceptance gate.");
    expect(workflowMarkdown).toContain("Review assessment first:");
    expect(workflowMarkdown).toContain("if `assessment.should_stop` is true, stop and follow `assessment.next_action`");
    expect(workflowMarkdown).toContain("if `assessment.blocking_diagnostics` is non-empty, report those diagnostics as the blocker");
    expect(workflowMarkdown).toContain("if `assessment.can_commit` is true and the user wants the real mutation, the request is commit-eligible");
    expect(workflowMarkdown).toContain("Read the returned assessment before proceeding. Use `assessment.can_render` as the render gate for persisted-state diagram artifact work.");
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
      "copy that artifact to the durable output path instead of rerendering"
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
