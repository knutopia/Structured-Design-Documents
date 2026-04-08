import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle, SyntaxClassifierFirstTokenSource } from "../src/bundle/types.js";
import { classifyLine, type LineRecord } from "../src/parser/classifyLine.js";
import { createParserSyntaxRuntime } from "../src/parser/syntaxRuntime.js";
import { loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

function cloneBundle(): Bundle {
  return structuredClone(bundle) as Bundle;
}

function line(raw: string): LineRecord {
  return {
    raw,
    lineNumber: 1,
    startOffset: 0
  };
}

function classify(raw: string, inputBundle = bundle) {
  return classifyLine(line(raw), createParserSyntaxRuntime(inputBundle));
}

describe("parser line classification", () => {
  it("classifies the current real-bundle line shapes to the expected statement kinds", () => {
    expect(classify("")).toMatchObject({ kind: "blank_line", lineKindKind: "blank_or_comment", content: "" });
    expect(classify("  # note")).toMatchObject({
      kind: "comment_line",
      lineKindKind: "blank_or_comment",
      content: "",
      commentText: " note"
    });
    expect(classify("END")).toMatchObject({ kind: "end_line", lineKindKind: "end_line", content: "END" });
    expect(classify('  + Place P-010 "Billing"')).toMatchObject({
      kind: "nested_node_header",
      lineKindKind: "nested_node_header"
    });
    expect(classify('Place P-010 "Billing"')).toMatchObject({
      kind: "top_node_header",
      lineKindKind: "top_node_header"
    });
    expect(classify("NAVIGATES_TO P-011")).toMatchObject({ kind: "edge_line", lineKindKind: "edge_line" });
    expect(classify("status = active")).toMatchObject({ kind: "property_line", lineKindKind: "property_line" });
    expect(classify("SDD-TEXT 0.1")).toMatchObject({ kind: "unknown", lineKindKind: "unknown" });
  });

  it("classifies END with a trailing comment using stripped content", () => {
    expect(classify("END # note")).toMatchObject({
      kind: "end_line",
      lineKindKind: "end_line",
      content: "END",
      commentText: " note"
    });
  });

  it("resolves blank_or_comment through statement match rules rather than a hard-coded branch", () => {
    const blank = classify("");
    const comment = classify("# note");

    expect(blank.lineKindKind).toBe("blank_or_comment");
    expect(blank.kind).toBe("blank_line");
    expect(comment.lineKindKind).toBe("blank_or_comment");
    expect(comment.kind).toBe("comment_line");
  });

  it("changes classification when line kind precedence changes", () => {
    const original = classify("NAVIGATES_TO = active");
    const cloned = cloneBundle();
    const propertyLine = cloned.syntax.line_kinds.find((lineKind) => lineKind.kind === "property_line");
    if (!propertyLine) {
      throw new Error("expected property_line line kind");
    }
    propertyLine.precedence = 3;

    const changed = classify("NAVIGATES_TO = active", cloned);

    expect(original.kind).toBe("edge_line");
    expect(changed.kind).toBe("property_line");
  });

  it("changes the resolved classification kind when a line kind statement mapping changes", () => {
    const cloned = cloneBundle();
    const topNodeHeader = cloned.syntax.line_kinds.find((lineKind) => lineKind.kind === "top_node_header");
    if (!topNodeHeader) {
      throw new Error("expected top_node_header line kind");
    }
    topNodeHeader.statement = "property_line";

    const classified = classify('Place P-010 "Billing"', cloned);

    expect(classified.kind).toBe("property_line");
    expect(classified.lineKindKind).toBe("top_node_header");
  });

  it("changes multi-statement resolution when statement match rules change", () => {
    const cloned = cloneBundle();
    const commentLine = cloned.syntax.statements.comment_line;
    commentLine.match = {
      first_non_whitespace: "/"
    };

    const classified = classify("# note", cloned);

    expect(classified.kind).toBe("unknown");
    expect(classified.lineKindKind).toBe("blank_or_comment");
  });

  it("routes first_token_source lookup through token_sources", () => {
    const cloned = cloneBundle();
    cloned.syntax.token_sources.node_types.key = "relationship_types";

    expect(classify('Place P-010 "Billing"', cloned)).toMatchObject({
      kind: "unknown",
      lineKindKind: "unknown"
    });
  });

  it("routes next_token_source lookup through token_sources", () => {
    const cloned = cloneBundle();
    cloned.syntax.token_sources.node_types.key = "relationship_types";

    expect(classify('  + Place P-010 "Billing"', cloned)).toMatchObject({
      kind: "unknown",
      lineKindKind: "unknown"
    });
  });

  it("uses the classifier's configured token source for top node headers", () => {
    const cloned = cloneBundle();
    const topNodeHeader = cloned.syntax.line_kinds.find((lineKind) => lineKind.kind === "top_node_header");
    if (!topNodeHeader || !("first_token_source" in topNodeHeader.classifier)) {
      throw new Error("expected top_node_header classifier to use first_token_source");
    }
    (topNodeHeader.classifier as SyntaxClassifierFirstTokenSource).first_token_source = "relationship_types";

    expect(classify('Place P-010 "Billing"', cloned)).toMatchObject({
      kind: "unknown",
      lineKindKind: "unknown"
    });
  });
});
