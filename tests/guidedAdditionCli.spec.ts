import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadBundle, type Bundle, type CompletedAdditionProposal } from "../src/index.js";
import { runCli, type CliDeps } from "../src/cli/program.js";
import type {
  GuidedPromptAdapter,
  GuidedPromptChoice
} from "../src/cli/guidedAddition.js";
import type { ApplyAdditionProposalResult } from "../src/authoring/guidedAddition/contracts.js";
import type { Diagnostic } from "../src/types.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const sourceExample = path.join(repoRoot, "bundle/v0.1/examples/outcome_to_ia_trace.sdd");

let bundle: Bundle;
let fixtureDir: string;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
  fixtureDir = fs.mkdtempSync(path.join(repoRoot, ".guided-cli-test-"));
});

afterAll(() => {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

interface ScriptOptions {
  operation?: { direction: "outgoing" | "incoming"; endpoint_strategy: "existing_only" | "existing_or_new" };
  nodeType?: string;
  relationship?: string;
  endpoint?: string | "create_new";
  save?: boolean;
  advancedNode?: boolean;
  advancedEdge?: boolean;
  changeFilters?: boolean;
  confirmEffect?: boolean;
  reparentAlternative?: boolean;
  acceptWarnings?: boolean;
  confirmCommit?: boolean;
}

class ScriptedPrompt implements GuidedPromptAdapter {
  readonly transcript: Array<{ id: string; message: string; labels?: string[]; defaultValue?: string }> = [];
  #changedFilters = false;
  #calls = 0;

  constructor(private readonly options: ScriptOptions = {}) {}

  async select<T>(request: { id: string; message: string; choices: GuidedPromptChoice<T>[] }): Promise<T> {
    if (++this.#calls > 100) {
      throw new Error(`Prompt script exceeded 100 selections: ${this.transcript.slice(-12).map((entry) => entry.id).join(", ")}`);
    }
    this.transcript.push({ id: request.id, message: request.message, labels: request.choices.map((choice) => `${choice.label}${choice.description ? ` — ${choice.description}` : ""}`) });
    const find = (predicate: (choice: GuidedPromptChoice<T>) => boolean): T => {
      const match = request.choices.find(predicate);
      if (!match) throw new Error(`Script has no matching choice for ${request.id}`);
      return match.value;
    };
    if (request.id === "operation" && this.options.operation) {
      return find((choice) => {
        const value = choice.value as any;
        return value.direction === this.options.operation!.direction && value.endpoint_strategy === this.options.operation!.endpoint_strategy;
      });
    }
    if (request.id === "node_type" && this.options.nodeType) return find((choice) => choice.value === this.options.nodeType as T);
    if (request.id === "relationship") {
      if (this.options.changeFilters && !this.#changedFilters) {
        this.#changedFilters = true;
        return find((choice) => choice.value === "change_filters" as T);
      }
      if (this.options.relationship) return find((choice) => choice.label.includes(` ${this.options.relationship} `));
    }
    if (request.id === "endpoint") {
      if (this.options.endpoint === "create_new") return find((choice) => (choice.value as any).kind === "create_new");
      if (this.options.endpoint) return find((choice) => (choice.value as any).node?.node_id === this.options.endpoint);
    }
    if (request.id === "filter_role" || request.id === "filter_presence") return request.choices[0]!.value;
    if (request.id === "placement") return request.choices[0]!.value;
    if (request.id === "reparent_refusal") {
      return this.options.reparentAlternative ? request.choices.at(-2)!.value : request.choices.at(-1)!.value;
    }
    if (request.id === "save_or_cancel") return find((choice) => choice.value === (this.options.save ? "save" : "cancel") as T);
    return request.choices[0]!.value;
  }

  async input(request: { id: string; message: string; defaultValue?: string; required?: boolean }): Promise<string> {
    this.transcript.push({ id: request.id, message: request.message, defaultValue: request.defaultValue });
    if (request.id === "field:name") return "Guided addition";
    if (request.id === "field:description") return "Created by the guided CLI";
    if (request.required && !request.defaultValue) return "value";
    return request.defaultValue ?? "";
  }

  async confirm(request: { id: string; message: string; defaultValue?: boolean }): Promise<boolean> {
    this.transcript.push({ id: request.id, message: request.message });
    if (request.id === "disclose_node_advanced") return this.options.advancedNode ?? false;
    if (request.id === "disclose_edge_advanced") return this.options.advancedEdge ?? false;
    if (request.id === "confirm_effect") return this.options.confirmEffect ?? true;
    if (request.id === "accept_warnings") return this.options.acceptWarnings ?? true;
    if (request.id === "confirm_commit") return this.options.confirmCommit ?? true;
    return request.defaultValue ?? true;
  }

  close(): void {}
}

function writeFixture(name: string, text = fs.readFileSync(sourceExample, "utf8")): string {
  const filePath = path.join(fixtureDir, `${name}.sdd`);
  fs.writeFileSync(filePath, text, "utf8");
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function appliedResult(
  proposal: CompletedAdditionProposal,
  mode: "dry_run" | "commit",
  status: "applied" | "rejected" = "applied",
  diagnostics: Diagnostic[] = []
): ApplyAdditionProposalResult {
  return {
    kind: "sdd-addition-proposal-result",
    proposal,
    base_revision: proposal.document_context.base_revision,
    ...(status === "applied" ? { resulting_revision: proposal.document_context.base_revision } : {}),
    mode,
    status,
    change_set: {
      kind: "sdd-change-set",
      change_set_id: `cs_${mode}`,
      path: proposal.document_context.path!,
      origin: "apply_addition_proposal",
      document_effect: "updated",
      base_revision: proposal.document_context.base_revision,
      ...(status === "applied" ? { resulting_revision: proposal.document_context.base_revision } : {}),
      mode,
      status,
      undo_eligible: mode === "commit" && status === "applied",
      operations: [],
      summary: {
        node_insertions: proposal.new_nodes.map((node) => ({ node_id: node.node_id, node_type: node.node_type })),
        node_deletions: [],
        node_renames: [],
        property_changes: [],
        edge_insertions: proposal.new_edges.map((edge) => ({ parent_handle: "mock", rel_type: edge.type, to: edge.to.node_id })),
        edge_deletions: [],
        ordering_changes: []
      },
      diagnostics
    },
    created_targets: [],
    diagnostics
  };
}

function cliHarness(prompt: ScriptedPrompt, overrides: Partial<CliDeps> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const apply = vi.fn(async (_workspace, _bundle, args) => appliedResult(args.proposal, args.mode ?? "dry_run"));
  return {
    stdout,
    stderr,
    apply,
    deps: {
      cwd: () => repoRoot,
      createGuidedPrompt: () => prompt,
      applyAdditionProposal: apply,
      stdout: (content: string) => stdout.push(content),
      stderr: (content: string) => stderr.push(content),
      ...overrides
    } satisfies Partial<CliDeps>
  };
}

describe("interactive sdd add", () => {
  it.each([
    ["standalone", undefined, undefined, undefined, undefined],
    ["outgoing existing", "O-001", { direction: "outgoing", endpoint_strategy: "existing_only" }, "MEASURED_BY", "M-001"],
    ["outgoing new", "O-001", { direction: "outgoing", endpoint_strategy: "existing_or_new" }, "MEASURED_BY", "create_new"],
    ["incoming existing", "O-001", { direction: "incoming", endpoint_strategy: "existing_only" }, "SUPPORTS", "OP-001"],
    ["incoming new", "O-001", { direction: "incoming", endpoint_strategy: "existing_or_new" }, "SUPPORTS", "create_new"]
  ] as const)("completes and cancels the %s route without invoking the executor", async (_name, anchor, operation, relationship, endpoint) => {
    const prompt = new ScriptedPrompt({
      ...(operation ? { operation } : {}),
      nodeType: "Outcome",
      ...(relationship ? { relationship } : {}),
      ...(endpoint ? { endpoint } : {}),
      save: false
    });
    const harness = cliHarness(prompt);
    const argv = ["node", "sdd", "add", writeFixture(`route-${_name.replaceAll(" ", "-")}`), ...(anchor ? ["--node", anchor] : [])];
    const result = await runCli(argv, harness.deps);

    expect(result.exitCode, harness.stderr.join("\n")).toBe(0);
    expect(harness.apply).not.toHaveBeenCalled();
    expect(harness.stdout.join("")).toContain("Cancelled. No changes were written.");
    expect(prompt.transcript.some((entry) => entry.id === "save_or_cancel")).toBe(true);
  });

  it("uses planner-provided view metadata, filter actions, ID suggestion, and advanced disclosure", async () => {
    const prompt = new ScriptedPrompt({
      operation: { direction: "outgoing", endpoint_strategy: "existing_or_new" },
      relationship: "MEASURED_BY",
      endpoint: "create_new",
      changeFilters: true,
      advancedNode: true,
      advancedEdge: true,
      save: false
    });
    const harness = cliHarness(prompt);
    const result = await runCli([
      "node", "sdd", "add", writeFixture("view-filter"),
      "--node", "O-001", "--view", "outcome_opportunity_map"
    ], harness.deps);

    expect(result.exitCode).toBe(0);
    const relationshipMenu = prompt.transcript.find((entry) => entry.id === "relationship");
    expect(relationshipMenu?.labels?.join("\n")).toContain("role: primary");
    expect(relationshipMenu?.labels?.join("\n")).toContain("presence: connector");
    expect(prompt.transcript.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "filter_role", "filter_presence", "disclose_node_advanced"
    ]));
    const nodeIdPrompt = prompt.transcript.find((entry) => entry.id === "field:node_id");
    expect(nodeIdPrompt?.message).toContain("Node ID");
  });

  it.each([
    ["accepts the exact effect", true, false],
    ["routes refusal to a non-reparenting alternative", false, true]
  ] as const)("%s for a new structural parent and existing child", async (_name, confirmEffect, reparentAlternative) => {
    const prompt = new ScriptedPrompt({
      operation: { direction: "incoming", endpoint_strategy: "existing_or_new" },
      relationship: "CONTAINS",
      endpoint: "create_new",
      confirmEffect,
      reparentAlternative,
      save: false
    });
    const harness = cliHarness(prompt);
    const result = await runCli([
      "node", "sdd", "add", writeFixture(`effect-${confirmEffect}`), "--node", "P-001"
    ], harness.deps);

    expect(result.exitCode, harness.stderr.join("\n")).toBe(0);
    expect(prompt.transcript.map((entry) => entry.id)).toContain("confirm_effect");
    if (!confirmEffect) expect(prompt.transcript.map((entry) => entry.id)).toContain("reparent_refusal");
  });

  it("dry-runs first, requires warning acceptance, and commits the exact proposal object", async () => {
    const prompt = new ScriptedPrompt({ nodeType: "Outcome", save: true, acceptWarnings: true, confirmCommit: true });
    const warning: Diagnostic = {
      stage: "validate",
      code: "test.warning",
      severity: "warn",
      message: "Review this warning",
      file: "fixture.sdd"
    };
    const apply = vi.fn(async (_workspace, _bundle, args) => appliedResult(
      args.proposal,
      args.mode ?? "dry_run",
      "applied",
      args.mode === "dry_run" ? [warning] : []
    ));
    const harness = cliHarness(prompt, { applyAdditionProposal: apply });
    const result = await runCli(["node", "sdd", "add", writeFixture("save")], harness.deps);

    expect(result.exitCode).toBe(0);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[0]![2]).toMatchObject({ mode: "dry_run", validate_profile: "simple" });
    expect(apply.mock.calls[1]![2]).toMatchObject({ mode: "commit", validate_profile: "simple" });
    expect(apply.mock.calls[0]![2].proposal).toBe(apply.mock.calls[1]![2].proposal);
    expect(prompt.transcript.map((entry) => entry.id)).toEqual(expect.arrayContaining(["accept_warnings", "confirm_commit"]));
  });

  it("blocks commit on dry-run rejection and reports stale drift between review and commit", async () => {
    const stale: Diagnostic = {
      stage: "authoring",
      code: "guided_addition.state_stale",
      severity: "error",
      message: "Proposal base revision does not match the current document",
      file: "fixture.sdd"
    };
    const prompt = new ScriptedPrompt({ nodeType: "Outcome", save: true, confirmCommit: true });
    const apply = vi.fn(async (_workspace, _bundle, args) => args.mode === "dry_run"
      ? appliedResult(args.proposal, "dry_run")
      : appliedResult(args.proposal, "commit", "rejected", [stale]));
    const harness = cliHarness(prompt, { applyAdditionProposal: apply });
    const result = await runCli(["node", "sdd", "add", writeFixture("stale")], harness.deps);

    expect(result.exitCode).toBe(1);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(harness.stderr.join("")).toContain("Restart `sdd add`");

    const rejectedPrompt = new ScriptedPrompt({ nodeType: "Outcome", save: true });
    const rejectedApply = vi.fn(async (_workspace, _bundle, args) => appliedResult(args.proposal, "dry_run", "rejected", [stale]));
    const rejectedHarness = cliHarness(rejectedPrompt, { applyAdditionProposal: rejectedApply });
    const rejected = await runCli(["node", "sdd", "add", writeFixture("dry-rejected")], rejectedHarness.deps);
    expect(rejected.exitCode).toBe(1);
    expect(rejectedApply).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid anchors, views, bundles, and documents before proposal execution", async () => {
    const cases: Array<{ name: string; argv: string[]; overrides?: Partial<CliDeps>; expected: string }> = [
      { name: "anchor", argv: ["--node", "missing"], expected: "was not found" },
      { name: "view", argv: ["--view", "missing_view"], expected: "Unknown guided view" },
      {
        name: "bundle",
        argv: [],
        overrides: { loadBundle: async () => ({ ...bundle, authoring: undefined }) },
        expected: "guided authoring metadata"
      },
      {
        name: "document",
        argv: [],
        expected: "unavailable"
      }
    ];

    for (const testCase of cases) {
      const prompt = new ScriptedPrompt();
      const harness = cliHarness(prompt, testCase.overrides);
      const document = testCase.name === "document" ? writeFixture("invalid-document", "not sdd") : writeFixture(`invalid-${testCase.name}`);
      const result = await runCli(["node", "sdd", "add", document, ...testCase.argv], harness.deps);
      expect(result.exitCode, testCase.name).toBe(1);
      expect(harness.apply, testCase.name).not.toHaveBeenCalled();
      expect(harness.stderr.join("").toLowerCase(), testCase.name).toContain(testCase.expected.toLowerCase());
    }
  });

  it("keeps the CLI semantic boundary free of bundle-shape inspection and mutation translation", () => {
    const source = fs.readFileSync(path.join(repoRoot, "src/cli/guidedAddition.ts"), "utf8");
    expect(source).not.toMatch(/bundle\.(contracts|views|authoring|profiles|vocab|syntax)/);
    expect(source).not.toContain("ChangeOperation");
    expect(source).not.toContain("executeChangeOperations");
    expect(source).not.toMatch(/SDD-TEXT|insert_node_block|insert_edge/);
  });

  it("changes presentation from bundle-only description, prefix, and placement mutations", async () => {
    const mutated = structuredClone(bundle);
    mutated.vocab.node_types.find((node) => node.token === "Outcome")!.description = "Bundle-mutated outcome description.";
    mutated.authoring!.node_id_suggestions.prefix_by_type.Outcome = "OX";
    mutated.authoring!.placement_policies.default.fallback = "first" as "last";
    const relationship = mutated.views.views
      .find((view) => view.id === "outcome_opportunity_map")!
      .conventions.guided_addition!.relationships
      .find((candidate) => candidate.from === "Outcome" && candidate.type === "MEASURED_BY" && candidate.to === "Metric")!;
    relationship.role = "bridge";
    relationship.display_by_profile.simple = [{ presence: "hidden", label: "hidden" }];

    const prompt = new ScriptedPrompt({ nodeType: "Outcome", save: false });
    const harness = cliHarness(prompt, { loadBundle: async () => mutated });
    const result = await runCli(["node", "sdd", "add", writeFixture("bundle-presentation")], harness.deps);

    expect(result.exitCode).toBe(0);
    expect(prompt.transcript.find((entry) => entry.id === "node_type")?.labels?.join("\n"))
      .toContain("Bundle-mutated outcome description.");
    expect(prompt.transcript.find((entry) => entry.id === "field:node_id")?.defaultValue).toMatch(/^OX/);
    expect(prompt.transcript.find((entry) => entry.id === "placement")?.labels?.[0]).toContain("first");

    const relationshipPrompt = new ScriptedPrompt({
      operation: { direction: "outgoing", endpoint_strategy: "existing_only" },
      relationship: "MEASURED_BY",
      endpoint: "M-001",
      save: false
    });
    const relationshipHarness = cliHarness(relationshipPrompt, { loadBundle: async () => mutated });
    const relationshipResult = await runCli([
      "node", "sdd", "add", writeFixture("bundle-relationship-presentation"),
      "--node", "O-001", "--view", "outcome_opportunity_map"
    ], relationshipHarness.deps);
    expect(relationshipResult.exitCode).toBe(0);
    const labels = relationshipPrompt.transcript.find((entry) => entry.id === "relationship")?.labels?.join("\n");
    expect(labels).toContain("role: bridge (bridge)");
    expect(labels).toContain("presence: hidden; label: hidden");
  });
});
