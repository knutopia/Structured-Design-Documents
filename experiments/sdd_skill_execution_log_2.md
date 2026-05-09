# SDD Skill Execution Log

This is a record of a prompt and agent response where an SDD File and diagram are created using sdd-skill and sdd-helper.

This log documents a skill-use after a range of skill- and helper refinements, including the addition of more --purpose request surfaces for `helper.command.apply`, `helper.command.create` and `helper.command.undo` .


## Prompt:
using Sdd Skill create an SDD with three places, "Peter" navigating to "Paul" and to "Mary". Show the information architecture diagram.
2:25 PM

## Response:

Worked for 14m 55s
I’ll use the SDD helper workflow from the skill: first resolving the helper surface, then creating and authoring the document through the helper, and finally rendering a saved IA diagram from the committed SDD state.


Ran 2 commands
Ran pwd && rg --files -g 'run_helper.sh' -g 'package.json' -g 'pnpm-lock.yaml'
$ pwd && rg --files -g 'run_helper.sh' -g 'package.json' -g 'pnpm-lock.yaml

pnpm-lock.yaml
skills/sdd-skill/scripts/run_helper.sh
package.json

Success
Ran test -x skills/sdd-skill/scripts/run_helper.sh && printf '%s\n' /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh || printf '%s\n' /mnt/c/Users/Knut/.codex/skills/sdd-skill/scripts/run_helper.sh
$ test -x skills/sdd-skill/scripts/run_helper.sh && printf '%s\n' /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh || printf '%s\n' /mnt/c/Users/Knut/.codex/skills/sdd-skill/scripts/run_helper.sh

/home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh

Success
The repo-local helper is available, so I’m using that rather than the installed copy. Next I’m checking its declared capabilities and the request formats for document creation and authoring.


Ran 3 commands
Ran /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh capabilities
$ /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh capabilities

{
  "kind": "sdd-helper-capabilities",
  "helper_name": "sdd-helper",
  "summary": "Machine-readable discovery payload for the JSON-first SDD helper CLI.",
  "discovery": {
    "bare_invocation": "returns_help_stub",
    "help_flag": "returns_help_stub",
    "canonical_introspection_command": "sdd-helper capabilities"
  },
  "conventions": {
    "stdout_success": "exactly_one_json_payload",
    "helper_errors": "sdd-helper-error_non_zero_exit",
    "domain_rejections": "structured_payload_exit_zero",
    "path_scope": "repo_relative_sdd_paths",
    "request_loading": [
      {
        "command": "apply",
        "option": "--request",
        "sources": [
          "file_path",
          "stdin_dash"
        ],
        "top_level_shape": "ApplyChangeSetArgs"
      },
      {
        "command": "author",
        "option": "--request",
        "sources": [
          "file_path",
          "stdin_dash"
        ],
        "top_level_shape": "ApplyAuthoringIntentArgs"
      },
      {
        "command": "undo",
        "option": "--request",
        "sources": [
          "file_path",
          "stdin_dash"
        ],
        "top_level_shape": "UndoChangeSetArgs"
      }
    ]
  },
  "commands": [
    {
      "name": "inspect",
      "invocation": "sdd-helper inspect <document_path>",
      "summary": "Return the inspect payload for a parseable repo-relative .sdd document.",
      "mutates_repo_state": "never",
      "arguments": [
        {
          "name": "document_path",
          "required": true,
          "description": "Repo-relative .sdd document path."
        }
      ],
      "options": [],
      "result_kind": "sdd-document-inspect",
      "constraints": [
        "The path must resolve to a repo-relative .sdd file.",
        "Parse-invalid documents return sdd-helper-error with code runtime_error."
      ],
      "subject_id": "helper.command.inspect",
      "input_shape_id": "shared.shape.inspect_document_args",
      "output_shape_id": "shared.shape.inspect_resource",
      "has_deep_introspection": true,
      "detail_modes": [
        "static"
      ]
    },
    {
      "name": "search",
      "invocation": "sdd-helper search --query <query> --node-type <node_type> --node-id <node_id> --under <path> --limit <count>",
      "summary": "Search compile-valid graph content across repo-local .sdd documents.",
      "mutates_repo_state": "never",
      "arguments": [],
      "options": [
        {
          "flag": "--query",
          "required": false,
          "value_name": "query",
          "description": "Case-insensitive substring query against node id, type, and name."
        },
        {
          "flag": "--node-type",
          "required": false,
          "value_name": "node_type",
          "description": "Exact node type filter."
        },
        {
          "flag": "--node-id",
          "required": false,
          "value_name": "node_id",
          "description": "Exact node id filter."
        },
        {
          "flag": "--under",
          "required": false,
          "value_name": "path",
          "description": "Repo-relative directory scope."
        },
        {
          "flag": "--limit",
          "required": false,
          "value_name": "count",
          "description": "Maximum number of matches to return."
        }
      ],
      "result_kind": "sdd-search-results",
      "constraints": [
        "At least one of --query, --node-type, or --node-id is required.",
        "Compile-invalid documents are skipped and surfaced through diagnostics."
      ],
      "subject_id": "helper.command.search",
      "input_shape_id": "shared.shape.search_graph_args",
      "output_shape_id": "shared.shape.search_graph_result",
      "has_deep_introspection": true,
      "detail_modes": [
        "static"
      ]
    },
    {
      "name": "create",
      "invocation": "sdd-helper create <document_path> [--version <version>]",
      "summary": "Create a new .sdd document through the authoring core.",
      "mutates_repo_state": "always",
      "arguments": [
        {
          "name": "document_path",
          "required": true,
          "description": "Repo-relative .sdd document path to create."
        }
      ],
      "options": [
        {
          "flag": "--version",
          "required": false,
          "value_name": "version",
          "description": "Document language version."
        }
      ],
      "result_kind": "sdd-create-document",
      "constraints": [
        "Create always bootstraps an empty document skeleton.",
        "Current implementation supports version 0.1."
      ],
      "subject_id": "helper.command.create",
      "input_shape_id": "shared.shape.create_document_args",
      "output_shape_id": "shared.shape.create_document_result",
      "has_deep_introspection": true,
      "detail_modes": [
        "static"
      ],
      "contract_purposes": [
        "request"
      ]
    },
    {
      "name": "apply",
      "invocation": "sdd-helper apply --request <file-or-stdin>",
      "summary": "Apply or dry-run a structured change set request.",
      "mutates_repo_state": "conditional",
      "arguments": [],
      "options": [
        {
          "flag": "--request",
          "required": true,
          "value_name": "file-or-stdin",
          "description": "JSON request file path or '-' for stdin."
        }
      ],
      "request_body": {
        "via_option": "--request",
        "top_level_shape": "ApplyChangeSetArgs",
        "source": "file_path_or_stdin_dash",
        "stdin_dash": {
          "read_mode": "read_all_stdin_until_eof",
          "empty_input_error": {
            "kind": "sdd-helper-error",
            "code": "invalid_json",
            "message": "Unexpected end of JSON input"
          }
        }
      },
      "result_kind": "sdd-change-set",
      "constraints": [
        "Dry-run is the default when the request omits mode.",
        "Rejected change sets stay structured and still exit zero."
      ],
      "subject_id": "helper.command.apply",
      "input_shape_id": "shared.shape.apply_change_set_args",
      "output_shape_id": "shared.shape.apply_change_set_result",
      "has_deep_introspection": true,
      "detail_modes": [
        "static",
        "bundle_resolved"
      ],
      "contract_purposes": [
        "request"
      ]
    },
    {
      "name": "author",
      "invocation": "sdd-helper author --request <file-or-stdin>",
      "summary": "Apply or dry-run high-level authoring intents through the shared authoring core.",
      "mutates_repo_state": "conditional",
      "arguments": [],
      "options": [
        {
          "flag": "--request",
          "required": true,
          "value_name": "file-or-stdin",
          "description": "JSON request file path or '-' for stdin."
        }
      ],
      "request_body": {
        "via_option": "--request",
        "top_level_shape": "ApplyAuthoringIntentArgs",
        "source": "file_path_or_stdin_dash",
        "stdin_dash": {
          "read_mode": "read_all_stdin_until_eof",
          "empty_input_error": {
            "kind": "sdd-helper-error",
            "code": "invalid_json",
            "message": "Unexpected end of JSON input"
          }
        }
      },
      "result_kind": "sdd-authoring-intent-result",
      "constraints": [
        "Dry-run is the default when the request omits mode.",
        "Committed results expose continuation-safe created_targets for the returned resulting_revision.",
        "Rejected authoring results stay structured and still exit zero."
      ],
      "subject_id": "helper.command.author",
      "input_shape_id": "shared.shape.apply_authoring_intent_args",
      "output_shape_id": "shared.shape.apply_authoring_intent_result",
      "has_deep_introspection": true,
      "detail_modes": [
        "static",
        "bundle_resolved"
      ],
      "contract_purposes": [
        "request"
      ]
    },
    {
      "name": "undo",
      "invocation": "sdd-helper undo --request <file-or-stdin>",
      "summary": "Undo a committed change set through a structured request.",
      "mutates_repo_state": "conditional",
      "arguments": [],
      "options": [
        {
          "flag": "--request",
          "required": true,
          "value_name": "file-or-stdin",
          "description": "JSON request file path or '-' for stdin."
        }
      ],
      "request_body": {
        "via_option": "--request",
        "top_level_shape": "UndoChangeSetArgs",
        "source": "file_path_or_stdin_dash",
        "stdin_dash": {
          "read_mode": "read_all_stdin_until_eof",
          "empty_input_error": {
            "kind": "sdd-helper-error",
            "code": "invalid_json",
            "message": "Unexpected end of JSON input"
          }
        }
      },
      "result_kind": "sdd-change-set",
      "constraints": [
        "Only committed and undo-eligible change sets can be undone.",
        "Rejected undo results stay structured and still exit zero."
      ],
      "subject_id": "helper.command.undo",
      "input_shape_id": "shared.shape.undo_change_set_args",
      "output_shape_id": "shared.shape.undo_change_set_result",
      "has_deep_introspection": true,
      "detail_modes": [
        "static",
        "bundle_resolved"
      ],
      "contract_purposes": [
        "request"
      ]
    },
    {
      "name": "validate",
      "invocation": "sdd-helper validate <document_path> --profile <profile_id>",
      "summary": "Return validation diagnostics for the current persisted document revision.",
      "mutates_repo_state": "never",
      "arguments": [
        {
          "name": "document_path",
          "required": true,
          "description": "Repo-relative .sdd document path."
        }
      ],
      "options": [
        {
          "flag": "--profile",
          "required": true,
          "value_name": "profile_id",
          "description": "Validation profile identifier."
        }
      ],
      "result_kind": "sdd-validation",
      "constraints": [
        "Validation reads the current on-disk LF-normalized document revision only.",
        "Use inline validate_profile on apply/author for pre-commit candidate feedback."
      ],
      "subject_id": "helper.command.validate",
      "input_shape_id": "shared.shape.validate_document_args",
      "output_shape_id": "shared.shape.validation_resource",
      "has_deep_introspection": true,
      "detail_modes": [
        "static",
        "bundle_resolved"
      ]
    },
    {
      "name": "project",
      "invocation": "sdd-helper project <document_path> --view <view_id>",
      "summary": "Return a structured projection for the current persisted document revision.",
      "mutates_repo_state": "never",
      "arguments": [
        {
          "name": "document_path",
          "required": true,
          "description": "Repo-relative .sdd document path."
        }
      ],
      "options": [
        {
          "flag": "--view",
          "required": true,
          "value_name": "view_id",
          "description": "Projection view identifier."
        }
      ],
      "result_kind": "sdd-projection",
      "constraints": [
        "Projection reads the current on-disk LF-normalized document revision only.",
        "Use inline projection_views on apply/author for pre-commit candidate feedback."
      ],
      "subject_id": "helper.command.project",
      "input_shape_id": "shared.shape.project_document_args",
      "output_shape_id": "shared.shape.projection_resource",
      "has_deep_introspection": true,
      "detail_modes": [
        "static",
        "bundle_resolved"
      ]
    },
    {
      "name": "preview",
      "invocation": "sdd-helper preview <document_path> --view <view_id> --profile <profile_id> --format <svg|png> [--backend <backend_id>]",
      "summary": "Render a preview artifact for a repo-relative .sdd document.",
      "mutates_repo_state": "never",
      "arguments": [
        {
          "name": "document_path",
          "required": true,
          "description": "Repo-relative .sdd document path."
        }
      ],
      "options": [
        {
          "flag": "--view",
          "required": true,
          "value_name": "view_id",
          "description": "Projection view identifier."
        },
        {
          "flag": "--profile",
          "required": true,
          "value_name": "profile_id",
          "description": "Validation/render profile identifier."
        },
        {
          "flag": "--format",
          "required": true,
          "value_name": "svg|png",
          "description": "Artifact format."
        },
        {
          "flag": "--backend",
          "required": false,
          "value_name": "backend_id",
          "description": "Optional preview backend override."
        }
      ],
      "result_kind": "sdd-preview",
      "constraints": [
        "If preview cannot produce an artifact, the helper returns runtime_error with stage-specific messaging and any available diagnostics.",
        "Successful preview responses materialize the rendered SVG or PNG to a helper-owned temp file and return artifact_path.",
        "artifact_path is an absolute, ephemeral local path under /tmp/unique-previews with a unique parent directory per preview invocation.",
        "Preview responses do not include inline SVG text or base64 PNG data."
      ],
      "subject_id": "helper.command.preview",
      "input_shape_id": "shared.shape.render_preview_args",
      "output_shape_id": "shared.shape.render_preview_result",
      "has_deep_introspection": true,
      "detail_modes": [
        "static",
        "bundle_resolved"
      ]
    },
    {
      "name": "git-status",
      "invocation": "sdd-helper git-status [<document_path> ...]",
      "summary": "Return narrow git status for SDD-scoped paths.",
      "mutates_repo_state": "never",
      "arguments": [
        {
          "name": "document_path",
          "required": false,
          "description": "Optional repo-relative .sdd document paths."
        }
      ],
      "options": [],
      "result_kind": "sdd-git-status",
      "constraints": [
        "The paths field is the exhaustive .sdd reporting scope.",
        "The status field is the sparse list of actual git status entries for that scope."
      ],
      "subject_id": "helper.command.git-status",
      "input_shape_id": "shared.shape.helper_git_status_args",
      "output_shape_id": "shared.shape.helper_git_status_result",
      "has_deep_introspection": true,
      "detail_modes": [
        "static"
      ]
    },
    {
      "name": "git-commit",
      "invocation": "sdd-helper git-commit --message <message> <document_path>...",
      "summary": "Create a narrow git commit for explicit SDD paths.",
      "mutates_repo_state": "always",
      "arguments": [
        {
          "name": "document_path",
          "required": true,
          "description": "One or more explicit repo-relative .sdd document paths."
        }
      ],
      "options": [
        {
          "flag": "--message",
          "required": true,
          "value_name": "message",
          "description": "Commit message."
        }
      ],
      "result_kind": "sdd-git-commit",
      "constraints": [
        "At least one explicit .sdd path is required.",
        "Only the supplied .sdd paths and any paired rename sources needed to complete those renames are staged and committed."
      ],
      "subject_id": "helper.command.git-commit",
      "input_shape_id": "shared.shape.helper_git_commit_args",
      "output_shape_id": "shared.shape.helper_git_commit_result",
      "has_deep_introspection": true,
      "detail_modes": [
        "static"
      ]
    },
    {
      "name": "contract",
      "invocation": "sdd-helper contract <subject_id> [--purpose request] [--resolve bundle]",
      "summary": "Return full shared contract detail for one helper subject.",
      "mutates_repo_state": "never",
      "arguments": [
        {
          "name": "subject_id",
          "required": true,
          "description": "Shared contract subject id."
        }
      ],
      "options": [
        {
          "flag": "--purpose",
          "required": false,
          "value_name": "purpose",
          "description": "Optional payload purpose. Supported value: request."
        },
        {
          "flag": "--resolve",
          "required": false,
          "value_name": "mode",
          "description": "Optional resolution mode. Supported value: bundle."
        }
      ],
      "result_kind": "sdd-contract-subject-detail",
      "constraints": [
        "The subject_id must match a subject exposed through sdd-helper capabilities.",
        "Static detail is the default; use --purpose request for request-composition payloads on subjects that declare it.",
        "Use --resolve bundle to expand bundle-owned allowed values on demand."
      ],
      "subject_id": "helper.command.contract",
      "input_shape_id": "shared.shape.helper_contract_args",
      "output_shape_id": "shared.shape.contract_subject_detail",
      "has_deep_introspection": true,
      "detail_modes": [
        "static",
        "bundle_resolved"
      ]
    },
    {
      "name": "capabilities",
      "invocation": "sdd-helper capabilities",
      "summary": "Return the full machine-readable helper capability manifest.",
      "mutates_repo_state": "never",
      "arguments": [],
      "options": [],
      "result_kind": "sdd-helper-capabilities",
      "constraints": [
        "This payload is static and does not require repo inspection or bundle loading."
      ],
      "subject_id": "helper.command.capabilities",
      "output_shape_id": "shared.shape.helper_capabilities_result",
      "has_deep_introspection": true,
      "detail_modes": [
        "static"
      ]
    }
  ]
}

Success
Ran /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh contract helper.command.create --purpose request
$ /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh contract helper.command.create --purpose request

{
  "kind": "sdd-contract-subject-detail",
  "subject": {
    "subject_id": "helper.command.create",
    "surface_kind": "helper_command",
    "surface_name": "create",
    "summary": "Create a new .sdd document through the authoring core.",
    "stability": "stable",
    "mutates_repo_state": "always",
    "input_shape_id": "shared.shape.create_document_args",
    "output_shape_id": "shared.shape.create_document_result",
    "detail_modes": [
      "static"
    ],
    "contract_purposes": [
      "request"
    ],
    "has_deep_introspection": true
  },
  "invocation": "sdd-helper create <document_path> [--version <version>]",
  "input_shape": {
    "shape_id": "shared.shape.create_document_args",
    "summary": "Create-document request payload.",
    "schema_format": "json_schema_2020_12",
    "schema": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string"
        },
        "version": {
          "type": "string",
          "enum": [
            "0.1"
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "path"
      ]
    },
    "stability": "stable"
  },
  "constraints": [],
  "bindings": [],
  "continuation": [
    {
      "continuation_id": "shared.continuation.create_document.bootstrap_revision",
      "applies_to_subject_id": "helper.command.create",
      "kind": "create_revision_is_bootstrap_continuation_surface",
      "summary": "The revision returned by create is the correct next base_revision for follow-on mutations."
    },
    {
      "continuation_id": "shared.continuation.create_document.inspect_may_fail_on_empty_bootstrap",
      "applies_to_subject_id": "helper.command.create",
      "kind": "inspect_may_fail_on_empty_bootstrap",
      "summary": "Immediate inspect after create may fail because the empty bootstrap document can still be parse-invalid."
    }
  ],
  "resolution": {
    "mode": "static"
  }
}

Success
Ran /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh contract helper.command.author --purpose request --resolve bundle
$ /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh contract helper.command.author --purpose request --resolve bundle

{
  "kind": "sdd-contract-subject-detail",
  "subject": {
    "subject_id": "helper.command.author",
    "surface_kind": "helper_command",
    "surface_name": "author",
    "summary": "Apply or dry-run high-level authoring intents through the shared authoring core.",
    "stability": "stable",
    "mutates_repo_state": "conditional",
    "input_shape_id": "shared.shape.apply_authoring_intent_args",
    "output_shape_id": "shared.shape.apply_authoring_intent_result",
    "detail_modes": [
      "static",
      "bundle_resolved"
    ],
    "contract_purposes": [
      "request"
    ],
    "has_deep_introspection": true
  },
  "input_shape": {
    "shape_id": "shared.shape.apply_authoring_intent_args",
    "summary": "High-level authoring intent request payload.",
    "schema_format": "json_schema_2020_12",
    "schema": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string"
        },
        "base_revision": {
          "type": "string"
        },
        "mode": {
          "type": "string",
          "enum": [
            "dry_run",
            "commit"
          ]
        },
        "intents": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/insert_node_scaffold_intent",
            "$defs": {
              "node_selector": {
                "type": "object",
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "node_id"
                    ]
                  },
                  "node_id": {
                    "type": "string"
                  }
                },
                "additionalProperties": false,
                "required": [
                  "kind",
                  "node_id"
                ]
              },
              "node_ref": {
                "oneOf": [
                  {
                    "type": "object",
                    "properties": {
                      "by": {
                        "type": "string",
                        "enum": [
                          "handle"
                        ]
                      },
                      "handle": {
                        "type": "string"
                      }
                    },
                    "additionalProperties": false,
                    "required": [
                      "by",
                      "handle"
                    ]
                  },
                  {
                    "type": "object",
                    "properties": {
                      "by": {
                        "type": "string",
                        "enum": [
                          "local_id"
                        ]
                      },
                      "local_id": {
                        "type": "string"
                      }
                    },
                    "additionalProperties": false,
                    "required": [
                      "by",
                      "local_id"
                    ]
                  },
                  {
                    "type": "object",
                    "properties": {
                      "by": {
                        "type": "string",
                        "enum": [
                          "selector"
                        ]
                      },
                      "selector": {
                        "type": "object",
                        "properties": {
                          "kind": {
                            "type": "string",
                            "enum": [
                              "node_id"
                            ]
                          },
                          "node_id": {
                            "type": "string"
                          }
                        },
                        "additionalProperties": false,
                        "required": [
                          "kind",
                          "node_id"
                        ]
                      }
                    },
                    "additionalProperties": false,
                    "required": [
                      "by",
                      "selector"
                    ]
                  }
                ]
              },
              "scaffold_prop": {
                "type": "object",
                "properties": {
                  "key": {
                    "type": "string"
                  },
                  "value_kind": {
                    "type": "string",
                    "enum": [
                      "quoted_string",
                      "bare_value"
                    ]
                  },
                  "raw_value": {
                    "type": "string"
                  }
                },
                "additionalProperties": false,
                "required": [
                  "key",
                  "value_kind",
                  "raw_value"
                ]
              },
              "scaffold_edge": {
                "type": "object",
                "properties": {
                  "local_id": {
                    "type": "string"
                  },
                  "rel_type": {
                    "type": "string"
                  },
                  "to": {
                    "type": "string"
                  },
                  "to_name": {
                    "type": "string"
                  },
                  "event": {
                    "type": "string"
                  },
                  "guard": {
                    "type": "string"
                  },
                  "effect": {
                    "type": "string"
                  },
                  "props": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": {
                      "type": "string"
                    }
                  },
                  "placement": {
                    "type": "object",
                    "properties": {
                      "mode": {
                        "type": "string",
                        "enum": [
                          "first",
                          "last"
                        ]
                      }
                    },
                    "additionalProperties": false,
                    "required": [
                      "mode"
                    ]
                  }
                },
                "additionalProperties": false,
                "required": [
                  "local_id",
                  "rel_type",
                  "to"
                ]
              },
              "insert_node_scaffold_intent": {
                "type": "object",
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "insert_node_scaffold"
                    ]
                  },
                  "local_id": {
                    "type": "string"
                  },
                  "parent": {
                    "$ref": "#/$defs/node_ref"
                  },
                  "placement": {
                    "type": "object",
                    "properties": {
                      "mode": {
                        "type": "string",
                        "enum": [
                          "before",
                          "after",
                          "first",
                          "last"
                        ]
                      },
                      "anchor": {
                        "oneOf": [
                          {
                            "type": "object",
                            "properties": {
                              "by": {
                                "type": "string",
                                "enum": [
                                  "handle"
                                ]
                              },
                              "handle": {
                                "type": "string"
                              }
                            },
                            "additionalProperties": false,
                            "required": [
                              "by",
                              "handle"
                            ]
                          },
                          {
                            "type": "object",
                            "properties": {
                              "by": {
                                "type": "string",
                                "enum": [
                                  "local_id"
                                ]
                              },
                              "local_id": {
                                "type": "string"
                              }
                            },
                            "additionalProperties": false,
                            "required": [
                              "by",
                              "local_id"
                            ]
                          },
                          {
                            "type": "object",
                            "properties": {
                              "by": {
                                "type": "string",
                                "enum": [
                                  "selector"
                                ]
                              },
                              "selector": {
                                "type": "object",
                                "properties": {
                                  "kind": {
                                    "type": "string",
                                    "enum": [
                                      "node_id"
                                    ]
                                  },
                                  "node_id": {
                                    "type": "string"
                                  }
                                },
                                "additionalProperties": false,
                                "required": [
                                  "kind",
                                  "node_id"
                                ]
                              }
                            },
                            "additionalProperties": false,
                            "required": [
                              "by",
                              "selector"
                            ]
                          }
                        ]
                      }
                    },
                    "additionalProperties": false,
                    "required": [
                      "mode"
                    ]
                  },
                  "node": {
                    "type": "object",
                    "properties": {
                      "node_type": {
                        "type": "string"
                      },
                      "node_id": {
                        "type": "string"
                      },
                      "name": {
                        "type": "string"
                      },
                      "props": {
                        "type": "array",
                        "items": {
                          "$ref": "#/$defs/scaffold_prop"
                        }
                      },
                      "edges": {
                        "type": "array",
                        "items": {
                          "$ref": "#/$defs/scaffold_edge"
                        }
                      },
                      "children": {
                        "type": "array",
                        "items": {
                          "$ref": "#/$defs/insert_node_scaffold_intent"
                        }
                      }
                    },
                    "additionalProperties": false,
                    "required": [
                      "node_type",
                      "node_id",
                      "name"
                    ]
                  }
                },
                "additionalProperties": false,
                "required": [
                  "kind",
                  "local_id",
                  "placement",
                  "node"
                ]
              }
            }
          }
        },
        "validate_profile": {
          "type": "string"
        },
        "projection_views": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "path",
        "base_revision",
        "intents"
      ]
    },
    "stability": "stable"
  },
  "request_body": {
    "via_option": "--request",
    "top_level_shape": "ApplyAuthoringIntentArgs",
    "source": "file_path_or_stdin_dash",
    "stdin_dash": {
      "read_mode": "read_all_stdin_until_eof",
      "empty_input_error": {
        "kind": "sdd-helper-error",
        "code": "invalid_json",
        "message": "Unexpected end of JSON input"
      }
    }
  },
  "constraints": [
    {
      "constraint_id": "shared.constraint.authoring_intent.anchor_required_for_before_after",
      "applies_to_shape_id": "shared.shape.apply_authoring_intent_args",
      "applies_to_json_pointers": [
        "/intents/*/placement/anchor"
      ],
      "kind": "required_if",
      "parameters": {
        "if": {
          "pointer": "/intents/*/placement/mode",
          "equals_one_of": [
            "before",
            "after"
          ]
        }
      },
      "summary": "Authoring placement.anchor is required when placement.mode is before or after."
    },
    {
      "constraint_id": "shared.constraint.authoring_intent.anchor_forbidden_for_first_last",
      "applies_to_shape_id": "shared.shape.apply_authoring_intent_args",
      "applies_to_json_pointers": [
        "/intents/*/placement/anchor"
      ],
      "kind": "forbidden_if",
      "parameters": {
        "if": {
          "pointer": "/intents/*/placement/mode",
          "equals_one_of": [
            "first",
            "last"
          ]
        }
      },
      "summary": "Authoring placement.anchor must be omitted when placement.mode is first or last."
    },
    {
      "constraint_id": "shared.constraint.authoring_intent.local_id_unique_within_request",
      "applies_to_shape_id": "shared.shape.apply_authoring_intent_args",
      "applies_to_json_pointers": [
        "/intents/*/local_id",
        "/intents/*/node/edges/*/local_id"
      ],
      "kind": "unique_within_request",
      "parameters": {
        "scope": "entire_request"
      },
      "summary": "All scaffold and scaffold-edge local_id values must be unique within one authoring request."
    },
    {
      "constraint_id": "shared.constraint.authoring_intent.local_id_references_must_point_earlier",
      "applies_to_shape_id": "shared.shape.apply_authoring_intent_args",
      "applies_to_json_pointers": [
        "/intents/*/parent",
        "/intents/*/placement/anchor"
      ],
      "kind": "must_reference_earlier_local_id",
      "parameters": {
        "local_id_reference_paths": [
          "/intents/*/parent",
          "/intents/*/placement/anchor"
        ],
        "resolution_scope": "earlier_created_request_nodes"
      },
      "summary": "Authoring local_id references must resolve to nodes created earlier in the same request."
    },
    {
      "constraint_id": "shared.constraint.apply_authoring_intent.handles_are_revision_bound",
      "applies_to_shape_id": "shared.shape.apply_authoring_intent_args",
      "applies_to_json_pointers": [
        "/intents/*/parent",
        "/intents/*/placement/anchor"
      ],
      "kind": "same_revision_handle",
      "parameters": {
        "base_revision_pointer": "/base_revision",
        "reference_mode": "by_handle"
      },
      "summary": "Handle-based authoring references are valid only against the supplied base_revision."
    }
  ],
  "bindings": [],
  "continuation": [],
  "authoring_format_card": {
    "card_id": "sdd.v0_1.author_json_quick_format",
    "summary": "Compact bundle-derived formatting guidance for helper author JSON.",
    "source": "bundle/v0.1/core/syntax.yaml",
    "lines": [
      "local_id is a request-only helper id; use snake_case. It is not an SDD node id.",
      "node.node_id, edge.to, and selector.node_id use SDD node IDs: ^[A-Z]{1,3}-[0-9]{3,}([a-z][a-z0-9]*)?$; examples P-001, J-010, SA-010, ST-010a.",
      "node.node_type and edge.rel_type use bundle vocabulary tokens, not prose labels.",
      "event/effect are raw SDD atoms: id_pattern, identifier_pattern, quoted_string.",
      "For prose event/effect text in JSON, include SDD quotes, e.g. \"effect\": \"\\\"side effect\\\"\".",
      "guard is raw text inside {...}; do not include } or a newline.",
      "property values should use value_kind quoted_string for prose; bare_value is for simple tokens."
    ],
    "field_hints": [
      {
        "hint_id": "sdd.v0_1.node_id",
        "applies_to_shape_id": "shared.shape.apply_authoring_intent_args",
        "applies_to_json_pointers": [
          "/intents/*/node/node_id",
          "/intents/*/node/edges/*/to",
          "/intents/*/parent/selector/node_id",
          "/intents/*/placement/anchor/selector/node_id"
        ],
        "source": "bundle/v0.1/core/syntax.yaml#/lexical/id_pattern",
        "accepted_pattern": "^[A-Z]{1,3}-[0-9]{3,}([a-z][a-z0-9]*)?$",
        "examples": [
          "P-001",
          "J-010",
          "SA-010",
          "ST-010a"
        ],
        "concise": "Use capital prefix, dash, at least three digits, optional lowercase suffix."
      },
      {
        "hint_id": "sdd.v0_1.event_atom",
        "applies_to_shape_id": "shared.shape.apply_authoring_intent_args",
        "applies_to_json_pointers": [
          "/intents/*/node/edges/*/event"
        ],
        "source": "bundle/v0.1/core/syntax.yaml#/atoms/event_atom",
        "accepted_forms": [
          "id_pattern",
          "identifier_pattern",
          "quoted_string"
        ],
        "examples": [
          "E-010",
          "ClickReview",
          "\"User clicked review\""
        ],
        "json_examples": [
          {
            "json": "E-010",
            "renders": "[E-010]"
          },
          {
            "json": "ClickReview",
            "renders": "[ClickReview]"
          },
          {
            "json": "\"User clicked review\"",
            "renders": "[\"User clicked review\"]"
          }
        ],
        "concise": "This is raw SDD source text. Prose needs embedded SDD quotes."
      },
      {
        "hint_id": "sdd.v0_1.effect_atom",
        "applies_to_shape_id": "shared.shape.apply_authoring_intent_args",
        "applies_to_json_pointers": [
          "/intents/*/node/edges/*/effect"
        ],
        "source": "bundle/v0.1/core/syntax.yaml#/atoms/effect_atom",
        "accepted_forms": [
          "id_pattern",
          "identifier_pattern",
          "quoted_string"
        ],
        "examples": [
          "SA-010",
          "emitMetric",
          "\"side effect\""
        ],
        "json_examples": [
          {
            "json": "SA-010",
            "renders": "/ SA-010"
          },
          {
            "json": "emitMetric",
            "renders": "/ emitMetric"
          },
          {
            "json": "\"side effect\"",
            "renders": "/ \"side effect\""
          }
        ],
        "concise": "This is raw SDD source text. Prose needs embedded SDD quotes."
      }
    ]
  },
  "resolution": {
    "mode": "bundle_resolved",
    "bundle_name": "sdd-text-spec-bundle",
    "bundle_version": "0.1"
  }
}

Success
The authoring contract gives the ID and request rules, but the semantic vocabulary still needs to come from the bundle. I’m reading the bundle view/profile and relation definitions now so the IA diagram uses bundle-owned terms.


Explored 3 files, 1 search
Searched for place|navig|ia_place_map|profile|view in core
Read vocab.yaml
Read views.yaml
Read contracts.yaml
The IA view is ia_place_map; it includes Place nodes and NAVIGATES_TO edges. I’m creating a small root-level SDD, then I’ll dry-run the scaffold before committing it through the helper.

Ran /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh create peter_paul_mary.sdd --version 0.1
$ /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh create peter_paul_mary.sdd --version 0.1

{
  "kind": "sdd-create-document",
  "path": "peter_paul_mary.sdd",
  "uri": "sdd://document/peter_paul_mary.sdd",
  "revision": "rev_ce0346709efe3ad4b016e73afa4a61e0782b68562b0d4cd0e90c339b6c1590f8",
  "change_set": {
    "kind": "sdd-change-set",
    "change_set_id": "chg_e04e9833-9568-4b3c-9353-af4e11851a66",
    "path": "peter_paul_mary.sdd",
    "origin": "create_document",
    "document_effect": "created",
    "base_revision": null,
    "mode": "commit",
    "status": "applied",
    "undo_eligible": true,
    "operations": [],
    "summary": {
      "node_insertions": [],
      "node_deletions": [],
      "node_renames": [],
      "property_changes": [],
      "edge_insertions": [],
      "edge_deletions": [],
      "ordering_changes": []
    },
    "diagnostics": [
      {
        "stage": "parse",
        "code": "parse.minimum_top_level_blocks",
        "severity": "error",
        "message": "Expected at least 1 top-level node block",
        "file": "peter_paul_mary.sdd",
        "span": {
          "line": 1,
          "column": 1,
          "endLine": 2,
          "endColumn": 1,
          "startOffset": 0,
          "endOffset": 13
        }
      }
    ],
    "resulting_revision": "rev_ce0346709efe3ad4b016e73afa4a61e0782b68562b0d4cd0e90c339b6c1590f8"
  },
  "assessment": {
    "kind": "sdd-authoring-outcome-assessment",
    "outcome": "review_required",
    "layer": "success",
    "can_commit": false,
    "can_render": false,
    "should_stop": false,
    "next_action": "Author initial content from the returned create revision before inspecting or rendering.",
    "blocking_diagnostics": [],
    "summary": "The document was created as an empty bootstrap and needs initial authoring content."
  }
}

Success
The create step committed the expected empty bootstrap revision, which is parse-invalid until content is added. I’m writing the authoring request now with three Place nodes and two NAVIGATES_TO edges from Peter.


Created 1 file, ran 1 command
Created
.tmp_peter_paul_mary_author.json
+61
-0
Ran TMPDIR=/tmp /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh author --request .tmp_peter_paul_mary_author.json
$ TMPDIR=/tmp /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh author --request .tmp_peter_paul_mary_author.json

{
  "kind": "sdd-authoring-intent-result",
  "path": "peter_paul_mary.sdd",
  "base_revision": "rev_ce0346709efe3ad4b016e73afa4a61e0782b68562b0d4cd0e90c339b6c1590f8",
  "resulting_revision": "rev_7707085f1e147728c4794a93fd7b81833ec31acc17e6ab69cde83526d4f3ddd5",
  "mode": "dry_run",
  "status": "applied",
  "intents": [
    {
      "kind": "insert_node_scaffold",
      "local_id": "peter_place",
      "placement": {
        "mode": "last"
      },
      "node": {
        "node_type": "Place",
        "node_id": "P-001",
        "name": "Peter",
        "edges": [
          {
            "local_id": "peter_to_paul",
            "rel_type": "NAVIGATES_TO",
            "to": "P-002",
            "to_name": "Paul"
          },
          {
            "local_id": "peter_to_mary",
            "rel_type": "NAVIGATES_TO",
            "to": "P-003",
            "to_name": "Mary"
          }
        ]
      }
    },
    {
      "kind": "insert_node_scaffold",
      "local_id": "paul_place",
      "placement": {
        "mode": "last"
      },
      "node": {
        "node_type": "Place",
        "node_id": "P-002",
        "name": "Paul"
      }
    },
    {
      "kind": "insert_node_scaffold",
      "local_id": "mary_place",
      "placement": {
        "mode": "last"
      },
      "node": {
        "node_type": "Place",
        "node_id": "P-003",
        "name": "Mary"
      }
    }
  ],
  "change_set": {
    "kind": "sdd-change-set",
    "change_set_id": "chg_e110081f-f893-4d95-a2dc-4e130c93be81",
    "path": "peter_paul_mary.sdd",
    "origin": "apply_authoring_intent",
    "document_effect": "updated",
    "base_revision": "rev_ce0346709efe3ad4b016e73afa4a61e0782b68562b0d4cd0e90c339b6c1590f8",
    "mode": "dry_run",
    "status": "applied",
    "undo_eligible": false,
    "operations": [
      {
        "kind": "insert_node_block",
        "node_type": "Place",
        "node_id": "P-001",
        "name": "Peter",
        "placement": {
          "mode": "last",
          "stream": "top_level"
        }
      },
      {
        "kind": "insert_edge_line",
        "parent_handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564",
        "rel_type": "NAVIGATES_TO",
        "to": "P-002",
        "to_name": "Paul"
      },
      {
        "kind": "insert_edge_line",
        "parent_handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564",
        "rel_type": "NAVIGATES_TO",
        "to": "P-003",
        "to_name": "Mary"
      },
      {
        "kind": "insert_node_block",
        "node_type": "Place",
        "node_id": "P-002",
        "name": "Paul",
        "placement": {
          "mode": "last",
          "stream": "top_level"
        }
      },
      {
        "kind": "insert_node_block",
        "node_type": "Place",
        "node_id": "P-003",
        "name": "Mary",
        "placement": {
          "mode": "last",
          "stream": "top_level"
        }
      }
    ],
    "summary": {
      "node_insertions": [
        {
          "handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564",
          "node_id": "P-001",
          "node_type": "Place"
        },
        {
          "handle": "hdl_e98cadac4d82a032cb731a47ad0bfe030c2b12e96d514309a24143f50bf081ca",
          "node_id": "P-002",
          "node_type": "Place"
        },
        {
          "handle": "hdl_43956689478c3a590b5e60830ef6df87c15ba0a721847989bca930672dd2c0ab",
          "node_id": "P-003",
          "node_type": "Place"
        }
      ],
      "node_deletions": [],
      "node_renames": [],
      "property_changes": [],
      "edge_insertions": [
        {
          "handle": "hdl_5b9be5a5dbf62f0124c16840ebaa38c2f971e0d1a2520bea7b9a9ff0192e722c",
          "parent_handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564",
          "rel_type": "NAVIGATES_TO",
          "to": "P-002"
        },
        {
          "handle": "hdl_26fd91a2fcc1cf35876884b287edf641f15bbf344744458bbbe7067ff30a1f51",
          "parent_handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564",
          "rel_type": "NAVIGATES_TO",
          "to": "P-003"
        }
      ],
      "edge_deletions": [],
      "ordering_changes": []
    },
    "diagnostics": [],
    "projection_results": [
      {
        "view_id": "ia_place_map",
        "projection": {
          "schema": "sdd-text-view-projection",
          "version": "0.1",
          "view_id": "ia_place_map",
          "source_example": "peter_paul_mary",
          "nodes": [
            {
              "id": "P-001",
              "type": "Place",
              "name": "Peter"
            },
            {
              "id": "P-002",
              "type": "Place",
              "name": "Paul"
            },
            {
              "id": "P-003",
              "type": "Place",
              "name": "Mary"
            }
          ],
          "edges": [
            {
              "from": "P-001",
              "type": "NAVIGATES_TO",
              "to": "P-002"
            },
            {
              "from": "P-001",
              "type": "NAVIGATES_TO",
              "to": "P-003"
            }
          ],
          "derived": {
            "node_annotations": [],
            "edge_annotations": [],
            "node_groups": [],
            "view_metadata": {}
          },
          "omissions": [],
          "notes": [
            "Hierarchy for IA view is driven by CONTAINS."
          ]
        },
        "diagnostics": []
      }
    ],
    "resulting_revision": "rev_7707085f1e147728c4794a93fd7b81833ec31acc17e6ab69cde83526d4f3ddd5"
  },
  "created_targets": [
    {
      "local_id": "peter_place",
      "kind": "node",
      "handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564"
    },
    {
      "local_id": "peter_to_paul",
      "kind": "edge",
      "handle": "hdl_5b9be5a5dbf62f0124c16840ebaa38c2f971e0d1a2520bea7b9a9ff0192e722c",
      "parent_local_id": "peter_place"
    },
    {
      "local_id": "peter_to_mary",
      "kind": "edge",
      "handle": "hdl_26fd91a2fcc1cf35876884b287edf641f15bbf344744458bbbe7067ff30a1f51",
      "parent_local_id": "peter_place"
    },
    {
      "local_id": "paul_place",
      "kind": "node",
      "handle": "hdl_e98cadac4d82a032cb731a47ad0bfe030c2b12e96d514309a24143f50bf081ca"
    },
    {
      "local_id": "mary_place",
      "kind": "node",
      "handle": "hdl_43956689478c3a590b5e60830ef6df87c15ba0a721847989bca930672dd2c0ab"
    }
  ],
  "diagnostics": [],
  "assessment": {
    "kind": "sdd-authoring-outcome-assessment",
    "outcome": "acceptable",
    "layer": "success",
    "can_commit": true,
    "can_render": false,
    "should_stop": false,
    "next_action": "Review the dry-run result, then commit the same candidate if acceptable.",
    "blocking_diagnostics": [],
    "summary": "The dry-run change set is clean and commit-eligible."
  }
}

Success
The dry-run is clean and commit-eligible. I’m switching only the request mode to commit, then I’ll validate and render from persisted state.


Edited 1 file, ran 1 command
Edited
.tmp_peter_paul_mary_author.json
+1
-1
Ran TMPDIR=/tmp /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh author --request .tmp_peter_paul_mary_author.json
$ TMPDIR=/tmp /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh author --request .tmp_peter_paul_mary_author.json

{
  "kind": "sdd-authoring-intent-result",
  "path": "peter_paul_mary.sdd",
  "base_revision": "rev_ce0346709efe3ad4b016e73afa4a61e0782b68562b0d4cd0e90c339b6c1590f8",
  "resulting_revision": "rev_7707085f1e147728c4794a93fd7b81833ec31acc17e6ab69cde83526d4f3ddd5",
  "mode": "commit",
  "status": "applied",
  "intents": [
    {
      "kind": "insert_node_scaffold",
      "local_id": "peter_place",
      "placement": {
        "mode": "last"
      },
      "node": {
        "node_type": "Place",
        "node_id": "P-001",
        "name": "Peter",
        "edges": [
          {
            "local_id": "peter_to_paul",
            "rel_type": "NAVIGATES_TO",
            "to": "P-002",
            "to_name": "Paul"
          },
          {
            "local_id": "peter_to_mary",
            "rel_type": "NAVIGATES_TO",
            "to": "P-003",
            "to_name": "Mary"
          }
        ]
      }
    },
    {
      "kind": "insert_node_scaffold",
      "local_id": "paul_place",
      "placement": {
        "mode": "last"
      },
      "node": {
        "node_type": "Place",
        "node_id": "P-002",
        "name": "Paul"
      }
    },
    {
      "kind": "insert_node_scaffold",
      "local_id": "mary_place",
      "placement": {
        "mode": "last"
      },
      "node": {
        "node_type": "Place",
        "node_id": "P-003",
        "name": "Mary"
      }
    }
  ],
  "change_set": {
    "kind": "sdd-change-set",
    "change_set_id": "chg_b11c37bb-2757-4727-944d-dbd39dc83859",
    "path": "peter_paul_mary.sdd",
    "origin": "apply_authoring_intent",
    "document_effect": "updated",
    "base_revision": "rev_ce0346709efe3ad4b016e73afa4a61e0782b68562b0d4cd0e90c339b6c1590f8",
    "mode": "commit",
    "status": "applied",
    "undo_eligible": true,
    "operations": [
      {
        "kind": "insert_node_block",
        "node_type": "Place",
        "node_id": "P-001",
        "name": "Peter",
        "placement": {
          "mode": "last",
          "stream": "top_level"
        }
      },
      {
        "kind": "insert_edge_line",
        "parent_handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564",
        "rel_type": "NAVIGATES_TO",
        "to": "P-002",
        "to_name": "Paul"
      },
      {
        "kind": "insert_edge_line",
        "parent_handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564",
        "rel_type": "NAVIGATES_TO",
        "to": "P-003",
        "to_name": "Mary"
      },
      {
        "kind": "insert_node_block",
        "node_type": "Place",
        "node_id": "P-002",
        "name": "Paul",
        "placement": {
          "mode": "last",
          "stream": "top_level"
        }
      },
      {
        "kind": "insert_node_block",
        "node_type": "Place",
        "node_id": "P-003",
        "name": "Mary",
        "placement": {
          "mode": "last",
          "stream": "top_level"
        }
      }
    ],
    "summary": {
      "node_insertions": [
        {
          "handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564",
          "node_id": "P-001",
          "node_type": "Place"
        },
        {
          "handle": "hdl_e98cadac4d82a032cb731a47ad0bfe030c2b12e96d514309a24143f50bf081ca",
          "node_id": "P-002",
          "node_type": "Place"
        },
        {
          "handle": "hdl_43956689478c3a590b5e60830ef6df87c15ba0a721847989bca930672dd2c0ab",
          "node_id": "P-003",
          "node_type": "Place"
        }
      ],
      "node_deletions": [],
      "node_renames": [],
      "property_changes": [],
      "edge_insertions": [
        {
          "handle": "hdl_5b9be5a5dbf62f0124c16840ebaa38c2f971e0d1a2520bea7b9a9ff0192e722c",
          "parent_handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564",
          "rel_type": "NAVIGATES_TO",
          "to": "P-002"
        },
        {
          "handle": "hdl_26fd91a2fcc1cf35876884b287edf641f15bbf344744458bbbe7067ff30a1f51",
          "parent_handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564",
          "rel_type": "NAVIGATES_TO",
          "to": "P-003"
        }
      ],
      "edge_deletions": [],
      "ordering_changes": []
    },
    "diagnostics": [],
    "projection_results": [
      {
        "view_id": "ia_place_map",
        "projection": {
          "schema": "sdd-text-view-projection",
          "version": "0.1",
          "view_id": "ia_place_map",
          "source_example": "peter_paul_mary",
          "nodes": [
            {
              "id": "P-001",
              "type": "Place",
              "name": "Peter"
            },
            {
              "id": "P-002",
              "type": "Place",
              "name": "Paul"
            },
            {
              "id": "P-003",
              "type": "Place",
              "name": "Mary"
            }
          ],
          "edges": [
            {
              "from": "P-001",
              "type": "NAVIGATES_TO",
              "to": "P-002"
            },
            {
              "from": "P-001",
              "type": "NAVIGATES_TO",
              "to": "P-003"
            }
          ],
          "derived": {
            "node_annotations": [],
            "edge_annotations": [],
            "node_groups": [],
            "view_metadata": {}
          },
          "omissions": [],
          "notes": [
            "Hierarchy for IA view is driven by CONTAINS."
          ]
        },
        "diagnostics": []
      }
    ],
    "resulting_revision": "rev_7707085f1e147728c4794a93fd7b81833ec31acc17e6ab69cde83526d4f3ddd5"
  },
  "created_targets": [
    {
      "local_id": "peter_place",
      "kind": "node",
      "handle": "hdl_6e72ac5137ea36696b215a9ca1e937b9c5361c630bb2835577720ea10781f564"
    },
    {
      "local_id": "peter_to_paul",
      "kind": "edge",
      "handle": "hdl_5b9be5a5dbf62f0124c16840ebaa38c2f971e0d1a2520bea7b9a9ff0192e722c",
      "parent_local_id": "peter_place"
    },
    {
      "local_id": "peter_to_mary",
      "kind": "edge",
      "handle": "hdl_26fd91a2fcc1cf35876884b287edf641f15bbf344744458bbbe7067ff30a1f51",
      "parent_local_id": "peter_place"
    },
    {
      "local_id": "paul_place",
      "kind": "node",
      "handle": "hdl_e98cadac4d82a032cb731a47ad0bfe030c2b12e96d514309a24143f50bf081ca"
    },
    {
      "local_id": "mary_place",
      "kind": "node",
      "handle": "hdl_43956689478c3a590b5e60830ef6df87c15ba0a721847989bca930672dd2c0ab"
    }
  ],
  "diagnostics": [],
  "assessment": {
    "kind": "sdd-authoring-outcome-assessment",
    "outcome": "acceptable",
    "layer": "success",
    "can_commit": false,
    "can_render": true,
    "should_stop": false,
    "next_action": "Validate or render the committed document state as needed.",
    "blocking_diagnostics": [],
    "summary": "The committed change set is clean and render-eligible."
  }
}

Success
The committed SDD is render-eligible according to the helper assessment. I’m validating and projecting the persisted document, then I’ll generate the saved IA artifact beside the SDD.


Ran 4 commands
Ran TMPDIR=/tmp /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh validate peter_paul_mary.sdd --profile simple
$ TMPDIR=/tmp /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh validate peter_paul_mary.sdd --profile simple

{
  "kind": "sdd-validation",
  "uri": "sdd://document/peter_paul_mary.sdd/validation/simple",
  "path": "peter_paul_mary.sdd",
  "revision": "rev_7707085f1e147728c4794a93fd7b81833ec31acc17e6ab69cde83526d4f3ddd5",
  "profile_id": "simple",
  "report": {
    "error_count": 0,
    "warning_count": 0
  },
  "diagnostics": [],
  "assessment": {
    "kind": "sdd-authoring-outcome-assessment",
    "outcome": "acceptable",
    "layer": "success",
    "can_commit": false,
    "can_render": true,
    "should_stop": false,
    "next_action": "Render the persisted document state if a visual artifact is needed.",
    "blocking_diagnostics": [],
    "summary": "The persisted document state passed validation and is render-eligible."
  }
}

Success
Ran TMPDIR=/tmp /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh project peter_paul_mary.sdd --view ia_place_map
$ TMPDIR=/tmp /home/knut/projects/sdd/skills/sdd-skill/scripts/run_helper.sh project peter_paul_mary.sdd --view ia_place_map

{
  "kind": "sdd-projection",
  "uri": "sdd://document/peter_paul_mary.sdd/projection/ia_place_map",
  "path": "peter_paul_mary.sdd",
  "revision": "rev_7707085f1e147728c4794a93fd7b81833ec31acc17e6ab69cde83526d4f3ddd5",
  "view_id": "ia_place_map",
  "projection": {
    "schema": "sdd-text-view-projection",
    "version": "0.1",
    "view_id": "ia_place_map",
    "source_example": "peter_paul_mary",
    "nodes": [
      {
        "id": "P-001",
        "type": "Place",
        "name": "Peter"
      },
      {
        "id": "P-002",
        "type": "Place",
        "name": "Paul"
      },
      {
        "id": "P-003",
        "type": "Place",
        "name": "Mary"
      }
    ],
    "edges": [
      {
        "from": "P-001",
        "type": "NAVIGATES_TO",
        "to": "P-002"
      },
      {
        "from": "P-001",
        "type": "NAVIGATES_TO",
        "to": "P-003"
      }
    ],
    "derived": {
      "node_annotations": [],
      "edge_annotations": [],
      "node_groups": [],
      "view_metadata": {}
    },
    "omissions": [],
    "notes": [
      "Hierarchy for IA view is driven by CONTAINS."
    ]
  },
  "diagnostics": [],
  "assessment": {
    "kind": "sdd-authoring-outcome-assessment",
    "outcome": "acceptable",
    "layer": "success",
    "can_commit": false,
    "can_render": true,
    "should_stop": false,
    "next_action": "Render the projected document state if a visual artifact is needed.",
    "blocking_diagnostics": [],
    "summary": "The projection is clean and render-eligible."
  }
}

Success
Ran TMPDIR=/tmp pnpm sdd show --help
$ TMPDIR=/tmp pnpm sdd show --help


> sdd-toolchain@0.1.0 sdd /home/knut/projects/sdd
> node dist/cli/main.js show --help

Usage: sdd show [options] <input>

Preferred preview command for renderable views. In v0.1 it defaults to SVG
output. `ia_place_map`, `service_blueprint`, and `ui_contracts` now select
staged preview backends by default, while the remaining views continue to route
through the legacy Graphviz preview backend unless you override `--backend`.

Arguments:
  input                   source .sdd file

Options:
  --view <view>           view id
  --bundle <manifest>     bundle manifest path (default:
                          "/home/knut/projects/sdd/bundle/v0.1/manifest.yaml")
  --profile <profile>     profile id (default: "strict")
  --format <format>       preview format (svg or png) (default: "svg")
  --backend <backend>     preview backend id override
  --out <file>            write the preview artifact to a file; defaults to
                          <input>.<view>.<profile>[.<backend>].<format> beside
                          the input
  --dot-out <file>        internal/debug: also keep the intermediate DOT source
                          in a file
  --diagnostics <format>  diagnostics format (pretty or json) (default:
                          "pretty")
  -h, --help              display help for command

Examples:
  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map
  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --backend legacy_graphviz_preview --out ./outcome-legacy.svg
  sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --out ./blueprint.svg
  sdd show bundle/v0.1/examples/service_blueprint_slice.sdd --view service_blueprint --backend legacy_graphviz_preview --out ./blueprint-legacy.svg
  sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --out ./ui-contracts.svg
  sdd show bundle/v0.1/examples/place_viewstate_transition.sdd --view ui_contracts --backend legacy_graphviz_preview --out ./ui-contracts-legacy.svg
  sdd show bundle/v0.1/examples/outcome_to_ia_trace.sdd --view ia_place_map --format png --out ./outcome.png
  Some bundle-defined views may appear before they become renderable in the CLI.

Success
Ran TMPDIR=/tmp pnpm sdd show peter_paul_mary.sdd --view ia_place_map --profile simple --format svg --out peter_paul_mary.ia_place_map.simple.svg
$ TMPDIR=/tmp pnpm sdd show peter_paul_mary.sdd --view ia_place_map --profile simple --format svg --out peter_paul_mary.ia_place_map.simple.svg


> sdd-toolchain@0.1.0 sdd /home/knut/projects/sdd
> node dist/cli/main.js show peter_paul_mary.sdd --view ia_place_map --profile simple --format svg --out peter_paul_mary.ia_place_map.simple.svg

Wrote /home/knut/projects/sdd/peter_paul_mary.ia_place_map.simple.svg

Success
The SVG diagram was written beside the source SDD. I’m cleaning up the temporary helper request file and doing a quick file check before I show the artifact.


Deleted 1 file, explored 1 file, 1 list, ran 1 command
Deleted
.tmp_peter_paul_mary_author.json
+0
-61
Read peter_paul_mary.sdd
Listed files in peter_paul_mary.sdd
Ran git status --short peter_paul_mary.sdd peter_paul_mary.ia_place_map.simple.svg .tmp_peter_paul_mary_author.json
$ git status --short peter_paul_mary.sdd peter_paul_mary.ia_place_map.simple.svg .tmp_peter_paul_mary_author.json

?? peter_paul_mary.ia_place_map.simple.svg
?? peter_paul_mary.sdd

Success
Created the SDD and rendered the IA diagram.

SDD: peter_paul_mary.sdd
Diagram: peter_paul_mary.ia_place_map.simple.svg

IA Place Map

Validation passed with 0 errors and 0 warnings under the simple profile.