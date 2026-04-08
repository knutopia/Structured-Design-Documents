import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "../src/bundle/types.js";
import { createParserSyntaxRuntime, type ParserSyntaxRuntime } from "../src/parser/syntaxRuntime.js";
import { getCapturePrimary, interpretStatement } from "../src/parser/statementInterpreter.js";
import { loadBundle } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

let bundle: Bundle;
let runtime: ParserSyntaxRuntime;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
  runtime = createParserSyntaxRuntime(bundle);
});

function expectSuccess(statementName: string, text: string) {
  const result = interpretStatement(text, statementName, runtime);
  expect(result.ok, `${statementName} should parse: ${text}`).toBe(true);
  return result.ok ? result : undefined!;
}

function expectFailure(statementName: string, text: string) {
  const result = interpretStatement(text, statementName, runtime);
  expect(result.ok, `${statementName} should reject: ${text}`).toBe(false);
}

describe("parser statement interpretation", () => {
  it("parses and rejects version declarations according to statement syntax", () => {
    const parsed = expectSuccess("version_decl", "SDD-TEXT 0.1");
    expect(parsed.emittedFields.version_number).toBe("0.1");

    expectFailure("version_decl", "SDD-TEXT 0.1 # comment");
    expectFailure("version_decl", "SDD-TEXT v0.1");
  });

  it("parses top and nested node headers through syntax-driven token, pattern, and atom rules", () => {
    const top = expectSuccess("top_node_header", 'Place P-010 "Billing"');
    expect(getCapturePrimary(top.captures, "node_type")).toBe("Place");
    expect(getCapturePrimary(top.captures, "id")).toBe("P-010");
    expect(getCapturePrimary(top.captures, "name")).toBe("Billing");

    const nested = expectSuccess("nested_node_header", '  + Place P-011 "Confirmation" # note');
    expect(getCapturePrimary(nested.captures, "node_type")).toBe("Place");
    expect(getCapturePrimary(nested.captures, "id")).toBe("P-011");
    expect(getCapturePrimary(nested.captures, "name")).toBe("Confirmation");

    expectFailure("nested_node_header", '+Place P-011 "Confirmation"');
  });

  it("parses property lines and rejects invalid property syntax", () => {
    const bare = expectSuccess("property_line", "status = active");
    expect(bare.emittedFields).toMatchObject({
      key: "status",
      value_kind: "bare_value",
      raw_value: "active"
    });

    const quoted = expectSuccess("property_line", 'label = "hello world" # note');
    expect(quoted.emittedFields).toMatchObject({
      key: "label",
      value_kind: "quoted_string",
      raw_value: "hello world"
    });

    expectFailure("property_line", "1status = active");
    expectFailure("property_line", 'label = "hello" trailing');
  });

  it("enforces edge fixed order, whitespace, atom validation, and quoted props", () => {
    expectFailure("edge_line", 'NAVIGATES_TO P-011 [E-010] "Confirmation"');
    expectFailure("edge_line", 'NAVIGATES_TO P-011 "Confirmation"[E-010]');
    expectFailure("edge_line", 'NAVIGATES_TO P-011 "Confirmation" [E-010] {ok} / "side effect"label=primary');
    expectFailure("edge_line", 'NAVIGATES_TO P-011 "Confirmation" [not valid !]');
    expectFailure("edge_line", 'TRANSITIONS_TO VS-010b "Next" [E-010] {ok} / 123');

    const quotedProp = expectSuccess("edge_line", 'BINDS_TO D-010 "Subscription" label="hello world"');
    expect(quotedProp.emittedFields.props).toEqual([
      {
        key: "label",
        value_kind: "quoted_string",
        raw_value: "hello world"
      }
    ]);

    const valid = expectSuccess("edge_line", 'NAVIGATES_TO P-011 "Confirmation" [E-010] {ok} / SA-010 label=primary');
    expect(valid.emittedFields).toMatchObject({
      rel_type: "NAVIGATES_TO",
      to: "P-011",
      to_name: "Confirmation",
      event: "E-010",
      guard: "ok",
      effect: "SA-010"
    });
    expect(valid.emittedFields.props).toEqual([
      {
        key: "label",
        value_kind: "bare_value",
        raw_value: "primary"
      }
    ]);
  });

  it("accepts END with optional trailing comment and rejects invalid trailing content", () => {
    expectSuccess("end_line", "END");
    expectSuccess("end_line", "END # note");
    expectFailure("end_line", "END trailing");
  });
});
