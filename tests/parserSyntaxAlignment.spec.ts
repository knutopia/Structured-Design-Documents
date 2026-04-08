import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import type { EdgeLine, NodeBlock, ParseDocument, ParseResult } from "../src/parser/types.js";
import { loadBundle, parseSource } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

function parseText(text: string, file = "/virtual/parser-syntax-alignment.sdd"): ParseResult {
  return parseSource({ path: file, text }, bundle);
}

function expectParseFailure(result: ParseResult, code: string): void {
  expect(result.document).toBeUndefined();
  expect(result.diagnostics.some((diagnostic) => diagnostic.stage === "parse")).toBe(true);
  expect(result.diagnostics.some((diagnostic) => diagnostic.stage === "parse" && diagnostic.code === code)).toBe(
    true
  );
}

function expectParseSuccess(result: ParseResult): ParseDocument {
  expect(result.document).toBeDefined();
  expect(result.diagnostics).toEqual([]);
  return result.document!;
}

function singleTopLevelBlock(document: ParseDocument): NodeBlock {
  const blocks = document.items.filter((item): item is NodeBlock => item.kind === "NodeBlock");
  expect(blocks).toHaveLength(1);
  return blocks[0];
}

function singleEdgeLine(block: NodeBlock): EdgeLine {
  const edges = block.bodyItems.filter((item): item is EdgeLine => item.kind === "EdgeLine");
  expect(edges).toHaveLength(1);
  return edges[0];
}

function topLevelBlockWithBody(bodyLine: string): string {
  return `Place P-010 "Billing"
  ${bodyLine}
END
`;
}

describe("parser syntax alignment proof cases", () => {
  it("rejects comment-only input because the syntax contract requires a top-level block", () => {
    const result = parseText(`# leading comment

  # indented comment
`);

    expectParseFailure(result, "parse.minimum_top_level_blocks");
  });

  it("rejects a version declaration with a trailing comment", () => {
    const result = parseText(`SDD-TEXT 0.1 # comment

Place P-010 "Billing"
END
`);

    expectParseFailure(result, "parse.invalid_version_declaration");
  });

  it("rejects an edge where event appears before to_name", () => {
    const result = parseText(topLevelBlockWithBody(`NAVIGATES_TO P-011 [E-010] "Confirmation"`));

    expectParseFailure(result, "parse.invalid_edge_line");
  });

  it("rejects an edge with no whitespace before an event suffix group", () => {
    const result = parseText(topLevelBlockWithBody(`NAVIGATES_TO P-011 "Confirmation"[E-010]`));

    expectParseFailure(result, "parse.invalid_edge_line");
  });

  it("rejects an edge with no whitespace before the first repeated edge property", () => {
    const result = parseText(
      topLevelBlockWithBody(`NAVIGATES_TO P-011 "Confirmation" [E-010] {ok} / "side effect"label=primary`)
    );

    expectParseFailure(result, "parse.invalid_edge_line");
  });

  it("rejects invalid event text inside brackets", () => {
    const result = parseText(topLevelBlockWithBody(`NAVIGATES_TO P-011 "Confirmation" [not valid !]`));

    expectParseFailure(result, "parse.invalid_edge_line");
  });

  it("rejects invalid bare effect text", () => {
    const result = parseText(topLevelBlockWithBody(`TRANSITIONS_TO VS-010b "Next" [E-010] {ok} / 123`));

    expectParseFailure(result, "parse.invalid_edge_line");
  });

  it("parses quoted edge-property values with spaces", () => {
    const result = parseText(topLevelBlockWithBody(`BINDS_TO D-010 "Subscription" label="hello world"`));
    const document = expectParseSuccess(result);
    const block = singleTopLevelBlock(document);
    const edge = singleEdgeLine(block);

    expect(edge.props).toHaveLength(1);
    expect(edge.props[0]).toMatchObject({
      key: "label",
      valueKind: "quoted_string",
      rawValue: "hello world"
    });
  });

  it("parses every manifest example without parse diagnostics", async () => {
    for (const example of bundle.manifest.examples) {
      const examplePath = path.join(bundle.rootDir, example.path);
      const result = parseText(await readFile(examplePath, "utf8"), examplePath);

      expect(result.document, `expected parse document for ${example.path}`).toBeDefined();
      expect(result.diagnostics, `expected zero parse diagnostics for ${example.path}`).toEqual([]);
    }
  });
});
