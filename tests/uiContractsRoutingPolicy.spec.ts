import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import { collectBundleDiagnostics, validateLoadedBundle } from "../src/bundle/validateLoadedBundle.js";
import { resolveUiContractsPresentation, uiContractsPresentationProblems } from "../src/bundle/uiContractsPresentation.js";
import type { Bundle, UiContractsRoutingPolicy, ViewSpec } from "../src/bundle/types.js";

let current: Bundle;
let compatibility: Bundle;

beforeAll(async () => {
  [current, compatibility] = await Promise.all([
    loadBundle("bundle/v0.2/manifest.yaml"),
    loadBundle("bundle/v0.1/manifest.yaml")
  ]);
});

function uiView(bundle: Bundle): ViewSpec {
  return bundle.views.views.find(view => view.id === "ui_contracts")!;
}

function routingPolicy(): UiContractsRoutingPolicy {
  return {
    scope: "within_transition_region",
    export_clearance: "readable_gap",
    capacity: { owner: "padding_and_adjacency_gaps", node: "fixed" },
    self_loop: {
      shape: "compact_same_side",
      traversal: { axis: "x", direction: "negative" },
      side_trials: [
        { side: "south", pair_placement: "before_other_arrivals" },
        { side: "north", pair_placement: "nearest_feasible" }
      ],
      label: "external",
      selection: ["crossings", "bends", "enlargement", "side_order", "length"]
    }
  };
}

function withPolicy(): Bundle {
  const bundle = structuredClone(current);
  uiView(bundle).conventions.renderer_defaults!.ui_contracts_presentation!.routing = routingPolicy();
  return bundle;
}

function replaceAtPath(bundle: Bundle, key: string, value: unknown): void {
  let parent = uiView(bundle).conventions.renderer_defaults!.ui_contracts_presentation as unknown as Record<string, unknown>;
  const parts = key.split(".");
  for (const part of parts.slice(0, -1)) parent = parent[part] as Record<string, unknown>;
  parent[parts.at(-1)!] = value;
}

async function loadWithPolicy(value: unknown): Promise<Bundle> {
  const temporary = await mkdtemp("/tmp/sdd-ui-routing-policy-");
  try {
    const copy = path.join(temporary, "v0.2");
    await cp("bundle/v0.2", copy, { recursive: true });
    const viewsPath = path.join(copy, "core/views.yaml");
    const views = YAML.parse(await readFile(viewsPath, "utf8"));
    views.views.find((view: { id: string }) => view.id === "ui_contracts")
      .conventions.renderer_defaults.ui_contracts_presentation.routing = value;
    await writeFile(viewsPath, YAML.stringify(views), "utf8");
    return await loadBundle(path.join(copy, "manifest.yaml"));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

describe("UI Contracts routing policy", () => {
  it("enables the current bundle while preserving the v0.1 compatibility capability", () => {
    for (const bundle of [current, compatibility]) {
      expect(() => validateLoadedBundle(bundle)).not.toThrow();
    }
    expect(resolveUiContractsPresentation(uiView(compatibility)).routing).toBeUndefined();
    expect(resolveUiContractsPresentation(uiView(current)).routing).toEqual({ ...routingPolicy(), capacity: { owner: "padding_and_adjacency_gaps", node: "port_minimum" } });
  });

  it("loads the explicit policy from bundle YAML without supplying defaults or changing order", async () => {
    const policy = routingPolicy();
    policy.self_loop.side_trials.reverse();
    policy.self_loop.selection.reverse();
    policy.self_loop.traversal.direction = "positive";
    const loaded = await loadWithPolicy(policy);
    expect(resolveUiContractsPresentation(uiView(loaded)).routing).toEqual(policy);
    expect(uiView(current).conventions.renderer_defaults!.ui_contracts_presentation!.routing!.self_loop.traversal.direction).toBe("negative");
  });

  it.each(["fixed", "padding_and_adjacency_gaps"] as const)("accepts owner capacity %s and both explicit node modes", owner => {
    for (const node of ["fixed", "port_minimum"] as const) {
      const bundle = withPolicy();
      const policy = uiView(bundle).conventions.renderer_defaults!.ui_contracts_presentation!.routing!;
      policy.capacity = { owner, node };
      expect(() => validateLoadedBundle(bundle)).not.toThrow();
      expect(resolveUiContractsPresentation(uiView(bundle)).routing!.capacity).toEqual({ owner, node });
    }
  });

  it.each(["x", "y"] as const)("accepts both directions on tangent %s trials", axis => {
    for (const direction of ["positive", "negative"] as const) {
      const bundle = withPolicy();
      const policy = uiView(bundle).conventions.renderer_defaults!.ui_contracts_presentation!.routing!;
      policy.self_loop.traversal = { axis, direction };
      policy.self_loop.side_trials = axis === "x"
        ? [{ side: "north", pair_placement: "nearest_feasible" }, { side: "south", pair_placement: "before_other_arrivals" }]
        : [{ side: "east", pair_placement: "nearest_feasible" }, { side: "west", pair_placement: "before_other_arrivals" }];
      expect(() => validateLoadedBundle(bundle)).not.toThrow();
      expect(resolveUiContractsPresentation(uiView(bundle)).routing!.self_loop).toEqual(policy.self_loop);
    }
  });

  const malformed: Array<[string, string, unknown]> = [
    ["present undefined block", "routing", undefined],
    ["null block", "routing", null],
    ["array block", "routing", []],
    ["primitive block", "routing", "compact"],
    ["empty block", "routing", {}],
    ["unknown scope", "routing.scope", "whole_view"],
    ["missing scope", "routing.scope", undefined],
    ["unknown export clearance", "routing.export_clearance", "none"],
    ["missing export clearance", "routing.export_clearance", undefined],
    ["null capacity", "routing.capacity", null],
    ["array capacity", "routing.capacity", []],
    ["missing node capacity", "routing.capacity", { owner: "fixed" }],
    ["unknown owner capacity", "routing.capacity.owner", "grow"],
    ["unknown node capacity", "routing.capacity.node", "label_minimum"],
    ["unknown capacity field", "routing.capacity", { owner: "fixed", node: "fixed", extra: true }],
    ["null loop", "routing.self_loop", null],
    ["array loop", "routing.self_loop", []],
    ["unknown shape", "routing.self_loop.shape", "enclosing"],
    ["missing shape", "routing.self_loop.shape", undefined],
    ["unknown label mode", "routing.self_loop.label", "internal"],
    ["missing label mode", "routing.self_loop.label", undefined],
    ["null traversal", "routing.self_loop.traversal", null],
    ["missing traversal direction", "routing.self_loop.traversal", { axis: "x" }],
    ["unknown traversal axis", "routing.self_loop.traversal.axis", "z"],
    ["unknown traversal direction", "routing.self_loop.traversal.direction", "backward"],
    ["unknown traversal field", "routing.self_loop.traversal", { axis: "x", direction: "negative", extra: true }],
    ["null trials", "routing.self_loop.side_trials", null],
    ["empty trials", "routing.self_loop.side_trials", []],
    ["null trial", "routing.self_loop.side_trials", [null]],
    ["unknown side", "routing.self_loop.side_trials", [{ side: "up", pair_placement: "nearest_feasible" }]],
    ["inherited object key side", "routing.self_loop.side_trials", [{ side: "constructor", pair_placement: "nearest_feasible" }]],
    ["nontangent side", "routing.self_loop.side_trials", [{ side: "west", pair_placement: "nearest_feasible" }]],
    ["missing pair placement", "routing.self_loop.side_trials", [{ side: "north" }]],
    ["unknown pair placement", "routing.self_loop.side_trials", [{ side: "north", pair_placement: "after_everything" }]],
    ["unknown trial field", "routing.self_loop.side_trials", [{ side: "north", pair_placement: "nearest_feasible", extra: true }]],
    ["duplicate sides", "routing.self_loop.side_trials", [
      { side: "north", pair_placement: "nearest_feasible" },
      { side: "north", pair_placement: "before_other_arrivals" }
    ]],
    ["null selection", "routing.self_loop.selection", null],
    ["empty selection", "routing.self_loop.selection", []],
    ["missing criterion", "routing.self_loop.selection", ["crossings", "bends", "enlargement", "length"]],
    ["duplicate criterion", "routing.self_loop.selection", ["crossings", "bends", "enlargement", "length", "length"]],
    ["unknown criterion", "routing.self_loop.selection", ["crossings", "bends", "enlargement", "length", "area"]],
    ["nonstring criterion", "routing.self_loop.selection", ["crossings", "bends", "enlargement", "length", null]],
    ["extra criterion", "routing.self_loop.selection", ["crossings", "bends", "enlargement", "side_order", "length", "area"]]
  ];

  it.each(malformed)("rejects %s in loaded validation and the production resolver", (_label, key, value) => {
    const bundle = withPolicy();
    replaceAtPath(bundle, key, value);
    const view = uiView(bundle);
    expect(uiContractsPresentationProblems(view.conventions.renderer_defaults!.ui_contracts_presentation).some(problem => problem.startsWith("routing"))).toBe(true);
    expect(() => validateLoadedBundle(bundle)).toThrow();
    expect(collectBundleDiagnostics(bundle)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "bundle.ui_contracts.presentation_shape", message: expect.stringContaining("routing") })
    ]));
    expect(() => resolveUiContractsPresentation(view)).toThrow(/routing/);
  });

  it.each(["routing", "routing.self_loop"])("rejects extra fields on %s", key => {
    const bundle = withPolicy();
    const policy = uiView(bundle).conventions.renderer_defaults!.ui_contracts_presentation!.routing!;
    replaceAtPath(bundle, key, { ...(key === "routing" ? policy : policy.self_loop), audit: false });
    expect(() => validateLoadedBundle(bundle)).toThrow();
    expect(() => resolveUiContractsPresentation(uiView(bundle))).toThrow(/routing/);
  });

  it.each([null, {}, { ...routingPolicy(), self_loop: { ...routingPolicy().self_loop, selection: ["length"] } }])(
    "rejects malformed present YAML policy %j during actual loading",
    async policy => {
      await expect(loadWithPolicy(policy)).rejects.toMatchObject({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: "bundle.ui_contracts.presentation_shape", message: expect.stringContaining("routing") })
        ])
      });
    }
  );

  it("leaves IA policy unchanged while UI policy is validated", () => {
    const bundle = withPolicy();
    const original = current.views.views.find(view => view.id === "ia_place_map")!.conventions.renderer_defaults!.ia_place_map;
    expect(() => validateLoadedBundle(bundle)).not.toThrow();
    expect(bundle.views.views.find(view => view.id === "ia_place_map")!.conventions.renderer_defaults!.ia_place_map).toEqual(original);
  });
});
