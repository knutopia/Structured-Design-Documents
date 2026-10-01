import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrapper = path.join(repoRoot, "skills/sdd-skill/scripts/run_helper.sh");
const main = path.join(repoRoot, "dist/cli/main.js");
const manifest = (version: string) => path.join(repoRoot, `bundle/v${version}/manifest.yaml`);

async function run(command: string, args: string[], cwd: string, configHome: string): Promise<{
  exitCode: number; stdout: string; stderr: string;
}> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, INIT_CWD: "", XDG_CONFIG_HOME: configHome, APPDATA: configHome, TMPDIR: "/tmp" }
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("error", (error) => resolve({ exitCode: 1, stdout: "", stderr: error.message }));
    child.on("close", (code) => resolve({
      exitCode: code ?? 1,
      stdout: Buffer.concat(out).toString("utf8"),
      stderr: Buffer.concat(err).toString("utf8")
    }));
  });
}

function payload(result: { stdout: string }): Record<string, unknown> {
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

async function withTempDirs(callback: (repoTemp: string, externalTemp: string) => Promise<void>): Promise<void> {
  const parent = path.join(repoRoot, "tests/.tmp");
  await mkdir(parent, { recursive: true });
  const repoTemp = await mkdtemp(path.join(parent, "skill-wrapper-"));
  const externalTemp = await mkdtemp(path.join(os.tmpdir(), "sdd-skill-installed-"));
  try {
    await callback(repoTemp, externalTemp);
  } finally {
    await rm(repoTemp, { recursive: true, force: true });
    await rm(externalTemp, { recursive: true, force: true });
  }
}

function relativeDocument(absolute: string): string {
  return path.relative(repoRoot, absolute).split(path.sep).join("/");
}

describe("sdd-skill helper wrapper", () => {
  it("preserves caller-relative manifests from root, nested, and installed-style locations", async () => {
    await withTempDirs(async (_repoTemp, externalTemp) => {
      const configHome = path.join(externalTemp, "config");
      const nested = path.join(repoRoot, "src");
      const installed = path.join(externalTemp, "scripts", "run_helper.sh");
      await mkdir(path.dirname(installed), { recursive: true });
      await copyFile(wrapper, installed);
      await chmod(installed, 0o755);
      for (const [wrapperPath, cwd, version] of [
        [wrapper, repoRoot, "0.1"],
        [wrapper, nested, "0.2"],
        [installed, nested, "0.2"]
      ]) {
        const result = await run(wrapperPath, [
          "--bundle", path.relative(cwd, manifest(version)),
          "contract", "helper.command.create", "--purpose", "request", "--resolve", "bundle"
        ], cwd, configHome);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(payload(result)).toMatchObject({
          resolution: { manifest_path: manifest(version), language_version: version },
          bindings: [expect.objectContaining({ resolved_values: [{ value: version }] })]
        });
        expect(result.stdout.trim().startsWith("{")).toBe(true);
      }
    });
  });

  for (const version of ["0.1", "0.2"] as const) {
    it(`completes a ${version} authoring and saved-render path through the wrapper`, async () => {
      await withTempDirs(async (repoTemp, externalTemp) => {
        const configHome = path.join(externalTemp, "config");
        const document = path.join(repoTemp, `wrapper-${version}.sdd`);
        const documentPath = relativeDocument(document);
        const execute = (args: string[]) => run(wrapper, ["--bundle", manifest(version), ...args], repoRoot, configHome);
        const contract = await execute(["contract", "helper.command.create", "--purpose", "request", "--resolve", "bundle"]);
        expect(contract.exitCode, contract.stdout).toBe(0);
        expect(payload(contract).resolution).toMatchObject({ manifest_path: manifest(version) });

        const created = await execute(["create", documentPath]);
        expect(created.exitCode, created.stdout).toBe(0);
        expect(await readFile(document, "utf8")).toBe(`SDD-TEXT ${version}\n`);
        const request = {
          path: documentPath,
          base_revision: payload(created).revision,
          intents: [{
            kind: "insert_node_scaffold",
            local_id: "billing",
            placement: { mode: "last" },
            node: {
              node_type: "Place", node_id: "P-001", name: "Billing",
              props: [
                { key: "owner", value_kind: "bare_value", raw_value: "Design" },
                { key: "description", value_kind: "quoted_string", raw_value: "Billing place" },
                { key: "surface", value_kind: "bare_value", raw_value: "web" },
                { key: "route_or_key", value_kind: "bare_value", raw_value: "/billing" },
                { key: "access", value_kind: "bare_value", raw_value: "auth" }
              ]
            }
          }],
          validate_profile: "strict",
          projection_views: ["ia_place_map"]
        };
        const requestFile = path.join(repoTemp, `request-${version}.json`);
        await writeFile(requestFile, JSON.stringify(request), "utf8");
        const dryRun = await execute(["author", "--request", requestFile]);
        expect(dryRun.exitCode, dryRun.stdout).toBe(0);
        expect(payload(dryRun).assessment).toMatchObject({ outcome: "acceptable", can_commit: true });
        await writeFile(requestFile, JSON.stringify({ ...request, mode: "commit" }), "utf8");
        const committed = await execute(["author", "--request", requestFile]);
        expect(committed.exitCode, committed.stdout).toBe(0);
        expect(payload(committed).assessment).toMatchObject({ outcome: "acceptable", can_render: true });
        const inspected = await execute(["inspect", documentPath]);
        expect(inspected.exitCode, inspected.stdout).toBe(0);
        expect(payload(inspected).effective_version).toBe(version);
        const validated = await execute(["validate", documentPath, "--profile", "strict"]);
        expect(validated.exitCode, validated.stdout).toBe(0);
        expect(payload(validated).assessment).toMatchObject({ outcome: "acceptable", can_render: true });
        const projected = await execute(["project", documentPath, "--view", "ia_place_map"]);
        expect(projected.exitCode, projected.stdout).toBe(0);
        expect(payload(projected).assessment).toMatchObject({ outcome: "acceptable" });
        const previewed = await execute(["preview", documentPath, "--view", "ia_place_map", "--profile", "strict", "--detail", "compact", "--format", "svg"]);
        expect(previewed.exitCode, previewed.stdout).toBe(0);
        expect(payload(previewed).assessment).toMatchObject({ outcome: "acceptable" });
        await rm(path.dirname(payload(previewed).artifact_path as string), { recursive: true, force: true });

        const outputPath = path.join(repoTemp, `saved-${version}.svg`);
        const shown = await run(process.execPath, [
          main, "show", documentPath,
          "--bundle", manifest(version),
          "--view", "ia_place_map", "--profile", "strict", "--detail", "compact",
          "--out", outputPath
        ], repoRoot, configHome);
        expect(shown.exitCode, shown.stderr).toBe(0);
        expect(await readFile(outputPath, "utf8")).toContain("<svg");
      });
    }, 60_000);
  }
});
