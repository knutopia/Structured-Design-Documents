import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const helperMainPath = path.join(repoRoot, "dist/cli/helperMain.js");

async function runHelperEntrypoint(
  cwd: string,
  args: string[]
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const result = await execFile(process.execPath, [helperMainPath, ...args], {
      cwd,
      encoding: "utf8"
    });
    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | string;
    };
    return {
      exitCode: typeof execError.code === "number" ? execError.code : 1,
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? ""
    };
  }
}

async function withRepoTempDir(run: (tempDir: string) => Promise<void>): Promise<void> {
  const tempRootParent = path.join(repoRoot, "tests/.tmp");
  await mkdir(tempRootParent, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRootParent, "helper-cli-"));
  try {
    await run(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

describe("sdd-helper entrypoint integration", () => {
  it("supports direct helper execution from nested repo directories for git-only and bundle-backed commands", async () => {
    const nestedCwd = path.join(repoRoot, "src");
    const documentPath = "bundle/v0.1/examples/outcome_to_ia_trace.sdd";

    const gitStatus = await runHelperEntrypoint(nestedCwd, ["git-status", documentPath]);
    expect(gitStatus.exitCode).toBe(0);
    expect(JSON.parse(gitStatus.stdout)).toMatchObject({
      kind: "sdd-git-status",
      paths: expect.arrayContaining([documentPath])
    });

    const inspect = await runHelperEntrypoint(nestedCwd, ["inspect", documentPath]);
    expect(inspect.exitCode).toBe(0);
    expect(JSON.parse(inspect.stdout)).toMatchObject({
      kind: "sdd-document-inspect",
      path: documentPath
    });

    const validate = await runHelperEntrypoint(nestedCwd, ["validate", documentPath, "--profile", "strict"]);
    expect(validate.exitCode).toBe(0);
    expect(JSON.parse(validate.stdout)).toMatchObject({
      kind: "sdd-validation",
      path: documentPath,
      profile_id: "strict"
    });

    const project = await runHelperEntrypoint(nestedCwd, ["project", documentPath, "--view", "ia_place_map"]);
    expect(project.exitCode).toBe(0);
    expect(JSON.parse(project.stdout)).toMatchObject({
      kind: "sdd-projection",
      path: documentPath,
      view_id: "ia_place_map"
    });
  });

  it("returns static and bundle-resolved contract detail from nested repo directories", async () => {
    const nestedCwd = path.join(repoRoot, "src");

    const staticContract = await runHelperEntrypoint(nestedCwd, ["contract", "helper.command.preview"]);
    expect(staticContract.exitCode).toBe(0);
    expect(JSON.parse(staticContract.stdout)).toMatchObject({
      kind: "sdd-contract-subject-detail",
      subject: {
        subject_id: "helper.command.preview"
      },
      resolution: {
        mode: "static",
        unresolved_binding_ids: [
          "shared.binding.render_preview.view_id",
          "shared.binding.render_preview.profile_id"
        ]
      }
    });

    const resolvedContract = await runHelperEntrypoint(nestedCwd, [
      "contract",
      "helper.command.preview",
      "--resolve",
      "bundle"
    ]);
    expect(resolvedContract.exitCode).toBe(0);
    expect(JSON.parse(resolvedContract.stdout)).toMatchObject({
      kind: "sdd-contract-subject-detail",
      subject: {
        subject_id: "helper.command.preview"
      },
      resolution: {
        mode: "bundle_resolved",
        bundle_name: "sdd-text-spec-bundle",
        bundle_version: "0.1"
      },
      bindings: expect.arrayContaining([
        expect.objectContaining({
          binding_id: "shared.binding.render_preview.view_id",
          resolved_values: expect.arrayContaining([
            expect.objectContaining({
              value: "ia_place_map"
            })
          ])
        }),
        expect.objectContaining({
          binding_id: "shared.binding.render_preview.profile_id",
          resolved_values: expect.arrayContaining([
            expect.objectContaining({
              value: "strict"
            })
          ])
        })
      ])
    });
  });

  it("reports specific preview diagnostics for invalid intermediate documents and succeeds once the document is valid", async () => {
    await withRepoTempDir(async (tempDir) => {
      const documentAbsolutePath = path.join(tempDir, "preview_incomplete.sdd");
      const documentPath = path.relative(repoRoot, documentAbsolutePath).split(path.sep).join("/");

      await writeFile(
        documentAbsolutePath,
        ["SDD-TEXT 0.1", "", "Place P-001 \"Billing\"", "END", ""].join("\n"),
        "utf8"
      );

      const invalidPreview = await runHelperEntrypoint(repoRoot, [
        "preview",
        documentPath,
        "--view",
        "ia_place_map",
        "--profile",
        "strict",
        "--format",
        "svg"
      ]);

      expect(invalidPreview.exitCode).toBe(1);
      expect(JSON.parse(invalidPreview.stdout)).toMatchObject({
        kind: "sdd-helper-error",
        code: "runtime_error",
        message: expect.stringContaining("Preview validate failure"),
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "validate.required_props_by_type",
            severity: "error"
          })
        ])
      });

      await writeFile(
        documentAbsolutePath,
        [
          "SDD-TEXT 0.1",
          "",
          "Place P-001 \"Billing\"",
          "  owner=Design",
          "  description=\"Billing place\"",
          "  surface=web",
          "  route_or_key=/billing",
          "  access=auth",
          "END",
          ""
        ].join("\n"),
        "utf8"
      );

      const validPreview = await runHelperEntrypoint(repoRoot, [
        "preview",
        documentPath,
        "--view",
        "ia_place_map",
        "--profile",
        "strict",
        "--format",
        "svg"
      ]);

      expect(validPreview.exitCode).toBe(0);
      expect(JSON.parse(validPreview.stdout)).toMatchObject({
        kind: "sdd-preview",
        path: documentPath,
        artifact: {
          format: "svg"
        }
      });
    });
  });
});
