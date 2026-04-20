import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const helperMainPath = path.join(repoRoot, "dist/cli/helperMain.js");

async function runHelperEntrypoint(
  cwd: string,
  args: string[],
  options: { stdin?: string } = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [helperMainPath, ...args], {
      cwd
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (error) => {
      resolve({
        exitCode: 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: `${Buffer.concat(stderrChunks).toString("utf8")}${error.message}`
      });
    });
    child.on("close", (code) => {
      resolve({
        exitCode: typeof code === "number" ? code : 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8")
      });
    });

    child.stdin.end(options.stdin ?? "");
  });
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

function getTopLevelJsonKeyOrder(jsonText: string): string[] {
  return [...jsonText.matchAll(/^  "([^"]+)":/gm)].map((match) => match[1]);
}

function parseJsonPayload(result: { stdout: string }): Record<string, unknown> {
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function expectAssessment(
  payload: Record<string, unknown>,
  expected: Record<string, unknown>
): void {
  expect(payload.assessment).toMatchObject({
    kind: "sdd-authoring-outcome-assessment",
    ...expected
  });
}

function repoRelativePath(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

async function writeJsonRequest(tempDir: string, name: string, value: unknown): Promise<string> {
  const requestPath = path.join(tempDir, name);
  await writeFile(requestPath, JSON.stringify(value), "utf8");
  return requestPath;
}

function strictPlaceProps() {
  return [
    {
      key: "owner",
      value_kind: "bare_value",
      raw_value: "Design"
    },
    {
      key: "description",
      value_kind: "quoted_string",
      raw_value: "Billing place"
    },
    {
      key: "surface",
      value_kind: "bare_value",
      raw_value: "web"
    },
    {
      key: "route_or_key",
      value_kind: "bare_value",
      raw_value: "/billing"
    },
    {
      key: "access",
      value_kind: "bare_value",
      raw_value: "auth"
    }
  ];
}

describe("sdd-helper entrypoint integration", () => {
  it(
    "supports direct helper execution from nested repo directories for git-only and bundle-backed commands",
    async () => {
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

      const validate = await runHelperEntrypoint(nestedCwd, [
        "validate",
        documentPath,
        "--profile",
        "strict"
      ]);
      expect(validate.exitCode).toBe(0);
      expect(JSON.parse(validate.stdout)).toMatchObject({
        kind: "sdd-validation",
        path: documentPath,
        profile_id: "strict"
      });

      const project = await runHelperEntrypoint(nestedCwd, [
        "project",
        documentPath,
        "--view",
        "ia_place_map"
      ]);
      expect(project.exitCode).toBe(0);
      expect(JSON.parse(project.stdout)).toMatchObject({
        kind: "sdd-projection",
        path: documentPath,
        view_id: "ia_place_map"
      });
    },
    15000
  );

  it("returns static and bundle-resolved contract detail from nested repo directories", async () => {
    const nestedCwd = path.join(repoRoot, "src");

    const capabilities = await runHelperEntrypoint(nestedCwd, ["capabilities"]);
    expect(capabilities.exitCode).toBe(0);
    const capabilitiesPayload = parseJsonPayload(capabilities);
    expect(capabilitiesPayload).toMatchObject({
      kind: "sdd-helper-capabilities",
      commands: expect.arrayContaining([
        expect.objectContaining({
          name: "author",
          subject_id: "helper.command.author"
        }),
        expect.objectContaining({
          name: "preview",
          subject_id: "helper.command.preview"
        })
      ])
    });
    expect(JSON.stringify(capabilitiesPayload)).not.toContain("sdd-authoring-outcome-assessment");

    const authorContract = await runHelperEntrypoint(nestedCwd, ["contract", "helper.command.author"]);
    expect(authorContract.exitCode).toBe(0);
    expect(parseJsonPayload(authorContract)).toMatchObject({
      kind: "sdd-contract-subject-detail",
      subject: {
        subject_id: "helper.command.author"
      },
      output_shape: {
        schema: {
          properties: {
            assessment: {
              properties: {
                kind: {
                  enum: ["sdd-authoring-outcome-assessment"]
                },
                can_commit: {
                  type: "boolean"
                },
                can_render: {
                  type: "boolean"
                }
              }
            }
          }
        }
      }
    });

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

  it(
    "proves Gate 6 authoring assessment scenarios through the built helper entrypoint",
    async () => {
      await withRepoTempDir(async (tempDir) => {
      const documentAbsolutePath = path.join(tempDir, "gate6_authoring.sdd");
      const documentPath = repoRelativePath(documentAbsolutePath);

      const emptyStdin = await runHelperEntrypoint(
        repoRoot,
        ["author", "--request", "-"],
        { stdin: "" }
      );
      expect(emptyStdin.exitCode).toBe(1);
      const emptyStdinPayload = parseJsonPayload(emptyStdin);
      expect(emptyStdinPayload).toMatchObject({
        kind: "sdd-helper-error",
        code: "invalid_json",
        message: "Unexpected end of JSON input"
      });
      expectAssessment(emptyStdinPayload, {
        outcome: "blocked",
        layer: "transport",
        can_commit: false,
        can_render: false,
        should_stop: true
      });

      const malformedJsonPath = path.join(tempDir, "malformed.json");
      await writeFile(malformedJsonPath, "{", "utf8");
      const malformedJson = await runHelperEntrypoint(repoRoot, [
        "apply",
        "--request",
        malformedJsonPath
      ]);
      expect(malformedJson.exitCode).toBe(1);
      const malformedJsonPayload = parseJsonPayload(malformedJson);
      expect(malformedJsonPayload).toMatchObject({
        kind: "sdd-helper-error",
        code: "invalid_json"
      });
      expectAssessment(malformedJsonPayload, {
        outcome: "blocked",
        layer: "request_shape",
        can_commit: false,
        can_render: false,
        should_stop: true
      });

      const malformedShapePath = await writeJsonRequest(tempDir, "malformed-shape.json", {
        path: documentPath
      });
      const malformedShape = await runHelperEntrypoint(repoRoot, [
        "apply",
        "--request",
        malformedShapePath
      ]);
      expect(malformedShape.exitCode).toBe(1);
      const malformedShapePayload = parseJsonPayload(malformedShape);
      expect(malformedShapePayload).toMatchObject({
        kind: "sdd-helper-error",
        code: "invalid_args",
        message: expect.stringContaining("Request body does not match ApplyChangeSetArgs")
      });
      expectAssessment(malformedShapePayload, {
        outcome: "blocked",
        layer: "request_shape",
        can_commit: false,
        can_render: false,
        should_stop: true
      });

      const createResult = await runHelperEntrypoint(repoRoot, [
        "create",
        documentPath,
        "--version",
        "0.1"
      ]);
      expect(createResult.exitCode).toBe(0);
      const createPayload = parseJsonPayload(createResult);
      expect(createPayload).toMatchObject({
        kind: "sdd-create-document",
        path: documentPath,
        change_set: {
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              code: "parse.minimum_top_level_blocks"
            })
          ])
        }
      });
      expectAssessment(createPayload, {
        outcome: "review_required",
        layer: "success",
        can_commit: false,
        can_render: false,
        should_stop: false
      });
      expect((createPayload.assessment as { next_action?: string }).next_action).toContain(
        "Author initial content"
      );

      const createdRevision = createPayload.revision as string;
      const diagnosticDryRunPath = await writeJsonRequest(tempDir, "diagnostic-dry-run.json", {
        path: documentPath,
        base_revision: createdRevision,
        intents: [
          {
            kind: "insert_node_scaffold",
            local_id: "billing-place",
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-001",
              name: "Billing"
            }
          }
        ],
        validate_profile: "strict"
      });
      const diagnosticDryRun = await runHelperEntrypoint(repoRoot, [
        "author",
        "--request",
        diagnosticDryRunPath
      ]);
      expect(diagnosticDryRun.exitCode).toBe(0);
      const diagnosticDryRunPayload = parseJsonPayload(diagnosticDryRun);
      expect(diagnosticDryRunPayload).toMatchObject({
        kind: "sdd-authoring-intent-result",
        status: "applied",
        change_set: {
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              code: "validate.required_props_by_type",
              severity: "error"
            })
          ])
        }
      });
      expectAssessment(diagnosticDryRunPayload, {
        outcome: "blocked",
        layer: "candidate_diagnostics",
        can_commit: false,
        can_render: false,
        should_stop: true
      });

      const cleanAuthorRequest = {
        path: documentPath,
        base_revision: createdRevision,
        intents: [
          {
            kind: "insert_node_scaffold",
            local_id: "billing-place",
            placement: {
              mode: "last"
            },
            node: {
              node_type: "Place",
              node_id: "P-001",
              name: "Billing",
              props: strictPlaceProps()
            }
          }
        ],
        validate_profile: "strict",
        projection_views: ["ia_place_map"]
      };
      const cleanDryRunPath = await writeJsonRequest(tempDir, "clean-dry-run.json", cleanAuthorRequest);
      const cleanDryRun = await runHelperEntrypoint(repoRoot, [
        "author",
        "--request",
        cleanDryRunPath
      ]);
      expect(cleanDryRun.exitCode).toBe(0);
      const cleanDryRunPayload = parseJsonPayload(cleanDryRun);
      expect(cleanDryRunPayload).toMatchObject({
        kind: "sdd-authoring-intent-result",
        status: "applied",
        mode: "dry_run"
      });
      expectAssessment(cleanDryRunPayload, {
        outcome: "acceptable",
        layer: "success",
        can_commit: true,
        can_render: false,
        should_stop: false
      });

      const cleanCommitPath = await writeJsonRequest(tempDir, "clean-commit.json", {
        ...cleanAuthorRequest,
        mode: "commit"
      });
      const cleanCommit = await runHelperEntrypoint(repoRoot, [
        "author",
        "--request",
        cleanCommitPath
      ]);
      expect(cleanCommit.exitCode).toBe(0);
      const cleanCommitPayload = parseJsonPayload(cleanCommit);
      expect(cleanCommitPayload).toMatchObject({
        kind: "sdd-authoring-intent-result",
        status: "applied",
        mode: "commit"
      });
      expectAssessment(cleanCommitPayload, {
        outcome: "acceptable",
        layer: "success",
        can_commit: false,
        can_render: true,
        should_stop: false
      });

      const committedRevision = cleanCommitPayload.resulting_revision as string;
      const invalidHandlePath = await writeJsonRequest(tempDir, "invalid-handle.json", {
        path: documentPath,
        base_revision: committedRevision,
        operations: [
          {
            kind: "set_node_property",
            node_handle: "hdl_missing",
            key: "owner",
            value_kind: "bare_value",
            raw_value: "Research"
          }
        ]
      });
      const invalidHandle = await runHelperEntrypoint(repoRoot, [
        "apply",
        "--request",
        invalidHandlePath
      ]);
      expect(invalidHandle.exitCode).toBe(0);
      const invalidHandlePayload = parseJsonPayload(invalidHandle);
      expect(invalidHandlePayload).toMatchObject({
        kind: "sdd-change-set",
        status: "rejected",
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "sdd.invalid_handle",
            severity: "error"
          })
        ])
      });
      expectAssessment(invalidHandlePayload, {
        outcome: "blocked",
        layer: "domain_rejection",
        can_commit: false,
        can_render: false,
        should_stop: true
      });

      const validation = await runHelperEntrypoint(repoRoot, [
        "validate",
        documentPath,
        "--profile",
        "strict"
      ]);
      expect(validation.exitCode).toBe(0);
      const validationPayload = parseJsonPayload(validation);
      expect(validationPayload).toMatchObject({
        kind: "sdd-validation",
        report: {
          error_count: 0
        }
      });
      expectAssessment(validationPayload, {
        outcome: "acceptable",
        layer: "success",
        can_commit: false,
        can_render: true,
        should_stop: false
      });
      });
    },
    20000
  );

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
      const invalidPreviewPayload = parseJsonPayload(invalidPreview);
      expect(invalidPreviewPayload).toMatchObject({
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
      expectAssessment(invalidPreviewPayload, {
        outcome: "blocked",
        layer: "persisted_validation",
        can_commit: false,
        can_render: false,
        should_stop: true,
        blocking_diagnostics: expect.arrayContaining([
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
      const payload = parseJsonPayload(validPreview) as Record<string, unknown> & { artifact_path: string };
      expect(payload).toMatchObject({
        kind: "sdd-preview",
        path: documentPath,
        format: "svg",
        mime_type: "image/svg+xml",
        artifact_path: expect.stringContaining("/tmp/unique-previews/")
      });
      expectAssessment(payload, {
        outcome: "acceptable",
        layer: "success",
        can_commit: false,
        can_render: true,
        should_stop: false
      });
      await rm(path.dirname(payload.artifact_path), { recursive: true, force: true });
    });
  });

  it("returns unique materialized artifact paths for svg and png preview output", async () => {
    const documentPath = "bundle/v0.1/examples/outcome_to_ia_trace.sdd";
    const svgPreview = await runHelperEntrypoint(repoRoot, [
      "preview",
      documentPath,
      "--view",
      "ia_place_map",
      "--profile",
      "strict",
      "--format",
      "svg"
    ]);
    const secondSvgPreview = await runHelperEntrypoint(repoRoot, [
      "preview",
      documentPath,
      "--view",
      "ia_place_map",
      "--profile",
      "strict",
      "--format",
      "svg"
    ]);
    const pngPreview = await runHelperEntrypoint(repoRoot, [
      "preview",
      documentPath,
      "--view",
      "ia_place_map",
      "--profile",
      "strict",
      "--format",
      "png"
    ]);

    expect(svgPreview.exitCode).toBe(0);
    expect(secondSvgPreview.exitCode).toBe(0);
    expect(pngPreview.exitCode).toBe(0);
    expect(getTopLevelJsonKeyOrder(svgPreview.stdout)).toEqual([
      "kind",
      "path",
      "revision",
      "view_id",
      "profile_id",
      "backend_id",
      "format",
      "mime_type",
      "artifact_path",
      "notes",
      "diagnostics",
      "assessment"
    ]);

    const svgPayload = JSON.parse(svgPreview.stdout) as Record<string, unknown>;
    const secondSvgPayload = JSON.parse(secondSvgPreview.stdout) as Record<string, unknown>;
    const pngPayload = JSON.parse(pngPreview.stdout) as Record<string, unknown>;
    for (const payload of [svgPayload, secondSvgPayload, pngPayload]) {
      expect(payload).not.toHaveProperty("artifact");
      expect(payload).not.toHaveProperty("display_copy_path");
      expect((payload.artifact_path as string).startsWith("/tmp/unique-previews/")).toBe(true);
    }

    const svgPath = svgPayload.artifact_path as string;
    const secondSvgPath = secondSvgPayload.artifact_path as string;
    const pngPath = pngPayload.artifact_path as string;
    try {
      expect(path.basename(svgPath)).toBe("outcome_to_ia_trace.ia_place_map.strict.svg");
      expect(path.basename(secondSvgPath)).toBe("outcome_to_ia_trace.ia_place_map.strict.svg");
      expect(path.dirname(svgPath)).not.toBe(path.dirname(secondSvgPath));
      expect(svgPayload).toMatchObject({
        format: "svg",
        mime_type: "image/svg+xml"
      });
      expectAssessment(svgPayload, {
        outcome: "acceptable",
        layer: "success",
        can_commit: false,
        can_render: true,
        should_stop: false
      });
      expect(await readFile(svgPath, "utf8")).toContain("<svg");

      expect(path.basename(pngPath)).toBe("outcome_to_ia_trace.ia_place_map.strict.png");
      expect(pngPayload).toMatchObject({
        format: "png",
        mime_type: "image/png"
      });
      expectAssessment(pngPayload, {
        outcome: "acceptable",
        layer: "success",
        can_commit: false,
        can_render: true,
        should_stop: false
      });
      expect((await readFile(pngPath)).subarray(0, 4).toString("hex")).toBe("89504e47");
    } finally {
      await rm(path.dirname(svgPath), { recursive: true, force: true });
      await rm(path.dirname(secondSvgPath), { recursive: true, force: true });
      await rm(path.dirname(pngPath), { recursive: true, force: true });
    }
  });
});
