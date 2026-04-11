# MCP Server for SDD Exploration 041026

**kg:**

Here is a primer about MCP servers: generic_mcp_server_primer.md . Please explore what it would take to create an MCP server for Structured Design Documents (our current project) that wold allow LLMs to consume, edit and author SDD documents. 

Address the following topics:

1. Does it make sense to focus an MCP server on file-based edits or is this when SDD documents should move into a database?
2. What would be a strong-but-not-overengineered feature set for an MCP server, addressing tool tasks (edit/write), resource tasks (retrieve/write) and prompt tasks (authoring / higher-level tasks)?
3. Helper app opportunity: to free the LLM from low level file work, what should the capabilities of a command line helper tool be that provides "low level" functions like reading, creating, editing, committing edits, undo. How should such a helper app coexist or be integrated with the current tool chain?
4. What is a proven, maintainable stack for realizing an MCP server?
5. How should the MCP server integrate or coexist with the current repo / tool chain?

**Codex:**

SDD looks like a very good MCP candidate, and I would not move it to a database yet. The repo already treats SDD as a human-and-LLM-readable file format, keeps the bundle as the behavioral source of truth, and has a clean TypeScript pipeline for parse, compile, validate, project, and preview work in [README.md](/home/knut/projects/sdd/README.md#L3), [architecture.md](/home/knut/projects/sdd/docs/toolchain/architecture.md#L5), [syntax.yaml](/home/knut/projects/sdd/bundle/v0.1/core/syntax.yaml#L4), and [src/index.ts](/home/knut/projects/sdd/src/index.ts#L1).

1. File-based edits vs database

- Keep `.sdd` files as the authoritative store for now.
- SDD’s file form is part of the product value: it is readable, reviewable in Git, deterministic, and already the input shape the toolchain expects.
- The better middle ground is not “DB now”, but “files plus a sidecar index/journal”. I’d use SQLite or similar only for search, cached projections, undo history, and edit sessions.
- I would only consider a real DB-backed source of truth when you need real-time multi-user collaboration, cross-document global identity, per-node ACLs, or non-Git transactional workflows.

2. Strong-but-not-overengineered MCP feature set

Use the MCP control model literally: prompts are user-controlled, resources are application-controlled, tools are model-controlled. For SDD, that suggests:

- Resources:
  - `sdd://bundle/v0.1/syntax`
  - `sdd://bundle/v0.1/vocab`
  - `sdd://bundle/v0.1/contracts`
  - `sdd://doc/{path}`
  - `sdd://parse/{path}`
  - `sdd://compiled/{path}`
  - `sdd://diagnostics/{path}?profile=...`
  - `sdd://projection/{path}?view=...&profile=...`
  - `sdd://preview/{path}?view=...&format=svg`
- Prefer resource templates over listing every file. For a real repo, `resources/templates/list` scales better than giant `resources/list`.
- Resources should stay read-oriented. “Write a resource” should be a tool that mutates a document and then returns updated resource links.

- Tools:
  - `sdd.list_documents`
  - `sdd.inspect_document`
  - `sdd.search_nodes`
  - `sdd.validate_document`
  - `sdd.project_view`
  - `sdd.render_preview`
  - `sdd.create_document`
  - `sdd.apply_operations`
  - `sdd.undo_change`
- The key write tool should be `sdd.apply_operations`, not raw text replacement. Give it a constrained op vocabulary:
  - `add_node`
  - `delete_node`
  - `rename_node`
  - `set_property`
  - `remove_property`
  - `add_edge`
  - `remove_edge`
  - `move_node`
- Require `baseRevision` or content hash for optimistic concurrency.
- Every tool should return `structuredContent` with an output schema, plus a short text summary.

- Prompts:
  - `author_new_sdd_slice`
  - `extend_existing_document`
  - `repair_validation_findings`
  - `trace_change_across_views`
- Keep prompts few and opinionated. Their job is to scaffold higher-level authoring, not replace the tools.

3. Helper app opportunity

Yes, I think a helper app is the right move. The main missing piece is not the MCP protocol layer; it is a safe document-mutation layer. The parser already preserves blocks, properties, edges, comments, blank lines, and spans in [src/parser/types.ts](/home/knut/projects/sdd/src/parser/types.ts#L5), which is enough to support a structured rewriter. I did not find an existing serializer/rewriter, so that is the first new subsystem I’d add.

A good helper CLI should be machine-oriented and JSON-first:

- `read`
- `create`
- `inspect`
- `search`
- `mutate`
- `diff`
- `validate`
- `commit`
- `undo`
- `git-status`
- `git-commit`

I would make `commit` mean “atomically apply this validated edit session to disk”, and keep Git commit as a separate explicit command.

It should coexist as a sibling tool, not as a replacement for `sdd`. My recommendation:
- Keep `sdd` as the human CLI for `compile`, `validate`, and `show`.
- Add `sdd-mcp-helper` as the machine CLI.
- Put the real logic in shared library code, and let both the helper CLI and MCP server call that library directly.

4. Proven, maintainable stack

- TypeScript on Node 22 is the best fit here.
- Use the official TypeScript MCP SDK with `zod` for tool schemas.
- Keep using your current `ajv`, `yaml`, and `vitest` stack for SDD semantics and tests.
- Start with `stdio` transport. Add Streamable HTTP later only if you need remote or multi-client operation.
- Use the official MCP Inspector for development and contract testing.
- Do not build on experimental MCP tasks initially; they are still marked experimental.

Why TypeScript specifically:
- your engine is already TypeScript
- the official SDK is Tier 1
- the repo already exports the core functions you need in [src/index.ts](/home/knut/projects/sdd/src/index.ts#L1)

5. How it should integrate with the current repo/toolchain

- Put the server in-repo, probably under `src/mcp/`.
- Keep the bundle authoritative. The server should derive allowed syntax, vocab, contracts, and views from the existing bundle files, not copy them into new schemas.
- Reuse existing engine steps directly:
  - `loadBundle`
  - `parseSource`
  - `compileSource`
  - `validateGraph`
  - internal `projectView`
  - preview/render services
- One concrete integration gap: projection is architecturally important in [architecture.md](/home/knut/projects/sdd/docs/toolchain/architecture.md#L23) but not publicly exported in [src/index.ts](/home/knut/projects/sdd/src/index.ts#L1). I would expose a stable projection service for the MCP layer.
- Keep strict workspace-root allowlists and path normalization.
- Make write tools validate before commit by default, and optionally render affected views after mutation for feedback.
- Add a sidecar change journal for undo; do not rely on raw text diffs alone.

If I were sequencing this, I’d do it in three steps:
1. Read-only MCP server: bundle resources, doc resources, validate/project/render tools.
2. Structured mutation layer plus helper CLI and undo.
3. Optional Git-aware workflows and optional Streamable HTTP mode.

Sources: [MCP overview](https://modelcontextprotocol.io/specification/2025-11-25/server/index), [Resources](https://modelcontextprotocol.io/specification/2025-11-25/server/resources), [Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [Prompts](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts), [Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [SDK tiers](https://modelcontextprotocol.io/docs/sdk), [TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/), [Inspector](https://github.com/modelcontextprotocol/inspector), [Tasks](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks).

If you want, I can turn this into a concrete SDD MCP design doc with proposed tool/resource schemas and URI templates next.

**kg:**

Thank you. In terms of sequencing, please provide your insights: consider if we should...
- solve for "expose a stable projection service" first?
- build the helper app first so it can be solved & debugged without MCP on top of it? (the helper app could possibly also give us a usable feature set to build a codex SKILL around, even without an MCP server)

**Codex:**

My short take is: yes, expose a stable projection service first, but only as a thin library contract; then build the helper app before building write-capable MCP.

Projection is already the intended semantic boundary in [architecture.md](/home/knut/projects/sdd/docs/toolchain/architecture.md#L88) and [architecture.md](/home/knut/projects/sdd/docs/toolchain/architecture.md#L95), but it is still internal and not exported in [src/index.ts](/home/knut/projects/sdd/src/index.ts#L1). That makes it the right first extraction. I would keep this narrow:
- export projection as a typed library API
- add a high-level `projectSource(...)` convenience
- make its output schema stable and test-covered
- do not make a big public `sdd project` surface yet unless you need it

The reason to do that first is that it unlocks the read side cleanly for both a future MCP server and a future skill. But I would not treat projection as the foundation for editing. Projection is a view artifact, not the source-of-truth edit model. For authoring and mutation, the real hard problem is the structured rewrite layer over source documents. Your parser already preserves a useful source-shaped tree with spans and body items in [src/parser/types.ts](/home/knut/projects/sdd/src/parser/types.ts#L43), so that is the right substrate for edits.

So on sequencing, I’d recommend:

1. Thin stable projection extraction.
2. Helper app built on shared library code, not on MCP.
3. Codex skill on top of the helper app.
4. Read-only MCP server.
5. Write-capable MCP tools only after the helper app mutation flow is solid.

I feel pretty strongly about the helper app coming before write MCP. It lets you solve the risky parts in isolation:
- edit operation model
- serializer / rewrite behavior
- validation-before-commit
- undo / journal
- deterministic diffs
- failure handling

That gives you a much better debugging loop than adding MCP protocol concerns at the same time. It also gives you immediate value: a Codex skill can use the helper app long before an MCP server exists, and that will teach you which operations, outputs, and safeguards are actually useful.

If I were optimizing for learning and momentum, I’d make the helper app’s first useful slice:
- `inspect`
- `validate`
- `project`
- `mutate --dry-run`
- `commit`
- `undo`

All JSON-first. Then build a skill around that. Once that feels good, the MCP server becomes mostly an adapter layer over already-proven semantics.

The one caveat is this: if you want a quick early demo of “LLMs can consume SDD well,” you could ship a read-only MCP server very early, right after the projection extraction. But for anything involving edit/write/author flows, helper-first is the safer and cleaner order.

