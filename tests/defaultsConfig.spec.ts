import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import { computeBundleFingerprint } from "../src/bundle/fingerprint.js";
import { renderSource } from "../src/renderer/renderView.js";
import {
  createDefaultsConfigRuntime,
  DefaultsConfigError,
  getGlobalDefaultsConfigPath,
  getProjectDefaultsConfigPath,
  loadDefaultsSources,
  nodeDefaultsConfigFileSystem,
  parseDefaultsConfig,
  readDefaultsConfig,
  resolveDefault,
  serializeDefaultsConfig,
  setStoredDefault,
  unsetStoredDefault,
  type DefaultsConfigFileSystem,
  type LoadedDefaultsSources
} from "../src/config/index.js";

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sdd-defaults-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function enoent(): NodeJS.ErrnoException {
  return Object.assign(new Error("missing"), { code: "ENOENT" });
}

describe("defaults configuration schema", () => {
  it("accepts complete, partial, and version-only files and serializes deterministically", () => {
    expect(parseDefaultsConfig('version: "1"\n', "/config.yaml")).toEqual({ version: "1", defaults: {} });
    expect(parseDefaultsConfig('version: "1"\ndefaults:\n  validation_profile_id: simple\n', "/config.yaml")).toEqual({
      version: "1",
      defaults: { validation_profile_id: "simple" }
    });
    const parsed = parseDefaultsConfig(
      'version: "1"\ndefaults:\n  render_detail_id: compact\n  validation_profile_id: strict\n',
      "/config.yaml"
    );
    expect(serializeDefaultsConfig(parsed)).toBe(
      'version: "1"\ndefaults:\n  validation_profile_id: strict\n  render_detail_id: compact\n'
    );
  });

  it.each([
    ["empty document", "", "config.parse"],
    ["multiple documents", 'version: "1"\n---\nversion: "1"\n', "config.parse"],
    ["non-object root", "- version\n", "config.shape"],
    ["missing version", "defaults: {}\n", "config.version"],
    ["numeric version", "version: 1\n", "config.version"],
    ["unsupported version", 'version: "2"\n', "config.version"],
    ["unknown root key", 'version: "1"\nextra: true\n', "config.unknown_key"],
    ["non-object defaults", 'version: "1"\ndefaults: []\n', "config.shape"],
    ["unknown defaults key", 'version: "1"\ndefaults:\n  profile: simple\n', "config.unknown_key"],
    ["non-string id", 'version: "1"\ndefaults:\n  validation_profile_id: 1\n', "config.invalid_id"],
    ["empty id", 'version: "1"\ndefaults:\n  validation_profile_id: "  "\n', "config.invalid_id"],
    ["duplicate root key", 'version: "1"\nversion: "1"\n', "config.parse"],
    ["duplicate setting", 'version: "1"\ndefaults:\n  validation_profile_id: simple\n  validation_profile_id: strict\n', "config.parse"]
  ])("rejects %s", (_label, text, code) => {
    try {
      parseDefaultsConfig(text, "/config.yaml");
      throw new Error("Expected parsing to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DefaultsConfigError);
      expect((error as DefaultsConfigError).code).toBe(code);
    }
  });

  it("treats only ENOENT as normal absence", async () => {
    const missingFs: DefaultsConfigFileSystem = {
      ...nodeDefaultsConfigFileSystem,
      readText: vi.fn(async () => { throw enoent(); })
    };
    await expect(readDefaultsConfig("/missing.yaml", missingFs)).resolves.toBeUndefined();

    const unreadableFs: DefaultsConfigFileSystem = {
      ...nodeDefaultsConfigFileSystem,
      readText: vi.fn(async () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); })
    };
    await expect(readDefaultsConfig("/denied.yaml", unreadableFs)).rejects.toMatchObject({ code: "config.read" });
  });
});

describe("defaults configuration paths", () => {
  it("resolves Linux XDG and home fallbacks", () => {
    expect(getGlobalDefaultsConfigPath({
      platform: "linux",
      env: { XDG_CONFIG_HOME: "/xdg" },
      homedir: () => "/home/test"
    })).toBe("/xdg/sdd/config.yaml");
    expect(getGlobalDefaultsConfigPath({
      platform: "linux",
      env: {},
      homedir: () => "/home/test"
    })).toBe("/home/test/.config/sdd/config.yaml");
  });

  it("resolves macOS and Windows native paths and rejects missing APPDATA", () => {
    expect(getGlobalDefaultsConfigPath({
      platform: "darwin",
      env: {},
      homedir: () => "/Users/test"
    })).toBe("/Users/test/Library/Application Support/sdd/config.yaml");
    expect(getGlobalDefaultsConfigPath({
      platform: "win32",
      env: { APPDATA: "C:\\Users\\test\\AppData\\Roaming" },
      homedir: () => "C:\\Users\\test"
    })).toBe("C:\\Users\\test\\AppData\\Roaming\\sdd\\config.yaml");
    expect(() => getGlobalDefaultsConfigPath({
      platform: "win32",
      env: {},
      homedir: () => "C:\\Users\\test"
    })).toThrow("APPDATA");
  });

  it("uses only the discovered repository root for project configuration", async () => {
    const finder = vi.fn(async () => "/repo/nearest");
    await expect(getProjectDefaultsConfigPath("/repo/nearest/deep", finder)).resolves.toBe("/repo/nearest/sdd.config.yaml");
    expect(finder).toHaveBeenCalledWith("/repo/nearest/deep");
    await expect(getProjectDefaultsConfigPath("/outside", async () => null)).resolves.toBeNull();
  });
});

describe("defaults precedence and provenance", () => {
  const baseSources: LoadedDefaultsSources = {
    globalPath: "/user/config.yaml",
    global: {
      path: "/user/config.yaml",
      config: { version: "1", defaults: { validation_profile_id: "permissive", render_detail_id: "compact" } }
    },
    projectPath: "/repo/sdd.config.yaml",
    project: {
      path: "/repo/sdd.config.yaml",
      config: { version: "1", defaults: { validation_profile_id: "strict" } }
    }
  };

  function resolve(sources: LoadedDefaultsSources, explicitValue?: string, bundleValue = "simple") {
    return resolveDefault({
      setting: "validation_profile_id",
      explicitValue,
      sources,
      bundleValue,
      availableValues: ["simple", "permissive", "strict"],
      bundlePath: "/bundle/manifest.yaml"
    });
  }

  it("resolves CLI, project, global, and bundle independently with provenance", () => {
    expect(resolve(baseSources, "simple")).toEqual({ value: "simple", source: "cli" });
    expect(resolve(baseSources)).toEqual({ value: "strict", source: "project", sourcePath: "/repo/sdd.config.yaml" });
    expect(resolve({ globalPath: baseSources.globalPath, global: baseSources.global })).toEqual({
      value: "permissive", source: "global", sourcePath: "/user/config.yaml"
    });
    expect(resolve({ globalPath: "/user/config.yaml" })).toEqual({ value: "simple", source: "bundle" });
    expect(baseSources.global?.config.defaults.render_detail_id).toBe("compact");
  });

  it("rejects an invalid value at every source and never falls through", () => {
    expect(() => resolve(baseSources, "unknown")).toThrow(/cli source/);
    const invalidProject: LoadedDefaultsSources = {
      ...baseSources,
      project: {
        path: "/repo/sdd.config.yaml",
        config: { version: "1", defaults: { validation_profile_id: "unknown" } }
      }
    };
    expect(() => resolve(invalidProject)).toThrow(/project configuration '\/repo\/sdd.config.yaml'/);
    expect(() => resolve({
      globalPath: "/user/config.yaml",
      global: {
        path: "/user/config.yaml",
        config: { version: "1", defaults: { validation_profile_id: "unknown" } }
      }
    })).toThrow(/global configuration '\/user\/config.yaml'/);
    expect(() => resolve({ globalPath: "/user/config.yaml" }, undefined, "unknown")).toThrow(/bundle source/);
  });

  it("loads only injected paths and file access", async () => {
    const reads: string[] = [];
    const runtime = createDefaultsConfigRuntime({
      platform: "linux",
      env: { XDG_CONFIG_HOME: "/isolated" },
      homedir: () => "/unused",
      findRepoRoot: async () => "/repo",
      fileSystem: {
        ...nodeDefaultsConfigFileSystem,
        readText: async (filePath) => {
          reads.push(filePath);
          throw enoent();
        }
      }
    });
    await expect(loadDefaultsSources(runtime, "/repo/subdir")).resolves.toMatchObject({
      globalPath: "/isolated/sdd/config.yaml",
      projectPath: "/repo/sdd.config.yaml"
    });
    expect(reads.sort()).toEqual(["/isolated/sdd/config.yaml", "/repo/sdd.config.yaml"]);
  });
});

describe("defaults configuration mutation", () => {
  it("sets, preserves, idempotently sets, unsets, and removes an empty file", async () => {
    await withTempDirectory(async (directory) => {
      const configPath = path.join(directory, "nested", "config.yaml");
      const first = await setStoredDefault(configPath, "render_detail_id", "compact", { createParent: true });
      expect(first.changed).toBe(true);
      await setStoredDefault(configPath, "validation_profile_id", "simple");
      expect(await readFile(configPath, "utf8")).toBe(
        'version: "1"\ndefaults:\n  validation_profile_id: simple\n  render_detail_id: compact\n'
      );

      const writeSpy = vi.fn(nodeDefaultsConfigFileSystem.writeTextExclusive);
      const idempotent = await setStoredDefault(configPath, "validation_profile_id", "simple", {
        fileSystem: { ...nodeDefaultsConfigFileSystem, writeTextExclusive: writeSpy }
      });
      expect(idempotent.changed).toBe(false);
      expect(writeSpy).not.toHaveBeenCalled();

      await unsetStoredDefault(configPath, "validation_profile_id");
      expect(parseDefaultsConfig(await readFile(configPath, "utf8"), configPath).defaults).toEqual({ render_detail_id: "compact" });
      await unsetStoredDefault(configPath, "render_detail_id");
      await expect(readFile(configPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      await expect(unsetStoredDefault(configPath, "render_detail_id")).resolves.toMatchObject({ changed: false });
    });
  });

  it("keeps the original file and cleans the sibling temporary file when rename fails", async () => {
    await withTempDirectory(async (directory) => {
      const configPath = path.join(directory, "config.yaml");
      const original = 'version: "1"\ndefaults:\n  validation_profile_id: simple\n';
      await writeFile(configPath, original, "utf8");
      const failingFs: DefaultsConfigFileSystem = {
        ...nodeDefaultsConfigFileSystem,
        renameFile: vi.fn(async () => { throw new Error("rename failed"); })
      };
      await expect(setStoredDefault(configPath, "validation_profile_id", "strict", {
        fileSystem: failingFs,
        temporarySuffix: () => "failure"
      })).rejects.toMatchObject({ code: "config.write" });
      expect(await readFile(configPath, "utf8")).toBe(original);
      expect(await readdir(directory)).toEqual(["config.yaml"]);
    });
  });

  it("cleans a sibling temporary file left by a failed write", async () => {
    await withTempDirectory(async (directory) => {
      const configPath = path.join(directory, "config.yaml");
      const failingFs: DefaultsConfigFileSystem = {
        ...nodeDefaultsConfigFileSystem,
        writeTextExclusive: async (filePath, content) => {
          await writeFile(filePath, content, "utf8");
          throw new Error("partial write failed");
        }
      };
      await expect(setStoredDefault(configPath, "validation_profile_id", "simple", {
        fileSystem: failingFs,
        temporarySuffix: () => "partial"
      })).rejects.toMatchObject({ code: "config.write" });
      expect(await readdir(directory)).toEqual([]);
    });
  });

  it("does not remove an existing sibling when exclusive temporary creation detects a collision", async () => {
    await withTempDirectory(async (directory) => {
      const configPath = path.join(directory, "config.yaml");
      const temporaryPath = path.join(directory, ".config.yaml.collision.tmp");
      await writeFile(temporaryPath, "belongs to another writer", "utf8");
      await expect(setStoredDefault(configPath, "validation_profile_id", "simple", {
        temporarySuffix: () => "collision"
      })).rejects.toMatchObject({ code: "config.write" });
      expect(await readFile(temporaryPath, "utf8")).toBe("belongs to another writer");
    });
  });

  it("does not include global or project configuration in bundle fingerprints", async () => {
    await withTempDirectory(async (directory) => {
      const bundle = await loadBundle(path.resolve("bundle/v0.1/manifest.yaml"));
      const before = computeBundleFingerprint(bundle);
      await setStoredDefault(path.join(directory, "sdd.config.yaml"), "validation_profile_id", "strict");
      expect(computeBundleFingerprint(bundle)).toBe(before);
    });
  });

  it("leaves direct library rendering configuration-independent", async () => {
    await withTempDirectory(async (directory) => {
      await setStoredDefault(path.join(directory, "sdd.config.yaml"), "validation_profile_id", "strict");
      const bundle = await loadBundle(path.resolve("bundle/v0.1/manifest.yaml"));
      const sourcePath = path.resolve("bundle/v0.1/examples/outcome_to_ia_trace.sdd");
      const result = renderSource({ path: sourcePath, text: await readFile(sourcePath, "utf8") }, bundle, {
        viewId: "ia_place_map",
        format: "dot"
      });
      expect(result.profileId).toBe("simple");
    });
  });
});
