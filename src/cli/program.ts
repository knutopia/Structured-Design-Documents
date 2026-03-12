import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command, CommanderError } from "commander";
import { loadBundle } from "../bundle/loadBundle.js";
import type { Bundle, ViewSpec } from "../bundle/types.js";
import { embedSvgFont, renderDotToSvg, renderSvgToPng } from "./previewArtifacts.js";
import { compileSource } from "../compiler/compileSource.js";
import type { CompileResult } from "../compiler/types.js";
import { formatJsonDiagnostics } from "../diagnostics/formatJson.js";
import { formatPrettyDiagnostics } from "../diagnostics/formatPretty.js";
import { hasErrors } from "../diagnostics/types.js";
import type { DotPreviewStyle } from "../renderer/previewStyle.js";
import { resolveDotPreviewStyle } from "../renderer/previewStyle.js";
import { renderSource } from "../renderer/renderView.js";
import {
  getKnownRenderableViewIds,
  getViewRenderCapability,
  type PreviewFormat,
  type TextRenderFormat,
  type ViewRenderCapability
} from "../renderer/viewRenderers.js";
import type { Diagnostic, RenderOptions, RenderResult, SourceInput } from "../types.js";
import { validateGraph } from "../validator/validateGraph.js";
import type { ValidationReport } from "../validator/types.js";

const defaultManifestPath = path.resolve("bundle/v0.1/manifest.yaml");

type DiagnosticsFormat = "pretty" | "json";

export interface CliDeps {
  loadBundle: (manifestPath: string) => Promise<Bundle>;
  readSourceInput: (filePath: string) => Promise<SourceInput>;
  compileSource: (input: SourceInput, bundle: Bundle) => CompileResult;
  validateGraph: (graph: NonNullable<CompileResult["graph"]>, bundle: Bundle, profileId: string) => ValidationReport;
  renderSource: (input: SourceInput, bundle: Bundle, options: RenderOptions) => RenderResult;
  writeTextFile: (outputPath: string, content: string) => Promise<void>;
  renderDotToSvg: (dot: string, style: DotPreviewStyle) => Promise<string>;
  embedSvgFont: (svg: string, style: DotPreviewStyle) => Promise<string>;
  renderSvgToPng: (svg: string, outputPath: string, style: DotPreviewStyle) => Promise<void>;
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

function createDefaultDeps(): CliDeps {
  return {
    loadBundle,
    readSourceInput: defaultReadSourceInput,
    compileSource,
    validateGraph,
    renderSource,
    writeTextFile: defaultWriteTextFile,
    renderDotToSvg,
    embedSvgFont,
    renderSvgToPng,
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

function writeDiagnostics(io: Pick<CliDeps, "stderr">, diagnostics: Diagnostic[], format: DiagnosticsFormat): void {
  if (diagnostics.length === 0) {
    return;
  }

  const content = format === "json" ? formatJsonDiagnostics(diagnostics) : formatPrettyDiagnostics(diagnostics);
  io.stderr(appendLine(content));
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

  if (!resolved.capability.textFormats.includes(format as TextRenderFormat)) {
    return {
      message: `View '${viewId}' does not support text format '${format}'. Supported text formats: ${formatList(resolved.capability.textFormats)}.`
    };
  }

  return {
    view: resolved.view,
    capability: resolved.capability
  };
}

function ensurePreviewFormat(bundle: Bundle, viewId: string, format: string): { view?: ViewSpec; capability?: ViewRenderCapability; message?: string } {
  const resolved = getViewCapability(bundle, viewId);
  if (!resolved.capability) {
    return {
      message: resolved.message
    };
  }

  if (!resolved.capability.previewFormats.includes(format as PreviewFormat)) {
    return {
      message: `View '${viewId}' does not support preview format '${format}'. Supported preview formats: ${formatList(resolved.capability.previewFormats)}.`
    };
  }

  return {
    view: resolved.view,
    capability: resolved.capability
  };
}

function graphvizInstallHint(): string {
  const lines = [
    "Graphviz is required for SVG and PNG preview flows because the CLI shells out to `dot` for DOT-to-SVG layout.",
  ];

  if (process.platform === "linux" && process.env.WSL_DISTRO_NAME) {
    lines.push("Install Graphviz inside WSL and verify it with `dot -V` or `pnpm run check:graphviz`.");
  } else if (process.platform === "linux") {
    lines.push("Install Graphviz with your distro package manager and verify it with `dot -V`.");
  } else if (process.platform === "win32") {
    lines.push("Install Graphviz on Windows, ensure `dot.exe` is on PATH, and verify it with `dot -V`.");
  } else {
    lines.push("Install Graphviz for your platform and verify it with `dot -V`.");
  }

  return lines.join(" ");
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
  options: { bundle: string; profile: string; diagnostics: string }
): Promise<number> {
  try {
    const { bundle, input } = await prepareContext(deps, options.bundle, inputPath);
    const compileResult = deps.compileSource(input, bundle);
    const diagnostics = [...compileResult.diagnostics];
    if (compileResult.graph && !hasErrors(diagnostics)) {
      diagnostics.push(...deps.validateGraph(compileResult.graph, bundle, options.profile).diagnostics);
    }
    writeDiagnostics(deps, diagnostics, normalizeDiagnosticsFormat(options.diagnostics));
    return hasErrors(diagnostics) ? 1 : 0;
  } catch (error) {
    deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function runRenderText(
  deps: CliDeps,
  inputPath: string,
  options: { bundle: string; profile: string; view: string; format: string; out?: string }
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
    const supported = ensureTextFormat(bundle, options.view, options.format);
    if (!supported.capability) {
      deps.stderr(appendLine(supported.message ?? `Unsupported render request for view '${options.view}'.`));
      return { exitCode: 2 };
    }

    const result = deps.renderSource(input, bundle, {
      viewId: options.view,
      format: options.format as TextRenderFormat,
      profileId: options.profile
    });
    writeDiagnostics(deps, result.diagnostics, "pretty");
    if (!result.text || hasErrors(result.diagnostics)) {
      return { exitCode: hasErrors(result.diagnostics) ? 1 : 0 };
    }

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

async function writePreviewArtifact(
  deps: Pick<CliDeps, "writeTextFile" | "renderDotToSvg" | "embedSvgFont" | "renderSvgToPng">,
  dot: string,
  outputPath: string,
  format: PreviewFormat,
  style: DotPreviewStyle
): Promise<void> {
  const rawSvg = await deps.renderDotToSvg(dot, style);
  const svg = await deps.embedSvgFont(rawSvg, style);

  if (format === "svg") {
    await deps.writeTextFile(path.resolve(outputPath), svg);
    return;
  }

  await deps.renderSvgToPng(svg, outputPath, style);
}

async function runDotCommand(
  deps: CliDeps,
  inputPath: string,
  options: { bundle: string; profile: string; out?: string; png?: boolean; pngOut?: string }
): Promise<number> {
  const pngOutputValidation = validateOutputExtension(options.pngOut, "png", "--png-out");
  if (!pngOutputValidation.valid) {
    deps.stderr(appendLine(pngOutputValidation.message ?? "Invalid PNG output path."));
    return 2;
  }

  const renderResult = await runRenderText(deps, inputPath, {
    bundle: options.bundle,
    profile: options.profile,
    view: "ia_place_map",
    format: "dot",
    out: options.out
  });
  if (renderResult.exitCode !== 0 || !renderResult.text || !renderResult.sourcePath) {
    return renderResult.exitCode;
  }

  const pngPath = options.pngOut ?? (options.png ? replaceExtension(renderResult.sourcePath, "png") : undefined);
  if (!pngPath) {
    return 0;
  }

  try {
    const style = renderResult.bundle && renderResult.view
      ? resolveDotPreviewStyle(renderResult.bundle, renderResult.view)
      : { fontFamily: "Public Sans", dpi: 192 };
    await writePreviewArtifact(deps, renderResult.text, pngPath, "png", style);
    announceFileWrite(deps, pngPath);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.stderr(appendLine(`${message}\n${graphvizInstallHint()}`));
    return 1;
  }
}

async function runShowCommand(
  deps: CliDeps,
  inputPath: string,
  options: { bundle: string; profile: string; view: string; format: string; out?: string; dotOut?: string }
): Promise<number> {
  try {
    const requestedPreviewFormat = (options.format || getViewRenderCapability(options.view)?.defaultPreviewFormat || "svg") as PreviewFormat;
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
    const supported = ensurePreviewFormat(bundle, options.view, requestedPreviewFormat);
    if (!supported.capability || !supported.view) {
      deps.stderr(appendLine(supported.message ?? `Unsupported preview request for view '${options.view}'.`));
      return 2;
    }

    const sourceFormat = supported.capability.previewSourceByFormat[requestedPreviewFormat as PreviewFormat];
    const renderResult = deps.renderSource(input, bundle, {
      viewId: options.view,
      format: sourceFormat,
      profileId: options.profile
    });
    writeDiagnostics(deps, renderResult.diagnostics, "pretty");
    if (!renderResult.text || hasErrors(renderResult.diagnostics)) {
      return hasErrors(renderResult.diagnostics) ? 1 : 0;
    }

    if (options.dotOut) {
      const resolvedDotPath = path.resolve(options.dotOut);
      await deps.writeTextFile(resolvedDotPath, renderResult.text);
      announceFileWrite(deps, resolvedDotPath);
    }

    const previewPath = options.out ?? replaceExtension(input.path, requestedPreviewFormat);
    const style = resolveDotPreviewStyle(bundle, supported.view);
    try {
      await writePreviewArtifact(deps, renderResult.text, previewPath, requestedPreviewFormat, style);
      announceFileWrite(deps, previewPath);
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.stderr(appendLine(`${message}\n${graphvizInstallHint()}`));
      return 1;
    }
  } catch (error) {
    deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

function globalHelpText(): string {
  return [
    "",
    "Profiles:",
    "  simple       low-noise drafting",
    "  permissive   warning-first completeness",
    "  recommended  strict governance (default)",
    "",
    "Common flows:",
    "  sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd",
    "  sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile recommended",
    "  sdd validate real_world_exploration/billSage_simple_structure.sdd --profile simple",
    "  sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd --out ./outcome.dot",
    "  sdd mmd bundle/v0.1/examples/outcome_to_ia_trace.sdd --out ./outcome.mmd",
    "  sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view journey_map --format mermaid --out ./journey.mmd",
    "  sdd render bundle/v0.1/examples/scenario_branching.sdd --view scenario_flow --format dot --out ./scenario.dot",
    "  sdd render bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --format dot --out ./ui-contracts.dot",
    "  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map",
    "  sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --out ./blueprint.svg",
    "  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view outcome_opportunity_map --out ./outcome-map.svg",
    "  sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --out ./ui-contracts.svg",
    "  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format png --out ./outcome.png",
    "",
    "Notes:",
    "  `show` defaults to SVG preview output and uses Graphviz for DOT-to-SVG layout.",
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

  program
    .command("validate")
    .summary("Compile and validate a source .sdd file")
    .description("Compile and validate a source .sdd file against a validation profile.")
    .argument("<input>", "source .sdd file")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--profile <profile>", "profile id", "recommended")
    .option("--diagnostics <format>", "diagnostics format (pretty or json)", "pretty")
    .addHelpText("after", examplesBlock([
      "sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile permissive",
      "sdd validate real_world_exploration/billSage_simple_structure.sdd --profile simple"
    ]))
    .action(async (inputPath, options) => {
      setExitCode(await runValidate(deps, inputPath, options));
    });

  program
    .command("render")
    .summary("Render a specific view to DOT or Mermaid text")
    .description("Low-level renderer command. Use `sdd dot`, `sdd mmd`, or `sdd show` for the common preview flows.")
    .argument("<input>", "source .sdd file")
    .requiredOption("--view <view>", "view id")
    .requiredOption("--format <format>", "text render format (dot or mermaid)")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--profile <profile>", "profile id", "recommended")
    .option("--out <file>", "write rendered output to a file instead of stdout")
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
    .command("dot")
    .summary("Render the ia_place_map view as DOT")
    .description("Convenience wrapper for `sdd render --view ia_place_map --format dot`.")
    .argument("<input>", "source .sdd file")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--profile <profile>", "profile id", "recommended")
    .option("--out <file>", "write DOT output to a file instead of stdout")
    .option("--png", "also write a sibling PNG rendered through the SVG preview pipeline")
    .option("--png-out <file>", "write PNG output to an explicit file path")
    .addHelpText("after", examplesBlock([
      "sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd --png",
      "sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd --out ./outcome.dot --png-out ./outcome.png"
    ]))
    .action(async (inputPath, options) => {
      setExitCode(await runDotCommand(deps, inputPath, options));
    });

  program
    .command("mmd")
    .summary("Render the ia_place_map view as Mermaid")
    .description("Convenience wrapper for `sdd render --view ia_place_map --format mermaid`.")
    .argument("<input>", "source .sdd file")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--profile <profile>", "profile id", "recommended")
    .option("--out <file>", "write Mermaid output to a file instead of stdout")
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
    .summary("Compile, validate, and produce a preview artifact for a view")
    .description("Preferred preview command for renderable views. In v0.1 it defaults to SVG output and uses Graphviz for DOT-to-SVG layout.")
    .argument("<input>", "source .sdd file")
    .requiredOption("--view <view>", "view id")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--profile <profile>", "profile id", "recommended")
    .option("--format <format>", "preview format (svg or png)", "svg")
    .option("--out <file>", "write the preview artifact to a file; defaults to a sibling file beside the input")
    .option("--dot-out <file>", "also keep the intermediate DOT source in a file")
    .addHelpText("after", examplesBlock([
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map",
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view journey_map --out ./journey.svg",
      "sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --out ./blueprint.svg",
      "sdd show bundle/v0.1/examples/scenario_branching.sdd --view scenario_flow --out ./scenario.svg",
      "sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --out ./ui-contracts.svg",
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view outcome_opportunity_map --out ./outcome-map.svg",
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --out ./outcome.svg --dot-out ./outcome.dot",
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format png --out ./outcome.png --dot-out ./outcome.dot",
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
