import type {
  SyntaxAtomDefinition,
  SyntaxChoiceAlternative,
  SyntaxEmitFieldValue,
  SyntaxSequenceItem,
  SyntaxStatementDefinition,
  SyntaxWhitespaceSequenceItem
} from "../bundle/types.js";
import { stripTrailingComment } from "./classifyLine.js";
import { getAtom, getPattern, getStatement, getTokenSource, type ParserSyntaxRuntime } from "./syntaxRuntime.js";

export interface ParsedCaptureValue {
  value: unknown;
  raw_text?: string;
  value_kind?: string;
  fields?: Record<string, unknown>;
}

export type ParsedCaptureStore = Record<string, ParsedCaptureValue | ParsedCaptureValue[]>;

export interface InterpretedStatementSuccess {
  ok: true;
  statementName: string;
  normalizedText: string;
  captures: ParsedCaptureStore;
  emittedKind?: string;
  emittedFields: Record<string, unknown>;
}

export interface InterpretedStatementFailure {
  ok: false;
  statementName: string;
  error: string;
}

export type InterpretedStatementResult = InterpretedStatementSuccess | InterpretedStatementFailure;

interface ParseState {
  cursor: number;
  captures: ParsedCaptureStore;
  captureOrder: string[];
}

interface AtomParseCandidate {
  nextCursor: number;
  value: ParsedCaptureValue;
}

function cloneCaptureValue(value: ParsedCaptureValue): ParsedCaptureValue {
  return {
    ...value,
    fields: value.fields ? { ...value.fields } : undefined
  };
}

function cloneCaptureStore(store: ParsedCaptureStore): ParsedCaptureStore {
  return Object.fromEntries(
    Object.entries(store).map(([name, value]) => [
      name,
      Array.isArray(value) ? value.map((entry) => cloneCaptureValue(entry)) : cloneCaptureValue(value)
    ])
  );
}

function withCapture(
  state: ParseState,
  captureName: string,
  value: ParsedCaptureValue,
  alwaysArray = false
): ParseState {
  const captures = cloneCaptureStore(state.captures);
  const existing = captures[captureName];
  if (existing === undefined) {
    captures[captureName] = alwaysArray ? [value] : value;
  } else if (Array.isArray(existing)) {
    captures[captureName] = [...existing, value];
  } else {
    captures[captureName] = [existing, value];
  }

  return {
    cursor: state.cursor,
    captures,
    captureOrder: [...state.captureOrder, captureName]
  };
}

function primaryValue(value: ParsedCaptureValue | ParsedCaptureValue[] | undefined): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => primaryValue(entry));
  }

  return value.value;
}

export function getCapturePrimary(captures: ParsedCaptureStore, captureName: string): unknown {
  return primaryValue(captures[captureName]);
}

function captureReferenceContext(value: ParsedCaptureValue | ParsedCaptureValue[]): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => primaryValue(entry));
  }

  return {
    ...(value.fields ?? {}),
    raw_text: value.raw_text,
    value_kind: value.value_kind
  };
}

function resolveFieldReference(captures: ParsedCaptureStore, fieldValue: SyntaxEmitFieldValue): unknown {
  if (typeof fieldValue !== "string") {
    return fieldValue.const;
  }

  if (fieldValue in captures) {
    return primaryValue(captures[fieldValue]);
  }

  const [captureName, ...path] = fieldValue.split(".");
  const captureValue = captures[captureName];
  if (captureValue === undefined) {
    return undefined;
  }

  let current = captureReferenceContext(captureValue) as Record<string, unknown> | unknown;
  for (const segment of path) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function applyEmitDefinition(
  captures: ParsedCaptureStore,
  emits?: { kind: string; fields?: Record<string, SyntaxEmitFieldValue>; defaults?: Record<string, unknown> }
): { emittedKind?: string; emittedFields: Record<string, unknown> } {
  const emittedFields = { ...(emits?.defaults ?? {}) };

  if (emits?.fields) {
    for (const [fieldName, fieldValue] of Object.entries(emits.fields)) {
      const resolved = resolveFieldReference(captures, fieldValue);
      if (resolved !== undefined) {
        emittedFields[fieldName] = resolved;
      }
    }
  }

  return {
    emittedKind: emits?.kind,
    emittedFields
  };
}

function buildWhitespaceSet(runtime: ParserSyntaxRuntime): Set<string> {
  return new Set(runtime.syntax.lexical.whitespace_chars);
}

function isWhitespace(character: string | undefined, runtime: ParserSyntaxRuntime): boolean {
  return character !== undefined && buildWhitespaceSet(runtime).has(character);
}

function consumeWhitespace(
  text: string,
  cursor: number,
  runtime: ParserSyntaxRuntime,
  item: SyntaxWhitespaceSequenceItem
): number | undefined {
  let nextCursor = cursor;
  while (isWhitespace(text[nextCursor], runtime)) {
    nextCursor += 1;
  }

  if (item.whitespace === "required" && nextCursor === cursor) {
    return undefined;
  }

  return nextCursor;
}

function parseQuotedString(text: string, cursor: number, runtime: ParserSyntaxRuntime): AtomParseCandidate[] {
  const quoted = runtime.syntax.lexical.quoted_string;
  if (!text.startsWith(quoted.delimiter, cursor)) {
    return [];
  }

  const escapes = [...quoted.standardized_escapes].sort((left, right) => right.literal.length - left.literal.length);
  let nextCursor = cursor + quoted.delimiter.length;
  let value = "";

  while (nextCursor < text.length) {
    if (text.startsWith(quoted.delimiter, nextCursor)) {
      return [
        {
          nextCursor: nextCursor + quoted.delimiter.length,
          value: {
            value,
            raw_text: value,
            value_kind: "quoted_string"
          }
        }
      ];
    }

    const escape = escapes.find((candidate) => text.startsWith(candidate.literal, nextCursor));
    if (escape) {
      value += escape.value;
      nextCursor += escape.literal.length;
      continue;
    }

    const character = text[nextCursor];
    if (character === "\\" && quoted.other_backslash_sequences === "literal") {
      value += "\\";
      nextCursor += 1;
      continue;
    }

    value += character;
    nextCursor += 1;
  }

  return [];
}

function parsePatternCandidates(
  text: string,
  cursor: number,
  runtime: ParserSyntaxRuntime,
  patternRef: string,
  valueKind?: string
): AtomParseCandidate[] {
  const pattern = getPattern(runtime, patternRef);
  const candidates: AtomParseCandidate[] = [];

  for (let end = text.length; end > cursor; end -= 1) {
    const candidate = text.slice(cursor, end);
    if (!pattern.test(candidate)) {
      continue;
    }

    candidates.push({
      nextCursor: end,
      value: {
        value: candidate,
        raw_text: candidate,
        value_kind: valueKind
      }
    });
  }

  return candidates;
}

function parseTokenSourceCandidates(
  text: string,
  cursor: number,
  runtime: ParserSyntaxRuntime,
  tokenSourceName: string
): AtomParseCandidate[] {
  const tokenSource = getTokenSource(runtime, tokenSourceName);
  return [...tokenSource.tokens]
    .sort((left, right) => right.length - left.length)
    .filter((token) => text.startsWith(token, cursor))
    .map((token) => ({
      nextCursor: cursor + token.length,
      value: {
        value: token,
        raw_text: token
      }
    }));
}

function parseChoiceAlternative(
  text: string,
  cursor: number,
  runtime: ParserSyntaxRuntime,
  alternative: SyntaxChoiceAlternative
): AtomParseCandidate[] {
  const candidates = alternative.pattern_ref
    ? parsePatternCandidates(text, cursor, runtime, alternative.pattern_ref, alternative.value_kind)
    : parseAtomByName(text, cursor, runtime, alternative.atom!);

  return candidates.map((candidate) => ({
    ...candidate,
    value: {
      ...candidate.value,
      value_kind: alternative.value_kind ?? candidate.value.value_kind
    }
  }));
}

function parseGuardTextAtom(text: string, runtime: ParserSyntaxRuntime, atom: SyntaxAtomDefinition): AtomParseCandidate[] {
  if (!("accepts_any_character_except" in atom)) {
    return [];
  }

  if (!atom.line_breaks_allowed && /[\r\n]/.test(text)) {
    return [];
  }

  if (atom.accepts_any_character_except.some((character) => text.includes(character))) {
    return [];
  }

  return [
    {
      nextCursor: text.length,
      value: {
        value: text,
        raw_text: atom.raw_text_preserved ? text : text.trim()
      }
    }
  ];
}

function finalizeAtomSequenceCandidates(
  text: string,
  states: ParseState[],
  atom: Extract<SyntaxAtomDefinition, { sequence: SyntaxSequenceItem[]; emits: unknown }>
): AtomParseCandidate[] {
  return states
    .filter((state) => state.cursor === text.length)
    .map((state) => {
      const emitted = applyEmitDefinition(state.captures, atom.emits);
      return {
        nextCursor: text.length,
        value: {
          value: emitted.emittedFields,
          fields: emitted.emittedFields
        }
      };
    });
}

function parseAtomText(text: string, atomName: string, runtime: ParserSyntaxRuntime): AtomParseCandidate[] {
  const candidates = parseAtomByName(text, 0, runtime, atomName);
  return candidates.filter((candidate) => candidate.nextCursor === text.length);
}

function parseEnclosureCapture(
  text: string,
  state: ParseState,
  runtime: ParserSyntaxRuntime,
  captureName: string,
  enclosure: { open: string; close: string; trim_inner_whitespace: boolean; inner_atom: string }
): ParseState[] {
  const { cursor } = state;
  if (!text.startsWith(enclosure.open, cursor)) {
    return [];
  }

  const states: ParseState[] = [];
  let searchIndex = cursor + enclosure.open.length;
  while (searchIndex <= text.length) {
    const closeIndex = text.indexOf(enclosure.close, searchIndex);
    if (closeIndex === -1) {
      break;
    }

    const innerSource = text.slice(cursor + enclosure.open.length, closeIndex);
    const innerText = enclosure.trim_inner_whitespace ? innerSource.trim() : innerSource;
    const atomCandidates = parseAtomText(innerText, enclosure.inner_atom, runtime);
    for (const atomCandidate of atomCandidates) {
      const nextState: ParseState = {
        cursor: closeIndex + enclosure.close.length,
        captures: state.captures,
        captureOrder: state.captureOrder
      };
      states.push(withCapture(nextState, captureName, atomCandidate.value));
    }
    searchIndex = closeIndex + enclosure.close.length;
  }

  return states;
}

function parseAtomByName(
  text: string,
  cursor: number,
  runtime: ParserSyntaxRuntime,
  atomName: string
): AtomParseCandidate[] {
  if (atomName === "quoted_string") {
    return parseQuotedString(text, cursor, runtime);
  }

  const atom = getAtom(runtime, atomName);

  if ("one_of" in atom) {
    return atom.one_of.flatMap((alternative) => parseChoiceAlternative(text, cursor, runtime, alternative));
  }

  if ("sequence" in atom) {
    const states = parseSequence(text, atom.sequence, runtime, {
      cursor,
      captures: {},
      captureOrder: []
    });

    return states
      .filter((state) => state.cursor >= cursor)
      .map((state) => ({
        nextCursor: state.cursor,
        value: (() => {
          const emitted = applyEmitDefinition(state.captures, atom.emits);
          return {
            value: emitted.emittedFields,
            fields: emitted.emittedFields
          };
        })()
      }));
  }

  return parseGuardTextAtom(text.slice(cursor), runtime, atom).map((candidate) => ({
    nextCursor: cursor + candidate.nextCursor,
    value: candidate.value
  }));
}

function advanceCaptureItem(
  text: string,
  item: Extract<SyntaxSequenceItem, { capture: string }>,
  state: ParseState,
  runtime: ParserSyntaxRuntime
): ParseState[] {
  if ("pattern_ref" in item) {
    return parsePatternCandidates(text, state.cursor, runtime, item.pattern_ref).map((candidate) => {
      const nextState = withCapture(state, item.capture, candidate.value);
      return { ...nextState, cursor: candidate.nextCursor };
    });
  }

  if ("token_source" in item) {
    return parseTokenSourceCandidates(text, state.cursor, runtime, item.token_source).map((candidate) => {
      const nextState = withCapture(state, item.capture, candidate.value);
      return { ...nextState, cursor: candidate.nextCursor };
    });
  }

  if ("atom" in item) {
    return parseAtomByName(text, state.cursor, runtime, item.atom).map((candidate) => {
      const nextState = withCapture(state, item.capture, candidate.value);
      return { ...nextState, cursor: candidate.nextCursor };
    });
  }

  if ("one_of" in item) {
    return item.one_of.flatMap((alternative) =>
      parseChoiceAlternative(text, state.cursor, runtime, alternative).map((candidate) => {
        const nextState = withCapture(state, item.capture, candidate.value);
        return { ...nextState, cursor: candidate.nextCursor };
      })
    );
  }

  if ("enclosure" in item) {
    return parseEnclosureCapture(text, state, runtime, item.capture, item.enclosure);
  }

  return [];
}

function advanceRepeatItem(text: string, state: ParseState, runtime: ParserSyntaxRuntime, item: { repeat: { separator: SyntaxWhitespaceSequenceItem; capture: string; atom: string } }): ParseState[] {
  const results: ParseState[] = [state];
  let frontier: ParseState[] = [state];

  while (frontier.length > 0) {
    const nextFrontier: ParseState[] = [];

    for (const candidateState of frontier) {
      const separatorCursor = consumeWhitespace(text, candidateState.cursor, runtime, item.repeat.separator);
      if (separatorCursor === undefined) {
        continue;
      }

      const atomCandidates = parseAtomByName(text, separatorCursor, runtime, item.repeat.atom);
      for (const atomCandidate of atomCandidates) {
        const capturedState = withCapture(
          {
            cursor: separatorCursor,
            captures: candidateState.captures,
            captureOrder: candidateState.captureOrder
          },
          item.repeat.capture,
          atomCandidate.value,
          true
        );
        const nextState = {
          ...capturedState,
          cursor: atomCandidate.nextCursor
        };
        nextFrontier.push(nextState);
        results.push(nextState);
      }
    }

    frontier = nextFrontier;
  }

  return results;
}

function advanceSequenceItem(
  text: string,
  item: SyntaxSequenceItem,
  state: ParseState,
  runtime: ParserSyntaxRuntime
): ParseState[] {
  if ("literal" in item) {
    return text.startsWith(item.literal, state.cursor)
      ? [{ ...state, cursor: state.cursor + item.literal.length }]
      : [];
  }

  if ("whitespace" in item) {
    const nextCursor = consumeWhitespace(text, state.cursor, runtime, item);
    return nextCursor === undefined ? [] : [{ ...state, cursor: nextCursor }];
  }

  if ("capture" in item) {
    return advanceCaptureItem(text, item, state, runtime);
  }

  if ("optional" in item) {
    return [state, ...parseSequence(text, item.optional, runtime, state)];
  }

  if ("repeat" in item) {
    return advanceRepeatItem(text, state, runtime, item);
  }

  return [];
}

function parseSequence(
  text: string,
  sequence: SyntaxSequenceItem[],
  runtime: ParserSyntaxRuntime,
  initialState: ParseState
): ParseState[] {
  let states: ParseState[] = [initialState];

  for (const item of sequence) {
    states = states.flatMap((state) => advanceSequenceItem(text, item, state, runtime));
    if (states.length === 0) {
      return [];
    }
  }

  return states;
}

function normalizeStatementInput(
  text: string,
  statementName: string,
  statement: SyntaxStatementDefinition,
  runtime: ParserSyntaxRuntime
): string {
  let normalizedText = text;

  if (runtime.syntax.lexical.leading_whitespace_ignored || statement.leading_whitespace === "ignored") {
    normalizedText = normalizedText.trimStart();
  }

  if (statement.trailing_comment === "allowed" || runtime.trailingCommentAllowedStatements.has(statementName)) {
    normalizedText = stripTrailingComment(normalizedText).content;
  }

  if (runtime.syntax.lexical.trailing_whitespace_ignored || statement.trailing_whitespace === "ignored") {
    normalizedText = normalizedText.trimEnd();
  }

  return normalizedText;
}

function respectsFixedOrder(statement: SyntaxStatementDefinition, state: ParseState): boolean {
  if (!statement.fixed_order || statement.fixed_order.length === 0) {
    return true;
  }

  const orderMap = new Map(statement.fixed_order.map((name, index) => [name, index]));
  let lastIndex = -1;

  for (const captureName of state.captureOrder) {
    const currentIndex = orderMap.get(captureName);
    if (currentIndex === undefined) {
      continue;
    }
    if (currentIndex < lastIndex) {
      return false;
    }
    lastIndex = currentIndex;
  }

  return true;
}

export function interpretStatement(
  text: string,
  statementName: string,
  runtime: ParserSyntaxRuntime
): InterpretedStatementResult {
  const statement = getStatement(runtime, statementName);
  if (!statement.sequence) {
    return {
      ok: false,
      statementName,
      error: `Statement '${statementName}' does not declare a sequence`
    };
  }

  const normalizedText = normalizeStatementInput(text, statementName, statement, runtime);
  const states = parseSequence(
    normalizedText,
    statement.sequence,
    runtime,
    {
      cursor: 0,
      captures: {},
      captureOrder: []
    }
  )
    .filter((state) => state.cursor === normalizedText.length)
    .filter((state) => respectsFixedOrder(statement, state));

  if (states.length === 0) {
    return {
      ok: false,
      statementName,
      error: `Invalid ${statementName} syntax`
    };
  }

  const [state] = [...states].sort((left, right) => right.captureOrder.length - left.captureOrder.length);
  const emitted = applyEmitDefinition(state.captures, statement.emits);

  return {
    ok: true,
    statementName,
    normalizedText,
    captures: state.captures,
    emittedKind: emitted.emittedKind,
    emittedFields: emitted.emittedFields
  };
}
