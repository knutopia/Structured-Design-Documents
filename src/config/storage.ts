import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertDefaultsConfigId, parseDefaultsConfig, serializeDefaultsConfig } from "./parser.js";
import {
  DefaultsConfigError,
  type DefaultsConfigSetting,
  type DefaultsConfigV1,
  type DefaultsMutationResult
} from "./types.js";

export interface DefaultsConfigFileSystem {
  readText(filePath: string): Promise<string>;
  createDirectory(directoryPath: string): Promise<void>;
  writeTextExclusive(filePath: string, content: string): Promise<void>;
  renameFile(sourcePath: string, destinationPath: string): Promise<void>;
  removeFile(filePath: string): Promise<void>;
}

export const nodeDefaultsConfigFileSystem: DefaultsConfigFileSystem = {
  readText: (filePath) => readFile(filePath, "utf8"),
  createDirectory: async (directoryPath) => {
    await mkdir(directoryPath, { recursive: true });
  },
  writeTextExclusive: async (filePath, content) => {
    await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
  },
  renameFile: (sourcePath, destinationPath) => rename(sourcePath, destinationPath),
  removeFile: (filePath) => unlink(filePath)
};

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

export async function readDefaultsConfig(
  filePath: string,
  fileSystem: DefaultsConfigFileSystem = nodeDefaultsConfigFileSystem
): Promise<DefaultsConfigV1 | undefined> {
  let text: string;
  try {
    text = await fileSystem.readText(filePath);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw new DefaultsConfigError("config.read", `Unable to read configuration file '${filePath}'.`, { cause: error });
  }
  return parseDefaultsConfig(text, filePath);
}

export interface WriteDefaultsConfigOptions {
  createParent?: boolean;
  fileSystem?: DefaultsConfigFileSystem;
  pathApi?: typeof path;
  temporarySuffix?: () => string;
}

export async function writeDefaultsConfigAtomic(
  filePath: string,
  config: DefaultsConfigV1,
  options: WriteDefaultsConfigOptions = {}
): Promise<void> {
  const fileSystem = options.fileSystem ?? nodeDefaultsConfigFileSystem;
  const pathApi = options.pathApi ?? path;
  const temporaryPath = pathApi.join(
    pathApi.dirname(filePath),
    `.${pathApi.basename(filePath)}.${options.temporarySuffix?.() ?? `${process.pid}.${randomUUID()}`}.tmp`
  );
  let temporaryAttempted = false;
  let temporaryWritten = false;

  try {
    if (options.createParent) await fileSystem.createDirectory(pathApi.dirname(filePath));
    temporaryAttempted = true;
    await fileSystem.writeTextExclusive(temporaryPath, serializeDefaultsConfig(config));
    temporaryWritten = true;
    await fileSystem.renameFile(temporaryPath, filePath);
  } catch (error) {
    if (temporaryWritten || (temporaryAttempted && errorCode(error) !== "EEXIST")) {
      try {
        await fileSystem.removeFile(temporaryPath);
      } catch {
        // Preserve the original failure; cleanup is best-effort.
      }
    }
    throw new DefaultsConfigError("config.write", `Unable to write configuration file '${filePath}' atomically.`, { cause: error });
  }
}

async function removeDefaultsConfig(
  filePath: string,
  fileSystem: DefaultsConfigFileSystem
): Promise<void> {
  try {
    await fileSystem.removeFile(filePath);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return;
    throw new DefaultsConfigError("config.write", `Unable to remove configuration file '${filePath}'.`, { cause: error });
  }
}

export async function setStoredDefault(
  filePath: string,
  setting: DefaultsConfigSetting,
  value: string,
  options: WriteDefaultsConfigOptions = {}
): Promise<DefaultsMutationResult> {
  assertDefaultsConfigId(value, setting, filePath);
  const fileSystem = options.fileSystem ?? nodeDefaultsConfigFileSystem;
  const existing = await readDefaultsConfig(filePath, fileSystem);
  if (existing?.defaults[setting] === value) return { changed: false, path: filePath };

  const config: DefaultsConfigV1 = {
    version: "1",
    defaults: {
      ...(existing?.defaults ?? {}),
      [setting]: value
    }
  };
  await writeDefaultsConfigAtomic(filePath, config, options);
  return { changed: true, path: filePath };
}

export async function unsetStoredDefault(
  filePath: string,
  setting: DefaultsConfigSetting,
  options: WriteDefaultsConfigOptions = {}
): Promise<DefaultsMutationResult> {
  const fileSystem = options.fileSystem ?? nodeDefaultsConfigFileSystem;
  const existing = await readDefaultsConfig(filePath, fileSystem);
  if (!existing || existing.defaults[setting] === undefined) return { changed: false, path: filePath };

  const defaults = { ...existing.defaults };
  delete defaults[setting];
  if (Object.keys(defaults).length === 0) {
    await removeDefaultsConfig(filePath, fileSystem);
    return { changed: true, path: filePath };
  }

  await writeDefaultsConfigAtomic(filePath, { version: "1", defaults }, options);
  return { changed: true, path: filePath };
}
