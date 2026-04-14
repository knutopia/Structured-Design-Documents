import type { HelperCapabilitiesResult, HelperHelpStubResult } from "../authoring/contracts.js";

type HelperCommandCapabilities = HelperCapabilitiesResult["commands"][number];

const COMMAND_CAPABILITIES: HelperCommandCapabilities[] = [
  {
    name: "inspect",
    invocation: "sdd-helper inspect <document_path>",
    summary: "Return the inspect payload for a parseable repo-relative .sdd document.",
    mutates_repo_state: "never",
    arguments: [
      {
        name: "document_path",
        required: true,
        description: "Repo-relative .sdd document path."
      }
    ],
    options: [],
    result_kind: "sdd-document-inspect",
    constraints: [
      "The path must resolve to a repo-relative .sdd file.",
      "Parse-invalid documents return sdd-helper-error with code runtime_error."
    ]
  },
  {
    name: "search",
    invocation: "sdd-helper search --query <query> --node-type <node_type> --node-id <node_id> --under <path> --limit <count>",
    summary: "Search compile-valid graph content across repo-local .sdd documents.",
    mutates_repo_state: "never",
    arguments: [],
    options: [
      {
        flag: "--query",
        required: false,
        value_name: "query",
        description: "Case-insensitive substring query against node id, type, and name."
      },
      {
        flag: "--node-type",
        required: false,
        value_name: "node_type",
        description: "Exact node type filter."
      },
      {
        flag: "--node-id",
        required: false,
        value_name: "node_id",
        description: "Exact node id filter."
      },
      {
        flag: "--under",
        required: false,
        value_name: "path",
        description: "Repo-relative directory scope."
      },
      {
        flag: "--limit",
        required: false,
        value_name: "count",
        description: "Maximum number of matches to return."
      }
    ],
    result_kind: "sdd-search-results",
    constraints: [
      "At least one of --query, --node-type, or --node-id is required.",
      "Compile-invalid documents are skipped and surfaced through diagnostics."
    ]
  },
  {
    name: "create",
    invocation: "sdd-helper create <document_path> --template <template_id> [--version <version>]",
    summary: "Create a new .sdd document through the authoring core.",
    mutates_repo_state: "always",
    arguments: [
      {
        name: "document_path",
        required: true,
        description: "Repo-relative .sdd document path to create."
      }
    ],
    options: [
      {
        flag: "--template",
        required: true,
        value_name: "template_id",
        description: "Document template identifier."
      },
      {
        flag: "--version",
        required: false,
        value_name: "version",
        description: "Document language version."
      }
    ],
    result_kind: "sdd-create-document",
    constraints: [
      "Current implementation supports template_id=empty.",
      "Current implementation supports version 0.1."
    ]
  },
  {
    name: "apply",
    invocation: "sdd-helper apply --request <file-or-stdin>",
    summary: "Apply or dry-run a structured change set request.",
    mutates_repo_state: "conditional",
    arguments: [],
    options: [
      {
        flag: "--request",
        required: true,
        value_name: "file-or-stdin",
        description: "JSON request file path or '-' for stdin."
      }
    ],
    request_body: {
      via_option: "--request",
      top_level_shape: "ApplyChangeSetArgs",
      source: "file_path_or_stdin_dash"
    },
    result_kind: "sdd-change-set",
    constraints: [
      "Dry-run is the default when the request omits mode.",
      "Rejected change sets stay structured and still exit zero."
    ]
  },
  {
    name: "undo",
    invocation: "sdd-helper undo --request <file-or-stdin>",
    summary: "Undo a committed change set through a structured request.",
    mutates_repo_state: "conditional",
    arguments: [],
    options: [
      {
        flag: "--request",
        required: true,
        value_name: "file-or-stdin",
        description: "JSON request file path or '-' for stdin."
      }
    ],
    request_body: {
      via_option: "--request",
      top_level_shape: "UndoChangeSetArgs",
      source: "file_path_or_stdin_dash"
    },
    result_kind: "sdd-change-set",
    constraints: [
      "Only committed and undo-eligible change sets can be undone.",
      "Rejected undo results stay structured and still exit zero."
    ]
  },
  {
    name: "preview",
    invocation: "sdd-helper preview <document_path> --view <view_id> --profile <profile_id> --format <svg|png> [--backend <backend_id>]",
    summary: "Render a preview artifact for a repo-relative .sdd document.",
    mutates_repo_state: "never",
    arguments: [
      {
        name: "document_path",
        required: true,
        description: "Repo-relative .sdd document path."
      }
    ],
    options: [
      {
        flag: "--view",
        required: true,
        value_name: "view_id",
        description: "Projection view identifier."
      },
      {
        flag: "--profile",
        required: true,
        value_name: "profile_id",
        description: "Validation/render profile identifier."
      },
      {
        flag: "--format",
        required: true,
        value_name: "svg|png",
        description: "Artifact format."
      },
      {
        flag: "--backend",
        required: false,
        value_name: "backend_id",
        description: "Optional preview backend override."
      }
    ],
    result_kind: "sdd-preview",
    constraints: [
      "If preview cannot produce an artifact, the helper returns runtime_error with stage-specific messaging and any available diagnostics."
    ]
  },
  {
    name: "git-status",
    invocation: "sdd-helper git-status [<document_path> ...]",
    summary: "Inspect narrow .sdd-scoped git status for explicit paths or all repo-local .sdd files.",
    mutates_repo_state: "never",
    arguments: [
      {
        name: "document_path",
        required: false,
        description: "Optional repo-relative .sdd document paths."
      }
    ],
    options: [],
    result_kind: "sdd-git-status",
    constraints: [
      "The paths field is the exhaustive .sdd reporting scope.",
      "The status field is the sparse list of actual git status entries for that scope."
    ]
  },
  {
    name: "git-commit",
    invocation: "sdd-helper git-commit --message <message> <document_path>...",
    summary: "Stage and commit only explicit repo-relative .sdd paths.",
    mutates_repo_state: "always",
    arguments: [
      {
        name: "document_path",
        required: true,
        description: "One or more explicit repo-relative .sdd document paths."
      }
    ],
    options: [
      {
        flag: "--message",
        required: true,
        value_name: "message",
        description: "Commit message."
      }
    ],
    result_kind: "sdd-git-commit",
    constraints: [
      "At least one explicit .sdd path is required.",
      "Only the supplied .sdd paths and any paired rename sources needed to complete those renames are staged and committed."
    ]
  },
  {
    name: "capabilities",
    invocation: "sdd-helper capabilities",
    summary: "Return the full machine-readable helper capability manifest.",
    mutates_repo_state: "never",
    arguments: [],
    options: [],
    result_kind: "sdd-helper-capabilities",
    constraints: [
      "This payload is static and does not require repo inspection or bundle loading."
    ]
  }
];

const COMMAND_NAMES = COMMAND_CAPABILITIES.map((command) => command.name);

export function createHelperHelpStub(): HelperHelpStubResult {
  return {
    kind: "sdd-helper-help",
    helper_name: "sdd-helper",
    summary: "JSON-first helper CLI for SDD authoring workflows.",
    note: "This is machine business: the helper is intended primarily for machine and LLM automation, and it returns JSON rather than text help.",
    capabilities_command: "sdd-helper capabilities",
    commands: COMMAND_NAMES
  };
}

export function createHelperCapabilities(): HelperCapabilitiesResult {
  return {
    kind: "sdd-helper-capabilities",
    helper_name: "sdd-helper",
    summary: "Machine-readable discovery payload for the JSON-first SDD helper CLI.",
    discovery: {
      bare_invocation: "returns_help_stub",
      help_flag: "returns_help_stub",
      canonical_introspection_command: "sdd-helper capabilities"
    },
    conventions: {
      stdout_success: "exactly_one_json_payload",
      helper_errors: "sdd-helper-error_non_zero_exit",
      domain_rejections: "structured_payload_exit_zero",
      path_scope: "repo_relative_sdd_paths",
      request_loading: [
        {
          command: "apply",
          option: "--request",
          sources: ["file_path", "stdin_dash"],
          top_level_shape: "ApplyChangeSetArgs"
        },
        {
          command: "undo",
          option: "--request",
          sources: ["file_path", "stdin_dash"],
          top_level_shape: "UndoChangeSetArgs"
        }
      ]
    },
    commands: COMMAND_CAPABILITIES
  };
}

export function shouldReturnHelperHelp(args: string[]): boolean {
  return args.length === 0 || args.includes("--help");
}
