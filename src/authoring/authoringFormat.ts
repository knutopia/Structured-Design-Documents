import type { Bundle, SyntaxChoiceAlternative } from "../bundle/types.js";
import type { Diagnostic } from "../types.js";
import type {
  ContractAuthoringFormatCard,
  ContractFieldFormatHint,
  ContractShapeId
} from "./contracts.js";

const APPLY_AUTHORING_INTENT_SHAPE: ContractShapeId = "shared.shape.apply_authoring_intent_args";
const APPLY_CHANGE_SET_SHAPE: ContractShapeId = "shared.shape.apply_change_set_args";

function syntaxDocumentSource(bundle: Bundle): string {
  const languageVersion = bundle.manifest.language_version ?? "0.1";
  const syntaxPath = bundle.manifest.core?.syntax ?? "core/syntax.yaml";
  return `bundle/v${languageVersion}/${syntaxPath}`;
}

function vocabDocumentSource(bundle: Bundle): string {
  const languageVersion = bundle.manifest.language_version ?? "0.1";
  const vocabPath = bundle.manifest.core?.vocab ?? "core/vocab.yaml";
  return `bundle/v${languageVersion}/${vocabPath}`;
}

function syntaxSource(bundle: Bundle, fragment: string): string {
  return `${syntaxDocumentSource(bundle)}#/${fragment}`;
}

function vocabSource(bundle: Bundle, fragment: string): string {
  return `${vocabDocumentSource(bundle)}#/${fragment}`;
}

export function idPatternSource(bundle: Bundle): string {
  return syntaxSource(bundle, "lexical/id_pattern");
}

export function atomSource(bundle: Bundle, atomName: "event_atom" | "effect_atom"): string {
  return syntaxSource(bundle, `atoms/${atomName}`);
}

function lexicalPattern(bundle: Bundle, patternRef: string): string | undefined {
  const key = patternRef.startsWith("lexical.") ? patternRef.slice("lexical.".length) : patternRef;
  const value = bundle.syntax.lexical[key as keyof typeof bundle.syntax.lexical];
  return typeof value === "string" ? value : undefined;
}

function matchesPatternRef(bundle: Bundle, patternRef: string, value: string): boolean {
  const pattern = lexicalPattern(bundle, patternRef);
  return pattern ? new RegExp(pattern).test(value) : false;
}

function matchesQuotedString(bundle: Bundle, value: string): boolean {
  const quoted = bundle.syntax.lexical.quoted_string;
  const delimiter = quoted.delimiter;
  if (!value.startsWith(delimiter)) {
    return false;
  }

  const escapes = [...quoted.standardized_escapes].sort((left, right) => right.literal.length - left.literal.length);
  let cursor = delimiter.length;

  while (cursor < value.length) {
    if (value.startsWith(delimiter, cursor)) {
      return cursor + delimiter.length === value.length;
    }

    const character = value[cursor];
    if (!quoted.multiline && (character === "\r" || character === "\n")) {
      return false;
    }

    const escape = escapes.find((candidate) => value.startsWith(candidate.literal, cursor));
    if (escape) {
      cursor += escape.literal.length;
      continue;
    }

    if (character === "\\" && quoted.other_backslash_sequences === "literal") {
      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return false;
}

function alternativeAcceptedForm(alternative: SyntaxChoiceAlternative): string {
  if (alternative.pattern_ref) {
    return alternative.pattern_ref.startsWith("lexical.")
      ? alternative.pattern_ref.slice("lexical.".length)
      : alternative.pattern_ref;
  }
  return alternative.atom ?? "unknown";
}

export function acceptedFormsForAtom(bundle: Bundle, atomName: "event_atom" | "effect_atom"): string[] {
  const atom = bundle.syntax.atoms[atomName];
  if (!atom || !("one_of" in atom)) {
    return [];
  }

  return atom.one_of.map(alternativeAcceptedForm);
}

export function isSddNodeId(bundle: Bundle, value: string): boolean {
  return matchesPatternRef(bundle, "lexical.id_pattern", value);
}

function matchesAtom(bundle: Bundle, atomName: string, value: string): boolean {
  if (atomName === "quoted_string") {
    return matchesQuotedString(bundle, value);
  }

  const atom = bundle.syntax.atoms[atomName];
  if (!atom || !("one_of" in atom)) {
    return false;
  }

  return atom.one_of.some((alternative) => {
    if (alternative.pattern_ref) {
      return matchesPatternRef(bundle, alternative.pattern_ref, value);
    }
    return alternative.atom === undefined ? false : matchesAtom(bundle, alternative.atom, value);
  });
}

export function isSyntaxAtom(bundle: Bundle, atomName: "event_atom" | "effect_atom", value: string): boolean {
  return matchesAtom(bundle, atomName, value);
}

function jsonExample(json: string, renders: string): { json: string; renders: string } {
  return { json, renders };
}

export function createAuthoringFormatCard(bundle: Bundle): ContractAuthoringFormatCard {
  const idPattern = bundle.syntax.lexical.id_pattern;
  const eventForms = acceptedFormsForAtom(bundle, "event_atom");
  const effectForms = acceptedFormsForAtom(bundle, "effect_atom");

  const nodeIdHint: ContractFieldFormatHint = {
    hint_id: "sdd.v0_1.node_id",
    applies_to_shape_id: APPLY_AUTHORING_INTENT_SHAPE,
    applies_to_json_pointers: [
      "/intents/*/node/node_id",
      "/intents/*/node/edges/*/to",
      "/intents/*/parent/selector/node_id",
      "/intents/*/placement/anchor/selector/node_id"
    ],
    source: idPatternSource(bundle),
    accepted_pattern: idPattern,
    examples: ["P-001", "J-010", "SA-010", "ST-010a"],
    concise: "Use capital prefix, dash, at least three digits, optional lowercase suffix."
  };

  const eventHint: ContractFieldFormatHint = {
    hint_id: "sdd.v0_1.event_atom",
    applies_to_shape_id: APPLY_AUTHORING_INTENT_SHAPE,
    applies_to_json_pointers: ["/intents/*/node/edges/*/event"],
    source: atomSource(bundle, "event_atom"),
    accepted_forms: eventForms,
    examples: ["E-010", "ClickReview", "\"User clicked review\""],
    json_examples: [
      jsonExample("E-010", "[E-010]"),
      jsonExample("ClickReview", "[ClickReview]"),
      jsonExample("\"User clicked review\"", "[\"User clicked review\"]")
    ],
    concise: "This is raw SDD source text. Prose needs embedded SDD quotes."
  };

  const effectHint: ContractFieldFormatHint = {
    hint_id: "sdd.v0_1.effect_atom",
    applies_to_shape_id: APPLY_AUTHORING_INTENT_SHAPE,
    applies_to_json_pointers: ["/intents/*/node/edges/*/effect"],
    source: atomSource(bundle, "effect_atom"),
    accepted_forms: effectForms,
    examples: ["SA-010", "emitMetric", "\"side effect\""],
    json_examples: [
      jsonExample("SA-010", "/ SA-010"),
      jsonExample("emitMetric", "/ emitMetric"),
      jsonExample("\"side effect\"", "/ \"side effect\"")
    ],
    concise: "This is raw SDD source text. Prose needs embedded SDD quotes."
  };

  return {
    card_id: "sdd.v0_1.author_json_quick_format",
    summary: "Compact bundle-derived formatting guidance for helper author JSON.",
    source: syntaxDocumentSource(bundle),
    lines: [
      "local_id is a request-only helper id; use snake_case. It is not an SDD node id.",
      `node.node_id, edge.to, and selector.node_id use SDD node IDs: ${idPattern}; examples P-001, J-010, SA-010, ST-010a.`,
      "node.node_type and edge.rel_type use bundle vocabulary tokens, not prose labels.",
      `event/effect are raw SDD atoms: ${[...new Set([...eventForms, ...effectForms])].join(", ")}.`,
      "For prose event/effect text in JSON, include SDD quotes, e.g. \"effect\": \"\\\"side effect\\\"\".",
      "guard is raw text inside {...}; do not include } or a newline.",
      "property values should use value_kind quoted_string for prose; bare_value is for simple tokens."
    ],
    field_hints: [nodeIdHint, eventHint, effectHint]
  };
}

export function createApplyFormatCard(bundle: Bundle): ContractAuthoringFormatCard {
  const idPattern = bundle.syntax.lexical.id_pattern;
  const eventForms = acceptedFormsForAtom(bundle, "event_atom");
  const effectForms = acceptedFormsForAtom(bundle, "effect_atom");
  const nodeTypes = bundle.vocab.node_types.map((entry) => entry.token);
  const relationshipTypes = bundle.vocab.relationship_types.map((entry) => entry.token);

  const nodeIdHint: ContractFieldFormatHint = {
    hint_id: "sdd.v0_1.node_id",
    applies_to_shape_id: APPLY_CHANGE_SET_SHAPE,
    applies_to_json_pointers: ["/operations/*/node_id", "/operations/*/to"],
    source: idPatternSource(bundle),
    accepted_pattern: idPattern,
    examples: ["P-001", "J-010", "SA-010", "ST-010a"],
    concise: "Use SDD node IDs for inserted node_id values and inserted edge to targets."
  };

  const nodeTypeHint: ContractFieldFormatHint = {
    hint_id: "sdd.v0_1.node_type",
    applies_to_shape_id: APPLY_CHANGE_SET_SHAPE,
    applies_to_json_pointers: ["/operations/*/node_type"],
    source: vocabSource(bundle, "node_types"),
    accepted_forms: nodeTypes,
    examples: nodeTypes.slice(0, 4),
    concise: "Use a bundle node type token exactly as written, not a prose label."
  };

  const relationshipTypeHint: ContractFieldFormatHint = {
    hint_id: "sdd.v0_1.rel_type",
    applies_to_shape_id: APPLY_CHANGE_SET_SHAPE,
    applies_to_json_pointers: ["/operations/*/rel_type"],
    source: vocabSource(bundle, "relationship_types"),
    accepted_forms: relationshipTypes,
    examples: relationshipTypes.slice(0, 4),
    concise: "Use a bundle relationship type token exactly as written."
  };

  const eventHint: ContractFieldFormatHint = {
    hint_id: "sdd.v0_1.event_atom",
    applies_to_shape_id: APPLY_CHANGE_SET_SHAPE,
    applies_to_json_pointers: ["/operations/*/event"],
    source: atomSource(bundle, "event_atom"),
    accepted_forms: eventForms,
    examples: ["E-010", "ClickReview", "\"User clicked review\""],
    json_examples: [
      jsonExample("E-010", "[E-010]"),
      jsonExample("ClickReview", "[ClickReview]"),
      jsonExample("\"User clicked review\"", "[\"User clicked review\"]")
    ],
    concise: "This is raw SDD source text. Prose needs embedded SDD quotes."
  };

  const effectHint: ContractFieldFormatHint = {
    hint_id: "sdd.v0_1.effect_atom",
    applies_to_shape_id: APPLY_CHANGE_SET_SHAPE,
    applies_to_json_pointers: ["/operations/*/effect"],
    source: atomSource(bundle, "effect_atom"),
    accepted_forms: effectForms,
    examples: ["SA-010", "emitMetric", "\"side effect\""],
    json_examples: [
      jsonExample("SA-010", "/ SA-010"),
      jsonExample("emitMetric", "/ emitMetric"),
      jsonExample("\"side effect\"", "/ \"side effect\"")
    ],
    concise: "This is raw SDD source text. Prose needs embedded SDD quotes."
  };

  const valueKindHint: ContractFieldFormatHint = {
    hint_id: "sdd.v0_1.value_kind",
    applies_to_shape_id: APPLY_CHANGE_SET_SHAPE,
    applies_to_json_pointers: ["/operations/*/value_kind"],
    source: syntaxSource(bundle, "statements/property_line"),
    accepted_forms: ["quoted_string", "bare_value"],
    examples: ["quoted_string", "bare_value"],
    concise: "Use quoted_string for prose property values and bare_value for simple source tokens."
  };

  const rawValueHint: ContractFieldFormatHint = {
    hint_id: "sdd.v0_1.raw_value",
    applies_to_shape_id: APPLY_CHANGE_SET_SHAPE,
    applies_to_json_pointers: ["/operations/*/raw_value"],
    source: syntaxSource(bundle, "statements/property_line"),
    examples: ["\"prose value\"", "active", "42"],
    concise: "raw_value is SDD source text matching value_kind; quoted_string values include SDD quotes inside the JSON string."
  };

  return {
    card_id: "sdd.v0_1.apply_json_quick_format",
    summary: "Compact bundle-derived formatting guidance for helper apply JSON.",
    source: syntaxDocumentSource(bundle),
    lines: [
      `insert_node_block.node_id and insert_edge_line.to use SDD node IDs: ${idPattern}; examples P-001, J-010, SA-010, ST-010a.`,
      "insert_node_block.node_type and insert_edge_line.rel_type use bundle vocabulary tokens exactly as written.",
      `insert_edge_line.event/effect are raw SDD atoms: ${[...new Set([...eventForms, ...effectForms])].join(", ")}.`,
      "For prose event/effect text in JSON, include SDD quotes, e.g. \"effect\": \"\\\"side effect\\\"\".",
      "set_node_property.raw_value is raw SDD source text; quoted strings include embedded SDD quotes.",
      "set_node_property.value_kind must match the raw_value form: quoted_string or bare_value."
    ],
    field_hints: [nodeIdHint, nodeTypeHint, relationshipTypeHint, eventHint, effectHint, valueKindHint, rawValueHint]
  };
}

function diagnostic(
  code: string,
  file: string,
  message: string,
  relatedIds: string[]
): Diagnostic {
  return {
    stage: "cli",
    code,
    severity: "error",
    file,
    message,
    relatedIds
  };
}

export function invalidSddIdDiagnostic(args: {
  bundle: Bundle;
  file: string;
  fieldPath: string;
  jsonPointer: string;
  value: string;
}): Diagnostic {
  return diagnostic(
    "helper.request.invalid_sdd_id",
    args.file,
    `${args.fieldPath} must be an SDD node id matching ${bundleIdPattern(args.bundle)}. Got '${args.value}'.`,
    [
      `json_pointer:${args.jsonPointer}`,
      `field_path:${args.fieldPath}`,
      `bundle_source:${idPatternSource(args.bundle)}`
    ]
  );
}

function bundleIdPattern(bundle: Bundle): string {
  return bundle.syntax.lexical.id_pattern;
}

export function invalidSddAtomDiagnostic(args: {
  bundle: Bundle;
  file: string;
  fieldPath: string;
  jsonPointer: string;
  atomName: "event_atom" | "effect_atom";
  value: string;
}): Diagnostic {
  const forms = acceptedFormsForAtom(args.bundle, args.atomName).join(", ");
  const quoteRepair = args.value.includes(" ") || args.value.length === 0
    ? ` For prose, use JSON value ${JSON.stringify(`"${args.value}"`)}.`
    : "";
  return diagnostic(
    "helper.request.invalid_sdd_atom",
    args.file,
    `${args.fieldPath} must be an SDD ${args.atomName}. Accepted forms: ${forms}. Got '${args.value}'.${quoteRepair}`,
    [
      `json_pointer:${args.jsonPointer}`,
      `field_path:${args.fieldPath}`,
      `bundle_source:${atomSource(args.bundle, args.atomName)}`
    ]
  );
}
