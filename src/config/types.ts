export type DefaultsConfigSetting = "validation_profile_id" | "render_detail_id";
export type DefaultsConfigSource = "cli" | "project" | "global" | "bundle";
export type DefaultsConfigScope = "global" | "project";

export interface DefaultsConfigValues {
  validation_profile_id?: string;
  render_detail_id?: string;
}

export interface DefaultsConfigV1 {
  version: "1";
  defaults: DefaultsConfigValues;
}

export interface LoadedDefaultsConfig {
  path: string;
  config: DefaultsConfigV1;
}

export interface LoadedDefaultsSources {
  globalPath: string;
  global?: LoadedDefaultsConfig;
  projectPath?: string;
  project?: LoadedDefaultsConfig;
}

export interface ResolvedDefault<T extends string = string> {
  value: T;
  source: DefaultsConfigSource;
  sourcePath?: string;
}

export interface DefaultsMutationResult {
  changed: boolean;
  path: string;
}

export type DefaultsConfigErrorCode =
  | "config.path"
  | "config.read"
  | "config.parse"
  | "config.shape"
  | "config.version"
  | "config.unknown_key"
  | "config.invalid_id"
  | "config.unknown_value"
  | "config.project_root"
  | "config.write";

export class DefaultsConfigError extends Error {
  constructor(
    readonly code: DefaultsConfigErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "DefaultsConfigError";
  }
}
