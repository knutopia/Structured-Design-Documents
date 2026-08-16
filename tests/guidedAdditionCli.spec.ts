import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAdditionProposalV1, type ApplyAdditionProposalV1Args } from "../src/authoring/additionProposalsV1.js";
import { runCli, type CliDeps } from "../src/cli/program.js";
import type { GuidedPromptAdapter, GuidedPromptChoice } from "../src/cli/guidedAddition.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const acceptanceFixture = path.join(repoRoot, "tests/fixtures/guided_addition_acceptance.sdd");
let fixtureDir: string;

beforeAll(() => {
  fixtureDir = fs.mkdtempSync(path.join(repoRoot, ".guided-cli-v1-test-"));
});

afterAll(() => {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

type SelectionRule = string | RegExp | number;

class TranscriptPrompt implements GuidedPromptAdapter {
  readonly output: string[] = [];
  readonly selectedIds: string[] = [];
  #selection = 0;
  #confirmation = 0;

  constructor(
    private readonly selectionRules: SelectionRule[],
    private readonly inputValues: Record<string, string> = {},
    private readonly confirmations: boolean[] = []
  ) {}

  async select<T>(request: { id: string; message: string; choices: GuidedPromptChoice<T>[] }): Promise<T> {
    const rule = this.selectionRules[this.#selection++];
    if (rule === undefined) throw new Error(`No scripted selection remains for '${request.id}'`);
    const index = typeof rule === "number"
      ? rule
      : request.choices.findIndex((choice) => typeof rule === "string" ? choice.label.includes(rule) : rule.test(choice.label));
    if (index < 0 || index >= request.choices.length) {
      throw new Error(`No choice for '${request.id}' matched ${String(rule)}: ${request.choices.map((choice) => choice.label).join(" | ")}`);
    }
    this.selectedIds.push(request.id);
    this.output.push(`${request.message}\n${request.choices.map((choice, choiceIndex) =>
      `  ${choiceIndex + 1}. ${choice.label}${choice.description ? ` — ${choice.description}` : ""}`).join("\n")}\nChoose a number: ${index + 1}\n`);
    return request.choices[index]!.value;
  }

  async input(request: { id: string; message: string; defaultValue?: string; required?: boolean }): Promise<string> {
    const value = this.inputValues[request.message] ?? request.defaultValue ?? "";
    const suffix = request.defaultValue !== undefined ? ` [${request.defaultValue}]` : "";
    this.output.push(`${request.message}${suffix}: ${value}\n`);
    return value;
  }

  async confirm(request: { id: string; message: string; defaultValue?: boolean }): Promise<boolean> {
    const answer = this.confirmations[this.#confirmation++] ?? request.defaultValue ?? true;
    const marker = request.defaultValue === false ? "y/N" : "Y/n";
    this.output.push(`${request.message} [${marker}]: ${answer ? "y" : "n"}\n`);
    return answer;
  }

  close(): void {}
}

function fixture(name: string): { relative: string; absolute: string; original: string } {
  const original = fs.readFileSync(acceptanceFixture, "utf8");
  const absolute = path.join(fixtureDir, `${name}.sdd`);
  fs.writeFileSync(absolute, original, "utf8");
  return { relative: path.relative(repoRoot, absolute).split(path.sep).join("/"), absolute, original };
}

async function run(
  target: ReturnType<typeof fixture>,
  prompt: TranscriptPrompt,
  args: string[] = [],
  overrides: Partial<CliDeps> = {}
): Promise<{ exitCode: number; transcript: string; stderr: string }> {
  const stderr: string[] = [];
  const result = await runCli(
    ["node", "sdd", "add", target.relative, ...args],
    {
      cwd: () => repoRoot,
      createGuidedPrompt: () => prompt,
      stdout: (content) => prompt.output.push(content),
      stderr: (content) => stderr.push(content),
      ...overrides
    }
  );
  return { exitCode: result.exitCode, transcript: prompt.output.join(""), stderr: stderr.join("") };
}

function standaloneRules(finalDecision: "Save" | "Cancel"): SelectionRule[] {
  return ["Add a standalone node", /^Place —/, "Last position", finalDecision];
}

describe("sdd add v1 transcript delivery", () => {
  it("matches T16 and writes once after one warning-free Save", async () => {
    const target = fixture("guided-addition-acceptance");
    const applications: ApplyAdditionProposalV1Args[] = [];
    const prompt = new TranscriptPrompt(
      standaloneRules("Save"),
      {
        "New node ID": "P-301",
        "New node Name": "Settings",
        "New node Description": "Configuration and preferences"
      },
      [false]
    );
    const result = await run(target, prompt, [], {
      applyAdditionProposalV1: async (workspace, loadedBundle, args) => {
        applications.push(args);
        return applyAdditionProposalV1(workspace, loadedBundle, args);
      }
    });

    expect(result.exitCode, result.stderr).toBe(0);
    expect(applications.map((args) => args.mode)).toEqual(["dry_run", "commit"]);
    expect(applications.every((args) => args.accepted_warning_token === undefined)).toBe(true);
    expect(result.transcript.slice(result.transcript.indexOf("Review proposed addition"))).toBe(
      `Review proposed addition
  Add Place P-301: Settings
  Description: Configuration and preferences
  Place P-301 at top level, last

Save these changes?
  1. Save
  2. Cancel
Choose a number: 1
Chosen: Save changes

Saved guided-addition-acceptance.sdd.
`
    );
    const saved = fs.readFileSync(target.absolute, "utf8");
    expect(saved.match(/Place P-301 "Settings"/g)).toHaveLength(1);
    expect(saved).toContain(`\n\nPlace P-301 "Settings"\n  description="Configuration and preferences"\nEND\n`);
  });

  it("matches T18 and performs no verification or write on Cancel", async () => {
    const target = fixture("cancel-acceptance");
    let executorCalls = 0;
    const prompt = new TranscriptPrompt(
      standaloneRules("Cancel"),
      {
        "New node ID": "P-301",
        "New node Name": "Settings",
        "New node Description": "Configuration and preferences"
      },
      [false]
    );
    const result = await run(target, prompt, [], {
      applyAdditionProposalV1: async () => {
        executorCalls += 1;
        throw new Error("The executor must not run after Cancel");
      }
    });

    expect(result.exitCode, result.stderr).toBe(0);
    expect(executorCalls).toBe(0);
    expect(result.transcript.slice(result.transcript.indexOf("Review proposed addition"))).toBe(
      `Review proposed addition
  Add Place P-301: Settings
  Description: Configuration and preferences
  Place P-301 at top level, last

Save these changes?
  1. Save
  2. Cancel
Choose a number: 2
Chosen: Cancel

Canceled. No changes were made.
`
    );
    expect(fs.readFileSync(target.absolute, "utf8")).toBe(target.original);
  });

  it("matches T17 and commits only with the exact duplicate-warning token", async () => {
    const target = fixture("guided-addition-acceptance");
    const applications: ApplyAdditionProposalV1Args[] = [];
    const prompt = new TranscriptPrompt(
      [
        "Incoming: another node connects to P-100 [choose by relationship type]",
        "Place NAVIGATES_TO P-100",
        /^P-210: Projects Overview/,
        "Save",
        "Save anyway"
      ],
      {},
      [false]
    );
    const result = await run(target, prompt, ["--node", "P-100"], {
      applyAdditionProposalV1: async (workspace, loadedBundle, args) => {
        applications.push(args);
        return applyAdditionProposalV1(workspace, loadedBundle, args);
      }
    });

    expect(result.exitCode, result.stderr).toBe(0);
    expect(applications.map((args) => args.mode)).toEqual(["dry_run", "commit"]);
    expect(applications[0]!.accepted_warning_token).toBeUndefined();
    expect(applications[1]!.accepted_warning_token).toMatch(/^warning_[a-f0-9]{64}$/);
    expect(result.transcript.slice(result.transcript.indexOf("Review proposed addition"))).toBe(
      `Review proposed addition
  Add relationship: P-210: Projects Overview NAVIGATES_TO P-100: Dashboard
  Leave both existing nodes where they are

Save these changes?
  1. Save
  2. Cancel
Choose a number: 1
Chosen: Save changes

Warning
  P-210: Projects Overview already has this exact navigation to P-100: Dashboard.

Save anyway?
  1. Save anyway
  2. Go back
Choose a number: 1
Chosen: Save anyway

Saved guided-addition-acceptance.sdd.
`
    );
    expect(fs.readFileSync(target.absolute, "utf8").match(/NAVIGATES_TO P-100 "Dashboard"/g)).toHaveLength(2);
  });

  it("returns Go back to the unchanged review and allows cancellation without writing", async () => {
    const target = fixture("warning-go-back");
    const prompt = new TranscriptPrompt(
      [
        "Incoming: another node connects to P-100 [choose by relationship type]",
        "Place NAVIGATES_TO P-100",
        /^P-210: Projects Overview/,
        "Save",
        "Go back",
        "Cancel"
      ],
      {},
      [false]
    );
    const result = await run(target, prompt, ["--node", "P-100"]);

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.transcript.match(/Review proposed addition/g)).toHaveLength(2);
    expect(fs.readFileSync(target.absolute, "utf8")).toBe(target.original);
  });

  it("renders contextual filter choices and never exposes forbidden implementation language", async () => {
    const target = fixture("filter-and-cancel");
    const prompt = new TranscriptPrompt(
      [
        "Add a standalone node",
        "[Filter nodes by diagram type: All diagram types]",
        "IA Place Map",
        "[Filter nodes by diagram type: IA Place Map]",
        "All diagram types",
        /^Place —/,
        "Last position",
        "Cancel"
      ],
      {
        "New node ID": "P-301",
        "New node Name": "Settings",
        "New node Description": "Configuration and preferences"
      },
      [false]
    );
    const result = await run(target, prompt);

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.transcript).toContain("Choose a diagram type to filter nodes by");
    expect(result.transcript).toContain("Chosen: IA Place Map filter");
    expect(result.transcript).toContain("Chosen: All diagram types filter");
    expect(result.transcript).not.toMatch(/reason_code|recommendation_id|proposal_[a-f0-9]|choice_[a-f0-9]|role:|presence:|source stream|reparent|\-\[[A-Z_]+\]\>/i);
  });

  it("rejects hidden --view initialization and keeps the CLI free of semantic reconstruction", async () => {
    const target = fixture("view-rejected");
    const prompt = new TranscriptPrompt([]);
    const result = await run(target, prompt, ["--view", "ia_place_map"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unknown option '--view'");

    const source = fs.readFileSync(path.join(repoRoot, "src/cli/guidedAddition.ts"), "utf8");
    expect(source).not.toMatch(/bundle\.(contracts|views|authoring|profiles|vocab|syntax)/);
    expect(source).not.toMatch(/insert_node_block|insert_edge_line|reason_code|recommendation_id/);
  });
});
