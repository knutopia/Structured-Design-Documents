import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import {
  createParserSyntaxRuntime,
  getAtom,
  getBlock,
  getPattern,
  getStatement,
  getTokenSource
} from "../src/parser/syntaxRuntime.js";
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

describe("parser syntax runtime", () => {
  it("builds a runtime from the real bundle without throwing", () => {
    const runtime = createParserSyntaxRuntime(bundle);

    expect(runtime.syntax).toBe(bundle.syntax);
    expect(runtime.trailingCommentAllowedStatements.has("edge_line")).toBe(true);
    expect(runtime.documentLeadingLineKinds.has("blank_line")).toBe(true);
    expect(runtime.documentTrailingLineKinds.has("comment_line")).toBe(true);
  });

  it("resolves node and relationship token sources against the bundle vocabulary", () => {
    const runtime = createParserSyntaxRuntime(bundle);
    const nodeTypes = getTokenSource(runtime, "node_types");
    const relationshipTypes = getTokenSource(runtime, "relationship_types");

    expect(nodeTypes.config.path).toBe("core/vocab.yaml");
    expect(nodeTypes.tokens).toContain("Place");
    expect(nodeTypes.tokenSet.has("Component")).toBe(true);
    expect(relationshipTypes.tokens).toContain("NAVIGATES_TO");
    expect(relationshipTypes.tokenSet.has("TRANSITIONS_TO")).toBe(true);
  });

  it("precompiles lexical patterns for the current parser-facing refs", () => {
    const runtime = createParserSyntaxRuntime(bundle);

    expect(getPattern(runtime, "lexical.identifier_pattern").test("route_or_key")).toBe(true);
    expect(getPattern(runtime, "lexical.id_pattern").test("P-010")).toBe(true);
    expect(getPattern(runtime, "lexical.version_number_pattern").test("0.1")).toBe(true);
    expect(getPattern(runtime, "lexical.bare_value_pattern").test("role:billing_agent")).toBe(true);
  });

  it("orders line kinds by declared precedence and preserves multi-statement kinds", () => {
    const runtime = createParserSyntaxRuntime(bundle);
    const blankOrComment = runtime.lineKindsByKind.get("blank_or_comment");

    expect(runtime.lineKindsInPrecedenceOrder.map((lineKind) => lineKind.kind)).toEqual([
      "end_line",
      "nested_node_header",
      "top_node_header",
      "edge_line",
      "property_line",
      "blank_or_comment"
    ]);
    expect(blankOrComment?.statements).toEqual(["blank_line", "comment_line"]);
  });

  it("exposes statement, block, and atom lookups for the current syntax contract", () => {
    const runtime = createParserSyntaxRuntime(bundle);

    expect(getStatement(runtime, "version_decl")).toBe(runtime.syntax.statements.version_decl);
    expect(getStatement(runtime, "edge_line")).toBe(runtime.syntax.statements.edge_line);
    expect(getStatement(runtime, "comment_line")).toBe(runtime.syntax.statements.comment_line);

    expect(getBlock(runtime, "top_node_block")).toBe(runtime.syntax.blocks.top_node_block);
    expect(getBlock(runtime, "nested_node_block")).toBe(runtime.syntax.blocks.nested_node_block);

    expect(getAtom(runtime, "event_atom")).toBe(runtime.syntax.atoms.event_atom);
    expect(getAtom(runtime, "effect_atom")).toBe(runtime.syntax.atoms.effect_atom);
    expect(getAtom(runtime, "guard_text")).toBe(runtime.syntax.atoms.guard_text);
    expect(getAtom(runtime, "edge_property")).toBe(runtime.syntax.atoms.edge_property);
  });

  it("throws on an unknown token-source reference", () => {
    const cloned = cloneBundle();
    const topNodeHeader = cloned.syntax.line_kinds.find((lineKind) => lineKind.kind === "top_node_header");
    if (!topNodeHeader || !("first_token_source" in topNodeHeader.classifier)) {
      throw new Error("expected top_node_header classifier to use first_token_source");
    }
    topNodeHeader.classifier.first_token_source = "missing_tokens";

    expect(() => createParserSyntaxRuntime(cloned)).toThrow(/unknown token source 'missing_tokens'/);
  });

  it("throws on an unknown pattern ref", () => {
    const cloned = cloneBundle();
    const propertyKey = cloned.syntax.statements.property_line.sequence?.[0];
    if (!propertyKey || !("pattern_ref" in propertyKey)) {
      throw new Error("expected property_line key capture to use pattern_ref");
    }
    propertyKey.pattern_ref = "lexical.missing_pattern";

    expect(() => createParserSyntaxRuntime(cloned)).toThrow(/unknown pattern ref 'lexical\.missing_pattern'/);
  });

  it("throws on an unknown atom ref", () => {
    const cloned = cloneBundle();
    const nodeName = cloned.syntax.statements.top_node_header.sequence?.[4];
    if (!nodeName || !("atom" in nodeName)) {
      throw new Error("expected top_node_header name capture to use atom");
    }
    nodeName.atom = "missing_atom";

    expect(() => createParserSyntaxRuntime(cloned)).toThrow(/unknown atom 'missing_atom'/);
  });

  it("throws on an unknown statement ref", () => {
    const cloned = cloneBundle();
    cloned.syntax.document.version_declaration.statement_kind = "missing_statement";

    expect(() => createParserSyntaxRuntime(cloned)).toThrow(/unknown statement 'missing_statement'/);
  });

  it("throws on an unknown block ref", () => {
    const cloned = cloneBundle();
    cloned.syntax.document.top_level_block_kind = "missing_block";

    expect(() => createParserSyntaxRuntime(cloned)).toThrow(/unknown block 'missing_block'/);
  });

  it("throws when a cloned line kind declares neither statement nor statements", () => {
    const cloned = cloneBundle();
    const blankOrComment = cloned.syntax.line_kinds.find((lineKind) => lineKind.kind === "blank_or_comment");
    if (!blankOrComment) {
      throw new Error("expected blank_or_comment line kind");
    }
    delete blankOrComment.statements;

    expect(() => createParserSyntaxRuntime(cloned)).toThrow(/invalid line kind declaration/);
  });

  it("throws when a cloned line kind declares both statement and statements", () => {
    const cloned = cloneBundle();
    const blankOrComment = cloned.syntax.line_kinds.find((lineKind) => lineKind.kind === "blank_or_comment");
    if (!blankOrComment) {
      throw new Error("expected blank_or_comment line kind");
    }
    blankOrComment.statement = "blank_line";

    expect(() => createParserSyntaxRuntime(cloned)).toThrow(/invalid line kind declaration/);
  });
});
