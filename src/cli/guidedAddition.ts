import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Bundle } from "../bundle/types.js";
import { getGuidedAdditionDefaultDisplayProfileId } from "../bundle/guidedAuthoring.js";
import { formatPrettyDiagnostics } from "../diagnostics/formatPretty.js";
import { hasErrors, type Diagnostic } from "../diagnostics/types.js";
import type { SourceInput } from "../types.js";
import type { AuthoringWorkspace } from "../authoring/workspace.js";
import type { ProfileId } from "../authoring/contracts.js";
import type {
  ApplyAdditionProposalV1Args,
  ApplyAdditionProposalV1Result
} from "../authoring/additionProposalsV1.js";
import type {
  GuidedDocumentSnapshot,
  GuidedNewDocumentSnapshotInput
} from "../authoring/guidedAddition/sharedContracts.js";
import {
  GuidedAdditionV1DomainError,
  type CompletedAdditionProposalV1,
  type ExistingNodeRefV1,
  type GuidedAdditionActionV1,
  type GuidedAdditionResultV1,
  type GuidedAdditionRuntimeV1,
  type GuidedChoicePageV1,
  type GuidedChoiceV1,
  type GuidedFieldDefinitionV1,
  type GuidedFieldValueV1,
  type GuidedFormPageV1,
  type GuidedProposalReviewV1
} from "../authoring/guidedAddition/v1/contracts.js";

export const guidedBack = Symbol("guided-back");
export type GuidedBack = typeof guidedBack;

export interface GuidedPromptChoice<T> {
  value: T;
  label: string;
  description?: string;
}

export interface GuidedPromptAdapter {
  select<T>(request: {
    id: string;
    message: string;
    choices: GuidedPromptChoice<T>[];
    back?: boolean;
  }): Promise<T | GuidedBack>;
  input(request: {
    id: string;
    message: string;
    defaultValue?: string;
    required?: boolean;
  }): Promise<string>;
  confirm(request: {
    id: string;
    message: string;
    defaultValue?: boolean;
  }): Promise<boolean>;
  close(): void | Promise<void>;
}

export interface GuidedAdditionCliDeps {
  cwd: () => string;
  loadBundle: (manifestPath: string) => Promise<Bundle>;
  readSourceInput: (filePath: string) => Promise<SourceInput>;
  findAuthoringRepoRoot: (startDir: string) => Promise<string | null>;
  createAuthoringWorkspace: (repoRoot: string) => AuthoringWorkspace;
  createGuidedDocumentSnapshot: (
    bundle: Bundle,
    input: { document_ref: string; path?: string; text: string }
  ) => GuidedDocumentSnapshot;
  createNewGuidedDocumentSnapshot: (
    bundle: Bundle,
    input: GuidedNewDocumentSnapshotInput
  ) => GuidedDocumentSnapshot;
  createGuidedAdditionRuntimeV1: (bundle: Bundle) => GuidedAdditionRuntimeV1;
  applyAdditionProposalV1: (
    workspace: AuthoringWorkspace,
    bundle: Bundle,
    args: ApplyAdditionProposalV1Args
  ) => Promise<ApplyAdditionProposalV1Result>;
  createGuidedPrompt: () => GuidedPromptAdapter;
  stdout: (content: string) => void;
  stderr: (content: string) => void;
}

export interface GuidedAdditionCliOptions {
  node?: string;
  bundle?: string;
}

function appendLine(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function numberedChoiceText<T>(choices: GuidedPromptChoice<T>[]): string {
  return choices.map((choice, index) => {
    const description = choice.description ? ` — ${choice.description}` : "";
    return `  ${index + 1}. ${choice.label}${description}`;
  }).join("\n");
}

function parseChoiceIndex(answer: string, choiceCount: number): number | undefined {
  if (!/^\d+$/.test(answer.trim())) return undefined;
  const index = Number(answer.trim()) - 1;
  return index >= 0 && index < choiceCount ? index : undefined;
}

export function createReadlineGuidedPrompt(): GuidedPromptAdapter {
  const readline = createInterface({ input, output });
  return {
    async select<T>(request: { id: string; message: string; choices: GuidedPromptChoice<T>[]; back?: boolean }): Promise<T | GuidedBack> {
      if (request.choices.length === 0) throw new Error(`No choices are available for '${request.id}'.`);
      for (;;) {
        output.write(`${request.message}\n${numberedChoiceText(request.choices)}\n`);
        const promptText = request.back ? "Choose a number (b for back): " : "Choose a number: ";
        const answer = await readline.question(promptText);
        if (request.back && (answer.trim() === "b" || answer.trim() === "B")) return guidedBack;
        const index = parseChoiceIndex(answer, request.choices.length);
        if (index !== undefined) return request.choices[index]!.value;
        output.write("Enter one of the listed numbers.\n");
      }
    },
    async input(request): Promise<string> {
      for (;;) {
        const suffix = request.defaultValue !== undefined ? ` [${request.defaultValue}]` : "";
        const answer = await readline.question(`${request.message}${suffix}: `);
        const value = answer.length === 0 && request.defaultValue !== undefined ? request.defaultValue : answer;
        if (!request.required || value.trim().length > 0) return value;
        output.write("A value is required.\n");
      }
    },
    async confirm(request): Promise<boolean> {
      const defaultText = request.defaultValue === false ? "y/N" : "Y/n";
      for (;;) {
        const answer = (await readline.question(`${request.message} [${defaultText}]: `)).trim().toLowerCase();
        if (answer.length === 0) return request.defaultValue !== false;
        if (answer === "y" || answer === "yes") return true;
        if (answer === "n" || answer === "no") return false;
        output.write("Answer yes or no.\n");
      }
    },
    close(): void {
      readline.close();
    }
  };
}

function writeDiagnostics(deps: Pick<GuidedAdditionCliDeps, "stderr">, diagnostics: Diagnostic[]): void {
  if (diagnostics.length > 0) deps.stderr(appendLine(formatPrettyDiagnostics(diagnostics)));
}

function exactAnchor(snapshot: GuidedDocumentSnapshot, nodeId: string | undefined): ExistingNodeRefV1 | undefined {
  if (!nodeId) return undefined;
  const matches = snapshot.nodes.filter((node) => node.node_id === nodeId);
  if (matches.length !== 1) {
    const detail = matches.length === 0 ? "was not found" : "is ambiguous";
    throw new Error(`Anchor node '${nodeId}' ${detail} in the document snapshot.`);
  }
  const node = matches[0]!;
  return {
    kind: "existing_node",
    handle: node.handle,
    node_id: node.node_id,
    node_type: node.node_type,
    name: node.name
  };
}

function pageMessage(page: GuidedChoicePageV1): string {
  return [
    page.content.title,
    ...page.content.lines.map((line) => `  ${line}`),
    ...(page.content.prompt ? [page.content.prompt] : [])
  ].join("\n");
}

function isDisclosurePage(page: GuidedChoicePageV1): boolean {
  return page.page_kind === "choose_node_detail_disclosure" ||
    page.page_kind === "choose_relationship_detail_disclosure";
}

function disclosureValue(choice: GuidedChoiceV1): boolean | undefined {
  if (choice.action.kind === "set_node_detail_disclosure" ||
      choice.action.kind === "set_relationship_detail_disclosure") {
    return choice.action.disclose;
  }
  return undefined;
}

async function actionForChoicePage(
  deps: GuidedAdditionCliDeps,
  prompt: GuidedPromptAdapter,
  page: GuidedChoicePageV1,
  back: boolean
): Promise<GuidedAdditionActionV1 | GuidedBack> {
  if (isDisclosurePage(page)) {
    const answer = await prompt.confirm({ id: page.page_id, message: page.content.title, defaultValue: false });
    const selected = page.choices.find((choice) => disclosureValue(choice) === answer);
    if (!selected) throw new Error(`The guided page '${page.page_id}' did not provide both disclosure choices.`);
    return selected.action;
  }
  const selected = await prompt.select<GuidedChoiceV1>({
    id: page.page_id,
    message: pageMessage(page),
    choices: page.choices.map((choice) => ({
      value: choice,
      label: choice.display,
      ...(choice.description ? { description: choice.description } : {})
    })),
    back
  });
  if (selected === guidedBack) {
    deps.stdout("Chosen: back\n\n");
    return guidedBack;
  }
  deps.stdout(`${selected.chosen}\n\n`);
  return selected.action;
}

function fieldPromptLabel(field: GuidedFieldDefinitionV1): string {
  return !field.required && field.prominence === "advanced"
    ? `${field.label} (optional)`
    : field.label;
}

async function promptField(
  prompt: GuidedPromptAdapter,
  page: GuidedFormPageV1,
  field: GuidedFieldDefinitionV1
): Promise<string> {
  const label = fieldPromptLabel(field);
  if (field.allowed_values && field.allowed_values.length > 0) {
    const selected = await prompt.select<string>({
      id: `${page.page_id}:${field.field_id}`,
      message: label,
      choices: [
        ...field.allowed_values.map((value) => ({ value, label: value })),
        ...(!field.required ? [{ value: "", label: "Leave blank" }] : [])
      ]
    });
    if (selected === guidedBack) throw new Error("Back is not available on form fields.");
    return selected;
  }
  return prompt.input({
    id: `${page.page_id}:${field.field_id}`,
    message: label,
    ...(field.suggested_raw_value !== undefined ? { defaultValue: field.suggested_raw_value } : {}),
    required: field.required
  });
}

async function actionForFormPage(
  prompt: GuidedPromptAdapter,
  page: GuidedFormPageV1
): Promise<GuidedAdditionActionV1> {
  const values: GuidedFieldValueV1[] = [];
  for (const field of page.fields) {
    const rawValue = await promptField(prompt, page, field);
    if (rawValue.length > 0 || field.required) {
      values.push({ field_id: field.field_id, value_kind: field.value_kind, raw_value: rawValue });
    }
  }
  return { ...page.submit_action, values };
}

function renderReview(deps: GuidedAdditionCliDeps, review: GuidedProposalReviewV1): void {
  deps.stdout(`${review.title}\n${review.lines.map((line) => `  ${line}`).join("\n")}\n\n`);
}

async function saveProposal(
  deps: GuidedAdditionCliDeps,
  prompt: GuidedPromptAdapter,
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  proposal: CompletedAdditionProposalV1,
  review: GuidedProposalReviewV1
): Promise<number> {
  for (;;) {
    renderReview(deps, review);
    const decision = await prompt.select<"save" | "cancel">({
      id: "save_or_cancel",
      message: "Save these changes?",
      choices: [{ value: "save", label: "Save" }, { value: "cancel", label: "Cancel" }]
    });
    deps.stdout(decision === "save" ? "Chosen: Save changes\n\n" : "Chosen: Cancel\n\n");
    if (decision === "cancel") {
      deps.stdout("Canceled. No changes were made.\n");
      return 0;
    }

    const dryRun = await deps.applyAdditionProposalV1(workspace, bundle, {
      proposal,
      mode: "dry_run",
      validate_profile: getGuidedAdditionDefaultDisplayProfileId(bundle) as ProfileId
    });
    if (dryRun.status === "rejected" || hasErrors(dryRun.diagnostics)) {
      writeDiagnostics(deps, dryRun.diagnostics);
      return 1;
    }

    let acceptedWarningToken: string | undefined;
    if (dryRun.warning_review) {
      deps.stdout(`${dryRun.warning_review.title}\n${dryRun.warning_review.lines.map((line) => `  ${line}`).join("\n")}\n\n`);
      const warningDecision = await prompt.select<"save_anyway" | "go_back">({
        id: "save_anyway",
        message: "Save anyway?",
        choices: [{ value: "save_anyway", label: "Save anyway" }, { value: "go_back", label: "Go back" }]
      });
      deps.stdout(warningDecision === "save_anyway" ? "Chosen: Save anyway\n\n" : "Chosen: Go back\n\n");
      if (warningDecision === "go_back") continue;
      acceptedWarningToken = dryRun.warning_review.acceptance_token;
    }

    const committed = await deps.applyAdditionProposalV1(workspace, bundle, {
      proposal,
      mode: "commit",
      validate_profile: getGuidedAdditionDefaultDisplayProfileId(bundle) as ProfileId,
      ...(acceptedWarningToken ? { accepted_warning_token: acceptedWarningToken } : {})
    });
    if (committed.status === "rejected" || hasErrors(committed.diagnostics)) {
      writeDiagnostics(deps, committed.diagnostics);
      deps.stderr("The document, bundle, resulting effect, or warning set changed after review. Restart `sdd add` before saving.\n");
      return 1;
    }
    deps.stdout(`Saved ${path.basename(proposal.document_context.document_ref)}.\n`);
    return 0;
  }
}

export async function runGuidedAdditionCommand(
  deps: GuidedAdditionCliDeps,
  documentPath: string,
  options: GuidedAdditionCliOptions
): Promise<number> {
  const prompt = deps.createGuidedPrompt();
  try {
    const absoluteDocumentPath = path.resolve(deps.cwd(), documentPath);
    const repoRoot = await deps.findAuthoringRepoRoot(path.dirname(absoluteDocumentPath));
    if (!repoRoot) throw new Error(`Could not find an SDD repository root for '${documentPath}'.`);
    const workspace = deps.createAuthoringWorkspace(repoRoot);
    const publicPath = workspace.normalizeDocumentPath(workspace.toPublicPath(absoluteDocumentPath));
    const bundlePath = options.bundle
      ? path.resolve(deps.cwd(), options.bundle)
      : path.join(repoRoot, "bundle/v0.1/manifest.yaml");
    const bundle = await deps.loadBundle(bundlePath);
    let snapshot: GuidedDocumentSnapshot;
    try {
      const source = await deps.readSourceInput(absoluteDocumentPath);
      snapshot = deps.createGuidedDocumentSnapshot(bundle, {
        document_ref: publicPath,
        path: publicPath,
        text: source.text
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      snapshot = deps.createNewGuidedDocumentSnapshot(bundle, {
        document_ref: publicPath,
        path: publicPath
      });
    }
    const runtime = deps.createGuidedAdditionRuntimeV1(bundle);
    const anchor = exactAnchor(snapshot, options.node);
    let result: GuidedAdditionResultV1 = runtime.begin(snapshot, {
      workflow_version: "1.0",
      ...(anchor ? { anchor } : {})
    });
    if (snapshot.document_precondition === "must_not_exist") {
      deps.stdout(`Creating new file ${path.basename(publicPath)}.\n\n`);
    }

    const history: GuidedAdditionResultV1[] = [];
    for (;;) {
      if (result.kind === "sdd-guided-addition-complete") {
        return await saveProposal(deps, prompt, workspace, bundle, result.proposal, result.review);
      }
      const action = "fields" in result.page
        ? await actionForFormPage(prompt, result.page)
        : await actionForChoicePage(deps, prompt, result.page, history.length > 0);
      if (action === guidedBack) {
        result = history.pop()!;
        continue;
      }
      history.push(result);
      result = runtime.advance(snapshot, result.state, action);
    }
  } catch (error) {
    if (error instanceof GuidedAdditionV1DomainError) writeDiagnostics(deps, error.diagnostics);
    else deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return 1;
  } finally {
    await prompt.close();
  }
}
