import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { loadBundle } from "../bundle/loadBundle.js";
import { bundleManifestPath, DEFAULT_BUNDLE_VERSION } from "../cli/bundleResolution.js";
import { resolveLauncherCwd } from "../cli/launcherCwd.js";
import { writeAllSync } from "../cli/writeAllSync.js";
import { createSddTextMateAssets, serializeTextMateAsset } from "./sddTextMate.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const launcherCwd = resolveLauncherCwd();
const program = new Command()
  .name("generate:textmate")
  .option("--bundle <manifest>", "bundle manifest path; omission uses the repository default")
  .option("--out-dir <directory>", "output root for grammar and language configuration");
program.parse(process.argv);

const options = program.opts<{ bundle?: string; outDir?: string }>();
const manifestPath = options.bundle
  ? path.resolve(launcherCwd, options.bundle)
  : bundleManifestPath(DEFAULT_BUNDLE_VERSION, repoRoot);
const extensionRoot = options.outDir
  ? path.resolve(launcherCwd, options.outDir)
  : path.join(repoRoot, "editors/vscode-sdd");
const grammarPath = path.join(extensionRoot, "syntaxes", "sdd.tmLanguage.json");
const languageConfigurationPath = path.join(extensionRoot, "language-configuration.json");

const bundle = await loadBundle(manifestPath);
const assets = createSddTextMateAssets(bundle);
const grammarText = serializeTextMateAsset(assets.grammar);
const languageConfigurationText = serializeTextMateAsset(assets.languageConfiguration);

await mkdir(path.dirname(grammarPath), { recursive: true });
await Promise.all([
  writeFile(grammarPath, grammarText, "utf8"),
  writeFile(languageConfigurationPath, languageConfigurationText, "utf8")
]);

writeAllSync(process.stdout.fd, `Bundle manifest: ${bundle.manifestPath}\nGenerated ${grammarPath}\nGenerated ${languageConfigurationPath}\n`);
