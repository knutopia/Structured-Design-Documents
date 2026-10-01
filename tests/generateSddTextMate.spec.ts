import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_BUNDLE_VERSION } from "../src/cli/bundleResolution.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generator = path.join(repoRoot, "dist/highlighting/generateSddTextMate.js");
const manifest = (version: string) => path.join(repoRoot, `bundle/v${version}/manifest.yaml`);

async function run(command: string, args: string[], cwd: string, configHome: string): Promise<{
  exitCode: number; stdout: string; stderr: string;
}> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, INIT_CWD: "", XDG_CONFIG_HOME: configHome, APPDATA: configHome, TMPDIR: "/tmp" }
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => resolve({ exitCode: 1, stdout: "", stderr: error.message }));
    child.on("close", (code) => resolve({
      exitCode: code ?? 1,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
  });
}

async function outputs(root: string): Promise<[string, string]> {
  return [
    await readFile(path.join(root, "syntaxes/sdd.tmLanguage.json"), "utf8"),
    await readFile(path.join(root, "language-configuration.json"), "utf8")
  ];
}

async function withTempDirectory(callback: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "sdd-textmate-"));
  try {
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("TextMate generator entrypoint", () => {
  it("loads either explicit bundle and resolves caller-relative paths from a nested directory", async () => {
    await withTempDirectory(async (root) => {
      const nestedCwd = path.join(repoRoot, "src");
      for (const version of ["0.1", "0.2"]) {
        const outDir = path.join(root, version);
        const result = await run(process.execPath, [
          generator,
          "--bundle", path.relative(nestedCwd, manifest(version)),
          "--out-dir", path.relative(nestedCwd, outDir)
        ], nestedCwd, path.join(root, "config"));
        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain(`Bundle manifest: ${manifest(version)}`);
        const [grammar, configuration] = await outputs(outDir);
        expect(grammar.endsWith("\n")).toBe(true);
        expect(configuration.endsWith("\n")).toBe(true);
        expect(grammar).not.toContain("\r");
      }
    });
  });

  it("leaves existing output untouched when bundle loading fails", async () => {
    await withTempDirectory(async (root) => {
      const outDir = path.join(root, "existing");
      await mkdir(path.join(outDir, "syntaxes"), { recursive: true });
      await writeFile(path.join(outDir, "syntaxes/sdd.tmLanguage.json"), "old grammar\n", "utf8");
      await writeFile(path.join(outDir, "language-configuration.json"), "old config\n", "utf8");
      const result = await run(process.execPath, [
        generator, "--bundle", path.join(root, "missing.yaml"), "--out-dir", outDir
      ], repoRoot, path.join(root, "config"));
      expect(result.exitCode).not.toBe(0);
      expect(await outputs(outDir)).toEqual(["old grammar\n", "old config\n"]);
    });
  });

  it("produces the repository default independently of saved personal preferences", async () => {
    await withTempDirectory(async (root) => {
      const results: Array<[string, string]> = [];
      for (const version of ["0.1", "0.2"]) {
        const configHome = path.join(root, `config-${version}`);
        await mkdir(path.join(configHome, "sdd"), { recursive: true });
        await writeFile(path.join(configHome, "sdd/config.yaml"), `version: "1"\ndefaults:\n  bundle_version: "${version}"\n`, "utf8");
        const outDir = path.join(root, `default-${version}`);
        const result = await run(process.execPath, [generator, "--out-dir", outDir], repoRoot, configHome);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain(`Bundle manifest: ${manifest(DEFAULT_BUNDLE_VERSION)}`);
        results.push(await outputs(outDir));
      }
      expect(results[0]).toEqual(results[1]);
    });
  });

  it("forwards flags through the pnpm script", async () => {
    await withTempDirectory(async (root) => {
      const outDir = path.join(root, "script-output");
      const result = await run("pnpm", [
        "run", "generate:textmate",
        "--bundle", "bundle/v0.1/manifest.yaml",
        "--out-dir", outDir
      ], repoRoot, path.join(root, "config"));
      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain(`Bundle manifest: ${manifest("0.1")}`);
      expect((await outputs(outDir))[0]).toContain("source.sdd");
    });
  }, 60_000);
});
