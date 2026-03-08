#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { loadBundle } from "../bundle/loadBundle.js";
import { compileSource } from "../compiler/compileSource.js";
import { formatJsonDiagnostics } from "../diagnostics/formatJson.js";
import { formatPrettyDiagnostics } from "../diagnostics/formatPretty.js";
import { hasErrors } from "../diagnostics/types.js";
import { renderSource } from "../renderer/renderView.js";
import type { Diagnostic, SourceInput } from "../types.js";
import { validateGraph } from "../validator/validateGraph.js";

const defaultManifestPath = path.resolve("bundle/v0.1/manifest.yaml");

async function readSourceInput(filePath: string): Promise<SourceInput> {
  const resolvedPath = path.resolve(filePath);
  return {
    path: resolvedPath,
    text: await readFile(resolvedPath, "utf8")
  };
}

async function writeOutput(outputPath: string | undefined, content: string): Promise<void> {
  if (!outputPath) {
    process.stdout.write(`${content}\n`);
    return;
  }
  await writeFile(path.resolve(outputPath), content, "utf8");
}

function writeDiagnostics(diagnostics: Diagnostic[], format: "pretty" | "json"): void {
  if (diagnostics.length === 0) {
    return;
  }
  const content = format === "json" ? formatJsonDiagnostics(diagnostics) : formatPrettyDiagnostics(diagnostics);
  process.stderr.write(`${content}\n`);
}

const program = new Command();
program.name("sdd");

program
  .command("compile")
  .argument("<input>", "source .sdd file")
  .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
  .option("--out <file>", "write compiled JSON to a file")
  .option("--diagnostics <format>", "diagnostics format", "pretty")
  .action(async (inputPath, options) => {
    try {
      const bundle = await loadBundle(options.bundle);
      const input = await readSourceInput(inputPath);
      const result = compileSource(input, bundle);
      writeDiagnostics(result.diagnostics, options.diagnostics === "json" ? "json" : "pretty");
      if (result.graph && !hasErrors(result.diagnostics)) {
        await writeOutput(options.out, JSON.stringify(result.graph, null, 2));
      }
      process.exit(hasErrors(result.diagnostics) ? 1 : 0);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    }
  });

program
  .command("validate")
  .argument("<input>", "source .sdd file")
  .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
  .option("--profile <profile>", "profile id", "recommended")
  .option("--diagnostics <format>", "diagnostics format", "pretty")
  .action(async (inputPath, options) => {
    try {
      const bundle = await loadBundle(options.bundle);
      const input = await readSourceInput(inputPath);
      const compileResult = compileSource(input, bundle);
      const diagnostics = [...compileResult.diagnostics];
      if (compileResult.graph && !hasErrors(diagnostics)) {
        const validation = validateGraph(compileResult.graph, bundle, options.profile);
        diagnostics.push(...validation.diagnostics);
      }
      writeDiagnostics(diagnostics, options.diagnostics === "json" ? "json" : "pretty");
      process.exit(hasErrors(diagnostics) ? 1 : 0);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    }
  });

program
  .command("render")
  .argument("<input>", "source .sdd file")
  .requiredOption("--view <view>", "view id")
  .requiredOption("--format <format>", "render format: dot | mermaid")
  .option("--bundle <manifest>", "bundle manifest path", defaultManifestPath)
  .option("--profile <profile>", "profile id", "recommended")
  .option("--out <file>", "write rendered output to a file")
  .action(async (inputPath, options) => {
    try {
      if (options.view !== "ia_place_map") {
        process.stderr.write("render.unsupported_view Only ia_place_map is supported in v0.1\n");
        process.exit(1);
      }

      if (options.format !== "dot" && options.format !== "mermaid") {
        process.stderr.write("Unsupported render format. Use 'dot' or 'mermaid'.\n");
        process.exit(2);
      }

      const bundle = await loadBundle(options.bundle);
      const input = await readSourceInput(inputPath);
      const result = renderSource(input, bundle, {
        viewId: options.view,
        format: options.format,
        profileId: options.profile
      });
      writeDiagnostics(result.diagnostics, "pretty");
      if (result.text && !hasErrors(result.diagnostics)) {
        await writeOutput(options.out, result.text);
      }
      process.exit(hasErrors(result.diagnostics) ? 1 : 0);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
