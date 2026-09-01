import YAML from "yaml";
import {
  DefaultsConfigError,
  type DefaultsConfigSetting,
  type DefaultsConfigV1,
  type DefaultsConfigValues
} from "./types.js";

const ROOT_KEYS = new Set(["version", "defaults"]);
const DEFAULT_KEYS = new Set<DefaultsConfigSetting>([
  "validation_profile_id",
  "render_detail_id",
  "node_decorator_mode_id"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function describePath(sourcePath: string): string {
  return `Configuration file '${sourcePath}'`;
}

function assertKnownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  sourcePath: string,
  location: string
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key)).sort();
  if (unknown.length > 0) {
    throw new DefaultsConfigError(
      "config.unknown_key",
      `${describePath(sourcePath)} has unknown ${location} key${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`
    );
  }
}

export function assertDefaultsConfigId(value: string, setting: DefaultsConfigSetting, sourcePath: string): void {
  if (value.trim().length === 0) {
    throw new DefaultsConfigError(
      "config.invalid_id",
      `${describePath(sourcePath)} setting '${setting}' must be a non-empty string.`
    );
  }
}

export function parseDefaultsConfig(text: string, sourcePath: string): DefaultsConfigV1 {
  const documents = YAML.parseAllDocuments(text, {
    prettyErrors: true,
    strict: true,
    uniqueKeys: true
  });

  if (documents.length !== 1) {
    throw new DefaultsConfigError(
      "config.parse",
      `${describePath(sourcePath)} must contain exactly one YAML document.`
    );
  }

  const document = documents[0]!;
  if (document.errors.length > 0) {
    throw new DefaultsConfigError(
      "config.parse",
      `${describePath(sourcePath)} is invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`
    );
  }

  const root = document.toJS() as unknown;
  if (!isRecord(root)) {
    throw new DefaultsConfigError(
      "config.shape",
      `${describePath(sourcePath)} must contain an object at its root.`
    );
  }
  assertKnownKeys(root, ROOT_KEYS, sourcePath, "top-level");

  if (root.version !== "1") {
    throw new DefaultsConfigError(
      "config.version",
      `${describePath(sourcePath)} must declare supported version "1".`
    );
  }

  if (root.defaults !== undefined && !isRecord(root.defaults)) {
    throw new DefaultsConfigError(
      "config.shape",
      `${describePath(sourcePath)} key 'defaults' must contain an object.`
    );
  }

  const rawDefaults = (root.defaults ?? {}) as Record<string, unknown>;
  assertKnownKeys(rawDefaults, DEFAULT_KEYS, sourcePath, "defaults");
  const defaults: DefaultsConfigValues = {};

  for (const setting of DEFAULT_KEYS) {
    const value = rawDefaults[setting];
    if (value === undefined) continue;
    if (typeof value !== "string") {
      throw new DefaultsConfigError(
        "config.invalid_id",
        `${describePath(sourcePath)} setting '${setting}' must be a non-empty string.`
      );
    }
    assertDefaultsConfigId(value, setting, sourcePath);
    defaults[setting] = value;
  }

  return { version: "1", defaults };
}

export function serializeDefaultsConfig(config: DefaultsConfigV1): string {
  const defaults: DefaultsConfigValues = {};
  if (config.defaults.validation_profile_id !== undefined) {
    defaults.validation_profile_id = config.defaults.validation_profile_id;
  }
  if (config.defaults.render_detail_id !== undefined) {
    defaults.render_detail_id = config.defaults.render_detail_id;
  }
  if (config.defaults.node_decorator_mode_id !== undefined) {
    defaults.node_decorator_mode_id = config.defaults.node_decorator_mode_id;
  }

  const serializable: { version: "1"; defaults?: DefaultsConfigValues } = { version: "1" };
  if (Object.keys(defaults).length > 0) serializable.defaults = defaults;
  return YAML.stringify(serializable, { lineWidth: 0 }).replace(/\r\n?/g, "\n").replace(/\n*$/, "\n");
}
