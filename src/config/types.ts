export type DefaultsConfigSetting =
  | "bundle_version"
  | "validation_profile_id"
  | "render_detail_id"
  | "node_decorator_mode_id";
export type DefaultsConfigSource = "cli" | "global" | "bundle";

export interface DefaultsConfigValues {
  bundle_version?: string;
  validation_profile_id?: string;
  render_detail_id?: string;
  node_decorator_mode_id?: string;
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
  | "config.bundle_not_found"
  | "config.bundle_version_mismatch"
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
