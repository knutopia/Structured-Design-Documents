import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createHighlighter,
  type HighlighterGeneric,
  type LanguageRegistration
} from "shiki";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import {
  createSddTextMateAssets,
  serializeTextMateAsset,
  type SddTextMateAssets
} from "../src/highlighting/sddTextMate.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const extensionRoot = path.join(repoRoot, "editors/vscode-sdd");
const grammarPath = path.join(extensionRoot, "syntaxes/sdd.tmLanguage.json");
const languageConfigurationPath = path.join(extensionRoot, "language-configuration.json");

let bundle: Bundle;
let assets: SddTextMateAssets;
let highlighter: HighlighterGeneric<never, never>;

interface ScopeSegment {
  start: number;
  end: number;
  scopes: string[];
}

function flattenScopes(
  result: ReturnType<typeof highlighter.codeToTokens>
): ScopeSegment[] {
  const segments: ScopeSegment[] = [];
  for (const line of result.tokens) {
    for (const token of line) {
      let offset = token.offset;
      for (const explanation of token.explanation ?? []) {
        segments.push({
          start: offset,
          end: offset + explanation.content.length,
          scopes: explanation.scopes.map((scope) => scope.scopeName)
        });
        offset += explanation.content.length;
      }
    }
  }
  return segments;
}

function occurrenceRange(code: string, needle: string, occurrence = 0): [number, number] {
  let offset = -1;
  for (let index = 0; index <= occurrence; index += 1) {
    offset = code.indexOf(needle, offset + 1);
    if (offset < 0) {
      throw new Error(`Could not find occurrence ${occurrence} of ${needle}`);
    }
  }
  return [offset, offset + needle.length];
}

function scopesFor(
  segments: ScopeSegment[],
  code: string,
  needle: string,
  occurrence = 0
): string[] {
  const [start, end] = occurrenceRange(code, needle, occurrence);
  return [
    ...new Set(
      segments
        .filter((segment) => segment.end > start && segment.start < end)
        .flatMap((segment) => segment.scopes)
    )
  ];
}

function expectScope(
  segments: ScopeSegment[],
  code: string,
  needle: string,
  expectedScope: string,
  occurrence = 0
): void {
  expect(scopesFor(segments, code, needle, occurrence)).toContain(expectedScope);
}

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
  assets = createSddTextMateAssets(bundle);
  highlighter = (await createHighlighter({
    themes: ["github-dark"],
    langs: [assets.grammar as LanguageRegistration]
  })) as HighlighterGeneric<never, never>;
});

afterAll(() => {
  highlighter.dispose();
});

describe("bundle-generated SDD TextMate assets", () => {
  it("keeps checked-in generated artifacts in deterministic sync", async () => {
    const [grammarText, languageConfigurationText] = await Promise.all([
      readFile(grammarPath, "utf8"),
      readFile(languageConfigurationPath, "utf8")
    ]);

    expect(grammarText).toBe(serializeTextMateAsset(assets.grammar));
    expect(languageConfigurationText).toBe(
      serializeTextMateAsset(assets.languageConfiguration)
    );
    expect(grammarText.endsWith("\n")).toBe(true);
    expect(grammarText).not.toContain("\r");
  });

  it("derives vocabulary tokens and group suffixes from the bundle", () => {
    const grammarText = serializeTextMateAsset(assets.grammar);
    for (const nodeType of bundle.vocab.node_types) {
      expect(grammarText).toContain(nodeType.token);
      expect(grammarText).toContain(
        `storage.type.node.sdd.${nodeType.group?.replace(/_/g, "-")}`
      );
    }
    for (const relationshipType of bundle.vocab.relationship_types) {
      expect(grammarText).toContain(relationshipType.token);
      expect(grammarText).toContain(
        `keyword.control.relationship.sdd.${relationshipType.group?.replace(/_/g, "-")}`
      );
    }
  });

  it("tokenizes every bundle vocabulary token with its bundle group suffix", () => {
    for (const nodeType of bundle.vocab.node_types) {
      const code = `${nodeType.token} N-001 "Name"\nEND`;
      const result = highlighter.codeToTokens(code, {
        lang: "sdd",
        theme: "github-dark",
        includeExplanation: true
      });
      expectScope(
        flattenScopes(result),
        code,
        nodeType.token,
        `storage.type.node.sdd.${nodeType.group?.replace(/_/g, "-")}`
      );
    }

    for (const relationshipType of bundle.vocab.relationship_types) {
      const code = `${relationshipType.token} N-001`;
      const result = highlighter.codeToTokens(code, {
        lang: "sdd",
        theme: "github-dark",
        includeExplanation: true
      });
      expectScope(
        flattenScopes(result),
        code,
        relationshipType.token,
        `keyword.control.relationship.sdd.${relationshipType.group?.replace(/_/g, "-")}`
      );
    }
  });

  it("changes generated behavior when bundle-only vocabulary changes", () => {
    const cloned = structuredClone(bundle) as Bundle;
    cloned.vocab.node_types.push({
      token: "Experiment",
      group: "product_intent",
      description: "Bundle mutation proof."
    });

    const changed = createSddTextMateAssets(cloned);

    expect(serializeTextMateAsset(changed.grammar)).toContain("Experiment");
    expect(serializeTextMateAsset(assets.grammar)).not.toContain("Experiment");
    expect(changed.languageConfiguration.indentationRules.increaseIndentPattern).toContain(
      "Experiment"
    );
  });

  it("changes generated behavior when bundle-only lexical syntax changes", () => {
    const cloned = structuredClone(bundle) as Bundle;
    cloned.syntax.lexical.id_pattern = "^[A-Z]{2,4}-[0-9]{4}$";

    const changed = createSddTextMateAssets(cloned);
    const changedGrammar = serializeTextMateAsset(changed.grammar);

    expect(changedGrammar).toContain("[A-Z]{2,4}-[0-9]{4}");
    expect(serializeTextMateAsset(assets.grammar)).not.toContain(
      "[A-Z]{2,4}-[0-9]{4}"
    );
    expect(changed.languageConfiguration.wordPattern).toContain(
      "[A-Z]{2,4}-[0-9]{4}"
    );
  });

  it("fails instead of inventing a hidden group default", () => {
    const cloned = structuredClone(bundle) as Bundle;
    delete cloned.vocab.node_types[0].group;

    expect(() => createSddTextMateAssets(cloned)).toThrow(
      /every vocabulary entry must declare a non-empty group/
    );
  });

  it("fails explicitly for an unsupported bare-value syntax shape", () => {
    const cloned = structuredClone(bundle) as Bundle;
    cloned.syntax.lexical.bare_value_pattern = "^.+$";

    expect(() => createSddTextMateAssets(cloned)).toThrow(
      /bare value pattern must be a one-or-more repetition of one character class/
    );
  });

  it("registers the intended language ergonomics", () => {
    expect(assets.languageConfiguration).toMatchObject({
      comments: { lineComment: "#" },
      brackets: [
        ["[", "]"],
        ["{", "}"]
      ]
    });
    expect(assets.languageConfiguration.wordPattern).toContain(
      "[A-Z]{1,3}-[0-9]{3,}"
    );
    expect(assets.languageConfiguration.folding.markers.end).toContain("END");
  });
});

describe("SDD TextMate tokenization", () => {
  it("scopes every v0.1 construct without splitting SDD IDs", () => {
    const escapedQuote = bundle.syntax.lexical.quoted_string.standardized_escapes.find(
      ({ value }) => value === bundle.syntax.lexical.quoted_string.delimiter
    )?.literal;
    if (!escapedQuote) {
      throw new Error("The test bundle must define its quoted-delimiter escape");
    }
    const quotedValue = `"A ${escapedQuote}quoted # value${escapedQuote}"`;
    const code = `SDD-TEXT 0.1
# document comment
Outcome O-001 "Increase successful checkout" # header comment
  owner=team_checkout
  description=${quotedValue}
  NAVIGATES_TO P-020 "Billing" [E-010] {cart.total # 0} / SA-009 confidence=high # edge comment
  + ViewState VS-020a "Billing ready"
  END # nested done
END`;
    const result = highlighter.codeToTokens(code, {
      lang: "sdd",
      theme: "github-dark",
      includeExplanation: true
    });
    const segments = flattenScopes(result);

    expectScope(segments, code, "SDD-TEXT", "keyword.other.version.sdd");
    expectScope(segments, code, "0.1", "constant.numeric.version.sdd");
    expectScope(segments, code, "# document comment", "comment.line.number-sign.sdd");
    expectScope(
      segments,
      code,
      "Outcome",
      "storage.type.node.sdd.product-intent"
    );
    expectScope(segments, code, "O-001", "constant.other.identifier.node.sdd");
    expectScope(
      segments,
      code,
      '"Increase successful checkout"',
      "string.quoted.double.sdd"
    );
    expectScope(segments, code, "owner", "variable.other.property.sdd");
    expectScope(segments, code, "=", "keyword.operator.assignment.sdd");
    expectScope(segments, code, "team_checkout", "string.unquoted.bare.sdd");
    expectScope(
      segments,
      code,
      escapedQuote,
      "constant.character.escape.sdd"
    );
    expectScope(
      segments,
      code,
      "NAVIGATES_TO",
      "keyword.control.relationship.sdd.navigation"
    );
    expectScope(segments, code, "P-020", "constant.other.identifier.target.sdd");
    expectScope(segments, code, "E-010", "constant.other.identifier.event.sdd");
    expectScope(segments, code, "cart.total # 0", "string.unquoted.guard.sdd");
    expect(scopesFor(segments, code, "cart.total # 0")).not.toContain(
      "comment.line.number-sign.sdd"
    );
    expectScope(segments, code, "/", "keyword.operator.effect.sdd");
    expectScope(segments, code, "SA-009", "constant.other.identifier.effect.sdd");
    expectScope(
      segments,
      code,
      "confidence",
      "variable.other.property.edge.sdd"
    );
    expectScope(
      segments,
      code,
      "+",
      "punctuation.definition.block.nested.sdd"
    );
    expectScope(
      segments,
      code,
      "ViewState",
      "storage.type.node.sdd.ui-behavior"
    );
    expectScope(
      segments,
      code,
      "VS-020a",
      "constant.other.identifier.node.sdd"
    );
    expectScope(segments, code, "END", "keyword.control.end.sdd");
    expectScope(
      segments,
      code,
      "# nested done",
      "comment.line.number-sign.sdd"
    );
  });

  it("leaves unknown and malformed statement shapes unclaimed", () => {
    const code = `Unknown X-001 "Bad"
END trailing
owner value`;
    const result = highlighter.codeToTokens(code, {
      lang: "sdd",
      theme: "github-dark",
      includeExplanation: true
    });
    const scopes = flattenScopes(result).flatMap((segment) => segment.scopes);

    expect(scopes).not.toContain("storage.type.node.sdd.product-intent");
    expect(scopes).not.toContain("keyword.control.end.sdd");
    expect(scopes).not.toContain("variable.other.property.sdd");
  });

  it("handles CRLF without leaking scopes across lines", () => {
    const code = 'Place P-001 "One"\r\nEND\r\nPlace P-002 "Two"\r\nEND';
    const result = highlighter.codeToTokens(code, {
      lang: "sdd",
      theme: "github-dark",
      includeExplanation: true
    });

    expect(result.tokens).toHaveLength(4);
    const segments = flattenScopes(result);
    expectScope(
      segments,
      code,
      "Place",
      "storage.type.node.sdd.structure",
      1
    );
    expectScope(segments, code, "P-002", "constant.other.identifier.node.sdd");
  });

  it("ends malformed strings and annotations at the line boundary", () => {
    const code = `Place P-001 "Unclosed
END
NAVIGATES_TO P-002 [E-001
END
Place P-003 "Recovered"
END`;
    const result = highlighter.codeToTokens(code, {
      lang: "sdd",
      theme: "github-dark",
      includeExplanation: true
    });
    const segments = flattenScopes(result);

    expectScope(segments, code, "END", "keyword.control.end.sdd", 0);
    expectScope(segments, code, "END", "keyword.control.end.sdd", 1);
    expectScope(
      segments,
      code,
      "Place",
      "storage.type.node.sdd.structure",
      1
    );
    expect(scopesFor(segments, code, "END", 0)).not.toContain(
      "string.quoted.double.sdd"
    );
    expect(scopesFor(segments, code, "END", 1)).not.toContain(
      "meta.annotation.event.sdd"
    );
  });

  it("tokenizes every bundled example without foreign grammar scopes", async () => {
    for (const example of bundle.manifest.examples) {
      const source = await readFile(path.join(bundle.rootDir, example.path), "utf8");
      const result = highlighter.codeToTokens(source, {
        lang: "sdd",
        theme: "github-dark",
        includeExplanation: true
      });
      const scopes = flattenScopes(result).flatMap((segment) => segment.scopes);

      expect(scopes.some((scope) => scope === "source.sdd")).toBe(true);
      expect(scopes.some((scope) => scope.includes(".shell"))).toBe(false);
      expect(
        scopes.every((scope) => scope === "source.sdd" || scope.includes(".sdd"))
      ).toBe(true);
      expect(scopes.some((scope) => scope.startsWith("storage.type.node.sdd."))).toBe(
        true
      );
      expect(scopes.some((scope) => scope === "keyword.control.end.sdd")).toBe(true);
    }
  });
});

describe("VS Code extension manifest", () => {
  it("registers .sdd, source.sdd, and generated asset paths", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(extensionRoot, "package.json"), "utf8")
    ) as {
      name: string;
      publisher: string;
      version: string;
      contributes: {
        languages: Array<Record<string, unknown>>;
        grammars: Array<Record<string, unknown>>;
      };
    };

    expect(`${manifest.publisher}.${manifest.name}`).toBe("knutopia.sdd-language");
    expect(manifest.version).toBe("0.1.0");
    expect(manifest.contributes.languages).toContainEqual(
      expect.objectContaining({
        id: "sdd",
        extensions: [".sdd"],
        configuration: "./language-configuration.json"
      })
    );
    expect(manifest.contributes.grammars).toContainEqual({
      language: "sdd",
      scopeName: "source.sdd",
      path: "./syntaxes/sdd.tmLanguage.json"
    });
  });
});
