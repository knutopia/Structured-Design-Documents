import type {
  Bundle,
  SyntaxAtomDefinition,
  SyntaxBlockDefinition,
  SyntaxChoiceAlternative,
  SyntaxConfig,
  SyntaxLineClassifierClause,
  SyntaxLineKindDefinition,
  SyntaxSequenceItem,
  SyntaxStatementDefinition,
  SyntaxTokenSource,
  VocabularyToken
} from "../bundle/types.js";

export interface ResolvedTokenSource {
  name: string;
  config: SyntaxTokenSource;
  entries: Array<Record<string, unknown>>;
  tokens: string[];
  tokenSet: Set<string>;
}

export interface ParserSyntaxRuntime {
  syntax: SyntaxConfig;
  tokenSources: Record<string, ResolvedTokenSource>;
  tokenSourcesByName: Map<string, ResolvedTokenSource>;
  patternsByRef: Map<string, RegExp>;
  lineKindsInPrecedenceOrder: SyntaxLineKindDefinition[];
  lineKindsByKind: Map<string, SyntaxLineKindDefinition>;
  statementsByName: Map<string, SyntaxStatementDefinition>;
  blocksByName: Map<string, SyntaxBlockDefinition>;
  atomsByName: Map<string, SyntaxAtomDefinition>;
  trailingCommentAllowedStatements: Set<string>;
  documentLeadingLineKinds: Set<string>;
  documentTrailingLineKinds: Set<string>;
}

function syntaxError(message: string): Error {
  return new Error(`Invalid parser syntax contract: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveTokenSource(bundle: Bundle, name: string, config: SyntaxTokenSource): ResolvedTokenSource {
  const vocabValue = (bundle.vocab as unknown as Record<string, unknown>)[config.key];
  if (!Array.isArray(vocabValue)) {
    throw syntaxError(`unknown token source '${name}' referenced vocab key '${config.key}'`);
  }

  const entries = vocabValue.map((entry, index) => {
    if (!isRecord(entry)) {
      throw syntaxError(`unknown token source '${name}' has non-object entry at index ${index}`);
    }

    const tokenValue = entry[config.token_field];
    if (typeof tokenValue !== "string") {
      throw syntaxError(
        `unknown token source '${name}' uses missing token field '${config.token_field}' on vocab key '${config.key}'`
      );
    }

    return entry;
  });

  const tokens = entries
    .map((entry) => entry[config.token_field])
    .filter((value): value is string => typeof value === "string");

  return {
    name,
    config,
    entries,
    tokens,
    tokenSet: new Set(tokens)
  };
}

function buildPatterns(syntax: SyntaxConfig): Map<string, RegExp> {
  return new Map([
    ["lexical.identifier_pattern", new RegExp(syntax.lexical.identifier_pattern)],
    ["lexical.id_pattern", new RegExp(syntax.lexical.id_pattern)],
    ["lexical.version_number_pattern", new RegExp(syntax.lexical.version_number_pattern)],
    ["lexical.bare_value_pattern", new RegExp(syntax.lexical.bare_value_pattern)]
  ]);
}

function validatePatternRef(runtime: ParserSyntaxRuntime, patternRef: string, context: string): void {
  if (!runtime.patternsByRef.has(patternRef)) {
    throw syntaxError(`unknown pattern ref '${patternRef}' referenced by ${context}`);
  }
}

function validateTokenSourceRef(runtime: ParserSyntaxRuntime, tokenSourceName: string, context: string): void {
  if (!runtime.tokenSourcesByName.has(tokenSourceName)) {
    throw syntaxError(`unknown token source '${tokenSourceName}' referenced by ${context}`);
  }
}

function validateAtomRef(runtime: ParserSyntaxRuntime, atomName: string, context: string): void {
  if (atomName !== "quoted_string" && !runtime.atomsByName.has(atomName)) {
    throw syntaxError(`unknown atom '${atomName}' referenced by ${context}`);
  }
}

function validateStatementRef(runtime: ParserSyntaxRuntime, statementName: string, context: string): void {
  if (!runtime.statementsByName.has(statementName)) {
    throw syntaxError(`unknown statement '${statementName}' referenced by ${context}`);
  }
}

function validateBlockRef(runtime: ParserSyntaxRuntime, blockName: string, context: string): void {
  if (!runtime.blocksByName.has(blockName)) {
    throw syntaxError(`unknown block '${blockName}' referenced by ${context}`);
  }
}

function validateChoiceAlternative(runtime: ParserSyntaxRuntime, alternative: SyntaxChoiceAlternative, context: string): void {
  const hasAtom = typeof alternative.atom === "string";
  const hasPatternRef = typeof alternative.pattern_ref === "string";

  if (hasAtom === hasPatternRef) {
    throw syntaxError(`invalid choice alternative in ${context}`);
  }

  if (alternative.atom) {
    validateAtomRef(runtime, alternative.atom, context);
  }

  if (alternative.pattern_ref) {
    validatePatternRef(runtime, alternative.pattern_ref, context);
  }
}

function validateSequence(runtime: ParserSyntaxRuntime, sequence: SyntaxSequenceItem[], context: string): void {
  sequence.forEach((item, index) => {
    const itemContext = `${context}[${index}]`;

    if ("literal" in item || "whitespace" in item) {
      return;
    }

    if ("optional" in item) {
      validateSequence(runtime, item.optional, `${itemContext}.optional`);
      return;
    }

    if ("repeat" in item) {
      validateAtomRef(runtime, item.repeat.atom, `${itemContext}.repeat.atom`);
      return;
    }

    if ("pattern_ref" in item) {
      validatePatternRef(runtime, item.pattern_ref, `${itemContext}.pattern_ref`);
      return;
    }

    if ("token_source" in item) {
      validateTokenSourceRef(runtime, item.token_source, `${itemContext}.token_source`);
      return;
    }

    if ("atom" in item) {
      validateAtomRef(runtime, item.atom, `${itemContext}.atom`);
      return;
    }

    if ("one_of" in item) {
      item.one_of.forEach((alternative, alternativeIndex) =>
        validateChoiceAlternative(runtime, alternative, `${itemContext}.one_of[${alternativeIndex}]`)
      );
      return;
    }

    if ("enclosure" in item) {
      validateAtomRef(runtime, item.enclosure.inner_atom, `${itemContext}.enclosure.inner_atom`);
    }
  });
}

function validateClassifier(runtime: ParserSyntaxRuntime, classifier: SyntaxLineClassifierClause, context: string): void {
  if ("first_token_source" in classifier) {
    validateTokenSourceRef(runtime, classifier.first_token_source, `${context}.first_token_source`);
    return;
  }

  if ("next_token_source" in classifier) {
    validateTokenSourceRef(runtime, classifier.next_token_source, `${context}.next_token_source`);
    return;
  }

  if ("any_of" in classifier) {
    classifier.any_of.forEach((clause, index) => validateClassifier(runtime, clause, `${context}.any_of[${index}]`));
  }
}

function validateLineKinds(runtime: ParserSyntaxRuntime): void {
  runtime.lineKindsInPrecedenceOrder.forEach((lineKind, index) => {
    const hasStatement = typeof lineKind.statement === "string";
    const hasStatements = Array.isArray(lineKind.statements);
    const context = `line_kinds[${index}] '${lineKind.kind}'`;

    if (hasStatement === hasStatements) {
      throw syntaxError(`invalid line kind declaration for ${context}`);
    }

    validateClassifier(runtime, lineKind.classifier, `${context}.classifier`);

    if (lineKind.statement) {
      validateStatementRef(runtime, lineKind.statement, `${context}.statement`);
    }

    if (lineKind.statements) {
      lineKind.statements.forEach((statementName, statementIndex) =>
        validateStatementRef(runtime, statementName, `${context}.statements[${statementIndex}]`)
      );
    }
  });
}

function validateStatements(runtime: ParserSyntaxRuntime): void {
  for (const [statementName, statement] of runtime.statementsByName) {
    const context = `statements.${statementName}`;

    if (statement.match) {
      validateClassifier(runtime, statement.match, `${context}.match`);
    }

    if (statement.sequence) {
      validateSequence(runtime, statement.sequence, `${context}.sequence`);
    }
  }
}

function validateBlocks(runtime: ParserSyntaxRuntime): void {
  for (const [blockName, block] of runtime.blocksByName) {
    const context = `blocks.${blockName}`;

    validateStatementRef(runtime, block.header_statement, `${context}.header_statement`);
    validateStatementRef(runtime, block.terminator_statement, `${context}.terminator_statement`);

    block.body_item_kinds.forEach((itemKind, index) => {
      if (runtime.statementsByName.has(itemKind) || runtime.blocksByName.has(itemKind)) {
        return;
      }
      throw syntaxError(`unknown block or statement '${itemKind}' referenced by ${context}.body_item_kinds[${index}]`);
    });
  }
}

function validateAtoms(runtime: ParserSyntaxRuntime): void {
  for (const [atomName, atom] of runtime.atomsByName) {
    const context = `atoms.${atomName}`;

    if ("one_of" in atom) {
      atom.one_of.forEach((alternative, index) =>
        validateChoiceAlternative(runtime, alternative, `${context}.one_of[${index}]`)
      );
      continue;
    }

    if ("sequence" in atom) {
      validateSequence(runtime, atom.sequence, `${context}.sequence`);
    }
  }
}

function validateDocumentConfig(runtime: ParserSyntaxRuntime): void {
  const { document } = runtime.syntax;

  validateStatementRef(
    runtime,
    document.version_declaration.statement_kind,
    "document.version_declaration.statement_kind"
  );

  validateBlockRef(runtime, document.top_level_block_kind, "document.top_level_block_kind");

  document.leading_lines_allowed.forEach((statementName, index) => {
    if (!runtime.statementsByName.has(statementName)) {
      throw syntaxError(
        `unknown statement '${statementName}' referenced by document.leading_lines_allowed[${index}]`
      );
    }
  });

  document.trailing_lines_allowed.forEach((statementName, index) => {
    if (!runtime.statementsByName.has(statementName)) {
      throw syntaxError(
        `unknown statement '${statementName}' referenced by document.trailing_lines_allowed[${index}]`
      );
    }
  });
}

function buildDerivedSet(values: string[]): Set<string> {
  return new Set(values);
}

export function createParserSyntaxRuntime(bundle: Bundle): ParserSyntaxRuntime {
  const syntax = bundle.syntax;
  const tokenSourceEntries = Object.entries(syntax.token_sources).map(([name, config]) => [
    name,
    resolveTokenSource(bundle, name, config)
  ] as const);

  const tokenSourcesByName = new Map(tokenSourceEntries);
  const lineKindsInPrecedenceOrder = [...syntax.line_kinds].sort((left, right) => left.precedence - right.precedence);
  const runtime: ParserSyntaxRuntime = {
    syntax,
    tokenSources: Object.fromEntries(tokenSourceEntries),
    tokenSourcesByName,
    patternsByRef: buildPatterns(syntax),
    lineKindsInPrecedenceOrder,
    lineKindsByKind: new Map(lineKindsInPrecedenceOrder.map((lineKind) => [lineKind.kind, lineKind])),
    statementsByName: new Map(Object.entries(syntax.statements)),
    blocksByName: new Map(Object.entries(syntax.blocks)),
    atomsByName: new Map(Object.entries(syntax.atoms)),
    trailingCommentAllowedStatements: buildDerivedSet(syntax.lexical.trailing_comments_allowed),
    documentLeadingLineKinds: buildDerivedSet(syntax.document.leading_lines_allowed),
    documentTrailingLineKinds: buildDerivedSet(syntax.document.trailing_lines_allowed)
  };

  validateLineKinds(runtime);
  validateStatements(runtime);
  validateBlocks(runtime);
  validateAtoms(runtime);
  validateDocumentConfig(runtime);

  return runtime;
}

export function getTokenSource(runtime: ParserSyntaxRuntime, name: string): ResolvedTokenSource {
  const tokenSource = runtime.tokenSourcesByName.get(name);
  if (!tokenSource) {
    throw syntaxError(`unknown token source '${name}'`);
  }
  return tokenSource;
}

export function getPattern(runtime: ParserSyntaxRuntime, patternRef: string): RegExp {
  const pattern = runtime.patternsByRef.get(patternRef);
  if (!pattern) {
    throw syntaxError(`unknown pattern ref '${patternRef}'`);
  }
  return pattern;
}

export function getStatement(runtime: ParserSyntaxRuntime, statementName: string): SyntaxStatementDefinition {
  const statement = runtime.statementsByName.get(statementName);
  if (!statement) {
    throw syntaxError(`unknown statement '${statementName}'`);
  }
  return statement;
}

export function getBlock(runtime: ParserSyntaxRuntime, blockName: string): SyntaxBlockDefinition {
  const block = runtime.blocksByName.get(blockName);
  if (!block) {
    throw syntaxError(`unknown block '${blockName}'`);
  }
  return block;
}

export function getAtom(runtime: ParserSyntaxRuntime, atomName: string): SyntaxAtomDefinition {
  const atom = runtime.atomsByName.get(atomName);
  if (!atom) {
    throw syntaxError(`unknown atom '${atomName}'`);
  }
  return atom;
}
