import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import type { EdgeLine, NodeBlock, ParseDocument, ParseResult, PropertyLine } from "../src/parser/types.js";
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

function parseText(text: string, inputBundle = bundle, file = "/virtual/parser-contract-mutation-proof.sdd"): ParseResult {
  return parseSource({ path: file, text }, inputBundle);
}

function expectSuccess(result: ParseResult): ParseDocument {
  expect(result.document).toBeDefined();
  expect(result.diagnostics).toEqual([]);
  return result.document!;
}

function singleTopLevelBlock(document: ParseDocument): NodeBlock {
  const blocks = document.items.filter((item): item is NodeBlock => item.kind === "NodeBlock");
  expect(blocks).toHaveLength(1);
  return blocks[0];
}

function singleNestedBlock(block: NodeBlock): NodeBlock {
  const blocks = block.bodyItems.filter((item): item is NodeBlock => item.kind === "NodeBlock");
  expect(blocks).toHaveLength(1);
  return blocks[0];
}

function singlePropertyLine(block: NodeBlock): PropertyLine {
  const properties = block.bodyItems.filter((item): item is PropertyLine => item.kind === "PropertyLine");
  expect(properties).toHaveLength(1);
  return properties[0];
}

function singleEdgeLine(block: NodeBlock): EdgeLine {
  const edges = block.bodyItems.filter((item): item is EdgeLine => item.kind === "EdgeLine");
  expect(edges).toHaveLength(1);
  return edges[0];
}

describe("parser contract mutation proofs", () => {
  it("renamed header statements and emitted header kinds change parser output without grammar edits", () => {
    const cloned = cloneBundle();
    cloned.syntax.statements.primary_header = cloned.syntax.statements.top_node_header;
    delete cloned.syntax.statements.top_node_header;
    cloned.syntax.statements.child_header = cloned.syntax.statements.nested_node_header;
    delete cloned.syntax.statements.nested_node_header;

    const topHeaderLineKind = cloned.syntax.line_kinds.find((lineKind) => lineKind.kind === "top_node_header");
    const nestedHeaderLineKind = cloned.syntax.line_kinds.find((lineKind) => lineKind.kind === "nested_node_header");
    if (!topHeaderLineKind?.statement || !nestedHeaderLineKind?.statement) {
      throw new Error("expected top and nested header line kinds");
    }
    topHeaderLineKind.statement = "primary_header";
    nestedHeaderLineKind.statement = "child_header";

    cloned.syntax.blocks.top_node_block.header_statement = "primary_header";
    cloned.syntax.blocks.nested_node_block.header_statement = "child_header";
    cloned.syntax.blocks.top_node_block.emits.fields = {
      ...cloned.syntax.blocks.top_node_block.emits.fields,
      header_kind: { const: "primary_header" }
    };
    cloned.syntax.blocks.nested_node_block.emits.fields = {
      ...cloned.syntax.blocks.nested_node_block.emits.fields,
      header_kind: { const: "child_header" }
    };

    const document = expectSuccess(
      parseText(`Place P-010 "Billing"
  + Place P-011 "Confirmation"
  END
END
`, cloned)
    );

    const topBlock = singleTopLevelBlock(document);
    const nestedBlock = singleNestedBlock(topBlock);

    expect(topBlock.headerKind).toBe("primary_header");
    expect(nestedBlock.headerKind).toBe("child_header");
  });

  it("renamed blank/comment statements still preserve document and block trivia through emits", () => {
    const cloned = cloneBundle();
    cloned.syntax.statements.empty_line = cloned.syntax.statements.blank_line;
    delete cloned.syntax.statements.blank_line;
    cloned.syntax.statements.note_line = cloned.syntax.statements.comment_line;
    delete cloned.syntax.statements.comment_line;

    const blankOrComment = cloned.syntax.line_kinds.find((lineKind) => lineKind.kind === "blank_or_comment");
    if (!blankOrComment?.statements) {
      throw new Error("expected blank_or_comment line kind");
    }
    blankOrComment.statements = ["empty_line", "note_line"];
    cloned.syntax.document.leading_lines_allowed = ["empty_line", "note_line"];
    cloned.syntax.document.trailing_lines_allowed = ["empty_line", "note_line"];
    cloned.syntax.blocks.top_node_block.body_item_kinds = cloned.syntax.blocks.top_node_block.body_item_kinds.map(
      (itemKind) => (itemKind === "blank_line" ? "empty_line" : itemKind === "comment_line" ? "note_line" : itemKind)
    );
    cloned.syntax.blocks.nested_node_block.body_item_kinds =
      cloned.syntax.blocks.nested_node_block.body_item_kinds.map((itemKind) =>
        itemKind === "blank_line" ? "empty_line" : itemKind === "comment_line" ? "note_line" : itemKind
      );

    const document = expectSuccess(
      parseText(`# leading

Place P-010 "Billing"

  # inside
END

# trailing
`, cloned)
    );

    const topBlock = singleTopLevelBlock(document);
    expect(document.items.map((item) => item.kind)).toEqual([
      "CommentLine",
      "BlankLine",
      "NodeBlock",
      "BlankLine",
      "CommentLine",
      "BlankLine"
    ]);
    expect(document.items[0]).toMatchObject({ kind: "CommentLine", rawText: " leading" });
    expect(topBlock.bodyItems.map((item) => item.kind)).toEqual(["BlankLine", "CommentLine"]);
    expect(topBlock.bodyItems[1]).toMatchObject({ kind: "CommentLine", rawText: " inside" });
  });

  it("adding version_decl to trailing comment policy makes version comments parse successfully", () => {
    const cloned = cloneBundle();
    cloned.syntax.lexical.trailing_comments_allowed.push("version_decl");

    const document = expectSuccess(
      parseText(`SDD-TEXT 0.1 # note

Place P-010 "Billing"
END
`, cloned)
    );

    expect(document.declaredVersion).toBe("0.1");
  });

  it("changing edge suffix order in the executable contract changes parse behavior", () => {
    const cloned = cloneBundle();
    cloned.syntax.statements.edge_line.fixed_order = [
      "rel_type",
      "to",
      "event",
      "to_name",
      "guard",
      "effect",
      "props"
    ];

    const edgeSequence = cloned.syntax.statements.edge_line.sequence;
    if (!edgeSequence) {
      throw new Error("expected edge_line sequence");
    }
    [edgeSequence[3], edgeSequence[4]] = [edgeSequence[4], edgeSequence[3]];

    const document = expectSuccess(
      parseText(`Place P-010 "Billing"
  NAVIGATES_TO P-011 [E-010] "Confirmation"
END
`, cloned)
    );

    const edge = singleEdgeLine(singleTopLevelBlock(document));
    expect(edge.event).toBe("E-010");
    expect(edge.toName).toBe("Confirmation");
  });

  it("widening effect_atom changes which bare effects parse successfully", () => {
    const cloned = cloneBundle();
    if (!("one_of" in cloned.syntax.atoms.effect_atom)) {
      throw new Error("expected effect_atom one_of");
    }
    cloned.syntax.atoms.effect_atom.one_of.push({
      pattern_ref: "lexical.bare_value_pattern"
    });

    const document = expectSuccess(
      parseText(`Place P-010 "Billing"
  TRANSITIONS_TO VS-010b "Next" [E-010] {ok} / 123
END
`, cloned)
    );

    const edge = singleEdgeLine(singleTopLevelBlock(document));
    expect(edge.effect).toBe("123");
  });

  it("remapping a statement emit field changes parsed node values", () => {
    const cloned = cloneBundle();
    cloned.syntax.statements.property_line.emits.fields = {
      ...cloned.syntax.statements.property_line.emits.fields,
      raw_value: "key"
    };

    const document = expectSuccess(
      parseText(`Place P-010 "Billing"
  status = active
END
`, cloned)
    );

    const propertyLine = singlePropertyLine(singleTopLevelBlock(document));
    expect(propertyLine).toMatchObject({
      key: "status",
      rawValue: "status"
    });
  });

  it("fails fast on invalid fixed_order and emit field references in mutated contracts", () => {
    const invalidFixedOrder = cloneBundle();
    invalidFixedOrder.syntax.statements.edge_line.fixed_order = [
      "rel_type",
      "missing_capture",
      "to",
      "to_name",
      "event",
      "guard",
      "effect",
      "props"
    ];
    expect(() => parseText(`Place P-010 "Billing"
END
`, invalidFixedOrder)).toThrow(/unknown fixed_order capture 'missing_capture'/);

    const invalidStatementEmit = cloneBundle();
    invalidStatementEmit.syntax.statements.property_line.emits.fields = {
      ...invalidStatementEmit.syntax.statements.property_line.emits.fields,
      raw_value: "value.missing_field"
    };
    expect(() => parseText(`Place P-010 "Billing"
END
`, invalidStatementEmit)).toThrow(/invalid emit field reference 'value\.missing_field'/);

    const invalidAtomEmit = cloneBundle();
    if (!("sequence" in invalidAtomEmit.syntax.atoms.edge_property)) {
      throw new Error("expected edge_property sequence atom");
    }
    invalidAtomEmit.syntax.atoms.edge_property.emits.fields = {
      ...invalidAtomEmit.syntax.atoms.edge_property.emits.fields,
      raw_value: "value.missing_field"
    };
    expect(() => parseText(`Place P-010 "Billing"
END
`, invalidAtomEmit)).toThrow(/invalid emit field reference 'value\.missing_field'/);

    const invalidBlockEmit = cloneBundle();
    invalidBlockEmit.syntax.blocks.top_node_block.emits.fields = {
      ...invalidBlockEmit.syntax.blocks.top_node_block.emits.fields,
      header_kind: "header.missing_capture"
    };
    expect(() => parseText(`Place P-010 "Billing"
END
`, invalidBlockEmit)).toThrow(/invalid block emit field reference 'header\.missing_capture'/);
  });
});
