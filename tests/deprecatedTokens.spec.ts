import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBundle, parseSource, compileSource } from "../src/index.js";
import type { Bundle } from "../src/bundle/types.js";
import { validateLoadedBundle } from "../src/bundle/validateLoadedBundle.js";
import { createParserSyntaxRuntime } from "../src/parser/syntaxRuntime.js";
import { runCli, type CliDeps } from "../src/cli/program.js";

let bundle: Bundle;
const file = "/tmp/deprecated-step.sdd";
const message = "Node type 'Step' is deprecated after v0.1. Use JourneyStep, BlueprintStep, or ScenarioStep as appropriate.";
const source = 'SDD-TEXT 0.2\nStep J-001 "Old"\nEND\n';
beforeAll(async () => { bundle = await loadBundle("bundle/v0.2/manifest.yaml"); });
const parse = (text = source, selected = bundle) => parseSource({ path: file, text }, selected);

describe("bundle-owned deprecated tokens", () => {
  it.each([
    [source, 2],
    ['SDD-TEXT 0.2\nStage G-001 "Stage"\n  + Step J-001 "Old" # comment\n  END\nEND\n', 3],
    ['SDD-TEXT 0.2\nPlace P-001 "Place"\nEND\n  Step J-001 "Old"\nEND\n', 4]
  ])("rejects deprecated headers with their source location", (text, line) => {
    const result = parse(text);
    expect(result.document).toBeUndefined();
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "parse.deprecated_node_type", severity: "error", stage: "parse", message,
      file, span: expect.objectContaining({ line, column: 1 })
    }));
    expect(result.diagnostics.some(d => d.span?.line === line && d.code === "parse.expected_top_level_block")).toBe(false);
    expect(compileSource({ path: file, text }, bundle).graph).toBeUndefined();
  });

  it("preserves valid types, v0.1 compatibility, and ordinary unknown-token errors", async () => {
    const old = await loadBundle("bundle/v0.1/manifest.yaml");
    expect(parse(source.replace("0.2", "0.1"), old).diagnostics).toEqual([]);
    expect(compileSource({ path: file, text: source.replace("0.2", "0.1") }, old).graph?.nodes[0].type).toBe("Step");
    for (const type of ["JourneyStep", "BlueprintStep", "ScenarioStep"]) {
      expect(parse(source.replace("Step", type)).diagnostics).toEqual([]);
    }
    for (const token of ["Unknown", "BluePrintStep", "step", "StepExtra"]) {
      const result = parse(source.replace("Step", token));
      expect(result.diagnostics.some(d => d.code === "parse.expected_top_level_block")).toBe(true);
      expect(result.diagnostics.some(d => d.code === "parse.deprecated_node_type")).toBe(false);
    }
    expect(parse('SDD-TEXT 0.2\n# Step J-001 "Old"\nPlace P-001 "Step" # Step\n  description="Step"\nEND\n').diagnostics).toEqual([]);
    expect(bundle.vocab.node_types.map(n => n.token)).not.toContain("Step");
  });

  it("follows the configured casing policy", () => {
    const selected = structuredClone(bundle);
    selected.syntax.parsing_model.case_sensitive = false;
    expect(parse(source.replace("Step", "sTeP"), selected).diagnostics.some(d => d.message === message)).toBe(true);
  });

  it("loads changed deprecation tokens, codes and messages from bundle files", async () => {
    const directory = await mkdtemp("/tmp/sdd-deprecation-bundle-");
    try {
      await cp(bundle.rootDir, directory, { recursive: true });
      const syntaxPath = path.join(directory, "core/syntax.yaml");
      const syntax = YAML.parse(await readFile(syntaxPath, "utf8"));
      syntax.token_sources.node_types.deprecated_tokens = {
        FormerNode: { code: "parse.custom_deprecation", message: "Custom migration guidance" }
      };
      await writeFile(syntaxPath, YAML.stringify(syntax));
      const selected = await loadBundle(path.join(directory, "manifest.yaml"));
      expect(parse(source.replace("Step", "FormerNode"), selected).diagnostics).toContainEqual(expect.objectContaining({
        code: "parse.custom_deprecation", message: "Custom migration guidance"
      }));
      expect(parse(source, selected).diagnostics.some(d => d.code === "parse.deprecated_node_type")).toBe(false);
      delete selected.syntax.token_sources.node_types.deprecated_tokens;
      expect(parse(source.replace("Step", "FormerNode"), selected).diagnostics.some(d => d.code === "parse.expected_top_level_block")).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([
    null, [], { Step: { code: "", message } }, { Step: { code: "parse.test" } },
    { "Bad Token": { code: "parse.test", message } }, { Place: { code: "parse.test", message } }
  ])("rejects invalid metadata in bundle validation and syntax runtime", metadata => {
    const selected = structuredClone(bundle);
    selected.syntax.token_sources.node_types.deprecated_tokens = metadata as never;
    expect(() => validateLoadedBundle(selected)).toThrow("Loaded bundle is invalid");
    expect(() => createParserSyntaxRuntime(selected)).toThrow("Invalid parser syntax contract");
  });

  it("rejects ambiguous deprecations under case-insensitive parsing", () => {
    const selected = structuredClone(bundle);
    selected.syntax.parsing_model.case_sensitive = false;
    selected.syntax.token_sources.node_types.deprecated_tokens!.step = { code: "parse.test", message };
    expect(() => validateLoadedBundle(selected)).toThrow();
    expect(() => createParserSyntaxRuntime(selected)).toThrow();
  });

  it.each(["pretty", "json"])("reports CLI errors in %s format without writing output", async format => {
    const stderr: string[] = [];
    const writes: string[] = [];
    const deps: Partial<CliDeps> = {
      loadBundle: async () => bundle,
      readSourceInput: async () => ({ path: file, text: source }),
      stderr: value => { stderr.push(value); }, stdout: () => {},
      writeTextFile: async destination => { writes.push(destination); },
      defaultsConfig: {
        getGlobalConfigPath: () => "/tmp/sdd-deprecation-defaults.yaml",
        read: async () => undefined,
        set: async destination => ({ changed: false, path: destination }),
        unset: async destination => ({ changed: false, path: destination })
      }
    };
    const result = await runCli(["node", "sdd", "compile", file, "--bundle", bundle.manifestPath,
      "--diagnostics", format, "--out", "/tmp/deprecated-step.json"], deps);
    expect(result.exitCode).toBe(1);
    expect(writes).toEqual([]);
    const output = stderr.join("");
    if (format === "json") {
      expect(JSON.parse(output)).toContainEqual(expect.objectContaining({ code: "parse.deprecated_node_type", message, severity: "error" }));
    } else {
      expect(output).toContain(`ERROR parse.deprecated_node_type (1 instance): ${message}`);
      expect(output).toContain("2:1");
    }
  });
});
