# SDD-Text v0.1 — Grammar (EBNF)

This document defines the **normative syntax** of SDD-Text v0.1 using EBNF.

**Notes**
- This grammar defines **parsing** only. Semantic validity (endpoint contracts, required props, etc.) is defined in **SDD-Text v0.1 Endpoint Contracts** and in the JSON Schema.
- Indentation is **not** semantically meaningful.
- EBNF alone cannot express full regex constraints (e.g., exact ID patterns). Those are specified in the **Lexical Tokens** section.

---

## 1) EBNF Conventions

- Terminals are in single quotes, e.g., `'END'`.
- `EOL` represents end-of-line (newline). In practice, the parser can treat lines as delimited by `\n` (optionally `\r\n`).
- `WS` is whitespace (spaces/tabs). Whitespace is generally allowed between tokens.
- `{ X }` = zero or more repetitions.
- `[ X ]` = optional.
- `|` = alternation.

---

## 2) Top-level Grammar

```ebnf
Document        = [ VersionDecl , EOL ] , { BlankOrCommentLine } ,
                  TopNodeBlock , { { BlankOrCommentLine } , TopNodeBlock } ,
                  { BlankOrCommentLine } ;

VersionDecl     = 'SDD-TEXT' , WS , VersionNumber ;
VersionNumber   = Digit , { Digit | '.' } ;

BlankOrCommentLine
                = [ WS ] , ( Comment | /* empty */ ) , EOL ;
Comment         = '#' , { NotEOL } ;
```

---

## 3) Node Blocks

A node block is a header, followed by zero or more body lines (properties, edges, and/or nested node blocks), and terminated by `END`.

```ebnf
TopNodeBlock     = TopNodeHeader , EOL , { NodeBodyItem } , EndLine ;
NestedNodeBlock  = NestedNodeHeader , EOL , { NodeBodyItem } , EndLine ;

TopNodeHeader    = [ WS ] , NodeType , WS , Id , WS , QuotedString , [ WS , TrailingComment ] ;
NestedNodeHeader = [ WS ] , '+' , WS , NodeType , WS , Id , WS , QuotedString , [ WS , TrailingComment ] ;

NodeBodyItem     = { BlankOrCommentLine }
                 | PropertyLine
                 | EdgeLine
                 | NestedNodeBlock ;

EndLine          = [ WS ] , 'END' , [ WS , TrailingComment ] , EOL ;

TrailingComment  = '#' , { NotEOL } ;
```

**Nesting rule (syntax):** A nested node starts with a header line whose **first non-whitespace character** is `+`. It is still a full `NestedNodeBlock` with its own `END`.

---

## 4) Properties

```ebnf
PropertyLine     = [ WS ] , Key , WS? , '=' , WS? , Value , [ WS , TrailingComment ] , EOL ;

Key              = Identifier ;
Value            = QuotedString | BareValue ;
```

---

## 5) Edges

Edge lines always describe an outgoing edge from the **current node block**.

**v0.1 edge syntax:**

```ebnf
EdgeLine         = [ WS ] , RelType , WS , Id , [ WS , QuotedString ] ,
                   [ WS , EventAnnot ] , [ WS , GuardAnnot ] , [ WS , EffectAnnot ] ,
                   { WS , EdgeProp } ,
                   [ WS , TrailingComment ] , EOL ;

EventAnnot       = '[' , WS? , EventAtom , WS? , ']' ;
EventAtom        = Id | Identifier | QuotedString ;

GuardAnnot       = '{' , GuardText , '}' ;
GuardText        = { GuardChar } ;
GuardChar        = NotRightBraceNotEOL ;

EffectAnnot      = '/' , WS? , EffectAtom ;
EffectAtom       = Id | Identifier | QuotedString ;

EdgeProp         = Key , WS? , '=' , WS? , Value ;
```

### Edge elements
- `RelType` = relationship token (must be disjoint from NodeType tokens)
- `Id` after `RelType` is the `to` endpoint
- Optional `QuotedString` after `to` is the **target name hint** (`to_name`)
- `[Event]` `{Guard}` `/ Effect` are optional annotations
- Trailing `key=value` pairs are edge properties

---

## 6) Lexical Tokens (Normative)

### 6.1 Whitespace and line chars
```ebnf
WS               = ' ' | '\t' | WS , WS ;
WS?              = [ WS ] ;
EOL              = '\n' | '\r\n' ;
NotEOL           = ? any character except CR or LF ? ;
NotRightBraceNotEOL
                 = ? any character except '}' or CR or LF ? ;
```

### 6.2 Identifiers and IDs

**Identifier (Key / bare words):**
- Normative constraint: `[A-Za-z_][A-Za-z0-9_./:-]*`

**Id (graph IDs):**
- Normative constraint (recommended):
  - Base: `[A-Z]{1,3}-[0-9]{3,}`
  - Optional suffix: `[a-z][a-z0-9]*`
- Examples: `P-020`, `VS-020a`, `OP-014`, `SA-009`

```ebnf
Identifier       = IdentStart , { IdentChar } ;
IdentStart       = Letter | '_' ;
IdentChar        = Letter | Digit | '_' | '.' | '/' | ':' | '-' ;

Id               = UpperPrefix , '-' , Digits , [ Suffix ] ;
UpperPrefix      = UpperLetter , [ UpperLetter ] , [ UpperLetter ] ;
Digits           = Digit , Digit , Digit , { Digit } ;
Suffix           = LowerLetter , { LowerLetter | Digit } ;
```

### 6.3 Strings

```ebnf
QuotedString     = '"' , { StringChar } , '"' ;
StringChar       = EscapedQuote | EscapedBackslash | NotQuoteNotEOL ;
EscapedQuote     = '\\"' ;
EscapedBackslash = '\\\\' ;
NotQuoteNotEOL    = ? any character except '"' or CR or LF ? ;

BareValue        = BareChar , { BareChar } ;
BareChar         = Letter | Digit | '_' | '.' | '/' | ':' | '-' ;
```

**Notes:**
- v0.1 disallows multi-line strings.
- Only `\\"` and `\\\\` escapes are standardized in v0.1. Other escapes MAY be treated as literal characters.

---

## 7) Token Vocabularies (Normative)

### 7.1 NodeType tokens
`NodeType` MUST be one of:

- `Outcome`, `Metric`, `Opportunity`, `Initiative`
- `Stage`, `Step`
- `Area`, `Place`, `ViewState`
- `Component`, `State`, `Event`
- `Process`, `SystemAction`, `DataEntity`, `Policy`

```ebnf
NodeType         = 'Outcome' | 'Metric' | 'Opportunity' | 'Initiative'
                 | 'Stage' | 'Step'
                 | 'Area' | 'Place' | 'ViewState'
                 | 'Component' | 'State' | 'Event'
                 | 'Process' | 'SystemAction' | 'DataEntity' | 'Policy' ;
```

### 7.2 Relationship tokens
`RelType` MUST be one of:

- `CONTAINS`, `COMPOSED_OF`, `PRECEDES`, `NAVIGATES_TO`
- `MEASURED_BY`, `SUPPORTS`, `ADDRESSES`, `IMPLEMENTED_BY`, `REALIZED_BY`
- `TRANSITIONS_TO`, `EMITS`, `DEPENDS_ON`, `CONSTRAINED_BY`
- `READS`, `WRITES`, `BINDS_TO`, `INSTRUMENTED_AT`

```ebnf
RelType          = 'CONTAINS' | 'COMPOSED_OF' | 'PRECEDES' | 'NAVIGATES_TO'
                 | 'MEASURED_BY' | 'SUPPORTS' | 'ADDRESSES' | 'IMPLEMENTED_BY' | 'REALIZED_BY'
                 | 'TRANSITIONS_TO' | 'EMITS' | 'DEPENDS_ON' | 'CONSTRAINED_BY'
                 | 'READS' | 'WRITES' | 'BINDS_TO' | 'INSTRUMENTED_AT' ;
```

### 7.3 Disjointness constraint
Tooling MUST ensure `NodeType` tokens and `RelType` tokens are disjoint.

---

## 8) Parsing Guidance (Non-normative)

- A line whose first non-whitespace token is a `NodeType` begins a node header.
- A line whose first non-whitespace token is `'+'` begins a nested node header.
- A line whose first non-whitespace token is a `RelType` is an edge line.
- A line containing `=` with a leading `Identifier` is a property line.
- `END` terminates the current node block.

In ambiguous cases, the recommended precedence is:
1) `END`
2) `+ NodeType` header
3) `NodeType` header
4) `RelType` edge
5) `Key = Value` property
6) comment/blank
