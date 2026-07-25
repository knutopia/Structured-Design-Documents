import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBundle } from "../bundle/loadBundle.js";
import { createSddTextMateAssets, serializeTextMateAsset } from "./sddTextMate.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const extensionRoot = path.join(repoRoot, "editors/vscode-sdd");
const syntaxDirectory = path.join(extensionRoot, "syntaxes");
const grammarPath = path.join(syntaxDirectory, "sdd.tmLanguage.json");
const languageConfigurationPath = path.join(extensionRoot, "language-configuration.json");

const bundle = await loadBundle(manifestPath);
const assets = createSddTextMateAssets(bundle);

await mkdir(syntaxDirectory, { recursive: true });
await Promise.all([
  writeFile(grammarPath, serializeTextMateAsset(assets.grammar), "utf8"),
  writeFile(
    languageConfigurationPath,
    serializeTextMateAsset(assets.languageConfiguration),
    "utf8"
  )
]);

console.log(`Generated ${path.relative(repoRoot, grammarPath)}`);
console.log(`Generated ${path.relative(repoRoot, languageConfigurationPath)}`);
