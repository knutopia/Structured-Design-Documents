import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { DefaultsConfigError, type DefaultsConfigRuntime, type DefaultsConfigV1 } from "../src/config/index.js";
import { runCli, type CliDeps } from "../src/cli/program.js";

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(path.resolve("bundle/v0.1/manifest.yaml"));
});

interface MemoryDefaultsOptions {
  global?: DefaultsConfigV1;
  project?: DefaultsConfigV1;
  projectRoot?: string | null;
}

function createMemoryDefaults(options: MemoryDefaultsOptions = {}): {
  runtime: DefaultsConfigRuntime;
  files: Map<string, DefaultsConfigV1>;
  read: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  unset: ReturnType<typeof vi.fn>;
} {
  const globalPath = "/user/config/sdd/config.yaml";
  const projectRoot = options.projectRoot === undefined ? "/repo" : options.projectRoot;
  const projectPath = projectRoot ? `${projectRoot}/sdd.config.yaml` : undefined;
  const files = new Map<string, DefaultsConfigV1>();
  if (options.global) files.set(globalPath, structuredClone(options.global));
  if (options.project && projectPath) files.set(projectPath, structuredClone(options.project));

  const read = vi.fn(async (filePath: string) => files.get(filePath));
  const set = vi.fn(async (filePath: string, setting: "validation_profile_id" | "render_detail_id", value: string) => {
    const existing = files.get(filePath) ?? { version: "1" as const, defaults: {} };
    const changed = existing.defaults[setting] !== value;
    if (changed) files.set(filePath, { version: "1", defaults: { ...existing.defaults, [setting]: value } });
    return { changed, path: filePath };
  });
  const unset = vi.fn(async (filePath: string, setting: "validation_profile_id" | "render_detail_id") => {
    const existing = files.get(filePath);
    if (!existing || existing.defaults[setting] === undefined) return { changed: false, path: filePath };
    const defaults = { ...existing.defaults };
    delete defaults[setting];
    if (Object.keys(defaults).length === 0) files.delete(filePath);
    else files.set(filePath, { version: "1", defaults });
    return { changed: true, path: filePath };
  });

  return {
    files,
    read,
    set,
    unset,
    runtime: {
      getGlobalConfigPath: () => globalPath,
      getProjectConfigPath: vi.fn(async () => projectPath ?? null),
      read,
      set,
      unset
    }
  };
}

function createCliDeps(defaultsConfig: DefaultsConfigRuntime): {
  deps: Partial<CliDeps>;
  stdout: string[];
  stderr: string[];
  validateGraph: ReturnType<typeof vi.fn>;
  renderSource: ReturnType<typeof vi.fn>;
  renderSourcePreview: ReturnType<typeof vi.fn>;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const validateGraph = vi.fn(() => ({ diagnostics: [], errorCount: 0, warningCount: 0 }));
  const renderSource = vi.fn((_input, _bundle, options) => ({
    viewId: options.viewId,
    format: options.format,
    profileId: options.profileId,
    text: options.format === "dot" ? "digraph G {}" : "flowchart TD",
    notes: [],
    diagnostics: []
  }));
  const renderSourcePreview = vi.fn(async (_input, loadedBundle, options) => ({
    view: loadedBundle.views.views.find((view) => view.id === options.viewId)!,
    capability: { textArtifacts: [], previewArtifacts: [], defaultPreviewFormat: "svg" as const },
    previewCapability: {
      format: options.format,
      backendId: options.backendId ?? "staged_ia_place_map_preview",
      backendClass: "staged" as const
    },
    artifact: { format: "svg" as const, text: "<svg/>" },
    notes: [],
    diagnostics: []
  }));

  return {
    stdout,
    stderr,
    validateGraph,
    renderSource,
    renderSourcePreview,
    deps: {
      cwd: () => "/repo/subdir",
      defaultsConfig,
      loadBundle: vi.fn(async () => bundle),
      readSourceInput: vi.fn(async () => ({ path: "/repo/example.sdd", text: "PLACE home" })),
      compileSource: vi.fn(() => ({
        diagnostics: [],
        graph: { schema: "sdd-text", version: "0.1", nodes: [], edges: [] }
      })),
      validateGraph,
      renderSource,
      renderSourcePreview,
      writeTextFile: vi.fn(async () => undefined),
      writeBinaryFile: vi.fn(async () => undefined),
      stdout: (content) => stdout.push(content),
      stderr: (content) => stderr.push(content)
    }
  };
}

const profileConsumers = [
  {
    name: "validate",
    argv: ["node", "sdd", "validate", "example.sdd"],
    selected: (context: ReturnType<typeof createCliDeps>) => context.validateGraph.mock.calls[0]?.[2]
  },
  {
    name: "render",
    argv: ["node", "sdd", "render", "example.sdd", "--view", "ia_place_map", "--format", "dot"],
    selected: (context: ReturnType<typeof createCliDeps>) => context.renderSource.mock.calls[0]?.[2].profileId
  },
  {
    name: "dot",
    argv: ["node", "sdd", "dot", "example.sdd"],
    selected: (context: ReturnType<typeof createCliDeps>) => context.renderSource.mock.calls[0]?.[2].profileId
  },
  {
    name: "mmd",
    argv: ["node", "sdd", "mmd", "example.sdd"],
    selected: (context: ReturnType<typeof createCliDeps>) => context.renderSource.mock.calls[0]?.[2].profileId
  },
  {
    name: "show",
    argv: ["node", "sdd", "show", "example.sdd", "--view", "ia_place_map", "--out", "/tmp/example.svg"],
    selected: (context: ReturnType<typeof createCliDeps>) => context.renderSourcePreview.mock.calls[0]?.[2].profileId
  }
] as const;

describe("persistent defaults CLI resolution", () => {
  it("applies bundle, global, project, and explicit profile sources to all five consumers", async () => {
    const sourceCases = [
      { name: "bundle", options: {}, expected: "simple", extra: [] },
      {
        name: "global",
        options: { global: { version: "1" as const, defaults: { validation_profile_id: "permissive" } } },
        expected: "permissive",
        extra: []
      },
      {
        name: "project",
        options: {
          global: { version: "1" as const, defaults: { validation_profile_id: "permissive" } },
          project: { version: "1" as const, defaults: { validation_profile_id: "strict" } }
        },
        expected: "strict",
        extra: []
      },
      {
        name: "explicit",
        options: {
          global: { version: "1" as const, defaults: { validation_profile_id: "permissive" } },
          project: { version: "1" as const, defaults: { validation_profile_id: "strict" } }
        },
        expected: "simple",
        extra: ["--profile", "simple"]
      }
    ];

    for (const consumer of profileConsumers) {
      for (const sourceCase of sourceCases) {
        const memory = createMemoryDefaults(sourceCase.options);
        const context = createCliDeps(memory.runtime);
        const result = await runCli([...consumer.argv, ...sourceCase.extra], context.deps);
        expect(result.exitCode, `${consumer.name}/${sourceCase.name}`).toBe(0);
        expect(consumer.selected(context), `${consumer.name}/${sourceCase.name}`).toBe(sourceCase.expected);
      }
    }
  });

  it("reports an invalid project profile without falling through to valid global configuration", async () => {
    const memory = createMemoryDefaults({
      global: { version: "1", defaults: { validation_profile_id: "permissive" } },
      project: { version: "1", defaults: { validation_profile_id: "unknown" } }
    });
    const context = createCliDeps(memory.runtime);
    const result = await runCli(["node", "sdd", "validate", "example.sdd"], context.deps);
    expect(result.exitCode).toBe(1);
    expect(context.validateGraph).not.toHaveBeenCalled();
    expect(context.stderr.join("")).toContain("Unknown value 'unknown'");
    expect(context.stderr.join("")).toContain("/repo/sdd.config.yaml");
    expect(context.stderr.join("")).toContain(bundle.manifestPath);
  });

  it("uses the same persistent profile in show rendering and automatic artifact naming", async () => {
    const memory = createMemoryDefaults({
      project: { version: "1", defaults: { validation_profile_id: "strict" } }
    });
    const context = createCliDeps(memory.runtime);
    const result = await runCli([
      "node", "sdd", "show", "example.sdd", "--view", "ia_place_map"
    ], context.deps);
    expect(result.exitCode).toBe(0);
    expect(context.renderSourcePreview.mock.calls[0]?.[2].profileId).toBe("strict");
    expect(vi.mocked(context.deps.writeTextFile!).mock.calls[0]?.[0]).toBe("/repo/example.ia_place_map.strict.svg");
  });

  it("fails profile consumers on malformed configuration but leaves compile and add configuration-free", async () => {
    const memory = createMemoryDefaults();
    memory.read.mockRejectedValue(new DefaultsConfigError("config.parse", "malformed injected configuration"));
    const validateContext = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "validate", "example.sdd"], validateContext.deps)).exitCode).toBe(1);
    expect(validateContext.stderr.join("")).toContain("malformed injected configuration");

    const compileContext = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "compile", "example.sdd"], compileContext.deps)).exitCode).toBe(0);

    memory.read.mockClear();
    const addContext = createCliDeps(memory.runtime);
    const rootFinder = vi.fn(async () => null);
    const addResult = await runCli(["node", "sdd", "add", "example.sdd"], {
      ...addContext.deps,
      findAuthoringRepoRoot: rootFinder
    });
    expect(addResult.exitCode).toBe(1);
    expect(memory.read).not.toHaveBeenCalled();
  });
});

describe("sdd defaults commands", () => {
  it("shows the effective bundle fallback and file-backed provenance deterministically", async () => {
    const bundleContext = createCliDeps(createMemoryDefaults({ projectRoot: null }).runtime);
    expect((await runCli(["node", "sdd", "defaults", "show"], bundleContext.deps)).exitCode).toBe(0);
    expect(bundleContext.stdout.join("")).toBe([
      `Bundle: ${bundle.manifestPath}`,
      "Profile: simple",
      "Profile source: bundle",
      "Bundle profile fallback: simple",
      ""
    ].join("\n"));

    const global = createMemoryDefaults({
      projectRoot: null,
      global: { version: "1", defaults: { validation_profile_id: "permissive" } }
    });
    const globalContext = createCliDeps(global.runtime);
    expect((await runCli(["node", "sdd", "defaults", "show"], globalContext.deps)).exitCode).toBe(0);
    expect(globalContext.stdout.join("")).toContain("Profile source: global\nProfile source path: /user/config/sdd/config.yaml");
  });

  it("sets, idempotently sets, inspects, and unsets a global profile", async () => {
    const memory = createMemoryDefaults({ projectRoot: null });
    const first = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "set", "profile", "strict", "--global"], first.deps)).exitCode).toBe(0);
    expect(memory.files.get("/user/config/sdd/config.yaml")?.defaults.validation_profile_id).toBe("strict");
    expect(memory.set).toHaveBeenCalledWith(
      "/user/config/sdd/config.yaml",
      "validation_profile_id",
      "strict",
      { createParent: true }
    );

    const second = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "set", "profile", "strict", "--global"], second.deps)).exitCode).toBe(0);
    expect(second.stdout.join("")).toContain("no changes made");

    const show = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "show", "--global"], show.deps)).exitCode).toBe(0);
    expect(show.stdout.join("")).toContain("Scope: global\nPath: /user/config/sdd/config.yaml");
    expect(show.stdout.join("")).toContain("Profile: strict\nProfile validity: valid");
    expect(show.stdout.join("")).toContain("Detail: unset\nDetail validity: not set");

    const unset = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "unset", "profile", "--global"], unset.deps)).exitCode).toBe(0);
    expect(memory.files.has("/user/config/sdd/config.yaml")).toBe(false);
  });

  it("sets and unsets a project profile without requesting global parent creation", async () => {
    const memory = createMemoryDefaults();
    const setContext = createCliDeps(memory.runtime);
    expect((await runCli([
      "node", "sdd", "defaults", "set", "profile", "permissive", "--project"
    ], setContext.deps)).exitCode).toBe(0);
    expect(memory.set).toHaveBeenCalledWith(
      "/repo/sdd.config.yaml",
      "validation_profile_id",
      "permissive",
      { createParent: false }
    );

    const unsetContext = createCliDeps(memory.runtime);
    expect((await runCli([
      "node", "sdd", "defaults", "unset", "profile", "--project"
    ], unsetContext.deps)).exitCode).toBe(0);
    expect(memory.files.has("/repo/sdd.config.yaml")).toBe(false);
  });

  it("rejects an unknown profile before mutating configuration", async () => {
    const memory = createMemoryDefaults();
    const context = createCliDeps(memory.runtime);
    expect((await runCli([
      "node", "sdd", "defaults", "set", "profile", "unknown", "--global"
    ], context.deps)).exitCode).toBe(1);
    expect(context.stderr.join("")).toContain("Available values: simple, permissive, strict");
    expect(memory.set).not.toHaveBeenCalled();
  });

  it("rejects unavailable detail writes while allowing detail removal without loading a bundle", async () => {
    const memory = createMemoryDefaults({
      global: { version: "1", defaults: { render_detail_id: "compact" } }
    });
    const setContext = createCliDeps(memory.runtime);
    expect((await runCli([
      "node", "sdd", "defaults", "set", "detail", "compact", "--global"
    ], setContext.deps)).exitCode).toBe(1);
    expect(setContext.stderr.join("")).toContain("declares no render-detail values");
    expect(memory.set).not.toHaveBeenCalled();

    const showContext = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "show", "--global"], showContext.deps)).exitCode).toBe(1);
    expect(showContext.stdout.join("")).toContain("Detail: compact");
    expect(showContext.stdout.join("")).toContain("Detail validity: unavailable");

    const unsetContext = createCliDeps(memory.runtime);
    const loadBundleMock = vi.fn(async () => bundle);
    expect((await runCli(["node", "sdd", "defaults", "unset", "detail", "--global"], {
      ...unsetContext.deps,
      loadBundle: loadBundleMock
    })).exitCode).toBe(0);
    expect(loadBundleMock).not.toHaveBeenCalled();
  });

  it("returns usage failures for invalid scopes and operational failures without a project root", async () => {
    const memory = createMemoryDefaults({ projectRoot: null });
    for (const argv of [
      ["node", "sdd", "defaults", "set", "profile", "simple"],
      ["node", "sdd", "defaults", "unset", "profile"],
      ["node", "sdd", "defaults", "show", "--global", "--project"]
    ]) {
      const context = createCliDeps(memory.runtime);
      expect((await runCli(argv, context.deps)).exitCode).toBe(2);
      expect(context.stderr.join("")).toContain("exactly one defaults scope");
    }

    for (const argv of [
      ["node", "sdd", "defaults", "show", "--project"],
      ["node", "sdd", "defaults", "set", "profile", "simple", "--project"],
      ["node", "sdd", "defaults", "unset", "profile", "--project"]
    ]) {
      const context = createCliDeps(memory.runtime);
      expect((await runCli(argv, context.deps)).exitCode).toBe(1);
      expect(context.stderr.join("")).toContain("no SDD project root");
    }
  });

  it("reports schema-valid unknown stored values in scoped show", async () => {
    const memory = createMemoryDefaults({
      global: { version: "1", defaults: { validation_profile_id: "unknown" } }
    });
    const context = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "show", "--global"], context.deps)).exitCode).toBe(1);
    expect(context.stdout.join("")).toContain("Profile: unknown\nProfile validity: invalid");
    expect(context.stdout.join("")).toContain("simple, permissive, strict");
  });
});
