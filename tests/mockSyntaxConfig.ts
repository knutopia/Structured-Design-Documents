import type { SyntaxConfig } from "../src/bundle/types.js";

export function createMockSyntaxConfig(): SyntaxConfig {
  return {
    version: "0.1",
    artifact: "syntax",
    parsing_model: {
      style: "line_oriented_typed_graph_dsl",
      case_sensitive: true,
      indentation_semantic: false,
      line_oriented: true,
      block_terminated_by_end: true
    },
    token_sources: {
      node_types: {
        path: "core/vocab.yaml",
        key: "node_types",
        token_field: "token"
      },
      relationship_types: {
        path: "core/vocab.yaml",
        key: "relationship_types",
        token_field: "token"
      }
    },
    lexical: {
      newline_sequences: ["\n", "\r\n"],
      whitespace_chars: [" ", "\t"],
      leading_whitespace_ignored: true,
      trailing_whitespace_ignored: true,
      comment_prefix: "#",
      trailing_comments_allowed: ["top_node_header", "nested_node_header", "property_line", "edge_line", "end_line"],
      identifier_pattern: "^[A-Za-z_][A-Za-z0-9_./:-]*$",
      id_pattern: "^[A-Z]{1,3}-[0-9]{3,}([a-z][a-z0-9]*)?$",
      version_number_pattern: "^[0-9][0-9.]*$",
      bare_value_pattern: "^[A-Za-z0-9_./:-]+$",
      quoted_string: {
        delimiter: "\"",
        multiline: false,
        standardized_escapes: [
          { literal: "\\\"", value: "\"" },
          { literal: "\\\\", value: "\\" }
        ],
        other_backslash_sequences: "literal"
      }
    },
    document: {
      version_declaration: {
        allowed: true,
        required: false,
        literal: "SDD-TEXT",
        statement_kind: "version_decl",
        default_effective_version: "0.1",
        post_parse_supported_versions: ["0.1"]
      },
      leading_lines_allowed: ["blank_line", "comment_line"],
      top_level_block_kind: "top_node_block",
      trailing_lines_allowed: ["blank_line", "comment_line"],
      minimum_top_level_blocks: 1
    },
    line_kinds: [
      {
        precedence: 1,
        kind: "end_line",
        statement: "end_line",
        classifier: {
          trimmed_equals: "END"
        }
      },
      {
        precedence: 2,
        kind: "nested_node_header",
        statement: "nested_node_header",
        classifier: {
          first_non_whitespace: "+",
          next_token_source: "node_types"
        }
      },
      {
        precedence: 3,
        kind: "top_node_header",
        statement: "top_node_header",
        classifier: {
          first_token_source: "node_types"
        }
      },
      {
        precedence: 4,
        kind: "edge_line",
        statement: "edge_line",
        classifier: {
          first_token_source: "relationship_types"
        }
      },
      {
        precedence: 5,
        kind: "property_line",
        statement: "property_line",
        classifier: {
          leading_identifier_before_equals: true
        }
      },
      {
        precedence: 6,
        kind: "blank_or_comment",
        statements: ["blank_line", "comment_line"],
        classifier: {
          any_of: [{ trimmed_equals: "" }, { first_non_whitespace: "#" }]
        }
      }
    ],
    statements: {
      version_decl: {
        role: "optional_preamble",
        leading_whitespace: "ignored",
        trailing_whitespace: "ignored",
        sequence: [
          { literal: "SDD-TEXT" },
          { whitespace: "required" },
          { capture: "version_number", pattern_ref: "lexical.version_number_pattern" }
        ],
        emits: {
          kind: "VersionDecl",
          fields: {
            version_number: "version_number"
          }
        }
      },
      top_node_header: {
        role: "block_header",
        leading_whitespace: "ignored",
        trailing_comment: "allowed",
        sequence: [
          { capture: "node_type", token_source: "node_types" },
          { whitespace: "required" },
          { capture: "id", pattern_ref: "lexical.id_pattern" },
          { whitespace: "required" },
          { capture: "name", atom: "quoted_string" }
        ],
        emits: {
          kind: "NodeHeader"
        }
      },
      nested_node_header: {
        role: "block_header",
        leading_whitespace: "ignored",
        trailing_comment: "allowed",
        sequence: [
          { literal: "+" },
          { whitespace: "required" },
          { capture: "node_type", token_source: "node_types" },
          { whitespace: "required" },
          { capture: "id", pattern_ref: "lexical.id_pattern" },
          { whitespace: "required" },
          { capture: "name", atom: "quoted_string" }
        ],
        emits: {
          kind: "NodeHeader"
        }
      },
      property_line: {
        role: "node_body_item",
        leading_whitespace: "ignored",
        trailing_comment: "allowed",
        sequence: [
          { capture: "key", pattern_ref: "lexical.identifier_pattern" },
          { whitespace: "optional" },
          { literal: "=" },
          { whitespace: "optional" },
          {
            capture: "value",
            one_of: [
              { atom: "quoted_string", value_kind: "quoted_string" },
              { pattern_ref: "lexical.bare_value_pattern", value_kind: "bare_value" }
            ]
          }
        ],
        emits: {
          kind: "PropertyLine",
          fields: {
            key: "key",
            value_kind: "value.value_kind",
            raw_value: "value.raw_text"
          }
        }
      },
      edge_line: {
        role: "node_body_item",
        leading_whitespace: "ignored",
        trailing_comment: "allowed",
        fixed_order: ["rel_type", "to", "to_name", "event", "guard", "effect", "props"],
        sequence: [
          { capture: "rel_type", token_source: "relationship_types" },
          { whitespace: "required" },
          { capture: "to", pattern_ref: "lexical.id_pattern" },
          {
            optional: [{ whitespace: "required" }, { capture: "to_name", atom: "quoted_string" }]
          },
          {
            optional: [
              { whitespace: "required" },
              {
                capture: "event",
                enclosure: {
                  open: "[",
                  close: "]",
                  trim_inner_whitespace: true,
                  inner_atom: "event_atom"
                }
              }
            ]
          },
          {
            optional: [
              { whitespace: "required" },
              {
                capture: "guard",
                enclosure: {
                  open: "{",
                  close: "}",
                  trim_inner_whitespace: false,
                  inner_atom: "guard_text"
                }
              }
            ]
          },
          {
            optional: [
              { whitespace: "required" },
              { literal: "/" },
              { whitespace: "optional" },
              { capture: "effect", atom: "effect_atom" }
            ]
          },
          {
            repeat: {
              separator: { whitespace: "required" },
              capture: "props",
              atom: "edge_property"
            }
          }
        ],
        emits: {
          kind: "EdgeLine",
          fields: {
            rel_type: "rel_type",
            to: "to",
            to_name: "to_name",
            event: "event",
            guard: "guard",
            effect: "effect",
            props: "props"
          },
          defaults: {
            to_name: null,
            event: null,
            guard: null,
            effect: null,
            props: []
          }
        }
      },
      end_line: {
        role: "block_terminator",
        leading_whitespace: "ignored",
        trailing_comment: "allowed",
        sequence: [{ literal: "END" }],
        emits: {
          kind: "EndLine"
        }
      },
      blank_line: {
        role: "trivia",
        match: {
          trimmed_equals: ""
        },
        emits: {
          kind: "BlankLine"
        }
      },
      comment_line: {
        role: "trivia",
        leading_whitespace: "ignored",
        match: {
          first_non_whitespace: "#"
        },
        emits: {
          kind: "CommentLine",
          fields: {
            raw_text: "after_comment_prefix"
          }
        }
      }
    },
    blocks: {
      top_node_block: {
        header_statement: "top_node_header",
        body_item_kinds: ["property_line", "edge_line", "nested_node_block", "blank_line", "comment_line"],
        terminator_statement: "end_line",
        emits: {
          kind: "NodeBlock",
          fields: {
            header_kind: {
              const: "top_node_header"
            },
            node_type: "header.node_type",
            id: "header.id",
            name: "header.name",
            body_items: "body_items"
          }
        }
      },
      nested_node_block: {
        header_statement: "nested_node_header",
        body_item_kinds: ["property_line", "edge_line", "nested_node_block", "blank_line", "comment_line"],
        terminator_statement: "end_line",
        emits: {
          kind: "NodeBlock",
          fields: {
            header_kind: {
              const: "nested_node_header"
            },
            node_type: "header.node_type",
            id: "header.id",
            name: "header.name",
            body_items: "body_items"
          }
        }
      }
    },
    atoms: {
      event_atom: {
        one_of: [
          { pattern_ref: "lexical.id_pattern" },
          { pattern_ref: "lexical.identifier_pattern" },
          { atom: "quoted_string" }
        ]
      },
      effect_atom: {
        one_of: [
          { pattern_ref: "lexical.id_pattern" },
          { pattern_ref: "lexical.identifier_pattern" },
          { atom: "quoted_string" }
        ]
      },
      guard_text: {
        terminator: "}",
        line_breaks_allowed: false,
        raw_text_preserved: true,
        accepts_any_character_except: ["}", "\r", "\n"]
      },
      edge_property: {
        sequence: [
          { capture: "key", pattern_ref: "lexical.identifier_pattern" },
          { whitespace: "optional" },
          { literal: "=" },
          { whitespace: "optional" },
          {
            capture: "value",
            one_of: [
              { atom: "quoted_string", value_kind: "quoted_string" },
              { pattern_ref: "lexical.bare_value_pattern", value_kind: "bare_value" }
            ]
          }
        ],
        emits: {
          kind: "EdgeProperty",
          fields: {
            key: "key",
            value_kind: "value.value_kind",
            raw_value: "value.raw_text"
          }
        }
      }
    },
    boundaries: {
      excluded_from_syntax_scope: [
        "endpoint legality",
        "referential integrity",
        "duplicate_edge_policy",
        "event_node_reference_policy",
        "property_requiredness_by_node_type",
        "canonical_json_sort_order",
        "projection_behavior",
        "bare_value_coercion_to_boolean_or_number"
      ],
      notes: [
        "Bare values are parsed lexically; any boolean or numeric coercion occurs after parsing.",
        "Canonical JSON ordering is compiler behavior, not source syntax behavior."
      ]
    },
    parse_output_contract: {
      normalized_nodes: [
        {
          kind: "Document",
          fields: ["declared_version", "effective_version", "items"],
          defaults: {
            effective_version: "0.1"
          },
          item_kinds: ["NodeBlock", "BlankLine", "CommentLine"]
        },
        {
          kind: "NodeBlock",
          fields: ["header_kind", "node_type", "id", "name", "body_items"],
          header_kinds: ["top_node_header", "nested_node_header"],
          body_item_kinds: ["PropertyLine", "EdgeLine", "NodeBlock", "BlankLine", "CommentLine"]
        },
        {
          kind: "PropertyLine",
          fields: ["key", "value_kind", "raw_value"],
          value_kinds: ["quoted_string", "bare_value"]
        },
        {
          kind: "EdgeLine",
          fields: ["rel_type", "to", "to_name", "event", "guard", "effect", "props"],
          defaults: {
            to_name: null,
            event: null,
            guard: null,
            effect: null,
            props: []
          }
        },
        {
          kind: "BlankLine"
        },
        {
          kind: "CommentLine",
          fields: ["raw_text"]
        }
      ],
      preserved_statement_nodes: [{ kind: "EndLine" }]
    }
  };
}
