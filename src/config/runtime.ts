import os from "node:os";
import path from "node:path";
import { getGlobalDefaultsConfigPath } from "./paths.js";
import {
  nodeDefaultsConfigFileSystem,
  readDefaultsConfig,
  setStoredDefault,
  unsetStoredDefault,
  type DefaultsConfigFileSystem
} from "./storage.js";
import type { DefaultsConfigSetting, DefaultsConfigV1, DefaultsMutationResult } from "./types.js";

export interface DefaultsConfigRuntime {
  getGlobalConfigPath(): string;
  read(filePath: string): Promise<DefaultsConfigV1 | undefined>;
  set(filePath: string, setting: DefaultsConfigSetting, value: string, options?: { createParent?: boolean }): Promise<DefaultsMutationResult>;
  unset(filePath: string, setting: DefaultsConfigSetting): Promise<DefaultsMutationResult>;
}

export interface DefaultsConfigRuntimeOptions {
  platform?: NodeJS.Platform;
  env?: Readonly<Record<string, string | undefined>>;
  homedir?: () => string;
  pathApi?: typeof path;
  fileSystem?: DefaultsConfigFileSystem;
  temporarySuffix?: () => string;
}

export function createDefaultsConfigRuntime(options: DefaultsConfigRuntimeOptions = {}): DefaultsConfigRuntime {
  const platform = options.platform ?? process.platform;
  const pathApi = options.pathApi ?? (platform === "win32" ? path.win32 : path);
  const fileSystem = options.fileSystem ?? nodeDefaultsConfigFileSystem;
  const writeOptions = {
    fileSystem,
    pathApi,
    ...(options.temporarySuffix ? { temporarySuffix: options.temporarySuffix } : {})
  };

  return {
    getGlobalConfigPath: () => getGlobalDefaultsConfigPath({
      platform,
      env: options.env ?? process.env,
      homedir: options.homedir ?? os.homedir,
      pathApi
    }),
    read: (filePath) => readDefaultsConfig(filePath, fileSystem),
    set: (filePath, setting, value, mutationOptions = {}) => setStoredDefault(filePath, setting, value, {
      ...writeOptions,
      createParent: mutationOptions.createParent
    }),
    unset: (filePath, setting) => unsetStoredDefault(filePath, setting, writeOptions)
  };
}
