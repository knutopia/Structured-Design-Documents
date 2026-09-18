import path from "node:path";

/**
 * Resolves the working directory the user launched the CLI from.
 *
 * When the CLI is invoked through a package-manager script (for example
 * `pnpm sdd ...` or `npm run sdd ...`), the package manager re-roots the
 * process working directory to the package root before executing the script.
 * The directory the user actually ran the command from is preserved in the
 * `INIT_CWD` environment variable by both npm and pnpm.
 *
 * Preferring `INIT_CWD` keeps relative document paths (such as `tmp.sdd`)
 * resolving against the user's shell directory instead of the package root.
 * For direct `node dist/cli/main.js` invocations `INIT_CWD` is undefined, so
 * this falls back to `process.cwd()`.
 */
export function resolveLauncherCwd(env: NodeJS.ProcessEnv = process.env): string {
  const initCwd = env.INIT_CWD;
  if (initCwd && initCwd.trim().length > 0) {
    return initCwd;
  }
  return process.cwd();
}

/**
 * Resolves a (possibly relative) path against the launcher's working directory
 * rather than `process.cwd()`. Absolute paths are returned normalized.
 *
 * Use this for any user-supplied input or output path so that relative paths
 * behave consistently whether the CLI is run directly or through a
 * package-manager script.
 */
export function resolveLauncherPath(targetPath: string, env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(resolveLauncherCwd(env), targetPath);
}
