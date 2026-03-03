## `authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md`

````diff
--- a/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md
+++ b/authoring_spec_type_first_dsl_sdd_text_v_0_dot_1.md
@@ -93,8 +93,12 @@
 B) **Edge line (outgoing edge from current node)**

 ```text
-<REL> <ToID> [<Event>] {<Guard>} / <Effect> <key>=<value>...
+<REL> <ToID> "<ToName>" [<Event>] {<Guard>} / <Effect> <key>=<value>...
````

+- `"<ToName>"` is OPTIONAL. If present, it MUST appear immediately after `<ToID>`. +- `"<ToName>"` is a human-readable hint only; it MUST NOT affect edge semantics. + C) **Nested Node block (v0.1.1 mitigation, included in v0.1)** Nested nodes MUST begin with an explicit marker `+`:

```text
@@ -146,7 +150,7 @@
- `{<Guard>}` is OPTIONAL and MUST be enclosed in `{}`.
- `/ <Effect>` is OPTIONAL and MUST begin with `/`.
- Optional trailing `key=value` pairs are edge properties.

-Order is fixed: `REL ToID` then optional `[Event]` then optional `{Guard}` then optional `/ Effect` then optional properties.
+Order is fixed: `REL ToID` then optional `"<ToName>"` then optional `[Event]` then optional `{Guard}` then optional `/ Effect` then optional properties.

### 5.2 Event and Guard conventions

@@ -161,6 +165,8 @@

SDD-Text does not assign IDs to edges in v0.1. Canonical JSON output MAY add an `edge_id` for tooling but MUST not require it in authoring.

+Tooling SHOULD treat two edges as **duplicates** if they have the same `from`, `type`, `to`, `event`, `guard`, `effect`, **and identical edge `props`**. The optional `to_name` hint MUST be ignored for duplicate detection.
+
---

## 6. Nesting (explicit marker `+`)
@@ -171,7 +177,7 @@

### 6.2 Parsing rule

-Within a node body, a line beginning with `+` starts a nested node header. The nested node continues until its `END`.
+Within a node body, a line whose **first non-whitespace character** is `+` starts a nested node header. The nested node continues until its `END`.

### 6.3 Semantic rule

@@ -208,7 +214,8 @@

- Nodes MUST be sorted by `id` ascending.
- Node `props` keys MUST be sorted lexicographically.
-- Edges MUST be sorted by `(from, type, to, event, guard, effect)`.
+- Edges MUST be sorted by `(from, type, to, event, guard, effect, props)` where `props` is compared by the lexicographically-sorted sequence of `(key, value_as_json)`, and `value_as_json` is the minified JSON encoding of the value with any object keys sorted lexicographically.
+- `to_name` MUST NOT affect sort order (it is a hint only).
- Edge `props` keys MUST be sorted lexicographically.

### 7.2 Forward references
```

---

## `ebnf_grammar_sdd_text_v_0_dot_1.md`

````diff
--- a/ebnf_grammar_sdd_text_v_0_dot_1.md
+++ b/ebnf_grammar_sdd_text_v_0_dot_1.md
@@ -23,7 +23,9 @@
 ## 2) Top-level Grammar

 ```ebnf
-Document        = [ VersionDecl , EOL ] , { BlankOrCommentLine } , NodeBlock , { { BlankOrCommentLine } , NodeBlock } , { BlankOrCommentLine } ;
+Document        = [ VersionDecl , EOL ] , { BlankOrCommentLine } ,
+                  TopNodeBlock , { { BlankOrCommentLine } , TopNodeBlock } ,
+                  { BlankOrCommentLine } ;

 VersionDecl     = 'SDD-TEXT' , WS , VersionNumber ;
 VersionNumber   = Digit , { Digit | '.' } ;
@@ -40,21 +42,23 @@
 A node block is a header, followed by zero or more body lines (properties, edges, and/or nested node blocks), and terminated by `END`.

 ```ebnf
-NodeBlock        = NodeHeader , EOL , { NodeBodyItem } , EndLine ;
-
-NodeHeader       = [ '+' , WS ] , NodeType , WS , Id , WS , QuotedString , [ WS , TrailingComment ] ;
+TopNodeBlock     = TopNodeHeader , EOL , { NodeBodyItem } , EndLine ;
+NestedNodeBlock  = NestedNodeHeader , EOL , { NodeBodyItem } , EndLine ;
+
+TopNodeHeader    = [ WS ] , NodeType , WS , Id , WS , QuotedString , [ WS , TrailingComment ] ;
+NestedNodeHeader = [ WS ] , '+' , WS , NodeType , WS , Id , WS , QuotedString , [ WS , TrailingComment ] ;

 NodeBodyItem     = { BlankOrCommentLine }
                  | PropertyLine
                  | EdgeLine
-                 | NodeBlock ;
+                 | NestedNodeBlock ;

 EndLine          = [ WS ] , 'END' , [ WS , TrailingComment ] , EOL ;

 TrailingComment  = '#' , { NotEOL } ;
````

-**Nesting rule (syntax):** A nested node starts with a header line prefixed by `+`. It is still a full `NodeBlock` with its own `END`. +**Nesting rule (syntax):** A nested node starts with a header line whose **first non-whitespace character** is `+`. It is still a full `NestedNodeBlock` with its own `END`.

---

@@ -132,7 +136,7 @@ IdentChar        = Letter | Digit | '\_' | '.' | '/' | ':' | '-' ;

Id               = UpperPrefix , '-' , Digits , [ Suffix ] ; -UpperPrefix      = UpperLetter , { UpperLetter } ; +UpperPrefix      = UpperLetter , [ UpperLetter ] , [ UpperLetter ] ; Digits           = Digit , Digit , Digit , { Digit } ; Suffix           = LowerLetter , { LowerLetter | Digit } ;

```
@@ -146,7 +150,8 @@
EscapedBackslash = '\\\\' ;
NotQuoteNotEOL    = ? any character except '"' or CR or LF ? ;

-BareValue        = Identifier ;
+BareValue        = BareChar , { BareChar } ;
+BareChar         = Letter | Digit | '_' | '.' | '/' | ':' | '-' ;
```

**Notes:**

````

---

## `readme_structured_design_diagrams_sdd_text_v_0_dot_1.md`

```diff
--- a/readme_structured_design_diagrams_sdd_text_v_0_dot_1.md
+++ b/readme_structured_design_diagrams_sdd_text_v_0_dot_1.md
@@ -116,7 +116,8 @@

 SDD-Text v0.1 is a **type-first DSL**:

-- The first token is the **node type** or **relationship**.
+- The first **non-whitespace** token is the **node type** or **relationship** (except nested node headers, which begin with `+` followed by the node type).
+- Leading indentation is allowed for readability and MUST be ignored by parsers.
 - Node blocks end explicitly with `END`.
 - Optional nesting uses `+` and is for authoring convenience (nesting does not imply relationships unless you add edges).

````

---

## `endpoint_contracts_semantic_rules_sdd_text_v_0_dot_1.md`

No changes (already consistent with the authoring spec once the spec’s canonical ordering and duplicate-edge identity are clarified).

---

## `json_schema_sdd_text_v_0_dot_1.md`

No changes required for the addressed inconsistencies (the schema already matches the authoring spec on ID prefix length and `to_name`; canonical ordering and nesting parsing rules are outside JSON Schema’s scope).

