import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("published CLI decorator guidance", () => {
  it("documents decorator choices, defaults, and automatic artifact identity", async () => {
    const guide = await readFile(path.resolve("docs/doc_site/sdd_cli_tools/index.md"), "utf8");

    expect(guide).not.toContain("(to do)");
    expect(guide).toContain("Use `--decorators` to add orientation information to diagram nodes:");
    expect(guide).toContain("- `type,id`: show both the type and ID");
    expect(guide).toContain("pnpm sdd defaults set decorators type,id");
    expect(guide).toContain("<source>.<view>.<detail>[.decorators-<mode>][.<backend>].<format>");
  });
});
