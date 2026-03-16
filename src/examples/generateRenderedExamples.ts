import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatPrettyDiagnostics } from "../diagnostics/formatPretty.js";
import { loadBundle } from "../bundle/loadBundle.js";
import { assertPreviewBackendAvailable, renderPreviewArtifact } from "../renderer/previewBackends.js";
import { renderSource } from "../renderer/renderView.js";
import { getPreviewArtifactCapability, getViewRenderCapability } from "../renderer/viewRenderers.js";
import {
  discoverCuratedRenderedExamplePairs,
  expandCuratedRenderedExampleVariants,
  getRenderedCorpusExampleDirName,
  getRenderedCorpusProfileDirName,
  getRenderedCorpusRoot,
  getRenderedCorpusViewDirName,
  planRenderedCorpusOutputPaths
} from "./renderedCorpus.js";

const defaultManifestPath = path.resolve("bundle/v0.1/manifest.yaml");

function buildReadmeContent(
  manifestPath: string,
  pairs: Array<{ viewId: string; exampleName: string }>,
  profileIds: string[]
): string {
  const lines = [
    "# Rendered Example Corpus",
    "",
    "This directory is generated from the canonical bundle examples and committed as a reviewer-friendly reference corpus.",
    "",
    "Regenerate it with:",
    "",
    "```bash",
    "TMPDIR=/tmp pnpm run generate:rendered-examples",
    "```",
    "",
    `Source manifest: \`${manifestPath}\``,
    "",
    "Curated view/example pairs:",
    ""
  ];

  for (const pair of pairs) {
    lines.push(
      `- \`${getRenderedCorpusViewDirName(pair.viewId)}/${getRenderedCorpusExampleDirName(pair.exampleName)}\``
    );
  }

  lines.push("");
  lines.push(
    `Profiles rendered in each pair directory: ${profileIds.map((profileId) => `\`${getRenderedCorpusProfileDirName(profileId)}\``).join(", ")}.`
  );
  lines.push("");
  lines.push(
    "Each pair directory contains the source `.sdd` at the pair root plus suffixed per-profile subfolders with `.dot`, `.mmd`, `.svg`, and `.png` render outputs."
  );
  lines.push("`simple_profile` may omit optional overlays for readability; `permissive_profile` and `recommended_profile` keep the fuller render detail.");
  lines.push("");

  return lines.join("\n");
}

async function main(): Promise<void> {
  const manifestPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultManifestPath;
  assertPreviewBackendAvailable("legacy_graphviz_preview");

  const bundle = await loadBundle(manifestPath);
  const discovery = await discoverCuratedRenderedExamplePairs(bundle);
  const variants = expandCuratedRenderedExampleVariants(bundle, discovery.pairs);
  const outputRoot = getRenderedCorpusRoot(bundle);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  for (const skippedExample of discovery.skippedExampleRelativePaths) {
    console.warn(`Skipping ${skippedExample}: file exists under bundle examples but is not declared in the manifest.`);
  }

  const outputIndex: Array<{ viewId: string; exampleName: string }> = [];

  for (const variant of variants) {
    const view = bundle.views.views.find((candidate) => candidate.id === variant.viewId);
    if (!view) {
      throw new Error(`Unknown view '${variant.viewId}' referenced by ${variant.manifestExample.path}.`);
    }

    const outputPaths = planRenderedCorpusOutputPaths(bundle, variant);
    await mkdir(outputPaths.exampleDir, { recursive: true });
    await mkdir(outputPaths.profileDir, { recursive: true });
    await copyFile(variant.example.absolutePath, outputPaths.sourceOutputPath);

    const input = {
      path: variant.example.absolutePath,
      text: await readFile(variant.example.absolutePath, "utf8")
    };

    const dotResult = renderSource(input, bundle, {
      viewId: variant.viewId,
      format: "dot",
      profileId: variant.profileId
    });
    const mermaidResult = renderSource(input, bundle, {
      viewId: variant.viewId,
      format: "mermaid",
      profileId: variant.profileId
    });

    const dotErrors = dotResult.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    if (dotErrors.length > 0 || !dotResult.text) {
      throw new Error(
        `Failed to render DOT for ${variant.example.relativePath} (${variant.viewId}, profile=${variant.profileId}).\n${formatPrettyDiagnostics(dotResult.diagnostics)}`
      );
    }

    const mermaidErrors = mermaidResult.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    if (mermaidErrors.length > 0 || !mermaidResult.text) {
      throw new Error(
        `Failed to render Mermaid for ${variant.example.relativePath} (${variant.viewId}, profile=${variant.profileId}).\n${formatPrettyDiagnostics(mermaidResult.diagnostics)}`
      );
    }

    await writeFile(outputPaths.dotOutputPath, `${dotResult.text}\n`, "utf8");
    await writeFile(outputPaths.mermaidOutputPath, `${mermaidResult.text}\n`, "utf8");

    const capability = getViewRenderCapability(variant.viewId);
    const svgCapability = capability ? getPreviewArtifactCapability(capability, "svg") : undefined;
    const pngCapability = capability ? getPreviewArtifactCapability(capability, "png") : undefined;
    if (!svgCapability || !pngCapability) {
      throw new Error(`View '${variant.viewId}' does not support legacy SVG/PNG preview generation.`);
    }

    const svgArtifact = await renderPreviewArtifact({
      backendId: svgCapability.backendId,
      bundle,
      view,
      format: "svg",
      sourceText: dotResult.text
    });
    const pngArtifact = await renderPreviewArtifact({
      backendId: pngCapability.backendId,
      bundle,
      view,
      format: "png",
      sourceText: dotResult.text
    });

    if (svgArtifact.format !== "svg" || pngArtifact.format !== "png") {
      throw new Error(`Unexpected preview artifact format while generating ${variant.viewId} corpus outputs.`);
    }

    await writeFile(outputPaths.svgOutputPath, svgArtifact.text, "utf8");
    await writeFile(outputPaths.pngOutputPath, pngArtifact.bytes);

    if (!outputIndex.some((entry) => entry.viewId === variant.viewId && entry.exampleName === variant.example.name)) {
      outputIndex.push({
        viewId: variant.viewId,
        exampleName: variant.example.name
      });
    }
    console.log(
      `Generated ${getRenderedCorpusViewDirName(variant.viewId)}/${getRenderedCorpusExampleDirName(variant.example.name)}/${getRenderedCorpusProfileDirName(variant.profileId)}`
    );
  }

  const displayManifestPath = path.relative(process.cwd(), manifestPath) || path.basename(manifestPath);
  await writeFile(
    path.join(outputRoot, "README.md"),
    buildReadmeContent(displayManifestPath, outputIndex, bundle.manifest.profiles.map((profile) => profile.id)),
    "utf8"
  );
}

await main();
