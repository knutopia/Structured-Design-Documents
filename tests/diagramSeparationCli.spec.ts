import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { runCli, type CliDeps } from "../src/cli/program.js";
import { renderPreparedCompiledGraphPreview } from "../src/renderer/previewWorkflow.js";
import { validateGraph } from "../src/validator/validateGraph.js";

let bundle: Bundle;
let source: string;
const inputPath = path.resolve("tests/fixtures/diagram-separation/scenario_named.sdd");
beforeAll(async () => {
  bundle = await loadBundle(path.resolve("bundle/v0.2/manifest.yaml"));
  source = await readFile(inputPath, "utf8");
});

async function invoke(command: string, options: string[], text = source, selectedBundle = bundle, overrides: Partial<CliDeps> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const files = new Map<string, string | Uint8Array>();
  const deps: Partial<CliDeps> = {
    loadBundle: async () => selectedBundle,
    readSourceInput: async () => ({ path: inputPath, text }),
    stdout: value => { stdout.push(value); },
    stderr: value => { stderr.push(value); },
    writeTextFile: async (file, content) => { files.set(file, content); },
    writeBinaryFile: async (file, content) => { files.set(file, content); },
    defaultsConfig: {
      getGlobalConfigPath: () => "/tmp/sdd-diagram-cli-defaults.yaml",
      read: async () => undefined,
      set: async file => ({ changed: false, path: file }),
      unset: async file => ({ changed: false, path: file })
    },
    ...overrides
  };
  const renderOptions = command === "diagrams" ? [] : ["--profile", "simple", "--detail", "detailed"];
  const result = await runCli(["node", "sdd", command, inputPath, "--bundle", selectedBundle.manifestPath, ...renderOptions, ...options], deps);
  return { ...result, stdout: stdout.join(""), stderr: stderr.join(""), files };
}

describe("named diagram CLI acceptance", () => {
  it("discovers semantic inventories and inclusion reasons without drawing", async () => {
    const result = await invoke("diagrams", ["--json", "--details"]);
    expect(result.exitCode).toBe(0);
    const listed = JSON.parse(result.stdout);
    expect(listed.diagrams.map((d: any) => [d.diagram_id, d.view_id, d.node_count, d.edge_count])).toEqual([
      ["DG-001", "scenario_flow", 5, 4], ["DG-002", "scenario_flow", 4, 3], ["DG-003", "scenario_flow", 3, 2]
    ]);
    expect(listed.diagrams[0].inclusions.find((entry: any) => entry.node_id === "SS-001").reasons).toEqual(["assigned_edge_endpoint"]);
    expect(listed.diagrams[0].source_edge_ids).toHaveLength(4);
    expect(result.files.size).toBe(0);
  });

  it("infers the type and carries exact branch labels and accessible title into SVG", async () => {
    const result = await invoke("show", ["--diagram", "DG-002"]);
    expect(result.exitCode).toBe(0);
    expect([...result.files.keys()]).toEqual([inputPath.replace(/\.sdd$/, ".scenario_flow.diagram-DG-002.detailed.svg")]);
    const svg = [...result.files.values()][0] as string;
    expect(svg).toContain("<title>Node pivot</title>");
    expect(svg).toContain("pivot node");
    expect(svg).not.toContain("add relationship");
    expect(svg).not.toContain("Choose the relationship");
  });

  it("keeps named and combined batches distinct, with collision-free duplicate titles", async () => {
    const text = source.replace('"Node pivot"', '"Add relationship"');
    const named = await invoke("show", ["--diagram", "all", "--out", "/tmp/diagram-cli.svg"], text);
    expect(named.exitCode).toBe(0);
    expect([...named.files.keys()]).toEqual([
      "/tmp/diagram-cli.scenario_flow.diagram-DG-001.svg",
      "/tmp/diagram-cli.scenario_flow.diagram-DG-002.svg",
      "/tmp/diagram-cli.scenario_flow.diagram-DG-003.svg"
    ]);
    const combined = await invoke("show", ["--view", "all", "--out", "/tmp/diagram-cli.svg"]);
    expect(combined.exitCode).toBe(0);
    expect([...combined.files.keys()]).toEqual(["/tmp/diagram-cli.scenario_flow.svg"]);
    const svg = [...combined.files.values()][0] as string;
    expect(svg).toContain("Choose the relationship");
    expect(svg).toContain("Inspect related content");
    expect(svg).toContain("Name the new view");
  });

  it("honors explicit output and text selection through the same named target", async () => {
    const svg = await invoke("show", ["--diagram", "DG-001", "--view", "scenario_flow", "--out", "/tmp/exact-name.svg"]);
    expect(svg.exitCode).toBe(0);
    expect([...svg.files.keys()]).toEqual(["/tmp/exact-name.svg"]);
    for (const format of ["dot", "mermaid"]) {
      const result = await invoke("render", ["--diagram", "DG-001", "--format", format]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("add relationship");
      expect(result.stdout).not.toContain("pivot node");
    }
  });

  it("rejects missing, unknown, conflicting and unsupported targets without any artifact", async () => {
    const selections = [[], ["--diagram", "DG-999"], ["--diagram", "DG-001", "--view", "journey_map"],
      ["--diagram", "all", "--view", "scenario_flow"], ["--view", "all", "--diagram", "DG-001"],
      ["--diagram", "all", "--dot-out", "/tmp/disallowed.dot"]];
    for (const selection of selections) {
      const result = await invoke("show", [...selection, "--force"]);
      expect(result.exitCode).not.toBe(0);
      expect(result.files.size).toBe(0);
    }
    const old = await loadBundle(path.resolve("bundle/v0.1/manifest.yaml"));
    const unsupported = await invoke("show", ["--diagram", "all"], "SDD-TEXT 0.1\nPlace P-001 \"Old\"\nEND\n", old);
    expect(unsupported.exitCode).not.toBe(0);
    expect(unsupported.stderr).toContain("does not support named diagrams");
  });

  it("fails a single empty target, skips it in a named batch, and fails batches producing nothing", async () => {
    const draft = '\nDiagram DG-004 "Draft"\n  diagram_type=scenario_flow\nEND\n';
    const single = await invoke("show", ["--diagram", "DG-004", "--force"], source + draft);
    expect(single.exitCode).toBe(1);
    expect(single.files.size).toBe(0);
    const batch = await invoke("show", ["--diagram", "all"], source + draft);
    expect(batch.exitCode).toBe(0);
    expect(batch.files.size).toBe(3);
    expect(batch.stderr).toContain("DG-004");
    const empty = await invoke("show", ["--diagram", "all"], 'SDD-TEXT 0.2\n' + draft);
    expect(empty.exitCode).toBe(1);
    expect(empty.files.size).toBe(0);
  });

  it("blocks named and combined force paths when membership anywhere in the document is invalid", async () => {
    const text = source.replace('diagrams=DG-003', 'diagrams=DG-999');
    for (const selection of [["--diagram", "DG-001"], ["--diagram", "all"], ["--view", "scenario_flow"], ["--view", "all"]]) {
      const result = await invoke("show", [...selection, "--force"], text);
      expect(result.exitCode).toBe(1);
      expect(result.files.size).toBe(0);
    }
  });

  it("records a failed backend target while producing the other named artifacts", async () => {
    const result = await invoke("show", ["--diagram", "all"], source, bundle, {
      renderPreparedCompiledGraphPreview: async (...args) => {
        if (args[3].diagramId === "DG-002") throw new Error("Proof backend target failure");
        return renderPreparedCompiledGraphPreview(...args);
      }
    });
    expect(result.exitCode).toBe(1);
    expect(result.files.size).toBe(2);
    expect([...result.files.keys()].every(file => !file.includes("DG-002"))).toBe(true);
    expect(result.stderr).toContain("Failed renderer: DG-002");
    expect(result.stderr).toContain("Proof backend target failure");
  });

  it("isolates unsupported explicit backends per named target after validating the full document", async () => {
    const mixed = source + '\nDiagram DG-901 "Journey"\n  diagram_type=journey_map\nEND\nStage STG-901 "Stage"\n  CONTAINS J-901 diagrams=DG-901\nEND\nJourneyStep J-901 "Journey step"\nEND\n';
    let validationCalls = 0;
    const overrides: Partial<CliDeps> = {
      validateGraph: (...args) => { validationCalls += 1; return validateGraph(...args); }
    };
    const result = await invoke("show", ["--diagram", "all", "--backend", "staged_scenario_flow_preview", "--out", "/tmp/mixed.svg", "--force"], mixed, bundle, overrides);
    expect(validationCalls).toBe(1);
    expect(result.exitCode).toBe(1);
    expect([...result.files.keys()]).toEqual([
      "/tmp/mixed.scenario_flow.diagram-DG-001.svg",
      "/tmp/mixed.scenario_flow.diagram-DG-002.svg",
      "/tmp/mixed.scenario_flow.diagram-DG-003.svg"
    ]);
    expect(result.stderr).toContain("Failed renderer: DG-901 (staged_scenario_flow_preview)");
    expect(result.stderr).toContain("Generated 3 diagram(s). Failed 1 renderer(s).");
    expect(result.stderr).toContain("renderer.unsupported_preview_backend");

    const invalid = await invoke("show", ["--diagram", "all", "--backend", "staged_scenario_flow_preview", "--force"], mixed.replace("diagrams=DG-003", "diagrams=DG-999"));
    expect(invalid.exitCode).toBe(1);
    expect(invalid.files.size).toBe(0);
    expect(invalid.stderr).toContain("validate.diagram_unresolved_reference");
    expect(invalid.stderr).not.toContain("renderer.unsupported_preview_backend");

    const combined = await invoke("show", ["--view", "all", "--backend", "staged_scenario_flow_preview"], mixed);
    expect(combined.exitCode).toBe(2);
    expect(combined.files.size).toBe(0);
    expect(combined.stderr).toContain("not supported for every available");
  });
});
