import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command, CommanderError } from "commander";
import { loadBundle } from "../bundle/loadBundle.js";
import type { Bundle, ViewSpec } from "../bundle/types.js";
import { compileSource } from "../compiler/compileSource.js";
import type { CompileResult } from "../compiler/types.js";
import { formatJsonDiagnostics } from "../diagnostics/formatJson.js";
import { formatPrettyDiagnostics } from "../diagnostics/formatPretty.js";
import { hasErrors } from "../diagnostics/types.js";
import { renderSource } from "../renderer/renderView.js";
import type { Diagnostic, RenderOptions, RenderResult, SourceInput } from "../types.js";
import { validateGraph } from "../validator/validateGraph.js";
import type { ValidationReport } from "../validator/types.js";

const defaultManifestPath = path.resolve("bundle/v0.1/manifest.yaml");

type DiagnosticsFormat = "pretty" | "json";
type TextRenderFormat = "dot" | "mermaid";
type PreviewFormat = "png";

interface ViewRenderCapability {
  textFormats: TextRenderFormat[];
  previewFormats: PreviewFormat[];
  previewSourceByFormat: Record<PreviewFormat, TextRenderFormat>;
  defaultPreviewFormat: PreviewFormat;
}

const viewRenderCapabilities: Partial<Record<string, ViewRenderCapability>> = {
  ia_place_map: {
    textFormats: ["dot", "mermaid"],
    previewFormats: ["png"],
    previewSourceByFormat: {
      png: "dot"
    },
    defaultPreviewFormat: "png"
  }
};

export interface CliDeps {
  loadBundle: (manifestPath: string) => Promise<Bundle>;
  readSourceInput: (filePath: string) => Promise<SourceInput>;
  compileSource: (input: SourceInput, bundle: Bundle) => CompileResult;
  validateGraph: (graph: NonNullable<CompileResult["graph"]>, bundle: Bundle, profileId: string) => ValidationReport;
  renderSource: (input: SourceInput, bundle: Bundle, options: RenderOptions) => RenderResult;
  writeTextFile: (outputPath: string, content: string) => Promise<void>;
  renderDotToPng: (dot: string, outputPath: string) => Promise<void>;
  stdout: (content: string) => void;
  stderr: (content: string) => void;
}

export interface RunCliResult {
  exitCode: number;
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

async function defaultRenderDotToPng(dot: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("dot", ["-Tpng", "-o", path.resolve(outputPath)], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `Graphviz exited with code ${code ?? "unknown"}`));
    });
    child.stdin.end(dot);
  });
}

function createDefaultDeps(): CliDeps {
  return {
    loadBundle,
    readSourceInput: defaultReadSourceInput,
    compileSource,
    validateGraph,
    renderSource,
    writeTextFile: defaultWriteTextFile,
    renderDotToPng: defaultRenderDotToPng,
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
  deps: Pick<CliDeps, "stdout" | "writeTextFile">,
  outputPath: string | undefined,
  content: string
): Promise<void> {
  if (!outputPath) {
    deps.stdout(appendLine(content));
    return;
  }

  await deps.writeTextFile(outputPath, content);
}

function replaceExtension(filePath: string, extension: string): string {
  const parsed = path.parse(path.resolve(filePath));
  return path.join(parsed.dir, `${parsed.name}.${extension}`);
}

function formatList(values: string[]): string {
  return values.join(", ");
}

function getViewSpec(bundle: Bundle, viewId: string): ViewSpec | undefined {
  return bundle.views.views.find((view) => view.id === viewId);
}

function getKnownRenderableViews(bundle: Bundle): string[] {
  return bundle.views.views
    .filter((view) => viewRenderCapabilities[view.id])
    .map((view) => view.id);
}

function getViewCapability(bundle: Bundle, viewId: string): { view?: ViewSpec; capability?: ViewRenderCapability; message?: string } {
  const view = getViewSpec(bundle, viewId);
  if (!view) {
    return {
      message: `Unknown view '${viewId}'. Available bundle views: ${formatList(bundle.views.views.map((candidate) => candidate.id))}.`
    };
  }

  const capability = viewRenderCapabilities[viewId];
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

function ensureTextFormat(bundle: Bundle, viewId: string, format: string): { capability?: ViewRenderCapability; message?: string } {
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
    capability: resolved.capability
  };
}

function ensurePreviewFormat(bundle: Bundle, viewId: string, format: string): { capability?: ViewRenderCapability; message?: string } {
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
    capability: resolved.capability
  };
}

function graphvizInstallHint(): string {
  const lines = [
    "Graphviz is required for PNG preview flows because the CLI shells out to `dot`.",
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
): Promise<{ exitCode: number; text?: string; sourcePath?: string }> {
  try {
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
      text: result.text,
      sourcePath: input.path
    };
  } catch (error) {
    deps.stderr(appendLine(error instanceof Error ? error.message : String(error)));
    return { exitCode: 1 };
  }
}

async function runDotCommand(
  deps: CliDeps,
  inputPath: string,
  options: { bundle: string; profile: string; out?: string; png?: boolean; pngOut?: string }
): Promise<number> {
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
    await deps.renderDotToPng(renderResult.text, pngPath);
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
    const { bundle, input } = await prepareContext(deps, options.bundle, inputPath);
    const requestedPreviewFormat = options.format || "png";
    const supported = ensurePreviewFormat(bundle, options.view, requestedPreviewFormat);
    if (!supported.capability) {
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
      await deps.writeTextFile(options.dotOut, renderResult.text);
    }

    const previewPath = options.out ?? replaceExtension(input.path, requestedPreviewFormat);
    try {
      await deps.renderDotToPng(renderResult.text, previewPath);
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
    "Common flows:",
    "  sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd",
    "  sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile recommended",
    "  sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd --out /tmp/outcome.dot",
    "  sdd mmd bundle/v0.1/examples/outcome_to_ia_trace.sdd --out /tmp/outcome.mmd",
    "  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map",
    "",
    "Notes:",
    "  `show` is the preferred preview command as more renderable views are added.",
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
      "sdd compile bundle/v0.1/examples/outcome_to_ia_trace.sdd --out /tmp/outcome.json --diagnostics json"
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
      "sdd validate bundle/v0.1/examples/outcome_to_ia_trace.sdd --profile permissive"
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
      "sdd render bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format mermaid --out /tmp/outcome.mmd"
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
    .option("--png", "also write a sibling PNG rendered through Graphviz")
    .option("--png-out <file>", "write PNG output to an explicit file path")
    .addHelpText("after", examplesBlock([
      "sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd",
      "sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd --png",
      "sdd dot bundle/v0.1/examples/outcome_to_ia_trace.sdd --out /tmp/outcome.dot --png-out /tmp/outcome.png"
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
      "sdd mmd bundle/v0.1/examples/outcome_to_ia_trace.sdd --out /tmp/outcome.mmd"
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
    .description("Preferred preview command for renderable views. In v0.1 it defaults to PNG output and requires Graphviz for DOT-to-PNG rendering.")
    .argument("<input>", "source .sdd file")
    .requiredOption("--view <view>", "view id")
    .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
    .option("--profile <profile>", "profile id", "recommended")
    .option("--format <format>", "preview format (currently png)", "png")
    .option("--out <file>", "write the preview artifact to a file; defaults to a sibling file beside the input")
    .option("--dot-out <file>", "also keep the intermediate DOT source in a file")
    .addHelpText("after", examplesBlock([
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map",
      "sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --out /tmp/outcome.png --dot-out /tmp/outcome.dot",
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
