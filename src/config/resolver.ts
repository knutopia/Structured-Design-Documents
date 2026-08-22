import type { DefaultsConfigRuntime } from "./runtime.js";
import {
  DefaultsConfigError,
  type DefaultsConfigSetting,
  type LoadedDefaultsSources,
  type ResolvedDefault
} from "./types.js";

export async function loadDefaultsSources(
  runtime: DefaultsConfigRuntime
): Promise<LoadedDefaultsSources> {
  const globalPath = runtime.getGlobalConfigPath();
  const globalConfig = await runtime.read(globalPath);

  return {
    globalPath,
    ...(globalConfig ? { global: { path: globalPath, config: globalConfig } } : {})
  };
}

export interface ResolveDefaultOptions {
  setting: DefaultsConfigSetting;
  explicitValue?: string;
  sources: LoadedDefaultsSources;
  bundleValue: string;
  availableValues: readonly string[];
  bundlePath: string;
}

export interface ValidateResolvedDefaultOptions {
  setting: DefaultsConfigSetting;
  selected: ResolvedDefault;
  availableValues: readonly string[];
  bundlePath: string;
}

export function validateResolvedDefault(options: ValidateResolvedDefaultOptions): ResolvedDefault {
  const { selected } = options;
  if (options.availableValues.includes(selected.value)) return selected;

  const sourceDescription = selected.sourcePath
    ? `${selected.source} configuration '${selected.sourcePath}'`
    : `${selected.source} source`;
  const available = options.availableValues.length > 0 ? options.availableValues.join(", ") : "(none)";
  throw new DefaultsConfigError(
    "config.unknown_value",
    `Unknown value '${selected.value}' for setting '${options.setting}' from ${sourceDescription}. ` +
    `Selected bundle: '${options.bundlePath}'. Available values: ${available}.`
  );
}

export function resolveDefault(options: ResolveDefaultOptions): ResolvedDefault {
  const selected: ResolvedDefault = options.explicitValue !== undefined
    ? { value: options.explicitValue, source: "cli" }
    : options.sources.global?.config.defaults[options.setting] !== undefined
      ? {
        value: options.sources.global.config.defaults[options.setting]!,
        source: "global",
        sourcePath: options.sources.global.path
      }
      : { value: options.bundleValue, source: "bundle" };

  return validateResolvedDefault({
    setting: options.setting,
    selected,
    availableValues: options.availableValues,
    bundlePath: options.bundlePath
  });
}
