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

function parseText(
  text: string,
  inputBundle = bundle,
  file = "/virtual/parser-syntax-alignment.sdd"
): ParseResult {
  return parseSource({ path: file, text }, inputBundle);
}

function cloneBundle(): Bundle {
  return structuredClone(bundle) as Bundle;
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

  it.each(["composed_of", "Composed_Of"])(
    "reports the canonical bundle spelling for a non-canonical relationship token '%s'",
    (token) => {
      const result = parseText(topLevelBlockWithBody(`${token} C-010 "Editor"`));
      const diagnostic = result.diagnostics.find((candidate) => candidate.code === "parse.token_case_mismatch");

      expect(result.document).toBeUndefined();
      expect(diagnostic).toMatchObject({
        stage: "parse",
        severity: "error",
        message: `Token '${token}' has non-canonical casing; use 'COMPOSED_OF'.`,
        span: {
          line: 2,
          column: 1,
          endLine: 2
        }
      });
    }
  );

  it("keeps unrelated relationship typos on the existing unexpected-line diagnostic", () => {
    const result = parseText(topLevelBlockWithBody(`composedof C-010 "Editor"`));

    expectParseFailure(result, "parse.unexpected_line_in_block");
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "parse.token_case_mismatch")).toBe(false);
  });

  it("derives the suggested spelling from the selected bundle vocabulary", () => {
    const renamedBundle = cloneBundle();
    renamedBundle.vocab.relationship_types.find(({ token }) => token === "COMPOSED_OF")!.token = "Composes";

    const result = parseText(topLevelBlockWithBody(`composes C-010 "Editor"`), renamedBundle);

    expectParseFailure(result, "parse.token_case_mismatch");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      message: "Token 'composes' has non-canonical casing; use 'Composes'."
    }));
  });

  it("uses a case-insensitive syntax contract while emitting canonical vocabulary tokens", () => {
    const caseInsensitiveBundle = cloneBundle();
    caseInsensitiveBundle.syntax.parsing_model.case_sensitive = false;

    const result = parseText(`sdd-text 0.1

place P-010 "Billing"
  composed_of C-010 "Editor"
end
`, caseInsensitiveBundle);
    const document = expectParseSuccess(result);
    const block = singleTopLevelBlock(document);
    const edge = singleEdgeLine(block);

    expect(document.declaredVersion).toBe("0.1");
    expect(block.nodeType).toBe("Place");
    expect(edge.relType).toBe("COMPOSED_OF");
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
      const result = parseText(await readFile(examplePath, "utf8"), bundle, examplePath);

      expect(result.document, `expected parse document for ${example.path}`).toBeDefined();
      expect(result.diagnostics, `expected zero parse diagnostics for ${example.path}`).toEqual([]);
    }
  });
});
