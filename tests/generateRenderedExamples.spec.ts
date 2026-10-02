import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import type { BundleManifest } from "../src/bundle/types.js";
import { resolveRenderedCorpusManifestPaths } from "../src/examples/renderedCorpus.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generator = path.join(repoRoot, "dist/examples/generateRenderedExamples.js");
const run = promisify(execFile);

async function withTempDirectory(callback: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "sdd-rendered-generator-"));
  try {
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("rendered corpus manifest selection", () => {
  it("discovers every manifest in stable directory order without a version allowlist", async () => {
    await withTempDirectory(async (root) => {
      for (const name of ["v0.2", "future-bundle", "v0.1"]) {
        await mkdir(path.join(root, "bundle", name), { recursive: true });
        await writeFile(path.join(root, "bundle", name, "manifest.yaml"), "", "utf8");
      }
      await mkdir(path.join(root, "bundle", "assets"));
      await mkdir(path.join(root, "bundle", "not-a-manifest", "manifest.yaml"), { recursive: true });
      await writeFile(path.join(root, "bundle", "README.md"), "", "utf8");

      expect(await resolveRenderedCorpusManifestPaths(undefined, root)).toEqual([
        "future-bundle", "v0.1", "v0.2"
      ].map((name) => path.join(root, "bundle", name, "manifest.yaml")));
    });
  });

  it("selects only an explicit caller-relative or absolute manifest without scanning bundles", async () => {
    await withTempDirectory(async (root) => {
      const manifestPath = path.join(root, "custom", "manifest.yaml");
      expect(await resolveRenderedCorpusManifestPaths("custom/manifest.yaml", root)).toEqual([manifestPath]);
      expect(await resolveRenderedCorpusManifestPaths(manifestPath, root)).toEqual([manifestPath]);
    });
  });

  it("reports an empty discovery instead of silently generating nothing", async () => {
    await withTempDirectory(async (root) => {
      await mkdir(path.join(root, "bundle"));
      await expect(resolveRenderedCorpusManifestPaths(undefined, root)).rejects.toThrow(
        `No bundle manifests found under ${path.join(root, "bundle")}.`
      );
    });
  });
});

describe("rendered corpus generator entrypoint", () => {
  it("generates both bundles by default and refreshes only the explicit bundle when supplied", async () => {
    await withTempDirectory(async (root) => {
      for (const version of ["0.1", "0.2"]) {
        const bundleRoot = path.join(root, "bundle", `v${version}`);
        await cp(path.join(repoRoot, "bundle", `v${version}`), bundleRoot, { recursive: true });
        const manifestPath = path.join(bundleRoot, "manifest.yaml");
        const manifest = YAML.parse(await readFile(manifestPath, "utf8")) as BundleManifest;
        // Keep one real projection per bundle so the test runs the full render path quickly.
        manifest.examples = manifest.examples.filter((example) => example.path === "examples/outcome_to_ia_trace.sdd");
        manifest.examples[0].projection_snapshots = ["snapshots/outcome_to_ia_trace.ia_place_map.projection.json"];
        await writeFile(manifestPath, YAML.stringify(manifest), "utf8");
      }

      const env = { ...process.env, TMPDIR: "/tmp" };
      await run(process.execPath, [generator], { cwd: root, env, timeout: 60_000 });
      for (const version of ["0.1", "0.2"]) {
        const exampleDir = path.join(root, "examples", "rendered", `v${version}`,
          "ia_place_map_diagram_type", "outcome_to_ia_trace_example");
        const canonicalSource = await readFile(path.join(root, "bundle", `v${version}`, "examples/outcome_to_ia_trace.sdd"), "utf8");
        expect(await readFile(path.join(exampleDir, "outcome_to_ia_trace.sdd"), "utf8")).toBe(canonicalSource);
        const manifest = YAML.parse(await readFile(path.join(root, "bundle", `v${version}`, "manifest.yaml"), "utf8")) as BundleManifest;
        for (const detail of manifest.render_details) {
          const stem = path.join(exampleDir, `${detail.id}_detail`, "outcome_to_ia_trace.ia_place_map");
          expect(await readFile(`${stem}.svg`, "utf8")).toContain('class="staged-svg');
          expect((await readFile(`${stem}.png`)).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        }
      }

      const preservedPath = path.join(root, "examples/rendered/v0.1/preserve.txt");
      await writeFile(preservedPath, "leave this corpus alone\n", "utf8");
      await writeFile(path.join(root, "bundle/v0.1/manifest.yaml"), "invalid manifest\n", "utf8");
      const sourcePath = path.join(root, "bundle/v0.2/examples/outcome_to_ia_trace.sdd");
      const updatedSource = `${await readFile(sourcePath, "utf8")}\n# Corpus refresh proof\n`;
      await writeFile(sourcePath, updatedSource, "utf8");

      await run(process.execPath, [generator, "bundle/v0.2/manifest.yaml"], {
        cwd: root, env, timeout: 60_000
      });
      expect(await readFile(preservedPath, "utf8")).toBe("leave this corpus alone\n");
      const copiedPath = path.join(root, "examples/rendered/v0.2/ia_place_map_diagram_type/outcome_to_ia_trace_example/outcome_to_ia_trace.sdd");
      expect(await readFile(copiedPath, "utf8")).toBe(updatedSource);
    });
  }, 120_000);
});
