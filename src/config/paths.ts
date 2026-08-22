import path from "node:path";
import { DefaultsConfigError } from "./types.js";

export interface DefaultsPathApi {
  join(...paths: string[]): string;
}

export interface GlobalDefaultsPathOptions {
  platform: NodeJS.Platform;
  env: Readonly<Record<string, string | undefined>>;
  homedir: () => string;
  pathApi?: DefaultsPathApi;
}

export function getGlobalDefaultsConfigPath(options: GlobalDefaultsPathOptions): string {
  const pathApi = options.pathApi ?? (options.platform === "win32" ? path.win32 : path);
  if (options.platform === "win32") {
    const appData = options.env.APPDATA;
    if (!appData) {
      throw new DefaultsConfigError(
        "config.path",
        "Cannot resolve global SDD defaults because APPDATA is not set."
      );
    }
    return pathApi.join(appData, "sdd", "config.yaml");
  }

  const home = options.homedir();
  if (!home) {
    throw new DefaultsConfigError("config.path", "Cannot resolve global SDD defaults because the home directory is unavailable.");
  }
  if (options.platform === "darwin") {
    return pathApi.join(home, "Library", "Application Support", "sdd", "config.yaml");
  }
  return pathApi.join(options.env.XDG_CONFIG_HOME || pathApi.join(home, ".config"), "sdd", "config.yaml");
}
