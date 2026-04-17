import type {
  ContractSubjectDescriptor,
  ContractSubjectId,
  HelperCapabilitiesResult,
  HelperCapabilitiesResultCommand,
  HelperHelpStubResult
} from "../authoring/contracts.js";
import { getContractSubjectDescriptor } from "../authoring/contractMetadata.js";

interface HelperCommandPresentation {
  subject_id: ContractSubjectId;
  invocation: string;
  arguments: HelperCapabilitiesResultCommand["arguments"];
  options: HelperCapabilitiesResultCommand["options"];
  request_body?: HelperCapabilitiesResultCommand["request_body"];
  result_kind: HelperCapabilitiesResultCommand["result_kind"];
  constraints: HelperCapabilitiesResultCommand["constraints"];
}

const COMMAND_PRESENTATIONS: readonly HelperCommandPresentation[] = [
  {
    subject_id: "helper.command.inspect",
    invocation: "sdd-helper inspect <document_path>",
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
    subject_id: "helper.command.search",
    invocation:
      "sdd-helper search --query <query> --node-type <node_type> --node-id <node_id> --under <path> --limit <count>",
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
    subject_id: "helper.command.create",
    invocation: "sdd-helper create <document_path> [--version <version>]",
    arguments: [
      {
        name: "document_path",
        required: true,
        description: "Repo-relative .sdd document path to create."
      }
    ],
    options: [
      {
        flag: "--version",
        required: false,
        value_name: "version",
        description: "Document language version."
      }
    ],
    result_kind: "sdd-create-document",
    constraints: [
      "Create always bootstraps an empty document skeleton.",
      "Current implementation supports version 0.1."
    ]
  },
  {
    subject_id: "helper.command.apply",
    invocation: "sdd-helper apply --request <file-or-stdin>",
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
    subject_id: "helper.command.author",
    invocation: "sdd-helper author --request <file-or-stdin>",
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
      top_level_shape: "ApplyAuthoringIntentArgs",
      source: "file_path_or_stdin_dash"
    },
    result_kind: "sdd-authoring-intent-result",
    constraints: [
      "Dry-run is the default when the request omits mode.",
      "Committed results expose continuation-safe created_targets for the returned resulting_revision.",
      "Rejected authoring results stay structured and still exit zero."
    ]
  },
  {
    subject_id: "helper.command.undo",
    invocation: "sdd-helper undo --request <file-or-stdin>",
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
    subject_id: "helper.command.validate",
    invocation: "sdd-helper validate <document_path> --profile <profile_id>",
    arguments: [
      {
        name: "document_path",
        required: true,
        description: "Repo-relative .sdd document path."
      }
    ],
    options: [
      {
        flag: "--profile",
        required: true,
        value_name: "profile_id",
        description: "Validation profile identifier."
      }
    ],
    result_kind: "sdd-validation",
    constraints: [
      "Validation reads the current on-disk LF-normalized document revision only.",
      "Use inline validate_profile on apply/author for pre-commit candidate feedback."
    ]
  },
  {
    subject_id: "helper.command.project",
    invocation: "sdd-helper project <document_path> --view <view_id>",
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
      }
    ],
    result_kind: "sdd-projection",
    constraints: [
      "Projection reads the current on-disk LF-normalized document revision only.",
      "Use inline projection_views on apply/author for pre-commit candidate feedback."
    ]
  },
  {
    subject_id: "helper.command.preview",
    invocation:
      "sdd-helper preview <document_path> --view <view_id> --profile <profile_id> --format <svg|png> [--backend <backend_id>]",
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
    subject_id: "helper.command.git-status",
    invocation: "sdd-helper git-status [<document_path> ...]",
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
    subject_id: "helper.command.git-commit",
    invocation: "sdd-helper git-commit --message <message> <document_path>...",
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
    subject_id: "helper.command.contract",
    invocation: "sdd-helper contract <subject_id> [--resolve bundle]",
    arguments: [
      {
        name: "subject_id",
        required: true,
        description: "Shared contract subject id."
      }
    ],
    options: [
      {
        flag: "--resolve",
        required: false,
        value_name: "mode",
        description: "Optional resolution mode. Supported value: bundle."
      }
    ],
    result_kind: "sdd-contract-subject-detail",
    constraints: [
      "The subject_id must match a subject exposed through sdd-helper capabilities.",
      "Static detail is the default; use --resolve bundle to expand bundle-owned allowed values on demand."
    ]
  },
  {
    subject_id: "helper.command.capabilities",
    invocation: "sdd-helper capabilities",
    arguments: [],
    options: [],
    result_kind: "sdd-helper-capabilities",
    constraints: [
      "This payload is static and does not require repo inspection or bundle loading."
    ]
  }
] as const;

function requireDescriptor(subjectId: ContractSubjectId): ContractSubjectDescriptor {
  const descriptor = getContractSubjectDescriptor(subjectId);
  if (!descriptor) {
    throw new Error(`Missing helper contract subject descriptor for '${subjectId}'.`);
  }
  return descriptor;
}

function mergeCommandCapabilities(presentation: HelperCommandPresentation): HelperCapabilitiesResultCommand {
  const descriptor = requireDescriptor(presentation.subject_id);
  return {
    name: descriptor.surface_name,
    invocation: presentation.invocation,
    summary: descriptor.summary,
    mutates_repo_state: descriptor.mutates_repo_state ?? "never",
    arguments: presentation.arguments,
    options: presentation.options,
    request_body: presentation.request_body,
    result_kind: presentation.result_kind,
    constraints: presentation.constraints,
    subject_id: descriptor.subject_id,
    input_shape_id: descriptor.input_shape_id,
    output_shape_id: descriptor.output_shape_id,
    has_deep_introspection: descriptor.has_deep_introspection,
    detail_modes: descriptor.detail_modes
  };
}

const COMMAND_CAPABILITIES: readonly HelperCapabilitiesResultCommand[] = COMMAND_PRESENTATIONS.map(
  mergeCommandCapabilities
);

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
          command: "author",
          option: "--request",
          sources: ["file_path", "stdin_dash"],
          top_level_shape: "ApplyAuthoringIntentArgs"
        },
        {
          command: "undo",
          option: "--request",
          sources: ["file_path", "stdin_dash"],
          top_level_shape: "UndoChangeSetArgs"
        }
      ]
    },
    commands: [...COMMAND_CAPABILITIES]
  };
}

export function shouldReturnHelperHelp(args: string[]): boolean {
  return args.length === 0 || args.includes("--help");
}
