import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import type { NodeBlock, ParseDocument, ParseResult } from "../src/parser/types.js";
import { loadBundle, parseSource } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

function cloneBundle(): Bundle {
  return structuredClone(bundle) as Bundle;
}

function parseText(
  text: string,
  inputBundle = bundle,
  file = "/virtual/parser-document-block-parsing.sdd"
): ParseResult {
  return parseSource({ path: file, text }, inputBundle);
}

function expectFailure(result: ParseResult, code: string): void {
  expect(result.document).toBeUndefined();
  expect(result.diagnostics.some((diagnostic) => diagnostic.stage === "parse" && diagnostic.code === code)).toBe(
    true
  );
}

function expectSuccess(result: ParseResult): ParseDocument {
  expect(result.diagnostics).toEqual([]);
  expect(result.document).toBeDefined();
  return result.document!;
}

function countTopLevelBlocks(document: ParseDocument): number {
  return document.items.filter((item): item is NodeBlock => item.kind === "NodeBlock").length;
}

const singleBlockDocument = `Place P-010 "Billing"
END
`;

const twoBlockDocument = `Place P-010 "Billing"
END

Place P-020 "Checkout"
END
`;

const versionedSingleBlockDocument = `SDD-TEXT 0.1

Place P-010 "Billing"
END
`;

const nestedBlockDocument = `Place P-010 "Billing"
  + Place P-011 "Confirmation"
  END
END
`;

describe("parser document and block authority", () => {
  it("enforces the document minimum top-level block count", () => {
    expectFailure(parseText(`# leading comment

  # indented comment
`), "parse.minimum_top_level_blocks");

    const minTwoBundle = cloneBundle();
    minTwoBundle.syntax.document.minimum_top_level_blocks = 2;

    expectFailure(parseText(singleBlockDocument, minTwoBundle), "parse.minimum_top_level_blocks");

    const parsedTwoBlockDocument = expectSuccess(parseText(twoBlockDocument, minTwoBundle));
    expect(countTopLevelBlocks(parsedTwoBlockDocument)).toBe(2);
  });

  it("enforces required and disallowed version declarations from document config", () => {
    const requiredVersionBundle = cloneBundle();
    requiredVersionBundle.syntax.document.version_declaration.required = true;

    expectFailure(parseText(singleBlockDocument, requiredVersionBundle), "parse.missing_version_declaration");

    const disallowedVersionBundle = cloneBundle();
    disallowedVersionBundle.syntax.document.version_declaration.allowed = false;

    expectFailure(
      parseText(versionedSingleBlockDocument, disallowedVersionBundle),
      "parse.unexpected_version_declaration"
    );
  });

  it("uses document.version_declaration.statement_kind to parse renamed version statements", () => {
    const renamedVersionBundle = cloneBundle();
    renamedVersionBundle.syntax.statements.sdd_version = renamedVersionBundle.syntax.statements.version_decl;
    delete renamedVersionBundle.syntax.statements.version_decl;
    renamedVersionBundle.syntax.document.version_declaration.statement_kind = "sdd_version";

    const document = expectSuccess(parseText(versionedSingleBlockDocument, renamedVersionBundle));
    expect(document.declaredVersion).toBe("0.1");
  });

  it("uses document.top_level_block_kind to select the top-level block parser", () => {
    const renamedTopLevelBlockBundle = cloneBundle();
    renamedTopLevelBlockBundle.syntax.blocks.primary_block = renamedTopLevelBlockBundle.syntax.blocks.top_node_block;
    delete renamedTopLevelBlockBundle.syntax.blocks.top_node_block;
    renamedTopLevelBlockBundle.syntax.document.top_level_block_kind = "primary_block";

    const document = expectSuccess(parseText(singleBlockDocument, renamedTopLevelBlockBundle));
    expect(countTopLevelBlocks(document)).toBe(1);
  });

  it("uses block body_item_kinds to allow renamed nested block references", () => {
    const renamedNestedBlockBundle = cloneBundle();
    renamedNestedBlockBundle.syntax.blocks.child_block = renamedNestedBlockBundle.syntax.blocks.nested_node_block;
    delete renamedNestedBlockBundle.syntax.blocks.nested_node_block;
    renamedNestedBlockBundle.syntax.blocks.top_node_block.body_item_kinds =
      renamedNestedBlockBundle.syntax.blocks.top_node_block.body_item_kinds.map((itemKind) =>
        itemKind === "nested_node_block" ? "child_block" : itemKind
      );
    renamedNestedBlockBundle.syntax.blocks.child_block.body_item_kinds =
      renamedNestedBlockBundle.syntax.blocks.child_block.body_item_kinds.map((itemKind) =>
        itemKind === "nested_node_block" ? "child_block" : itemKind
      );

    const document = expectSuccess(parseText(nestedBlockDocument, renamedNestedBlockBundle));
    const topLevelBlock = document.items.find((item): item is NodeBlock => item.kind === "NodeBlock");

    expect(topLevelBlock?.bodyItems.some((item) => item.kind === "NodeBlock")).toBe(true);
  });

  it("rejects nested blocks and property lines when body_item_kinds disallow them", () => {
    const noNestedBlockBundle = cloneBundle();
    noNestedBlockBundle.syntax.blocks.top_node_block.body_item_kinds =
      noNestedBlockBundle.syntax.blocks.top_node_block.body_item_kinds.filter(
        (itemKind) => itemKind !== "nested_node_block"
      );

    expectFailure(parseText(nestedBlockDocument, noNestedBlockBundle), "parse.unexpected_line_in_block");

    const noPropertyLineBundle = cloneBundle();
    noPropertyLineBundle.syntax.blocks.top_node_block.body_item_kinds =
      noPropertyLineBundle.syntax.blocks.top_node_block.body_item_kinds.filter(
        (itemKind) => itemKind !== "property_line"
      );

    expectFailure(
      parseText(`Place P-010 "Billing"
  status = active
END
`, noPropertyLineBundle),
      "parse.unexpected_line_in_block"
    );
  });

  it("uses block terminator_statement even when the terminator statement is renamed", () => {
    const renamedTerminatorBundle = cloneBundle();
    renamedTerminatorBundle.syntax.statements.finish_line = renamedTerminatorBundle.syntax.statements.end_line;
    delete renamedTerminatorBundle.syntax.statements.end_line;

    const terminatorLineKind = renamedTerminatorBundle.syntax.line_kinds.find(
      (lineKind) => lineKind.kind === "end_line"
    );
    if (!terminatorLineKind || !terminatorLineKind.statement) {
      throw new Error("expected end_line line kind");
    }
    terminatorLineKind.statement = "finish_line";
    renamedTerminatorBundle.syntax.blocks.top_node_block.terminator_statement = "finish_line";
    renamedTerminatorBundle.syntax.blocks.nested_node_block.terminator_statement = "finish_line";

    const document = expectSuccess(parseText(singleBlockDocument, renamedTerminatorBundle));
    expect(countTopLevelBlocks(document)).toBe(1);
  });
});
