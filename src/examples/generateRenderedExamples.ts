import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatPrettyDiagnostics } from "../diagnostics/formatPretty.js";
import { loadBundle } from "../bundle/loadBundle.js";
import { assertPreviewBackendAvailable } from "../renderer/previewBackends.js";
import { renderSourcePreview } from "../renderer/previewWorkflow.js";
import { renderSource } from "../renderer/renderView.js";
import { projectView } from "../projector/projectView.js";
import { compileSource } from "../compiler/compileSource.js";
import { renderServiceBlueprintPreRoutingArtifacts } from "../renderer/staged/serviceBlueprint.js";
import {
  getPreviewArtifactCapabilities,
  getPreviewArtifactCapability,
  getViewRenderCapability
} from "../renderer/viewRenderers.js";
import {
  discoverCuratedRenderedExamplePairs,
  expandCuratedRenderedExampleVariants,
  getRenderedCorpusExampleDirName,
  getRenderedCorpusDebugOutputPath,
  getRenderedCorpusProfileDirName,
  getRenderedCorpusPreviewOutputPath,
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
  lines.push(
    "Unsuffixed `.svg` and `.png` files are the default preview backend for that view/profile when that backend emits artifacts. When a view keeps parallel preview backends, preserved non-default preview artifacts are committed as backend-suffixed siblings."
  );
  lines.push("`simple_profile` may omit optional overlays for readability; `permissive_profile` and `recommended_profile` keep the fuller render detail.");
  lines.push("");
  lines.push("`ia_place_map` visual review checklist:");
  lines.push("");
  lines.push("- top-level items read left-to-right with clean vertical alignment");
  lines.push("- no headers, labels, or routed edges sit visually above the top-level nodes");
  lines.push("- mixed top-level `Place` and `Area` ordering follows source order");
  lines.push("- same-scope follower places align at one indent level under the earliest preceding hub that navigates to them");
  lines.push("- single-child contained places stay directly below the owner; branched child or follower scopes reserve a left connector trunk");
  lines.push("- `simple_profile` suppresses route/access/entry-point overlays while preserving allowed `primary_nav` annotations");
  lines.push("- only forward local structure connectors are drawn, using direct-vertical or shared-trunk routes");
  lines.push("");
  lines.push("`ui_contracts` visual review checklist:");
  lines.push("");
  lines.push("- top-level Place containers remain vertically balanced even when content density varies sharply");
  lines.push("- synthetic `ViewState Graph` and fallback `State graph` regions read horizontally inside their owning scope");
  lines.push("- contract edges that emerge from containers stay readable without collapsing sibling grid or stack placement");
  lines.push("- default unsuffixed `.svg` and `.png` artifacts come from the staged renderer, while legacy Graphviz siblings remain available when committed");
  lines.push("");
  lines.push("`service_blueprint` visual review checklist:");
  lines.push("");
  lines.push("- staged unsuffixed `.svg` and `.png` artifacts come from the fixed-grid staged renderer with direct straight connectors");
  lines.push("- additional `.pre_routing.svg` and `.pre_routing.png` siblings capture the fixed grid before any edge routing runs");
  lines.push("- customer, frontstage, backstage, support, system, and policy lanes remain legible in semantic top-to-bottom order");
  lines.push("- customer chronology reads left-to-right, sidecar `DataEntity` and `Policy` nodes stay on the shared right-side rail, and `PRECEDES` edges remain unlabeled");
  lines.push("- legacy Graphviz preview siblings remain committed for side-by-side comparison");
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

    if (variant.viewId === "service_blueprint") {
      const compiled = compileSource(input, bundle);
      const compileErrors = compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
      if (compileErrors.length > 0 || !compiled.graph) {
        throw new Error(
          `Failed to compile service_blueprint input for pre-routing artifacts ${variant.example.relativePath} (profile=${variant.profileId}).\n${formatPrettyDiagnostics(compiled.diagnostics)}`
        );
      }

      const projected = projectView(compiled.graph, bundle, variant.viewId);
      const projectionErrors = projected.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
      if (projectionErrors.length > 0 || !projected.projection) {
        throw new Error(
          `Failed to project service_blueprint input for pre-routing artifacts ${variant.example.relativePath} (profile=${variant.profileId}).\n${formatPrettyDiagnostics(projected.diagnostics)}`
        );
      }

      const preRouting = await renderServiceBlueprintPreRoutingArtifacts(
        projected.projection,
        compiled.graph,
        view,
        variant.profileId
      );
      await writeFile(
        getRenderedCorpusDebugOutputPath(bundle, variant, "pre_routing", "svg"),
        preRouting.preRoutingSvg,
        "utf8"
      );
      await writeFile(
        getRenderedCorpusDebugOutputPath(bundle, variant, "pre_routing", "png"),
        preRouting.preRoutingPng
      );
    }

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
    if (!capability) {
      throw new Error(`View '${variant.viewId}' does not support preview generation.`);
    }
    const svgCapability = capability ? getPreviewArtifactCapability(capability, "svg") : undefined;
    const pngCapability = capability ? getPreviewArtifactCapability(capability, "png") : undefined;
    if (!svgCapability || !pngCapability) {
      throw new Error(`View '${variant.viewId}' does not support SVG/PNG preview generation.`);
    }

    const svgResult = await renderSourcePreview(input, bundle, {
      viewId: variant.viewId,
      format: "svg",
      profileId: variant.profileId,
      backendId: svgCapability.backendId
    });
    const pngResult = await renderSourcePreview(input, bundle, {
      viewId: variant.viewId,
      format: "png",
      profileId: variant.profileId,
      backendId: pngCapability.backendId
    });

    if (!svgResult.artifact || svgResult.artifact.format !== "svg" || svgResult.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      throw new Error(
        `Failed to render SVG preview for ${variant.example.relativePath} (${variant.viewId}, profile=${variant.profileId}, backend=${svgCapability.backendId}).\n${formatPrettyDiagnostics(svgResult.diagnostics)}`
      );
    }
    if (!pngResult.artifact || pngResult.artifact.format !== "png" || pngResult.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      throw new Error(
        `Failed to render PNG preview for ${variant.example.relativePath} (${variant.viewId}, profile=${variant.profileId}, backend=${pngCapability.backendId}).\n${formatPrettyDiagnostics(pngResult.diagnostics)}`
      );
    }

    if (svgResult.artifact?.format === "svg") {
      await writeFile(outputPaths.svgOutputPath, svgResult.artifact.text, "utf8");
    }
    if (pngResult.artifact?.format === "png") {
      await writeFile(outputPaths.pngOutputPath, pngResult.artifact.bytes);
    }

    for (const extraSvgCapability of getPreviewArtifactCapabilities(capability, "svg").filter(
      (candidate) => candidate.backendId !== svgCapability.backendId
    )) {
      const extraSvgResult = await renderSourcePreview(input, bundle, {
        viewId: variant.viewId,
        format: "svg",
        profileId: variant.profileId,
        backendId: extraSvgCapability.backendId
      });
      if (!extraSvgResult.artifact || extraSvgResult.artifact.format !== "svg" || extraSvgResult.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        throw new Error(
          `Failed to render SVG preview for ${variant.example.relativePath} (${variant.viewId}, profile=${variant.profileId}, backend=${extraSvgCapability.backendId}).\n${formatPrettyDiagnostics(extraSvgResult.diagnostics)}`
        );
      }
      await writeFile(
        getRenderedCorpusPreviewOutputPath(bundle, variant, "svg", extraSvgCapability.backendId, svgCapability.backendId),
        extraSvgResult.artifact.text,
        "utf8"
      );
    }

    for (const extraPngCapability of getPreviewArtifactCapabilities(capability, "png").filter(
      (candidate) => candidate.backendId !== pngCapability.backendId
    )) {
      const extraPngResult = await renderSourcePreview(input, bundle, {
        viewId: variant.viewId,
        format: "png",
        profileId: variant.profileId,
        backendId: extraPngCapability.backendId
      });
      if (!extraPngResult.artifact || extraPngResult.artifact.format !== "png" || extraPngResult.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        throw new Error(
          `Failed to render PNG preview for ${variant.example.relativePath} (${variant.viewId}, profile=${variant.profileId}, backend=${extraPngCapability.backendId}).\n${formatPrettyDiagnostics(extraPngResult.diagnostics)}`
        );
      }
      await writeFile(
        getRenderedCorpusPreviewOutputPath(bundle, variant, "png", extraPngCapability.backendId, pngCapability.backendId),
        extraPngResult.artifact.bytes
      );
    }

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
