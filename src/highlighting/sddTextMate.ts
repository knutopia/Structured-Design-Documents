import type {
  Bundle,
  SyntaxCaptureEnclosureSequenceItem,
  SyntaxCapturePatternSequenceItem,
  SyntaxCaptureTokenSourceSequenceItem,
  SyntaxLineClassifierClause,
  SyntaxSequenceItem,
  SyntaxStatementDefinition
} from "../bundle/types.js";
import {
  createParserSyntaxRuntime,
  getBlock,
  getStatement,
  getTokenSource,
  type ParserSyntaxRuntime
} from "../parser/syntaxRuntime.js";

interface TextMateCapture {
  name?: string;
}

interface TextMateRule {
  name?: string;
  include?: string;
  match?: string;
  begin?: string;
  end?: string;
  captures?: Record<string, TextMateCapture>;
  beginCaptures?: Record<string, TextMateCapture>;
  endCaptures?: Record<string, TextMateCapture>;
  patterns?: TextMateRule[];
}

export interface TextMateGrammar {
  name: string;
  scopeName: string;
  fileTypes: string[];
  patterns: TextMateRule[];
  repository: Record<string, TextMateRule>;
}

interface LanguageConfigurationPair {
  open: string;
  close: string;
  notIn?: string[];
}

export interface SddLanguageConfiguration {
  comments: {
    lineComment: string;
  };
  brackets: Array<[string, string]>;
  autoClosingPairs: LanguageConfigurationPair[];
  surroundingPairs: LanguageConfigurationPair[];
  wordPattern: string;
  indentationRules: {
    increaseIndentPattern: string;
    decreaseIndentPattern: string;
  };
  folding: {
    markers: {
      start: string;
      end: string;
    };
  };
}

export interface SddTextMateAssets {
  grammar: TextMateGrammar;
  languageConfiguration: SddLanguageConfiguration;
}

interface DerivedSyntax {
  runtime: ParserSyntaxRuntime;
  topHeaderStatementName: string;
  nestedHeaderStatementName: string;
  edgeStatementName: string;
  propertyStatementName: string;
  terminatorStatementName: string;
  commentStatementName: string;
  nodeTokenSourceName: string;
  relationshipTokenSourceName: string;
  nodeIdPattern: string;
  identifierPattern: string;
  bareValuePattern: string;
  bareValueCharacterClass: string;
  versionPattern: string;
  versionLiteral: string;
  nestedMarker: string;
  terminatorLiteral: string;
  assignmentLiteral: string;
  effectMarker: string;
  eventOpen: string;
  eventClose: string;
  guardOpen: string;
  guardClose: string;
  quote: string;
  standardizedEscapes: string[];
  commentPrefix: string;
}

function textMateError(message: string): Error {
  return new Error(`Cannot generate SDD TextMate assets: ${message}`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAnchors(pattern: string, label: string): string {
  if (!pattern.startsWith("^") || !pattern.endsWith("$")) {
    throw textMateError(`${label} must be fully anchored`);
  }
  return pattern.slice(1, -1);
}

function repeatedCharacterClass(pattern: string, label: string): string {
  const unanchored = stripAnchors(pattern, label);
  const match = /^(\[(?:\\.|[^\]])+\])\+$/.exec(unanchored);
  if (!match) {
    throw textMateError(
      `${label} must be a one-or-more repetition of one character class`
    );
  }
  return match[1];
}

function scopeSegment(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw textMateError("every vocabulary entry must declare a non-empty group");
  }
  return value.toLowerCase().replace(/_/g, "-").replace(/[^a-z0-9-]/g, "-");
}

function one<T>(values: T[], label: string): T {
  if (values.length !== 1) {
    throw textMateError(`expected exactly one ${label}, found ${values.length}`);
  }
  return values[0];
}

function walkClassifier(
  classifier: SyntaxLineClassifierClause,
  predicate: (clause: SyntaxLineClassifierClause) => boolean
): boolean {
  if (predicate(classifier)) {
    return true;
  }
  return "any_of" in classifier && classifier.any_of.some((clause) => walkClassifier(clause, predicate));
}

function captureByName<T extends SyntaxSequenceItem>(
  statement: SyntaxStatementDefinition,
  captureName: string,
  predicate: (item: SyntaxSequenceItem) => item is T
): T {
  const sequence = statement.sequence ?? [];
  return one(
    sequence.filter(
      (item): item is T => predicate(item) && "capture" in item && item.capture === captureName
    ),
    `capture '${captureName}'`
  );
}

function tokenCapture(
  statement: SyntaxStatementDefinition,
  captureName: string
): SyntaxCaptureTokenSourceSequenceItem {
  return captureByName(
    statement,
    captureName,
    (item): item is SyntaxCaptureTokenSourceSequenceItem => "token_source" in item
  );
}

function patternCapture(
  statement: SyntaxStatementDefinition,
  captureName: string
): SyntaxCapturePatternSequenceItem {
  return captureByName(
    statement,
    captureName,
    (item): item is SyntaxCapturePatternSequenceItem => "pattern_ref" in item
  );
}

function enclosureCapture(
  statement: SyntaxStatementDefinition,
  captureName: string
): SyntaxCaptureEnclosureSequenceItem {
  const optionalItems = (statement.sequence ?? []).flatMap((item) =>
    "optional" in item ? item.optional : []
  );
  return one(
    optionalItems.filter(
      (item): item is SyntaxCaptureEnclosureSequenceItem =>
        "enclosure" in item && item.capture === captureName
    ),
    `enclosure capture '${captureName}'`
  );
}

function literalBeforeCapture(statement: SyntaxStatementDefinition, captureName: string): string {
  const optionalSequences = (statement.sequence ?? [])
    .filter((item): item is Extract<SyntaxSequenceItem, { optional: SyntaxSequenceItem[] }> => "optional" in item)
    .map((item) => item.optional);
  const matchingSequence = one(
    optionalSequences.filter((sequence) =>
      sequence.some((item) => "capture" in item && item.capture === captureName)
    ),
    `optional sequence containing capture '${captureName}'`
  );
  const captureIndex = matchingSequence.findIndex(
    (item) => "capture" in item && item.capture === captureName
  );
  const literal = [...matchingSequence.slice(0, captureIndex)]
    .reverse()
    .find((item): item is Extract<SyntaxSequenceItem, { literal: string }> => "literal" in item);
  if (!literal) {
    throw textMateError(`capture '${captureName}' must be preceded by a literal`);
  }
  return literal.literal;
}

function literalFromStatement(statement: SyntaxStatementDefinition, label: string): string {
  const literals = (statement.sequence ?? []).filter(
    (item): item is Extract<SyntaxSequenceItem, { literal: string }> => "literal" in item
  );
  return one(literals, `${label} literal`).literal;
}

function deriveSyntax(bundle: Bundle): DerivedSyntax {
  const runtime = createParserSyntaxRuntime(bundle);
  const topBlock = getBlock(runtime, runtime.syntax.document.top_level_block_kind);
  const nestedBlocks = Object.entries(runtime.syntax.blocks)
    .filter(([name]) => name !== runtime.syntax.document.top_level_block_kind)
    .filter(([, block]) => block.emits.kind === topBlock.emits.kind);
  const [, nestedBlock] = one(nestedBlocks, "nested node block");
  const nestedHeaderStatementName = nestedBlock.header_statement;

  const topHeaderStatementName = topBlock.header_statement;
  const terminatorStatementName = topBlock.terminator_statement;
  const topHeader = getStatement(runtime, topHeaderStatementName);
  const nestedHeader = getStatement(runtime, nestedHeaderStatementName);
  const terminator = getStatement(runtime, terminatorStatementName);

  const edgeStatementName = one(
    topBlock.body_item_kinds.filter(
      (name) => runtime.statementsByName.has(name) && getStatement(runtime, name).fixed_order
    ),
    "edge statement"
  );
  const edgeStatement = getStatement(runtime, edgeStatementName);

  const propertyLineKind = one(
    runtime.lineKindsInPrecedenceOrder.filter((lineKind) =>
      walkClassifier(
        lineKind.classifier,
        (clause) => "leading_identifier_before_equals" in clause && clause.leading_identifier_before_equals
      )
    ),
    "property line classifier"
  );
  if (!propertyLineKind.statement) {
    throw textMateError("property line classifier must reference one statement");
  }
  const propertyStatementName = propertyLineKind.statement;
  const propertyStatement = getStatement(runtime, propertyStatementName);

  const commentLineKind = one(
    runtime.lineKindsInPrecedenceOrder.filter((lineKind) =>
      walkClassifier(
        lineKind.classifier,
        (clause) =>
          "first_non_whitespace" in clause &&
          clause.first_non_whitespace === runtime.syntax.lexical.comment_prefix
      )
    ),
    "comment line classifier"
  );
  const commentStatementName = one(
    commentLineKind.statements?.filter((name) => {
      const match = getStatement(runtime, name).match;
      return Boolean(
        match &&
          walkClassifier(
            match,
            (clause) =>
              "first_non_whitespace" in clause &&
              clause.first_non_whitespace === runtime.syntax.lexical.comment_prefix
          )
      );
    }) ?? [],
    "comment statement"
  );

  const nodeTypeCapture = tokenCapture(topHeader, "node_type");
  const nestedNodeTypeCapture = tokenCapture(nestedHeader, "node_type");
  if (nodeTypeCapture.token_source !== nestedNodeTypeCapture.token_source) {
    throw textMateError("top and nested headers must use the same node token source");
  }
  const nodeIdCapture = patternCapture(topHeader, "id");
  const nestedNodeIdCapture = patternCapture(nestedHeader, "id");
  const edgeTargetCapture = patternCapture(edgeStatement, "to");
  if (
    nodeIdCapture.pattern_ref !== nestedNodeIdCapture.pattern_ref ||
    nodeIdCapture.pattern_ref !== edgeTargetCapture.pattern_ref
  ) {
    throw textMateError("headers and edge targets must use the same ID pattern");
  }

  const relationshipCapture = tokenCapture(edgeStatement, "rel_type");
  const eventCapture = enclosureCapture(edgeStatement, "event");
  const guardCapture = enclosureCapture(edgeStatement, "guard");
  const propertyKeyCapture = patternCapture(propertyStatement, "key");
  const propertyLiteral = literalFromStatement(propertyStatement, "property assignment");
  const nestedMarker = literalFromStatement(nestedHeader, "nested marker");
  const versionStatementName = runtime.syntax.document.version_declaration.statement_kind;
  const versionStatement = getStatement(runtime, versionStatementName);
  const versionLiteral = literalFromStatement(versionStatement, "version declaration");
  if (versionLiteral !== runtime.syntax.document.version_declaration.literal) {
    throw textMateError("version declaration literals disagree");
  }

  const quote = runtime.syntax.lexical.quoted_string.delimiter;
  if (quote.length !== 1 || runtime.syntax.lexical.quoted_string.multiline) {
    throw textMateError("v0.1 highlighting requires one-character, single-line quoted strings");
  }
  const standardizedEscapes =
    runtime.syntax.lexical.quoted_string.standardized_escapes.map(({ literal }) => literal);
  if (
    standardizedEscapes.length === 0 ||
    standardizedEscapes.some((literal) => literal.length === 0)
  ) {
    throw textMateError("quoted strings must declare non-empty standardized escapes");
  }
  if (runtime.syntax.lexical.quoted_string.other_backslash_sequences !== "literal") {
    throw textMateError(
      "v0.1 highlighting only supports literal unknown backslash sequences"
    );
  }

  return {
    runtime,
    topHeaderStatementName,
    nestedHeaderStatementName,
    edgeStatementName,
    propertyStatementName,
    terminatorStatementName,
    commentStatementName,
    nodeTokenSourceName: nodeTypeCapture.token_source,
    relationshipTokenSourceName: relationshipCapture.token_source,
    nodeIdPattern: stripAnchors(runtime.syntax.lexical.id_pattern, "ID pattern"),
    identifierPattern: stripAnchors(
      runtime.syntax.lexical.identifier_pattern,
      propertyKeyCapture.pattern_ref
    ),
    bareValuePattern: stripAnchors(runtime.syntax.lexical.bare_value_pattern, "bare value pattern"),
    bareValueCharacterClass: repeatedCharacterClass(
      runtime.syntax.lexical.bare_value_pattern,
      "bare value pattern"
    ),
    versionPattern: stripAnchors(runtime.syntax.lexical.version_number_pattern, "version number pattern"),
    versionLiteral,
    nestedMarker,
    terminatorLiteral: literalFromStatement(terminator, "block terminator"),
    assignmentLiteral: propertyLiteral,
    effectMarker: literalBeforeCapture(edgeStatement, "effect"),
    eventOpen: eventCapture.enclosure.open,
    eventClose: eventCapture.enclosure.close,
    guardOpen: guardCapture.enclosure.open,
    guardClose: guardCapture.enclosure.close,
    quote,
    standardizedEscapes,
    commentPrefix: runtime.syntax.lexical.comment_prefix
  };
}

function tokensByGroup(runtime: ParserSyntaxRuntime, tokenSourceName: string): Map<string, string[]> {
  const source = getTokenSource(runtime, tokenSourceName);
  const groups = new Map<string, string[]>();
  for (const entry of source.entries) {
    const token = entry[source.config.token_field];
    if (typeof token !== "string") {
      throw textMateError(`token source '${tokenSourceName}' has a non-string token`);
    }
    const group = scopeSegment(entry.group);
    groups.set(group, [...(groups.get(group) ?? []), token]);
  }
  return groups;
}

function alternation(values: string[]): string {
  return [...values]
    .sort((left, right) => right.length - left.length || left.localeCompare(right))
    .map(escapeRegex)
    .join("|");
}

function capture(name: string): TextMateCapture {
  return { name };
}

function createGrammar(derived: DerivedSyntax): TextMateGrammar {
  const {
    runtime,
    versionLiteral,
    versionPattern,
    commentPrefix,
    quote,
    standardizedEscapes,
    nodeIdPattern,
    identifierPattern,
    bareValuePattern,
    bareValueCharacterClass,
    nestedMarker,
    terminatorLiteral,
    assignmentLiteral,
    effectMarker,
    eventOpen,
    eventClose,
    guardOpen,
    guardClose
  } = derived;
  const escapedComment = escapeRegex(commentPrefix);
  const escapedQuote = escapeRegex(quote);
  const escapedAssignment = escapeRegex(assignmentLiteral);
  const idBoundary = `(?<!${bareValueCharacterClass})(?:${nodeIdPattern})(?!${bareValueCharacterClass})`;
  const identifierBoundary = `(?<!${bareValueCharacterClass})(?:${identifierPattern})(?!${bareValueCharacterClass})`;
  const bareBoundary = `(?<!${bareValueCharacterClass})(?:${bareValuePattern})(?!${bareValueCharacterClass})`;
  const nextPropertyOrComment = `(?=\\s+(?:${identifierPattern})\\s*${escapedAssignment}|\\s+${escapedComment}|$)`;
  const trailingCommentsAllowed = new Set(runtime.syntax.lexical.trailing_comments_allowed);
  const withTrailingComment = (
    statementName: string,
    patterns: TextMateRule[]
  ): TextMateRule[] =>
    trailingCommentsAllowed.has(statementName)
      ? [...patterns, { include: "#line-comment" }]
      : patterns;

  const stringRule: TextMateRule = {
    name: "string.quoted.double.sdd",
    begin: escapedQuote,
    beginCaptures: { "0": capture("punctuation.definition.string.begin.sdd") },
    end: `(?:${escapedQuote}|$)`,
    endCaptures: { "0": capture("punctuation.definition.string.end.sdd") },
    patterns: [
      {
        name: "constant.character.escape.sdd",
        match: `(?:${alternation(standardizedEscapes)})`
      }
    ]
  };
  const lineCommentRule: TextMateRule = {
    name: "comment.line.number-sign.sdd",
    match: `(${escapedComment}).*$`,
    captures: {
      "1": capture("punctuation.definition.comment.sdd")
    }
  };
  const bareValueRule: TextMateRule = {
    name: "string.unquoted.bare.sdd",
    match: bareBoundary
  };

  const nodeGroups = tokensByGroup(runtime, derived.nodeTokenSourceName);
  const relationshipGroups = tokensByGroup(runtime, derived.relationshipTokenSourceName);

  const topHeaderRules = [...nodeGroups.entries()].map(([group, tokens]): TextMateRule => ({
    name: "meta.block.header.node.sdd",
    begin: `^(\\s*)(${alternation(tokens)})(\\s+)(${nodeIdPattern})(?=\\s+${escapedQuote})`,
    beginCaptures: {
      "2": capture(`storage.type.node.sdd.${group}`),
      "4": capture("constant.other.identifier.node.sdd")
    },
    end: "$",
    patterns: withTrailingComment(derived.topHeaderStatementName, [
      { include: "#quoted-string" }
    ])
  }));

  const nestedHeaderRules = [...nodeGroups.entries()].map(([group, tokens]): TextMateRule => ({
    name: "meta.block.header.node.nested.sdd",
    begin: `^(\\s*)(${escapeRegex(nestedMarker)})(\\s+)(${alternation(tokens)})(\\s+)(${nodeIdPattern})(?=\\s+${escapedQuote})`,
    beginCaptures: {
      "2": capture("punctuation.definition.block.nested.sdd"),
      "4": capture(`storage.type.node.sdd.${group}`),
      "6": capture("constant.other.identifier.node.sdd")
    },
    end: "$",
    patterns: withTrailingComment(derived.nestedHeaderStatementName, [
      { include: "#quoted-string" }
    ])
  }));

  const edgeRules = [...relationshipGroups.entries()].map(([group, tokens]): TextMateRule => ({
    name: "meta.relationship.sdd",
    begin: `^(\\s*)(${alternation(tokens)})(\\s+)(${nodeIdPattern})(?=\\s|$)`,
    beginCaptures: {
      "2": capture(`keyword.control.relationship.sdd.${group}`),
      "4": capture("constant.other.identifier.target.sdd")
    },
    end: "$",
    patterns: withTrailingComment(derived.edgeStatementName, [
      { include: "#quoted-string" },
      { include: "#event-annotation" },
      { include: "#guard-annotation" },
      { include: "#effect-annotation" },
      { include: "#edge-property" }
    ])
  }));

  const statementIncludes = new Map<string, string>([
    [derived.terminatorStatementName, "#block-terminator"],
    [derived.nestedHeaderStatementName, "#nested-node-header"],
    [derived.topHeaderStatementName, "#top-node-header"],
    [derived.edgeStatementName, "#edge-line"],
    [derived.propertyStatementName, "#property-line"],
    [derived.commentStatementName, "#comment-line"]
  ]);
  const topPatterns: TextMateRule[] = [{ include: "#version-declaration" }];
  for (const lineKind of runtime.lineKindsInPrecedenceOrder) {
    const statementNames = lineKind.statement ? [lineKind.statement] : lineKind.statements ?? [];
    for (const statementName of statementNames) {
      const include = statementIncludes.get(statementName);
      if (include && !topPatterns.some((rule) => rule.include === include)) {
        topPatterns.push({ include });
      }
    }
  }

  return {
    name: "sdd",
    scopeName: "source.sdd",
    fileTypes: ["sdd"],
    patterns: topPatterns,
    repository: {
      "version-declaration": {
        name: "meta.version.sdd",
        match: `^(\\s*)(${escapeRegex(versionLiteral)})(\\s+)(${versionPattern})\\s*$`,
        captures: {
          "2": capture("keyword.other.version.sdd"),
          "4": capture("constant.numeric.version.sdd")
        }
      },
      "comment-line": {
        name: "comment.line.number-sign.sdd",
        match: `^\\s*(${escapedComment}).*$`,
        captures: {
          "1": capture("punctuation.definition.comment.sdd")
        }
      },
      "line-comment": lineCommentRule,
      "quoted-string": stringRule,
      "bare-value": bareValueRule,
      "block-terminator": {
        name: "meta.block.terminator.sdd",
        begin: `^(\\s*)(${escapeRegex(terminatorLiteral)})(?=\\s*(?:${escapedComment}|$))`,
        beginCaptures: {
          "2": capture("keyword.control.end.sdd")
        },
        end: "$",
        patterns: withTrailingComment(derived.terminatorStatementName, [])
      },
      "top-node-header": {
        patterns: topHeaderRules
      },
      "nested-node-header": {
        patterns: nestedHeaderRules
      },
      "property-line": {
        name: "meta.property.sdd",
        begin: `^(\\s*)(${identifierPattern})(\\s*)(${escapedAssignment})(\\s*)`,
        beginCaptures: {
          "2": capture("variable.other.property.sdd"),
          "4": capture("keyword.operator.assignment.sdd")
        },
        end: "$",
        patterns: withTrailingComment(derived.propertyStatementName, [
          { include: "#quoted-string" },
          { include: "#bare-value" }
        ])
      },
      "edge-line": {
        patterns: edgeRules
      },
      "event-annotation": {
        name: "meta.annotation.event.sdd",
        begin: escapeRegex(eventOpen),
        beginCaptures: {
          "0": capture("punctuation.section.brackets.begin.event.sdd")
        },
        end: `(?:${escapeRegex(eventClose)}|$)`,
        endCaptures: {
          "0": capture("punctuation.section.brackets.end.event.sdd")
        },
        patterns: [
          { include: "#quoted-string" },
          {
            name: "constant.other.identifier.event.sdd",
            match: idBoundary
          },
          {
            name: "variable.other.event.sdd",
            match: identifierBoundary
          }
        ]
      },
      "guard-annotation": {
        name: "meta.annotation.guard.sdd",
        begin: escapeRegex(guardOpen),
        beginCaptures: {
          "0": capture("punctuation.section.braces.begin.guard.sdd")
        },
        end: `(?:${escapeRegex(guardClose)}|$)`,
        endCaptures: {
          "0": capture("punctuation.section.braces.end.guard.sdd")
        },
        patterns: [
          {
            name: "string.unquoted.guard.sdd",
            match: `[^${escapeRegex(guardClose)}\\r\\n]+`
          }
        ]
      },
      "effect-annotation": {
        name: "meta.annotation.effect.sdd",
        begin: `(${escapeRegex(effectMarker)})(?=\\s*)`,
        beginCaptures: {
          "1": capture("keyword.operator.effect.sdd")
        },
        end: nextPropertyOrComment,
        patterns: [
          { include: "#quoted-string" },
          {
            name: "constant.other.identifier.effect.sdd",
            match: idBoundary
          },
          {
            name: "entity.name.function.effect.sdd",
            match: identifierBoundary
          }
        ]
      },
      "edge-property": {
        name: "meta.property.edge.sdd",
        begin: `(\\s+)(${identifierPattern})(\\s*)(${escapedAssignment})(\\s*)`,
        beginCaptures: {
          "2": capture("variable.other.property.edge.sdd"),
          "4": capture("keyword.operator.assignment.sdd")
        },
        end: nextPropertyOrComment,
        patterns: [{ include: "#quoted-string" }, { include: "#bare-value" }]
      }
    }
  };
}

function createLanguageConfiguration(derived: DerivedSyntax): SddLanguageConfiguration {
  const nodeTokens = getTokenSource(derived.runtime, derived.nodeTokenSourceName).tokens;
  const nodeAlternation = alternation(nodeTokens);
  const nested = escapeRegex(derived.nestedMarker);
  const quote = escapeRegex(derived.quote);
  const id = derived.nodeIdPattern;
  const headerStart = `^\\s*(?:${nested}\\s+)?(?:${nodeAlternation})\\s+(?:${id})\\s+${quote}`;
  const end = `^\\s*${escapeRegex(derived.terminatorLiteral)}(?:\\s+${escapeRegex(derived.commentPrefix)}.*)?\\s*$`;
  const pairs = [
    { open: derived.eventOpen, close: derived.eventClose },
    { open: derived.guardOpen, close: derived.guardClose }
  ];

  return {
    comments: {
      lineComment: derived.commentPrefix
    },
    brackets: pairs.map(({ open, close }) => [open, close]),
    autoClosingPairs: [
      ...pairs.map((pair) => ({ ...pair, notIn: ["string", "comment"] })),
      {
        open: derived.quote,
        close: derived.quote,
        notIn: ["string", "comment"]
      }
    ],
    surroundingPairs: [...pairs, { open: derived.quote, close: derived.quote }],
    wordPattern: `(?:${derived.nodeIdPattern}|${derived.identifierPattern})`,
    indentationRules: {
      increaseIndentPattern: headerStart,
      decreaseIndentPattern: end
    },
    folding: {
      markers: {
        start: headerStart,
        end
      }
    }
  };
}

export function createSddTextMateAssets(bundle: Bundle): SddTextMateAssets {
  const derived = deriveSyntax(bundle);
  return {
    grammar: createGrammar(derived),
    languageConfiguration: createLanguageConfiguration(derived)
  };
}

export function serializeTextMateAsset(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
