import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type {
  Bundle,
  BundleManifest,
  ContractsConfig,
  JsonSchema,
  ProfileConfig,
  SyntaxConfig,
  ViewsConfig,
  Vocabulary
} from "./types.js";

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected object`);
  }
}

async function readYamlFile<T>(filePath: string): Promise<T> {
  const text = await readFile(filePath, "utf8");
  return YAML.parse(text) as T;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text) as T;
}

function resolveFromManifest(rootDir: string, relativePath: string): string {
  return path.resolve(rootDir, relativePath);
}

function validateManifest(manifest: BundleManifest): void {
  assertRecord(manifest, "bundle manifest");
  if (!manifest.core?.vocab || !manifest.core?.syntax || !manifest.core?.schema) {
    throw new Error("Invalid bundle manifest: missing required core entries");
  }
  if (!Array.isArray(manifest.profiles)) {
    throw new Error("Invalid bundle manifest: profiles must be an array");
  }
}

export async function loadBundle(manifestPath: string): Promise<Bundle> {
  const resolvedManifestPath = path.resolve(manifestPath);
  const rootDir = path.dirname(resolvedManifestPath);
  const manifest = await readYamlFile<BundleManifest>(resolvedManifestPath);
  validateManifest(manifest);

  const vocabPath = resolveFromManifest(rootDir, manifest.core.vocab);
  const syntaxPath = resolveFromManifest(rootDir, manifest.core.syntax);
  const schemaPath = resolveFromManifest(rootDir, manifest.core.schema);
  const contractsPath = resolveFromManifest(rootDir, manifest.core.contracts);
  const projectionSchemaPath = resolveFromManifest(rootDir, manifest.core.projection_schema);
  const viewsPath = resolveFromManifest(rootDir, manifest.core.views);

  const [vocab, syntax, schema, contracts, projectionSchema, views] = await Promise.all([
    readYamlFile<Vocabulary>(vocabPath),
    readYamlFile<SyntaxConfig>(syntaxPath),
    readJsonFile<JsonSchema>(schemaPath),
    readYamlFile<ContractsConfig>(contractsPath),
    readJsonFile<JsonSchema>(projectionSchemaPath),
    readYamlFile<ViewsConfig>(viewsPath)
  ]);

  const profilesEntries = await Promise.all(
    manifest.profiles.map(async (profileEntry) => {
      const profilePath = resolveFromManifest(rootDir, profileEntry.path);
      const profile = await readYamlFile<ProfileConfig>(profilePath);
      return [profileEntry.id, profile] as const;
    })
  );

  return {
    rootDir,
    manifestPath: resolvedManifestPath,
    manifest,
    vocab,
    syntax,
    schema,
    projectionSchema,
    contracts,
    views,
    profiles: Object.fromEntries(profilesEntries)
  };
}

