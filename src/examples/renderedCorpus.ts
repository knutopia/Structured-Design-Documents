import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Bundle, BundleManifestExample } from "../bundle/types.js";

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
  profileId: string;
}

export interface CuratedRenderedExampleDiscovery {
  exampleDir: string;
  scannedExamples: CanonicalBundleExampleFile[];
  skippedExampleRelativePaths: string[];
  pairs: CuratedRenderedExamplePair[];
}

export interface RenderedCorpusOutputPaths {
  exampleDir: string;
  profileDir: string;
  sourceOutputPath: string;
  dotOutputPath: string;
  mermaidOutputPath: string;
  svgOutputPath: string;
  pngOutputPath: string;
}

function getRepoRoot(bundle: Bundle): string {
  return path.resolve(bundle.rootDir, "..", "..");
}

function getVersionedCorpusDirName(bundle: Bundle): string {
  return `v${bundle.manifest.bundle_version}`;
}

export function getRenderedCorpusViewDirName(viewId: string): string {
  return `${viewId}_diagram_type`;
}

export function getRenderedCorpusExampleDirName(exampleName: string): string {
  return `${exampleName}_example`;
}

export function getRenderedCorpusProfileDirName(profileId: string): string {
  return `${profileId}_profile`;
}

export function getRenderedCorpusRoot(bundle: Bundle): string {
  return path.join(getRepoRoot(bundle), "examples", "rendered", getVersionedCorpusDirName(bundle));
}

export function getRenderedCorpusProfileIds(bundle: Bundle): string[] {
  return bundle.manifest.profiles.map((profile) => profile.id);
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
  const profileIds = getRenderedCorpusProfileIds(bundle);
  return pairs.flatMap((pair) => profileIds.map((profileId) => ({
    ...pair,
    profileId
  })));
}

export function planRenderedCorpusOutputPaths(
  bundle: Bundle,
  variant: Pick<CuratedRenderedExampleVariant, "example" | "viewId" | "profileId">
): RenderedCorpusOutputPaths {
  const rootDir = getRenderedCorpusRoot(bundle);
  const viewDir = path.join(rootDir, getRenderedCorpusViewDirName(variant.viewId));
  const exampleDir = path.join(viewDir, getRenderedCorpusExampleDirName(variant.example.name));
  const profileDir = path.join(exampleDir, getRenderedCorpusProfileDirName(variant.profileId));
  const renderedStem = `${variant.example.name}.${variant.viewId}`;

  return {
    exampleDir,
    profileDir,
    sourceOutputPath: path.join(exampleDir, `${variant.example.name}.sdd`),
    dotOutputPath: path.join(profileDir, `${renderedStem}.dot`),
    mermaidOutputPath: path.join(profileDir, `${renderedStem}.mmd`),
    svgOutputPath: path.join(profileDir, `${renderedStem}.svg`),
    pngOutputPath: path.join(profileDir, `${renderedStem}.png`)
  };
}
