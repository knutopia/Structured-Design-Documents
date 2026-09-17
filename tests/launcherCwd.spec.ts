import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveLauncherCwd, resolveLauncherPath } from "../src/cli/launcherCwd.js";

describe("resolveLauncherCwd", () => {
  it("prefers INIT_CWD so package-manager scripts resolve against the launcher directory", () => {
    // `pnpm sdd ...` / `npm run sdd ...` re-root process.cwd() to the package
    // root but preserve the user's shell directory in INIT_CWD.
    const launcherDir = "/home/knut/projects/sdd/docs/sdd_app_planning";
    expect(resolveLauncherCwd({ INIT_CWD: launcherDir })).toBe(launcherDir);
  });

  it("falls back to process.cwd() for direct node invocations without INIT_CWD", () => {
    expect(resolveLauncherCwd({})).toBe(process.cwd());
  });

  it("ignores a blank INIT_CWD and falls back to process.cwd()", () => {
    expect(resolveLauncherCwd({ INIT_CWD: "   " })).toBe(process.cwd());
  });
});

describe("resolveLauncherPath", () => {
  it("resolves a relative output path against INIT_CWD, not process.cwd()", () => {
    const launcherDir = "/home/knut/projects/sdd/docs/sdd_app_planning";
    expect(resolveLauncherPath("test.svg", { INIT_CWD: launcherDir })).toBe(
      path.join(launcherDir, "test.svg")
    );
  });

  it("returns absolute paths normalized regardless of INIT_CWD", () => {
    const absolute = "/tmp/somewhere/out.svg";
    expect(resolveLauncherPath(absolute, { INIT_CWD: "/home/knut/projects/sdd" })).toBe(absolute);
  });

  it("falls back to process.cwd() for relative paths without INIT_CWD", () => {
    expect(resolveLauncherPath("test.svg", {})).toBe(path.resolve(process.cwd(), "test.svg"));
  });
});
