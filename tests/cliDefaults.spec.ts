import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import {
  DefaultsConfigError,
  type DefaultsConfigRuntime,
  type DefaultsConfigSetting,
  type DefaultsConfigV1
} from "../src/config/index.js";
import { runCli, type CliDeps } from "../src/cli/program.js";

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(path.resolve("bundle/v0.1/manifest.yaml"));
});

interface MemoryDefaultsOptions {
  global?: DefaultsConfigV1;
}

function createMemoryDefaults(options: MemoryDefaultsOptions = {}): {
  runtime: DefaultsConfigRuntime;
  files: Map<string, DefaultsConfigV1>;
  read: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  unset: ReturnType<typeof vi.fn>;
} {
  const globalPath = "/user/config/sdd/config.yaml";
  const files = new Map<string, DefaultsConfigV1>();
  if (options.global) files.set(globalPath, structuredClone(options.global));

  const read = vi.fn(async (filePath: string) => files.get(filePath));
  const set = vi.fn(async (filePath: string, setting: DefaultsConfigSetting, value: string) => {
    const existing = files.get(filePath) ?? { version: "1" as const, defaults: {} };
    const changed = existing.defaults[setting] !== value;
    if (changed) files.set(filePath, { version: "1", defaults: { ...existing.defaults, [setting]: value } });
    return { changed, path: filePath };
  });
  const unset = vi.fn(async (filePath: string, setting: DefaultsConfigSetting) => {
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
      read,
      set,
      unset
    }
  };
}

function createCliDeps(defaultsConfig: DefaultsConfigRuntime, cwd = "/repo/subdir"): {
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
    detailId: options.detailId,
    text: options.format === "dot" ? "digraph G {}" : "flowchart TD",
    notes: [],
    diagnostics: []
  }));
  const renderSourcePreview = vi.fn(async (_input, loadedBundle, options) => ({
    profileId: options.profileId,
    detailId: options.detailId,
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
      cwd: () => cwd,
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

const detailConsumers = profileConsumers.filter((consumer) => consumer.name !== "validate");

describe("persistent defaults CLI resolution", () => {
  it("resolves the independent happy-path profile/detail matrix", async () => {
    const cases = [
      { name: "bundle fallbacks", options: {}, extra: [], expectedProfile: "simple", expectedDetail: "compact" },
      {
        name: "global profile only",
        options: { global: { version: "1" as const, defaults: { validation_profile_id: "permissive" } } },
        extra: [],
        expectedProfile: "permissive",
        expectedDetail: "compact"
      },
      {
        name: "global detail only",
        options: { global: { version: "1" as const, defaults: { render_detail_id: "detailed" } } },
        extra: [],
        expectedProfile: "simple",
        expectedDetail: "detailed"
      },
      {
        name: "full global configuration",
        options: {
          global: {
            version: "1" as const,
            defaults: { validation_profile_id: "strict", render_detail_id: "detailed" }
          }
        },
        extra: [],
        expectedProfile: "strict",
        expectedDetail: "detailed"
      },
      {
        name: "CLI profile only",
        options: {
          global: {
            version: "1" as const,
            defaults: { validation_profile_id: "strict", render_detail_id: "detailed" }
          }
        },
        extra: ["--profile", "permissive"],
        expectedProfile: "permissive",
        expectedDetail: "detailed"
      },
      {
        name: "CLI detail only",
        options: {
          global: {
            version: "1" as const,
            defaults: { validation_profile_id: "strict", render_detail_id: "compact" }
          }
        },
        extra: ["--detail", "detailed"],
        expectedProfile: "strict",
        expectedDetail: "detailed"
      },
      {
        name: "both CLI flags",
        options: {
          global: {
            version: "1" as const,
            defaults: { validation_profile_id: "strict", render_detail_id: "compact" }
          }
        },
        extra: ["--profile", "permissive", "--detail", "detailed"],
        expectedProfile: "permissive",
        expectedDetail: "detailed"
      }
    ];

    for (const matrixCase of cases) {
      const context = createCliDeps(createMemoryDefaults(matrixCase.options).runtime);
      const result = await runCli([
        "node", "sdd", "show", "example.sdd", "--view", "ia_place_map", "--out", "/tmp/example.svg",
        ...matrixCase.extra
      ], context.deps);
      expect(result.exitCode, matrixCase.name).toBe(0);
      expect(context.renderSourcePreview.mock.calls[0]?.[2]).toMatchObject({
        profileId: matrixCase.expectedProfile,
        detailId: matrixCase.expectedDetail
      });
    }
  });

  it("applies bundle, global, and explicit profile sources to all five consumers", async () => {
    const sourceCases = [
      { name: "bundle", options: {}, expected: "simple", extra: [] },
      {
        name: "global",
        options: { global: { version: "1" as const, defaults: { validation_profile_id: "permissive" } } },
        expected: "permissive",
        extra: []
      },
      {
        name: "explicit",
        options: { global: { version: "1" as const, defaults: { validation_profile_id: "permissive" } } },
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

  it("applies bundle, global, and explicit detail sources to all four rendering consumers", async () => {
    const sourceCases = [
      { name: "bundle", options: {}, expected: "compact", extra: [] },
      {
        name: "global",
        options: { global: { version: "1" as const, defaults: { render_detail_id: "detailed" } } },
        expected: "detailed",
        extra: []
      },
      {
        name: "explicit",
        options: { global: { version: "1" as const, defaults: { render_detail_id: "compact" } } },
        expected: "detailed",
        extra: ["--detail", "detailed"]
      }
    ];

    for (const consumer of detailConsumers) {
      for (const sourceCase of sourceCases) {
        const memory = createMemoryDefaults(sourceCase.options);
        const context = createCliDeps(memory.runtime);
        const result = await runCli([...consumer.argv, ...sourceCase.extra], context.deps);
        expect(result.exitCode, `${consumer.name}/${sourceCase.name}`).toBe(0);
        const call = consumer.name === "show"
          ? context.renderSourcePreview.mock.calls[0]?.[2]
          : context.renderSource.mock.calls[0]?.[2];
        expect(call.detailId, `${consumer.name}/${sourceCase.name}`).toBe(sourceCase.expected);
      }
    }
  });

  it("applies bundle, global, and explicit decorator sources only to show", async () => {
    const cases = [
      { name: "bundle", options: {}, expected: "none", extra: [], expectedPath: "/repo/example.ia_place_map.compact.svg" },
      {
        name: "global",
        options: { global: { version: "1" as const, defaults: { node_decorator_mode_id: "type" } } },
        expected: "type",
        extra: [],
        expectedPath: "/repo/example.ia_place_map.compact.decorators-type.svg"
      },
      {
        name: "explicit",
        options: { global: { version: "1" as const, defaults: { node_decorator_mode_id: "id" } } },
        expected: "type,id",
        extra: ["--decorators", "type,id"],
        expectedPath: "/repo/example.ia_place_map.compact.decorators-type-id.svg"
      }
    ];

    for (const testCase of cases) {
      const context = createCliDeps(createMemoryDefaults(testCase.options).runtime);
      const result = await runCli([
        "node", "sdd", "show", "example.sdd", "--view", "ia_place_map", ...testCase.extra
      ], context.deps);
      expect(result.exitCode, testCase.name).toBe(0);
      expect(context.renderSourcePreview.mock.calls[0]?.[2].nodeDecoratorModeId).toBe(testCase.expected);
      expect(vi.mocked(context.deps.writeTextFile!).mock.calls[0]?.[0]).toBe(testCase.expectedPath);
    }
  });

  it("changes omitted decorator behavior from bundle-only mode and fallback changes", async () => {
    const customBundle = structuredClone(bundle) as Bundle;
    customBundle.manifest.node_decorator_modes.push({
      id: "orientation",
      intent: "custom orientation mode",
      show_node_type: true,
      show_node_id: true
    });
    customBundle.manifest.tool_defaults.node_decorator_mode_id = "orientation";
    const context = createCliDeps(createMemoryDefaults().runtime);

    const result = await runCli([
      "node", "sdd", "show", "example.sdd", "--view", "ia_place_map"
    ], {
      ...context.deps,
      loadBundle: vi.fn(async () => customBundle)
    });

    expect(result.exitCode).toBe(0);
    expect(context.renderSourcePreview.mock.calls[0]?.[2].nodeDecoratorModeId).toBe("orientation");
    expect(vi.mocked(context.deps.writeTextFile!).mock.calls[0]?.[0])
      .toBe("/repo/example.ia_place_map.compact.decorators-orientation.svg");
  });

  it.each(["id,type", "type,type", "none,type", "all"])(
    "rejects unsupported explicit decorator mode %s before preview",
    async (mode) => {
      const context = createCliDeps(createMemoryDefaults().runtime);
      const result = await runCli([
        "node", "sdd", "show", "example.sdd", "--view", "ia_place_map", "--decorators", mode
      ], context.deps);
      expect(result.exitCode).toBe(1);
      expect(context.renderSourcePreview).not.toHaveBeenCalled();
      expect(context.stderr.join("")).toContain(`Unknown value '${mode}'`);
      expect(context.stderr.join("")).toContain("Available values: none, type, id, type,id");
    }
  );

  it("reports an invalid global profile without falling through to the bundle", async () => {
    const memory = createMemoryDefaults({
      global: { version: "1", defaults: { validation_profile_id: "unknown" } }
    });
    const context = createCliDeps(memory.runtime);
    const result = await runCli(["node", "sdd", "validate", "example.sdd"], context.deps);
    expect(result.exitCode).toBe(1);
    expect(context.validateGraph).not.toHaveBeenCalled();
    expect(context.stderr.join("")).toContain("Unknown value 'unknown'");
    expect(context.stderr.join("")).toContain("/user/config/sdd/config.yaml");
    expect(context.stderr.join("")).toContain(bundle.manifestPath);
  });

  it("reports an invalid global detail without falling through to the bundle", async () => {
    const memory = createMemoryDefaults({
      global: { version: "1", defaults: { render_detail_id: "unknown" } }
    });
    const context = createCliDeps(memory.runtime);
    const result = await runCli(["node", "sdd", "show", "example.sdd", "--view", "ia_place_map"], context.deps);
    expect(result.exitCode).toBe(1);
    expect(context.renderSourcePreview).not.toHaveBeenCalled();
    expect(context.stderr.join("")).toContain("setting 'render_detail_id'");
    expect(context.stderr.join("")).toContain("/user/config/sdd/config.yaml");
    expect(context.stderr.join("")).toContain("Available values: compact, detailed");
  });

  it("reports an invalid global decorator mode without falling through to the bundle", async () => {
    const memory = createMemoryDefaults({
      global: { version: "1", defaults: { node_decorator_mode_id: "unknown" } }
    });
    const context = createCliDeps(memory.runtime);
    const result = await runCli(["node", "sdd", "show", "example.sdd", "--view", "ia_place_map"], context.deps);
    expect(result.exitCode).toBe(1);
    expect(context.renderSourcePreview).not.toHaveBeenCalled();
    expect(context.stderr.join("")).toContain("setting 'node_decorator_mode_id'");
    expect(context.stderr.join("")).toContain("Available values: none, type, id, type,id");
  });

  it("uses the same persistent detail in show rendering and automatic artifact naming", async () => {
    const memory = createMemoryDefaults({
      global: { version: "1", defaults: { render_detail_id: "detailed" } }
    });
    const context = createCliDeps(memory.runtime);
    const result = await runCli([
      "node", "sdd", "show", "example.sdd", "--view", "ia_place_map"
    ], context.deps);
    expect(result.exitCode).toBe(0);
    expect(context.renderSourcePreview.mock.calls[0]?.[2].detailId).toBe("detailed");
    expect(vi.mocked(context.deps.writeTextFile!).mock.calls[0]?.[0]).toBe("/repo/example.ia_place_map.detailed.svg");
  });

  it("uses only the user configuration regardless of working directory", async () => {
    const memory = createMemoryDefaults({
      global: { version: "1", defaults: { validation_profile_id: "permissive" } }
    });
    memory.files.set("/repo-a/sdd.config.yaml", {
      version: "1",
      defaults: { validation_profile_id: "strict", render_detail_id: "detailed" }
    });

    for (const cwd of ["/repo-a/subdir", "/repo-b/subdir"]) {
      const context = createCliDeps(memory.runtime, cwd);
      expect((await runCli(["node", "sdd", "validate", "example.sdd"], context.deps)).exitCode).toBe(0);
      expect(context.validateGraph.mock.calls[0]?.[2]).toBe("permissive");
    }
    expect(memory.read.mock.calls.map(([filePath]) => filePath)).toEqual([
      "/user/config/sdd/config.yaml",
      "/user/config/sdd/config.yaml"
    ]);
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
  it("makes bare defaults and defaults show equivalent and compact", async () => {
    for (const suffix of [[], ["show"]]) {
      const context = createCliDeps(createMemoryDefaults().runtime);
      expect((await runCli(["node", "sdd", "defaults", ...suffix], context.deps)).exitCode).toBe(0);
      expect(context.stdout.join("")).toBe(
        "Profile: simple (bundle fallback)\nDetail: compact (bundle fallback)\nDecorators: none (bundle fallback)\n"
      );
    }

    const globalContext = createCliDeps(createMemoryDefaults({
      global: { version: "1", defaults: { validation_profile_id: "permissive" } }
    }).runtime);
    expect((await runCli(["node", "sdd", "defaults"], globalContext.deps)).exitCode).toBe(0);
    expect(globalContext.stdout.join("")).toBe(
      "Profile: permissive (user default)\nDetail: compact (bundle fallback)\nDecorators: none (bundle fallback)\n"
    );
  });

  it("sets, idempotently sets, inspects, and unsets a user profile", async () => {
    const memory = createMemoryDefaults();
    const first = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "set", "profile", "strict"], first.deps)).exitCode).toBe(0);
    expect(memory.files.get("/user/config/sdd/config.yaml")?.defaults.validation_profile_id).toBe("strict");
    expect(memory.set).toHaveBeenCalledWith(
      "/user/config/sdd/config.yaml",
      "validation_profile_id",
      "strict",
      { createParent: true }
    );

    const second = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "set", "profile", "strict"], second.deps)).exitCode).toBe(0);
    expect(second.stdout.join("")).toContain("no changes made");

    const show = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "show"], show.deps)).exitCode).toBe(0);
    expect(show.stdout.join("")).toBe(
      "Profile: strict (user default)\nDetail: compact (bundle fallback)\nDecorators: none (bundle fallback)\n"
    );

    const unset = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "unset", "profile"], unset.deps)).exitCode).toBe(0);
    expect(memory.files.has("/user/config/sdd/config.yaml")).toBe(false);
  });

  it("rejects an unknown profile before mutating configuration", async () => {
    const memory = createMemoryDefaults();
    const context = createCliDeps(memory.runtime);
    expect((await runCli([
      "node", "sdd", "defaults", "set", "profile", "unknown"
    ], context.deps)).exitCode).toBe(1);
    expect(context.stderr.join("")).toContain("Available values: simple, permissive, strict");
    expect(memory.set).not.toHaveBeenCalled();
  });

  it("rejects an unknown decorator default before mutating configuration", async () => {
    const memory = createMemoryDefaults();
    const context = createCliDeps(memory.runtime);
    expect((await runCli([
      "node", "sdd", "defaults", "set", "decorators", "all"
    ], context.deps)).exitCode).toBe(1);
    expect(context.stderr.join("")).toContain("Available values: none, type, id, type,id");
    expect(memory.set).not.toHaveBeenCalled();
  });

  it("validates a saved value against the explicitly selected bundle", async () => {
    const memory = createMemoryDefaults();
    const context = createCliDeps(memory.runtime);
    const alternateBundle: Bundle = {
      ...bundle,
      manifestPath: "/alternate/manifest.yaml",
      manifest: {
        ...bundle.manifest,
        profiles: bundle.manifest.profiles.filter((profile) => profile.id === "simple")
      }
    };
    const result = await runCli([
      "node", "sdd", "defaults", "set", "profile", "strict", "--bundle", "/alternate/manifest.yaml"
    ], {
      ...context.deps,
      loadBundle: vi.fn(async () => alternateBundle)
    });
    expect(result.exitCode).toBe(1);
    expect(context.stderr.join("")).toContain("Selected bundle: '/alternate/manifest.yaml'");
    expect(context.stderr.join("")).toContain("Available values: simple");
    expect(memory.set).not.toHaveBeenCalled();
  });

  it("sets active detail values and allows detail removal without loading a bundle", async () => {
    const memory = createMemoryDefaults({
      global: { version: "1", defaults: { render_detail_id: "compact" } }
    });
    const setContext = createCliDeps(memory.runtime);
    expect((await runCli([
      "node", "sdd", "defaults", "set", "detail", "compact"
    ], setContext.deps)).exitCode).toBe(0);
    expect(memory.set).toHaveBeenCalledWith(
      "/user/config/sdd/config.yaml",
      "render_detail_id",
      "compact",
      { createParent: true }
    );

    const showContext = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "show"], showContext.deps)).exitCode).toBe(0);
    expect(showContext.stdout.join("")).toContain("Detail: compact (user default)");

    const unsetContext = createCliDeps(memory.runtime);
    const loadBundleMock = vi.fn(async () => bundle);
    expect((await runCli(["node", "sdd", "defaults", "unset", "detail"], {
      ...unsetContext.deps,
      loadBundle: loadBundleMock
    })).exitCode).toBe(0);
    expect(loadBundleMock).not.toHaveBeenCalled();
  });

  it("sets, shows, and unsets decorators without loading a bundle during unset", async () => {
    const memory = createMemoryDefaults();
    const setContext = createCliDeps(memory.runtime);
    expect((await runCli([
      "node", "sdd", "defaults", "set", "decorators", "type,id"
    ], setContext.deps)).exitCode).toBe(0);
    expect(memory.set).toHaveBeenCalledWith(
      "/user/config/sdd/config.yaml",
      "node_decorator_mode_id",
      "type,id",
      { createParent: true }
    );

    const showContext = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "show"], showContext.deps)).exitCode).toBe(0);
    expect(showContext.stdout.join("")).toContain("Decorators: type,id (user default)");

    const unsetContext = createCliDeps(memory.runtime);
    const loadBundleMock = vi.fn(async () => bundle);
    expect((await runCli(["node", "sdd", "defaults", "unset", "decorators"], {
      ...unsetContext.deps,
      loadBundle: loadBundleMock
    })).exitCode).toBe(0);
    expect(loadBundleMock).not.toHaveBeenCalled();
  });

  it("rejects the removed scope flags", async () => {
    const memory = createMemoryDefaults();
    for (const argv of [
      ["node", "sdd", "defaults", "show", "--global"],
      ["node", "sdd", "defaults", "set", "profile", "simple", "--project"],
      ["node", "sdd", "defaults", "unset", "profile", "--global"]
    ]) {
      const context = createCliDeps(memory.runtime);
      expect((await runCli(argv, context.deps)).exitCode).not.toBe(0);
      expect(context.stderr.join("")).toContain("unknown option");
    }
  });

  it("reports schema-valid unknown stored values in show", async () => {
    const memory = createMemoryDefaults({
      global: { version: "1", defaults: { validation_profile_id: "unknown" } }
    });
    const context = createCliDeps(memory.runtime);
    expect((await runCli(["node", "sdd", "defaults", "show"], context.deps)).exitCode).toBe(1);
    expect(context.stdout.join("")).toBe("");
    expect(context.stderr.join("")).toContain("Unknown value 'unknown'");
    expect(context.stderr.join("")).toContain("simple, permissive, strict");
  });
});
