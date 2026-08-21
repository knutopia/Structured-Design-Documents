import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Bundle, BundleManifestExample } from "../bundle/types.js";
import type { PreviewFormat, PreviewRendererBackendId } from "../renderer/renderArtifacts.js";

export interface CanonicalBundleExampleFile {
  name: string;
  relativePath: string;
  absolutePath: string;
}

export interface CuratedRenderedExamplePair {
  example: CanonicalBundleExampleFile;
  manifestExample: BundleManifestExample;
  viewId: string;
}

export interface CuratedRenderedExampleVariant extends CuratedRenderedExamplePair {
  detailId: string;
}

export interface CuratedRenderedExampleDiscovery {
  exampleDir: string;
  scannedExamples: CanonicalBundleExampleFile[];
  skippedExampleRelativePaths: string[];
  pairs: CuratedRenderedExamplePair[];
}

export interface RenderedCorpusOutputPaths {
  exampleDir: string;
  detailDir: string;
  sourceOutputPath: string;
  dotOutputPath: string;
  mermaidOutputPath: string;
  svgOutputPath: string;
  pngOutputPath: string;
}

const previewOnlyRenderedCorpusViewIds = new Set<string>();

const previewOnlyRenderedCorpusViewDirSuffix = " [preview_only]";

export function getRenderedCorpusDebugOutputPath(
  bundle: Bundle,
  variant: Pick<CuratedRenderedExampleVariant, "example" | "viewId" | "detailId">,
  debugStem: string,
  format: PreviewFormat
): string {
  const outputPaths = planRenderedCorpusOutputPaths(bundle, variant);
  const renderedStem = `${variant.example.name}.${variant.viewId}`;
  return path.join(outputPaths.detailDir, `${renderedStem}.${debugStem}.${format}`);
}

function getRepoRoot(bundle: Bundle): string {
  return path.resolve(bundle.rootDir, "..", "..");
}

function getVersionedCorpusDirName(bundle: Bundle): string {
  return `v${bundle.manifest.bundle_version}`;
}

export function getRenderedCorpusViewDirName(viewId: string): string {
  const baseName = `${viewId}_diagram_type`;
  return previewOnlyRenderedCorpusViewIds.has(viewId)
    ? `${baseName}${previewOnlyRenderedCorpusViewDirSuffix}`
    : baseName;
}

export function isPreviewOnlyRenderedCorpusView(viewId: string): boolean {
  return previewOnlyRenderedCorpusViewIds.has(viewId);
}

export function getRenderedCorpusExampleDirName(exampleName: string): string {
  return `${exampleName}_example`;
}

export function getRenderedCorpusDetailDirName(detailId: string): string {
  return `${detailId}_detail`;
}

export function getRenderedCorpusRoot(bundle: Bundle): string {
  return path.join(getRepoRoot(bundle), "examples", "rendered", getVersionedCorpusDirName(bundle));
}

export function getRenderedCorpusDetailIds(bundle: Bundle): string[] {
  return bundle.manifest.render_details.map((detail) => detail.id);
}

export async function listCanonicalBundleExampleFiles(bundle: Bundle): Promise<CanonicalBundleExampleFile[]> {
  const exampleDir = path.join(bundle.rootDir, "examples");
  const entries = await readdir(exampleDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sdd"))
    .map((entry) => {
      const relativePath = path.posix.join("examples", entry.name);
      return {
        name: path.parse(entry.name).name,
        relativePath,
        absolutePath: path.join(exampleDir, entry.name)
      };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function readProjectionSnapshotViewIds(bundle: Bundle, manifestExample: BundleManifestExample): Promise<string[]> {
  const seen = new Set<string>();

  for (const snapshotRelativePath of manifestExample.projection_snapshots ?? []) {
    const snapshotPath = path.join(bundle.rootDir, snapshotRelativePath);
    const rawSnapshot = await readFile(snapshotPath, "utf8");
    const snapshot = JSON.parse(rawSnapshot) as { view_id?: unknown };
    if (typeof snapshot.view_id === "string") {
      seen.add(snapshot.view_id);
    }
  }

  const orderedViewIds = bundle.views.views.map((view) => view.id).filter((viewId) => seen.has(viewId));
  return orderedViewIds;
}

export async function discoverCuratedRenderedExamplePairs(bundle: Bundle): Promise<CuratedRenderedExampleDiscovery> {
  const scannedExamples = await listCanonicalBundleExampleFiles(bundle);
  const exampleDir = path.join(bundle.rootDir, "examples");
  const manifestExamplesByPath = new Map(bundle.manifest.examples.map((example) => [example.path, example]));

  const skippedExampleRelativePaths: string[] = [];
  const pairs: CuratedRenderedExamplePair[] = [];

  for (const example of scannedExamples) {
    const manifestExample = manifestExamplesByPath.get(example.relativePath);
    if (!manifestExample) {
      skippedExampleRelativePaths.push(example.relativePath);
      continue;
    }

    const viewIds = await readProjectionSnapshotViewIds(bundle, manifestExample);
    for (const viewId of viewIds) {
      pairs.push({
        example,
        manifestExample,
        viewId
      });
    }
  }

  return {
    exampleDir,
    scannedExamples,
    skippedExampleRelativePaths,
    pairs
  };
}

export function expandCuratedRenderedExampleVariants(
  bundle: Bundle,
  pairs: CuratedRenderedExamplePair[]
): CuratedRenderedExampleVariant[] {
  const detailIds = getRenderedCorpusDetailIds(bundle);
  return pairs.flatMap((pair) => detailIds.map((detailId) => ({
    ...pair,
    detailId
  })));
}

export function planRenderedCorpusOutputPaths(
  bundle: Bundle,
  variant: Pick<CuratedRenderedExampleVariant, "example" | "viewId" | "detailId">
): RenderedCorpusOutputPaths {
  const rootDir = getRenderedCorpusRoot(bundle);
  const viewDir = path.join(rootDir, getRenderedCorpusViewDirName(variant.viewId));
  const exampleDir = path.join(viewDir, getRenderedCorpusExampleDirName(variant.example.name));
  const detailDir = path.join(exampleDir, getRenderedCorpusDetailDirName(variant.detailId));
  const renderedStem = `${variant.example.name}.${variant.viewId}`;

  return {
    exampleDir,
    detailDir,
    sourceOutputPath: path.join(exampleDir, `${variant.example.name}.sdd`),
    dotOutputPath: path.join(detailDir, `${renderedStem}.dot`),
    mermaidOutputPath: path.join(detailDir, `${renderedStem}.mmd`),
    svgOutputPath: path.join(detailDir, `${renderedStem}.svg`),
    pngOutputPath: path.join(detailDir, `${renderedStem}.png`)
  };
}

export function getRenderedCorpusPreviewOutputPath(
  bundle: Bundle,
  variant: Pick<CuratedRenderedExampleVariant, "example" | "viewId" | "detailId">,
  format: PreviewFormat,
  backendId: PreviewRendererBackendId,
  defaultBackendId: PreviewRendererBackendId
): string {
  const outputPaths = planRenderedCorpusOutputPaths(bundle, variant);
  const renderedStem = `${variant.example.name}.${variant.viewId}`;
  const backendSuffix = backendId === defaultBackendId ? "" : `.${backendId}`;

  return path.join(outputPaths.detailDir, `${renderedStem}${backendSuffix}.${format}`);
}
