import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command, CommanderError } from "commander";
import { applyAdditionProposalV1 } from "../authoring/additionProposalsV1.js";
import { createGuidedAdditionRuntimeV1 } from "../authoring/guidedAddition/v1/planner.js";
import {
  createGuidedDocumentSnapshot,
  createNewGuidedDocumentSnapshot
} from "../authoring/guidedAddition/snapshot.js";
import { createAuthoringWorkspace, findAuthoringRepoRoot } from "../authoring/workspace.js";
import { loadBundle } from "../bundle/loadBundle.js";
import type { Bundle, ViewSpec } from "../bundle/types.js";
import { compileSource } from "../compiler/compileSource.js";
import type { CompiledGraph, CompileResult } from "../compiler/types.js";
import { formatJsonDiagnostics } from "../diagnostics/formatJson.js";
import { formatPrettyDiagnostics } from "../diagnostics/formatPretty.js";
import { hasErrors } from "../diagnostics/types.js";
import {
  getPreviewBackend,
  renderPreviewArtifact,
  type PreviewArtifactResult,
  type RenderPreviewArtifactRequest
} from "../renderer/previewBackends.js";
import {
  prepareCompiledGraphPreview,
  renderPreparedCompiledGraphPreview,
  renderSourcePreview,
  type CompiledPreviewRenderOptions,
  type PreparedCompiledGraphPreview,
  type SourcePreviewRenderResult
} from "../renderer/previewWorkflow.js";
import { renderSource } from "../renderer/renderView.js";
import {
  getKnownRenderableViewIds,
  getPreviewArtifactCapabilities,
  getPreviewArtifactCapability,
  getSupportedPreviewFormats,
  getSupportedPreviewBackendIds,
  getSupportedTextFormats,
  getTextArtifactCapability,
  getViewRenderCapability,
  type PreviewFormat,
  type PreviewRendererBackendId,
  type TextRenderFormat,
  type ViewRenderCapability
} from "../renderer/viewRenderers.js";
import {
  buildExplicitBatchPreviewOutputPath,
  buildShowPreviewOutputPath
} from "../previewArtifactPaths.js";
import { isBatchApplicable } from "../renderer/prepareProjectionForRender.js";
import type { Diagnostic, RenderOptions, RenderResult, SourceInput } from "../types.js";
import { validateGraph } from "../validator/validateGraph.js";
import type { ValidationReport } from "../validator/types.js";
import {
  createDefaultsConfigRuntime,
  validateResolvedDefault,
  type DefaultsConfigSource,
  type DefaultsConfigRuntime,
  type DefaultsConfigSetting
} from "../config/index.js";
import {
  createReadlineGuidedPrompt,
  runGuidedAdditionCommand,
  type GuidedAdditionCliDeps
} from "./guidedAddition.js";
import { resolveCliRenderSettings, resolveCliValidationProfile } from "./profileResolution.js";

const defaultManifestPath = path.resolve("bundle/v0.1/manifest.yaml");
const jsonDiagnosticsHint = "Hint: rerun with --diagnostics json for machine-readable diagnostics.";

type DiagnosticsFormat = "pretty" | "json";

export interface CliDeps extends GuidedAdditionCliDeps {
  defaultsConfig: DefaultsConfigRuntime;
  compileSource: (input: SourceInput, bundle: Bundle) => CompileResult;
  validateGraph: (graph: NonNullable<CompileResult["graph"]>, bundle: Bundle, profileId: string) => ValidationReport;
  renderSource: (input: SourceInput, bundle: Bundle, options: RenderOptions) => RenderResult;
  renderSourcePreview: (input: SourceInput, bundle: Bundle, options: {
    viewId: string;
    format: PreviewFormat;
    profileId: string;
    detailId: string;
    backendId?: PreviewRendererBackendId;
  }) => Promise<SourcePreviewRenderResult>;
  prepareCompiledGraphPreview: (
    sourcePath: string,
    graph: CompiledGraph,
    bundle: Bundle,
    options: CompiledPreviewRenderOptions
  ) => PreparedCompiledGraphPreview;
  renderPreparedCompiledGraphPreview: (
    sourcePath: string,
    graph: CompiledGraph,
    bundle: Bundle,
    prepared: PreparedCompiledGraphPreview
  ) => Promise<SourcePreviewRenderResult>;
  writeTextFile: (outputPath: string, content: string) => Promise<void>;
  writeBinaryFile: (outputPath: string, content: Uint8Array) => Promise<void>;
  renderPreviewArtifact: (request: RenderPreviewArtifactRequest) => Promise<PreviewArtifactResult>;
  stdout: (content: string) => void;
  stderr: (content: string) => void;
}

export interface RunCliResult {
  exitCode: number;
}

interface OutputValidationResult {
  valid: boolean;
  message?: string;
}

function appendLine(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

async function defaultReadSourceInput(filePath: string): Promise<SourceInput> {
  const resolvedPath = path.resolve(filePath);
  return {
    path: resolvedPath,
    text: await readFile(resolvedPath, "utf8")
  };
}

async function defaultWriteTextFile(outputPath: string, content: string): Promise<void> {
  await writeFile(path.resolve(outputPath), content, "utf8");
}

async function defaultWriteBinaryFile(outputPath: string, content: Uint8Array): Promise<void> {
  await writeFile(path.resolve(outputPath), content);
}

function createDefaultDeps(): CliDeps {
  return {
    cwd: () => process.cwd(),
    loadBundle,
    readSourceInput: defaultReadSourceInput,
    findAuthoringRepoRoot,
    createAuthoringWorkspace,
    createGuidedDocumentSnapshot,
    createNewGuidedDocumentSnapshot,
    createGuidedAdditionRuntimeV1,
    applyAdditionProposalV1,
    createGuidedPrompt: createReadlineGuidedPrompt,
    defaultsConfig: createDefaultsConfigRuntime(),
    compileSource,
    validateGraph,
    renderSource,
    renderSourcePreview,
    prepareCompiledGraphPreview,
    renderPreparedCompiledGraphPreview,
    writeTextFile: defaultWriteTextFile,
    writeBinaryFile: defaultWriteBinaryFile,
    renderPreviewArtifact,
    stdout: (content) => {
      process.stdout.write(content);
    },
    stderr: (content) => {
      process.stderr.write(content);
    }
  };
}

function withDefaults(overrides: Partial<CliDeps> = {}): CliDeps {
  return {
    ...createDefaultDeps(),
    ...overrides
  };
}

function normalizeDiagnosticsFormat(value: string): DiagnosticsFormat {
  return value === "json" ? "json" : "pretty";
}

function formatValidationSummary(graph: NonNullable<CompileResult["graph"]>): string {
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;
  return `Validated ${nodeCount} node${nodeCount === 1 ? "" : "s"} and ${edgeCount} edge${
    edgeCount === 1 ? "" : "s"
  }.`;
}

function writeDiagnostics(io: Pick<CliDeps, "stderr">, diagnostics: Diagnostic[], format: DiagnosticsFormat): void {
  if (diagnostics.length === 0) {
    return;
  }

  const content = format === "json"
    ? formatJsonDiagnostics(diagnostics)
    : `${formatPrettyDiagnostics(diagnostics)}\n\n${jsonDiagnosticsHint}`;
  io.stderr(appendLine(content));
}

function writeNotes(io: Pick<CliDeps, "stderr">, notes: string[]): void {
  for (const note of notes) {
    io.stderr(appendLine(note));
  }
}

async function writeTextOutput(
  deps: Pick<CliDeps, "stdout" | "stderr" | "writeTextFile">,
  outputPath: string | undefined,
  content: string
): Promise<void> {
  if (!outputPath) {
    deps.stdout(appendLine(content));
    return;
  }

  const resolvedPath = path.resolve(outputPath);
  await deps.writeTextFile(resolvedPath, content);
  deps.stderr(appendLine(`Wrote ${resolvedPath}`));
}

function announceFileWrite(io: Pick<CliDeps, "stderr">, outputPath: string): void {
  io.stderr(appendLine(`Wrote ${path.resolve(outputPath)}`));
}

function appendInstallHint(message: string, backendId: PreviewRendererBackendId): string {
  const hint = getPreviewBackend(backendId).installHint();
  return hint ? `${message}\n${hint}` : message;
}

function replaceExtension(filePath: string, extension: string): string {
  const parsed = path.parse(path.resolve(filePath));
  return path.join(parsed.dir, `${parsed.name}.${extension}`);
}

function validateOutputExtension(outputPath: string | undefined, expectedExtension: string, optionName: string): OutputValidationResult {
  if (!outputPath) {
    return { valid: true };
  }

  const actualExtension = path.extname(outputPath).toLowerCase();
  if (!actualExtension) {
    return { valid: true };
  }

  if (actualExtension === `.${expectedExtension.toLowerCase()}`) {
    return { valid: true };
  }

  return {
    valid: false,
    message: `${optionName} expects a .${expectedExtension} file, but got '${outputPath}'.`
  };
}

function formatList(values: string[]): string {
  return values.join(", ");
}

function getViewSpec(bundle: Bundle, viewId: string): ViewSpec | undefined {
  return bundle.views.views.find((view) => view.id === viewId);
}

function getKnownRenderableViews(bundle: Bundle): string[] {
  return getKnownRenderableViewIds(bundle);
}

function getViewCapability(bundle: Bundle, viewId: string): { view?: ViewSpec; capability?: ViewRenderCapability; message?: string } {
  const view = getViewSpec(bundle, viewId);
  if (!view) {
    return {
      message: `Unknown view '${viewId}'. Available bundle views: ${formatList(bundle.views.views.map((candidate) => candidate.id))}.`
    };
  }

  const capability = getViewRenderCapability(viewId);
  if (!capability) {
    const supportedViews = getKnownRenderableViews(bundle);
    return {
      view,
      message: `View '${viewId}' is defined in the bundle but is not renderable yet. Renderable views in this CLI: ${formatList(supportedViews)}.`
    };
  }

  return {
    view,
    capability
  };
}

function ensureTextFormat(bundle: Bundle, viewId: string, format: string): { view?: ViewSpec; capability?: ViewRenderCapability; message?: string } {
  const resolved = getViewCapability(bundle, viewId);
  if (!resolved.capability) {
    return {
      message: resolved.message
    };
  }

  const textFormat = format as TextRenderFormat;
  if (!getTextArtifactCapability(resolved.capability, textFormat)) {
    return {
      message: `View '${viewId}' does not support text format '${format}'. Supported text formats: ${formatList(getSupportedTextFormats(resolved.capability))}.`
    };
  }

  return {
    view: resolved.view,
    capability: resolved.capability
  };
}

function ensurePreviewFormat(
  bundle: Bundle,
  viewId: string,
  format: string,
  backendId?: PreviewRendererBackendId
): { view?: ViewSpec; capability?: ViewRenderCapability; message?: string } {
  const resolved = getViewCapability(bundle, viewId);
  if (!resolved.capability) {
    return {
      message: resolved.message
    };
  }

  const previewFormat = format as PreviewFormat;
  if (!getPreviewArtifactCapability(resolved.capability, previewFormat, backendId)) {
    const supportedBackendIds = backendId
      ? ` Supported backends for '${previewFormat}': ${formatList(getSupportedPreviewBackendIds(resolved.capability, previewFormat))}.`
      : "";
    return {
      message: `View '${viewId}' does not support preview format '${format}'${backendId ? ` with backend '${backendId}'` : ""}. Supported preview formats: ${formatList(getSupportedPreviewFormats(resolved.capability))}.${supportedBackendIds}`
    };
  }

  return {
    view: resolved.view,
    capability: resolved.capability
  };
}

interface CompileContext {
  bundle: Bundle;
  input: SourceInput;
}

async function prepareContext(deps: CliDeps, bundlePath: string, inputPath: string): Promise<CompileContext> {
  const bundle = await deps.loadBundle(bundlePath);
  const input = await deps.readSourceInput(inputPath);
  return {
    bundle,
    input
  };
}

async function runCompile(
  deps: CliDeps,
  inputPath: string,
  options: { bundle: string; out?: string; diagnostics: string }
): Promise<number> {
  try {
    const { bundle, input } = await prepareContext(deps, options.bundle, inputPath);
    const result = deps.compileSource(input, bundle);
    writeDiagnostics(deps, result.diagnostics, normalizeDiagnosticsFormat(options.diagnostics));
    if (result.graph && !hasErrors(result.diagnostics)) {
      await writeTextOutput(deps, options.out, JSON.stringify(result.graph, null, 2));
    }
    return hasErrors(result.diagnostics) ? 1 : 0;
  } catch (error) {
    deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function runValidate(
  deps: CliDeps,
  inputPath: string,
  options: { bundle: string; profile?: string; diagnostics: string }
): Promise<number> {
  try {
    const { bundle, input } = await prepareContext(deps, options.bundle, inputPath);
    const profileId = (await resolveCliValidationProfile(deps.defaultsConfig, bundle, options.profile)).value;
    const compileResult = deps.compileSource(input, bundle);
    const diagnostics = [...compileResult.diagnostics];
    if (compileResult.graph && !hasErrors(diagnostics)) {
      diagnostics.push(...deps.validateGraph(compileResult.graph, bundle, profileId).diagnostics);
    }
    const diagnosticsFormat = normalizeDiagnosticsFormat(options.diagnostics);
    const failed = hasErrors(diagnostics);
    writeDiagnostics(deps, diagnostics, diagnosticsFormat);
    if (compileResult.graph && !failed && diagnosticsFormat === "pretty") {
      deps.stdout(appendLine(formatValidationSummary(compileResult.graph)));
    }
    return failed ? 1 : 0;
  } catch (error) {
    deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function runRenderText(
  deps: CliDeps,
  inputPath: string,
  options: { bundle: string; profile?: string; detail?: string; view: string; format: string; out?: string; diagnostics: string }
): Promise<{ exitCode: number; text?: string; sourcePath?: string; bundle?: Bundle; view?: ViewSpec }> {
  try {
    const expectedExtension = options.format === "dot" ? "dot" : options.format === "mermaid" ? "mmd" : undefined;
    if (expectedExtension) {
      const outputValidation = validateOutputExtension(options.out, expectedExtension, "--out");
      if (!outputValidation.valid) {
        deps.stderr(appendLine(outputValidation.message ?? "Invalid output path."));
        return { exitCode: 2 };
      }
    }

    const { bundle, input } = await prepareContext(deps, options.bundle, inputPath);
    const settings = await resolveCliRenderSettings(deps.defaultsConfig, bundle, {
      profileId: options.profile,
      detailId: options.detail
    });
    const profileId = settings.profile.value;
    const detailId = settings.detail.value;
    const supported = ensureTextFormat(bundle, options.view, options.format);
    if (!supported.capability) {
      deps.stderr(appendLine(supported.message ?? `Unsupported render request for view '${options.view}'.`));
      return { exitCode: 2 };
    }

    const result = deps.renderSource(input, bundle, {
      viewId: options.view,
      format: options.format as TextRenderFormat,
      profileId,
      detailId
    });
    writeDiagnostics(deps, result.diagnostics, normalizeDiagnosticsFormat(options.diagnostics));
    if (!result.text || hasErrors(result.diagnostics)) {
      return { exitCode: hasErrors(result.diagnostics) ? 1 : 0 };
    }

    writeNotes(deps, result.notes);
    await writeTextOutput(deps, options.out, result.text);
    return {
      exitCode: 0,
      bundle,
      view: supported.view,
      text: result.text,
      sourcePath: input.path
    };
  } catch (error) {
    deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return { exitCode: 1 };
  }
}

async function writePreviewOutput(
  deps: Pick<CliDeps, "writeBinaryFile" | "writeTextFile">,
  outputPath: string,
  artifact: PreviewArtifactResult
): Promise<void> {
  if (artifact.format === "svg") {
    await deps.writeTextFile(path.resolve(outputPath), artifact.text);
    return;
  }

  await deps.writeBinaryFile(path.resolve(outputPath), artifact.bytes);
}

async function runDotCommand(
  deps: CliDeps,
  inputPath: string,
  options: { bundle: string; profile?: string; detail?: string; out?: string; png?: boolean; pngOut?: string; diagnostics: string }
): Promise<number> {
  const pngOutputValidation = validateOutputExtension(options.pngOut, "png", "--png-out");
  if (!pngOutputValidation.valid) {
    deps.stderr(appendLine(pngOutputValidation.message ?? "Invalid PNG output path."));
    return 2;
  }

  const renderResult = await runRenderText(deps, inputPath, {
    bundle: options.bundle,
    profile: options.profile,
    detail: options.detail,
    view: "ia_place_map",
    format: "dot",
    out: options.out,
    diagnostics: options.diagnostics
  });
  if (renderResult.exitCode !== 0 || !renderResult.text || !renderResult.sourcePath) {
    return renderResult.exitCode;
  }

  const pngPath = options.pngOut ?? (options.png ? replaceExtension(renderResult.sourcePath, "png") : undefined);
  if (!pngPath) {
    return 0;
  }

  const capability = getViewRenderCapability("ia_place_map");
  const previewCapability = capability ? getPreviewArtifactCapability(capability, "png", "legacy_graphviz_preview") : undefined;
  if (!previewCapability || !renderResult.bundle || !renderResult.view) {
    deps.stderr(appendLine("The ia_place_map view does not support PNG preview output."));
    return 2;
  }

  try {
    const artifact = await deps.renderPreviewArtifact({
      backendId: previewCapability.backendId,
      bundle: renderResult.bundle,
      view: renderResult.view,
      format: "png",
      source: {
        kind: "text",
        format: "dot",
        text: renderResult.text
      }
    });
    await writePreviewOutput(deps, pngPath, artifact);
    announceFileWrite(deps, pngPath);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.stderr(appendLine(appendInstallHint(message, previewCapability.backendId)));
    return 1;
  }
}

function resolveShowPreviewCapability(
  capability: ViewRenderCapability,
  format: PreviewFormat,
  backendId: PreviewRendererBackendId | undefined,
  preferDotIntermediate: boolean
): ReturnType<typeof getPreviewArtifactCapability> {
  if (backendId) {
    return getPreviewArtifactCapability(capability, format, backendId);
  }

  if (!preferDotIntermediate) {
    return getPreviewArtifactCapability(capability, format);
  }

  return getPreviewArtifactCapabilities(capability, format).find((candidate) => {
    const backend = getPreviewBackend(candidate.backendId);
    return backend.inputRequirement.kind === "text" && backend.inputRequirement.sourceFormat === "dot";
  });
}

interface ShowAllCandidate {
  view: ViewSpec;
  capability: ViewRenderCapability;
  previewCapability: NonNullable<ReturnType<typeof resolveShowPreviewCapability>>;
}

async function runShowAllCommand(
  deps: CliDeps,
  bundle: Bundle,
  input: SourceInput,
  options: {
    profileId: string;
    detailId: string;
    format: PreviewFormat;
    backendId?: PreviewRendererBackendId;
    out?: string;
    diagnostics: string;
  }
): Promise<number> {
  const candidates: ShowAllCandidate[] = bundle.views.views.flatMap((view) => {
    if (view.status !== "operational") return [];
    const capability = getViewRenderCapability(view.id);
    if (!capability || !getSupportedPreviewFormats(capability).includes(options.format)) return [];
    const previewCapability = resolveShowPreviewCapability(
      capability,
      options.format,
      options.backendId,
      false
    );
    return previewCapability ? [{ view, capability, previewCapability }] : [];
  });

  if (options.backendId) {
    const backendIncompatible = bundle.views.views.flatMap((view) => {
      if (view.status !== "operational") return [];
      const capability = getViewRenderCapability(view.id);
      if (!capability || !getSupportedPreviewFormats(capability).includes(options.format)) return [];
      return getPreviewArtifactCapability(capability, options.format, options.backendId) ? [] : [view.id];
    });
    if (backendIncompatible.length > 0) {
      deps.stderr(appendLine(
        `Preview backend '${options.backendId}' is not supported for every available ${options.format} view. Incompatible views: ${formatList(backendIncompatible)}.`
      ));
      return 2;
    }
  }

  if (candidates.length === 0) {
    deps.stderr(appendLine(`No operational renderable views support preview format '${options.format}'.`));
    return 2;
  }

  const compileResult = deps.compileSource(input, bundle);
  const sourceDiagnostics = [...compileResult.diagnostics];
  if (!compileResult.graph || hasErrors(sourceDiagnostics)) {
    writeDiagnostics(deps, sourceDiagnostics, normalizeDiagnosticsFormat(options.diagnostics));
    return 1;
  }
  const validation = deps.validateGraph(compileResult.graph, bundle, options.profileId);
  sourceDiagnostics.push(...validation.diagnostics);
  if (validation.errorCount > 0) {
    writeDiagnostics(deps, sourceDiagnostics, normalizeDiagnosticsFormat(options.diagnostics));
    return 1;
  }

  const preparedCandidates = candidates.map((candidate) => ({
    candidate,
    prepared: deps.prepareCompiledGraphPreview(input.path, compileResult.graph!, bundle, {
      viewId: candidate.view.id,
      format: options.format,
      profileId: options.profileId,
      detailId: options.detailId,
      backendId: candidate.previewCapability.backendId
    })
  }));
  const preparationDiagnostics = preparedCandidates.flatMap(({ prepared }) => prepared.diagnostics);
  if (hasErrors(preparationDiagnostics)) {
    writeDiagnostics(
      deps,
      [...sourceDiagnostics, ...preparationDiagnostics],
      normalizeDiagnosticsFormat(options.diagnostics)
    );
    return 1;
  }

  const applicable = preparedCandidates.filter(({ candidate, prepared }) =>
    prepared.prepared && isBatchApplicable(candidate.view, prepared.prepared)
  );
  const skipped = preparedCandidates.filter(({ candidate, prepared }) =>
    !prepared.prepared || !isBatchApplicable(candidate.view, prepared.prepared)
  );

  if (applicable.length === 0) {
    writeDiagnostics(
      deps,
      [...sourceDiagnostics, ...preparationDiagnostics],
      normalizeDiagnosticsFormat(options.diagnostics)
    );
    for (const { prepared } of skipped) writeNotes(deps, prepared.prepared?.notes ?? []);
    deps.stderr(appendLine(
      `No applicable diagrams found for detail '${options.detailId}'. Considered ${candidates.length} view(s).`
    ));
    return 0;
  }

  const outputEntries = applicable.map(({ candidate, prepared }) => ({
    candidate,
    prepared,
    outputPath: options.out
      ? buildExplicitBatchPreviewOutputPath(options.out, candidate.view.id)
      : buildShowPreviewOutputPath(input.path, {
        viewId: candidate.view.id,
        detailId: options.detailId,
        format: options.format,
        backendId: options.backendId ? candidate.previewCapability.backendId : undefined
      })
  }));
  const outputPaths = outputEntries.map(({ outputPath }) => path.resolve(outputPath));
  if (new Set(outputPaths).size !== outputPaths.length) {
    deps.stderr(appendLine("Batch preview output paths collide after view modifiers are applied."));
    return 2;
  }

  const renderedEntries: Array<{
    outputPath: string;
    result: SourcePreviewRenderResult;
  }> = [];
  for (const entry of outputEntries) {
    try {
      const result = await deps.renderPreparedCompiledGraphPreview(
        input.path,
        compileResult.graph,
        bundle,
        entry.prepared
      );
      renderedEntries.push({ outputPath: entry.outputPath, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.stderr(appendLine(appendInstallHint(message, entry.candidate.previewCapability.backendId)));
      return 1;
    }
  }

  const renderDiagnostics = renderedEntries.flatMap(({ result }) => result.diagnostics);
  const allDiagnostics = [
    ...sourceDiagnostics,
    ...skipped.flatMap(({ prepared }) => prepared.diagnostics),
    ...renderDiagnostics
  ];
  writeDiagnostics(deps, allDiagnostics, normalizeDiagnosticsFormat(options.diagnostics));
  if (hasErrors(renderDiagnostics) || renderedEntries.some(({ result }) => !result.artifact)) {
    return 1;
  }

  for (const { outputPath, result } of renderedEntries) {
    writeNotes(deps, result.notes);
    await writePreviewOutput(deps, outputPath, result.artifact!);
    announceFileWrite(deps, outputPath);
  }
  const skippedSuffix = skipped.length > 0
    ? ` Skipped ${skipped.length} without visible content: ${formatList(skipped.map(({ candidate }) => candidate.view.id))}.`
    : "";
  deps.stderr(appendLine(`Generated ${renderedEntries.length} diagram(s).${skippedSuffix}`));
  return 0;
}

async function runShowCommand(
  deps: CliDeps,
  inputPath: string,
  options: {
    bundle: string;
    profile?: string;
    detail?: string;
    view: string;
    format: string;
    out?: string;
    dotOut?: string;
    backend?: string;
    diagnostics: string;
  }
): Promise<number> {
  try {
    const requestedPreviewFormat = (options.format || getViewRenderCapability(options.view)?.defaultPreviewFormat || "svg") as PreviewFormat;
    const requestedBackendId = options.backend as PreviewRendererBackendId | undefined;
    if (options.view === "all" && options.dotOut) {
      deps.stderr(appendLine("--dot-out cannot be used with '--view all'. Select one view to keep an intermediate DOT file."));
      return 2;
    }
    const previewOutputValidation = validateOutputExtension(options.out, requestedPreviewFormat, "--out");
    if (!previewOutputValidation.valid) {
      deps.stderr(appendLine(previewOutputValidation.message ?? "Invalid preview output path."));
      return 2;
    }
    const dotOutputValidation = validateOutputExtension(options.dotOut, "dot", "--dot-out");
    if (!dotOutputValidation.valid) {
      deps.stderr(appendLine(dotOutputValidation.message ?? "Invalid DOT output path."));
      return 2;
    }

    const { bundle, input } = await prepareContext(deps, options.bundle, inputPath);
    const settings = await resolveCliRenderSettings(deps.defaultsConfig, bundle, {
      profileId: options.profile,
      detailId: options.detail
    });
    const profileId = settings.profile.value;
    const detailId = settings.detail.value;
    if (options.view === "all") {
      return runShowAllCommand(deps, bundle, input, {
        profileId,
        detailId,
        format: requestedPreviewFormat,
        backendId: requestedBackendId,
        out: options.out,
        diagnostics: options.diagnostics
      });
    }
    const supported = ensurePreviewFormat(bundle, options.view, requestedPreviewFormat, requestedBackendId);
    if (!supported.capability || !supported.view) {
      deps.stderr(appendLine(supported.message ?? `Unsupported preview request for view '${options.view}'.`));
      return 2;
    }

    const previewCapability = resolveShowPreviewCapability(
      supported.capability,
      requestedPreviewFormat,
      requestedBackendId,
      Boolean(options.dotOut && !requestedBackendId)
    );
    if (!previewCapability) {
      const supportedBackends = formatList(getSupportedPreviewBackendIds(supported.capability, requestedPreviewFormat));
      deps.stderr(appendLine(`Unsupported preview request for view '${options.view}'.`));
      deps.stderr(appendLine(`Supported preview backends for ${requestedPreviewFormat}: ${supportedBackends}.`));
      return 2;
    }
    if (options.dotOut) {
      const previewBackend = getPreviewBackend(previewCapability.backendId);
      if (previewBackend.inputRequirement.kind !== "text" || previewBackend.inputRequirement.sourceFormat !== "dot") {
        deps.stderr(appendLine(`Preview backend '${previewCapability.backendId}' does not expose a DOT intermediate for '--dot-out'.`));
        return 2;
      }
    }

    const previewPath = options.out ?? buildShowPreviewOutputPath(input.path, {
      viewId: options.view,
      detailId,
      format: requestedPreviewFormat,
      backendId: requestedBackendId ? previewCapability.backendId : undefined
    });
    try {
      const renderResult = await deps.renderSourcePreview(input, bundle, {
        backendId: previewCapability.backendId,
        viewId: options.view,
        format: requestedPreviewFormat,
        profileId,
        detailId
      });
      writeDiagnostics(deps, renderResult.diagnostics, normalizeDiagnosticsFormat(options.diagnostics));
      if (!renderResult.artifact || hasErrors(renderResult.diagnostics)) {
        return hasErrors(renderResult.diagnostics) ? 1 : 0;
      }

      writeNotes(deps, renderResult.notes);
      if (options.dotOut) {
        const dotSource = renderResult.artifact.sourceArtifacts?.dot;
        if (!dotSource) {
          deps.stderr(appendLine(`Preview backend '${previewCapability.backendId}' does not expose a DOT intermediate for '--dot-out'.`));
          return 2;
        }
        const resolvedDotPath = path.resolve(options.dotOut);
        await deps.writeTextFile(resolvedDotPath, dotSource);
        announceFileWrite(deps, resolvedDotPath);
      }
      await writePreviewOutput(deps, previewPath, renderResult.artifact);
      announceFileWrite(deps, previewPath);
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.stderr(appendLine(appendInstallHint(message, previewCapability.backendId)));
      return 1;
    }
  } catch (error) {
    deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

type DefaultsCliSetting = "profile" | "detail";

function parseDefaultsSetting(deps: Pick<CliDeps, "stderr">, value: string): DefaultsCliSetting | null {
  if (value === "profile" || value === "detail") return value;
  deps.stderr(`Unknown defaults setting '${value}'. Choose profile or detail.\n`);
  return null;
}

function storedSettingForCli(setting: DefaultsCliSetting): DefaultsConfigSetting {
  return setting === "profile" ? "validation_profile_id" : "render_detail_id";
}

function profileAvailability(bundle: Bundle): string[] {
  return bundle.manifest.profiles.map((profile) => profile.id);
}

function detailAvailability(bundle: Bundle): string[] {
  return bundle.manifest.render_details.map((detail) => detail.id);
}

function defaultsSourceLabel(source: DefaultsConfigSource): string {
  if (source === "global") return "user default";
  if (source === "bundle") return "bundle fallback";
  return "CLI override";
}

async function runDefaultsShow(
  deps: CliDeps,
  options: { bundle: string }
): Promise<number> {
  try {
    const bundle = await deps.loadBundle(options.bundle);
    const settings = await resolveCliRenderSettings(deps.defaultsConfig, bundle);
    deps.stdout([
      `Profile: ${settings.profile.value} (${defaultsSourceLabel(settings.profile.source)})`,
      `Detail: ${settings.detail.value} (${defaultsSourceLabel(settings.detail.source)})`
    ].join("\n") + "\n");
    return 0;
  } catch (error) {
    deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function runDefaultsSet(
  deps: CliDeps,
  settingValue: string,
  value: string,
  options: { bundle: string }
): Promise<number> {
  const setting = parseDefaultsSetting(deps, settingValue);
  if (!setting) return 2;

  try {
    const bundle = await deps.loadBundle(options.bundle);
    validateResolvedDefault({
      setting: storedSettingForCli(setting),
      selected: { value, source: "cli" },
      availableValues: setting === "profile" ? profileAvailability(bundle) : detailAvailability(bundle),
      bundlePath: bundle.manifestPath
    });

    const configPath = deps.defaultsConfig.getGlobalConfigPath();
    const result = await deps.defaultsConfig.set(configPath, storedSettingForCli(setting), value, {
      createParent: true
    });
    deps.stdout(result.changed
      ? `Set ${setting} to '${value}' in user defaults at ${configPath}.\n`
      : `${setting[0]!.toUpperCase()}${setting.slice(1)} is already '${value}' in user defaults at ${configPath}; no changes made.\n`);
    return 0;
  } catch (error) {
    deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function runDefaultsUnset(
  deps: CliDeps,
  settingValue: string
): Promise<number> {
  const setting = parseDefaultsSetting(deps, settingValue);
  if (!setting) return 2;

  try {
    const configPath = deps.defaultsConfig.getGlobalConfigPath();
    const result = await deps.defaultsConfig.unset(configPath, storedSettingForCli(setting));
    deps.stdout(result.changed
      ? `Unset ${setting} in user defaults at ${configPath}.\n`
      : `${setting[0]!.toUpperCase()}${setting.slice(1)} is already unset in user defaults at ${configPath}; no changes made.\n`);
    return 0;
  } catch (error) {
    deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

function globalHelpText(): string {
  return [
    "",
    "Validation profiles (bundle-declared; shipped v0.1 profiles shown):",
    "  simple       low-noise drafting",
    "  permissive   warning-first completeness",
    "  strict       strict governance",
    "  Omit --profile to resolve your user default, then the selected-bundle fallback.",
    "",
    "Render detail (bundle-declared; shipped v0.1 values shown):",
    "  compact      low-noise primary structure",
    "  detailed     supporting annotations and labels",
    "  Omit --detail to resolve your user default, then the selected-bundle fallback.",
    "",
    "Common flows:",
    "  sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd",
    "  sdd defaults show",
    "  sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile strict",
    "  sdd validate real_world_exploration/billSage_example/billSage_simple_structure.sdd --profile simple",
    "  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map",
    "  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view all",
    "  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view journey_map --out ./journey.svg",
    "  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view outcome_opportunity_map --out ./outcome-opportunity.svg",
    "  sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --out ./blueprint.svg",
    "  sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --out ./ui-contracts.svg",
    "  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format png --out ./outcome.png",
    "",
    "Notes:",
    "  `show` defaults to SVG preview output. Use `--view all` to save every applicable view after render-detail filtering. `ia_place_map`, `journey_map`, `outcome_opportunity_map`, `service_blueprint`, `scenario_flow`, and `ui_contracts` select staged preview backends by default. Legacy Graphviz preview remains available with `--backend legacy_graphviz_preview`.",
    "  Internal DOT and Mermaid text artifacts remain available for tests and debugging.",
    "  Use `sdd help <command>` or `<command> --help` for required and optional flags.",
  ].join("\n");
}

function examplesBlock(lines: string[]): string {
  return ["", "Examples:", ...lines.map((line) => `  ${line}`)].join("\n");
}

export function createProgram(overrides: Partial<CliDeps> = {}): Command {
  const deps = withDefaults(overrides);
  let commandExitCode = 0;
  const setExitCode = (value: number): void => {
    commandExitCode = value;
  };

  const program = new Command();
  program
    .name("sdd")
    .description("Structured Design Document toolchain CLI")
    .showHelpAfterError()
    .showSuggestionAfterError()
    .configureOutput({
      writeOut: (content) => deps.stdout(content),
      writeErr: (content) => deps.stderr(content)
    })
    .addHelpText("after", globalHelpText());

  program
    .command("add")
    .summary("Interactively add a node or relationship")
    .description("Guide a semantic addition, review a dry run, and Save or Cancel without constructing source text in the CLI.")
    .argument("<document_path>", "repo-owned .sdd path (created on Save if absent)")
    .option("--node <node_id>", "exact anchor node id")
    .option("--bundle <manifest>", "bundle manifest path")
    .addHelpText("after", examplesBlock([
      "sdd add tmp_app.sdd",
      "sdd add bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "sdd add bundle/v0.1/examples/outcome_to_ia_trace.sdd --node O-001"
    ]))
    .action(async (documentPath, options) => {
      setExitCode(await runGuidedAdditionCommand(deps, documentPath, options));
    });

  program
    .command("compile")
    .summary("Compile a source .sdd file to canonical graph JSON")
    .description("Compile a source .sdd file to canonical graph JSON.")
    .argument("<input>", "source .sdd file")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--out <file>", "write compiled JSON to a file instead of stdout")
    .option("--diagnostics <format>", "diagnostics format (pretty or json)", "pretty")
    .addHelpText("after", examplesBlock([
      "sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd --out ./outcome.json --diagnostics json"
    ]))
    .action(async (inputPath, options) => {
      setExitCode(await runCompile(deps, inputPath, options));
    });

  const defaultsCommand = program
    .command("defaults")
    .summary("Show or manage persistent CLI defaults")
    .description("Show or manage your user defaults for validation profile and render detail.")
    .option("--bundle <manifest>", "bundle manifest used to validate stored values", defaultManifestPath)
    .action(async (options) => {
      setExitCode(await runDefaultsShow(deps, options));
    });

  defaultsCommand
    .command("show")
    .description("Show the effective profile and detail.")
    .option("--bundle <manifest>", "bundle manifest used to validate stored values", defaultManifestPath)
    .action(async (options) => {
      setExitCode(await runDefaultsShow(deps, options));
    });

  defaultsCommand
    .command("set")
    .description("Set one user default.")
    .argument("<setting>", "profile or detail")
    .argument("<value>", "bundle-declared setting value")
    .option("--bundle <manifest>", "bundle manifest used to validate the value", defaultManifestPath)
    .action(async (setting, value, options) => {
      setExitCode(await runDefaultsSet(deps, setting, value, options));
    });

  defaultsCommand
    .command("unset")
    .description("Remove one user default.")
    .argument("<setting>", "profile or detail")
    .action(async (setting) => {
      setExitCode(await runDefaultsUnset(deps, setting));
    });

  program
    .command("validate")
    .summary("Compile and validate a source .sdd file")
    .description("Compile and validate a source .sdd file against a validation profile.")
    .argument("<input>", "source .sdd file")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--profile <profile>", "profile id override; omission uses the resolved user/bundle default")
    .option("--diagnostics <format>", "diagnostics format (pretty or json)", "pretty")
    .addHelpText("after", examplesBlock([
      "sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile permissive",
      "sdd validate real_world_exploration/billSage_example/billSage_simple_structure.sdd --profile simple"
    ]))
    .action(async (inputPath, options) => {
      setExitCode(await runValidate(deps, inputPath, options));
    });

  program
    .command("render", { hidden: true })
    .summary("Emit internal DOT or Mermaid text artifacts for a specific view")
    .description("Internal/debug renderer command. These text artifacts are retained for tests, corpus generation, and debugging. Use `sdd show` for supported SVG/PNG preview output.")
    .argument("<input>", "source .sdd file")
    .requiredOption("--view <view>", "view id")
    .requiredOption("--format <format>", "internal text render format (dot or mermaid)")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--profile <profile>", "profile id override; omission uses the resolved user/bundle default")
    .option("--detail <detail>", "render detail id override; omission uses the resolved user/bundle default")
    .option("--out <file>", "write rendered output to a file instead of stdout")
    .option("--diagnostics <format>", "diagnostics format (pretty or json)", "pretty")
    .addHelpText("after", examplesBlock([
      "sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format dot",
      "sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format mermaid --out ./outcome.mmd",
      "sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view journey_map --format mermaid --out ./journey.mmd",
      "sdd render bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --format dot --out ./blueprint.dot",
      "sdd render bundle/v0.1/examples/scenario_branching.sdd --view scenario_flow --format dot --out ./scenario.dot",
      "sdd render bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --format dot --out ./ui-contracts.dot"
    ]))
    .action(async (inputPath, options) => {
      const result = await runRenderText(deps, inputPath, options);
      setExitCode(result.exitCode);
    });

  program
    .command("dot", { hidden: true })
    .summary("Internal/debug: render the ia_place_map view as DOT")
    .description("Internal convenience wrapper for `sdd render --view ia_place_map --format dot`. Use `sdd show` for supported preview output.")
    .argument("<input>", "source .sdd file")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--profile <profile>", "profile id override; omission uses the resolved user/bundle default")
    .option("--detail <detail>", "render detail id override; omission uses the resolved user/bundle default")
    .option("--out <file>", "write internal DOT output to a file instead of stdout")
    .option("--png", "also write a sibling PNG preview rendered through the SVG pipeline")
    .option("--png-out <file>", "write PNG output to an explicit file path")
    .option("--diagnostics <format>", "diagnostics format (pretty or json)", "pretty")
    .addHelpText("after", examplesBlock([
      "sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd --png",
      "sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd --out ./outcome.dot --png-out ./outcome.png"
    ]))
    .action(async (inputPath, options) => {
      setExitCode(await runDotCommand(deps, inputPath, options));
    });

  program
    .command("mmd", { hidden: true })
    .summary("Internal/debug: render the ia_place_map view as Mermaid")
    .description("Internal convenience wrapper for `sdd render --view ia_place_map --format mermaid`. Use `sdd show` for supported preview output.")
    .argument("<input>", "source .sdd file")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--profile <profile>", "profile id override; omission uses the resolved user/bundle default")
    .option("--detail <detail>", "render detail id override; omission uses the resolved user/bundle default")
    .option("--out <file>", "write internal Mermaid output to a file instead of stdout")
    .option("--diagnostics <format>", "diagnostics format (pretty or json)", "pretty")
    .addHelpText("after", examplesBlock([
      "sdd mmd bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "sdd mmd bundle/v0.1/examples/outcome_to_ia_trace.sdd --out ./outcome.mmd"
    ]))
    .action(async (inputPath, options) => {
      const result = await runRenderText(deps, inputPath, {
        ...options,
        view: "ia_place_map",
        format: "mermaid"
      });
      setExitCode(result.exitCode);
    });

  program
    .command("show")
    .summary("Compile, validate, and produce preview artifacts for one or all applicable views")
    .description("Preferred preview command for renderable views. Use `--view all` to generate every operational view with visible content after applying render detail. In v0.1 it defaults to SVG output. `ia_place_map`, `journey_map`, `outcome_opportunity_map`, `service_blueprint`, `scenario_flow`, and `ui_contracts` select staged preview backends by default. Legacy Graphviz preview remains available with `--backend legacy_graphviz_preview`.")
    .argument("<input>", "source .sdd file")
    .requiredOption("--view <view>", "view id, or all for every applicable view")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--profile <profile>", "profile id override; omission uses the resolved user/bundle default")
    .option("--detail <detail>", "render detail id override; omission uses the resolved user/bundle default")
    .option("--format <format>", "preview format (svg or png)", "svg")
    .option("--backend <backend>", "preview backend id override")
    .option("--out <file>", "write preview output; with --view all, insert each view id before the extension; omission defaults to <input>.<view>.<detail>[.<backend>].<format> beside the input")
    .option("--dot-out <file>", "internal/debug: also keep the intermediate DOT source for one selected view; incompatible with --view all")
    .option("--diagnostics <format>", "diagnostics format (pretty or json)", "pretty")
    .addHelpText("after", examplesBlock([
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map",
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view all",
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view all --out ./outcome.svg",
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --backend legacy_graphviz_preview --out ./outcome-legacy.svg",
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view outcome_opportunity_map --out ./outcome-opportunity.svg",
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view outcome_opportunity_map --backend legacy_graphviz_preview --out ./outcome-opportunity-legacy.svg",
      "sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --out ./blueprint.svg",
      "sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --backend legacy_graphviz_preview --out ./blueprint-legacy.svg",
      "sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --out ./ui-contracts.svg",
      "sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --backend legacy_graphviz_preview --out ./ui-contracts-legacy.svg",
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format png --out ./outcome.png",
      "Some bundle-defined views may appear before they become renderable in the CLI."
    ]))
    .action(async (inputPath, options) => {
      setExitCode(await runShowCommand(deps, inputPath, options));
    });

  program.hook("postAction", () => {
    process.exitCode = commandExitCode;
  });

  return program;
}

export async function runCli(argv: string[] = process.argv, overrides: Partial<CliDeps> = {}): Promise<RunCliResult> {
  const program = createProgram(overrides);
  let exitCode = 0;

  program.exitOverride();

  try {
    await program.parseAsync(argv);
    exitCode = typeof process.exitCode === "number" ? process.exitCode : 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      exitCode = typeof error.exitCode === "number" ? error.exitCode : 1;
    } else {
      const deps = withDefaults(overrides);
      deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
      exitCode = 1;
    }
  } finally {
    process.exitCode = 0;
  }

  return { exitCode };
}
