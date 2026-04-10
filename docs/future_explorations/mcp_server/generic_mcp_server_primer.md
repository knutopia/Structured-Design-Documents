# Primer: Structure and Architecture of a Generic MCP Server

This primer explains how a **generic Model Context Protocol (MCP) server** is structured, what responsibilities it has, and how its internal pieces typically fit together. MCP is an open protocol built on **JSON-RPC 2.0**. At the protocol level, a server exposes three primary categories of capabilities to a client: **tools**, **resources**, and **prompts**. MCP also defines a formal connection lifecycle, capability negotiation, and standard transports such as **stdio** and **Streamable HTTP**. ([Model Context Protocol][1])

---

## 1. What an MCP server is

An MCP server is a process or service that sits between a host application and some useful domain capability: files, APIs, databases, business logic, search systems, internal docs, codebases, or application actions. Its job is to expose those capabilities in a way an MCP client can discover and invoke safely and predictably. In the MCP architecture, the **host** owns the user experience and LLM orchestration, the **client** maintains a 1:1 protocol session with a server, and the **server** publishes capabilities and responds to requests. ([Model Context Protocol][2])

A useful mental model is this:

**MCP server = protocol adapter + domain adapter + safety boundary**

It is not “the AI.” It is the structured capability surface that an AI-enabled host can connect to.

---

## 2. The external architecture

At a high level, the topology looks like this:

```text
User
  ↓
Host application (IDE, chat app, agent framework, desktop app)
  ↓
MCP client inside the host
  ⇄  JSON-RPC over stdio or HTTP
MCP server
  ↓
Underlying systems:
- local files
- Git repos
- databases
- SaaS APIs
- internal services
- business logic
```

The host may talk to multiple MCP servers at once. Each client instance typically manages one isolated connection to one server, which is important for both security and composability. MCP is deliberately modular: implementations must support the base protocol and lifecycle, while features like tools, resources, prompts, and authorization are added as needed. ([Model Context Protocol][2])

---

## 3. The three things a server usually exposes

### Tools

**Tools** are executable actions. Think “functions the model can call”: search a system, create a ticket, query a database, transform content, trigger a workflow. A tool has a name, description, and input schema, and the server executes it when requested. ([Model Context Protocol][1])

### Resources

**Resources** are retrievable context objects, identified by URIs. They are not actions; they are data surfaces. Examples: a file, a schema, a knowledge item, a generated report, a Git blob, a database document. Resources can often be listed, read, and sometimes subscribed to for change notifications if the server declares those capabilities. ([Model Context Protocol][3])

### Prompts

**Prompts** are reusable prompt templates or message bundles that a client can discover and ask the server to instantiate with arguments. They are generally intended to be more user-controlled than tools. ([Model Context Protocol][4])

A practical rule:

* Use a **tool** when the client wants the server to **do** something.
* Use a **resource** when the client wants the server to **provide data**.
* Use a **prompt** when the server wants to provide a **reusable interaction template**. ([Model Context Protocol][3])

---

## 4. The internal architecture of a generic MCP server

A clean MCP server usually separates into six layers.

### A. Transport layer

This layer reads and writes MCP messages over the chosen transport.

Typical responsibilities:

* accept stdio or HTTP connections
* parse and emit UTF-8 JSON-RPC messages
* correlate requests and responses
* enforce framing, connection, and timeout rules

MCP currently defines **stdio** and **Streamable HTTP** as standard transports. ([Model Context Protocol][5])

### B. Protocol/session layer

This is the MCP-specific runtime.

Typical responsibilities:

* handle `initialize`
* negotiate protocol version and capabilities
* enforce lifecycle state
* route method names to handlers
* emit notifications when supported
* maintain session-scoped state if needed

Initialization must happen first; the protocol defines a formal lifecycle of **initialization → operation → shutdown**. ([Model Context Protocol][6])

### C. Capability registry

This is the server’s inventory of what it exposes.

Typical responsibilities:

* register tools, resources, prompt definitions
* publish metadata and schemas
* support list operations
* optionally support change notifications

This layer is often declarative. In good designs, the protocol handlers do not know business details; they just consult the registry. ([Model Context Protocol][3])

### D. Domain adapter layer

This is where real work happens.

Typical responsibilities:

* call external APIs
* read files or repositories
* query databases
* enforce domain rules
* transform backend models into MCP-friendly results

This is the layer that turns “generic protocol server” into “GitHub MCP server,” “Postgres MCP server,” “design system MCP server,” and so on.

### E. Safety and policy layer

This is the most underappreciated part.

Typical responsibilities:

* validate tool arguments against schemas
* authorize sensitive actions
* restrict filesystem/network/database scope
* redact secrets
* rate-limit or budget expensive calls
* log audit events
* require user confirmation where appropriate

MCP’s architecture explicitly emphasizes security boundaries and host-controlled authorization decisions; the server should be designed with least privilege in mind. ([Model Context Protocol][2])

### F. Observability/support layer

This keeps the server operable.

Typical responsibilities:

* structured logging
* metrics
* traces
* debug mode / inspector support
* error mapping
* health diagnostics

Without this layer, tool failures become opaque and hard to debug in real hosts.

---

## 5. Lifecycle of an MCP server session

A generic MCP session typically unfolds like this:

### 1. Connection established

The client opens stdio or HTTP transport to the server. ([Model Context Protocol][5])

### 2. Initialization

The client sends `initialize` with supported protocol version, capabilities, and implementation info. The server replies with its own protocol version compatibility, capabilities, and implementation details. This is the capability negotiation phase. ([Model Context Protocol][6])

### 3. Operational phase

Once initialized, normal requests can flow:

* list tools
* call tools
* list resources
* read resources
* list prompts
* get prompt content
* receive notifications if supported ([Model Context Protocol][3])

### 4. Shutdown

The connection is terminated gracefully. The protocol defines shutdown as a distinct phase, not just a crash or dropped pipe. ([Model Context Protocol][6])

Architecturally, this means your server should behave like a **state machine**, not a random bag of endpoints.

---

## 6. How requests flow inside the server

A good request path looks like this:

```text
Incoming JSON-RPC message
  → transport parser
  → protocol router
  → lifecycle/capability checks
  → schema validation
  → capability handler (tool/resource/prompt)
  → domain adapter / backend call
  → result normalization
  → JSON-RPC response
```

For a tool call specifically:

```text
tools/call
  → locate tool definition
  → validate args against input schema
  → check permissions/policy
  → execute domain logic
  → map output to MCP content/result shape
  → return response
```

That separation matters because it keeps the protocol stable even while backend systems evolve.

---

## 7. The minimum viable generic MCP server

A small but well-structured MCP server often consists of these modules:

```text
/server
  transport/
    stdio.ts
    http.ts
  protocol/
    session.ts
    router.ts
    lifecycle.ts
    errors.ts
  capabilities/
    tools.ts
    resources.ts
    prompts.ts
    registry.ts
  domain/
    search_service.ts
    file_service.ts
    api_client.ts
  policy/
    auth.ts
    validation.ts
    limits.ts
    redaction.ts
  support/
    logging.ts
    metrics.ts
    config.ts
  main.ts
```

Equivalent structure in Python, Go, or Rust would be conceptually the same. The language is secondary; the separation of concerns is primary.

---

## 8. What makes MCP servers different from ordinary APIs

A developer who knows service architecture will notice that an MCP server is not just “REST with different syntax.”

### Key differences

#### A. Discovery is built in

Clients can ask what tools, resources, and prompts exist. That makes the interface more self-describing than many ad hoc APIs. ([Model Context Protocol][3])

#### B. The consumer is usually an AI-enabled host

Your real consumer is often not just a human-written frontend but a host that may surface capabilities to an LLM. That changes naming, descriptions, schemas, and safety expectations.

#### C. Capability negotiation matters

Not every server or client supports the same feature set. You must advertise capabilities up front and behave accordingly. ([Model Context Protocol][6])

#### D. Resources and prompts are first-class

Normal APIs usually expose data and actions only. MCP treats reusable context and reusable prompting structures as protocol concepts. ([Model Context Protocol][3])

#### E. Stateful session semantics are part of the design

MCP has explicit session/lifecycle semantics, particularly around initialization and capabilities. ([Model Context Protocol][6])

---

## 9. Design principles for a good MCP server

### Keep protocol and business logic separate

Your tool handler should not also be your transport parser or auth subsystem. Treat MCP as an adapter layer.

### Design tools like public APIs

Tool names, descriptions, and argument schemas should be crisp and narrow. Ambiguous tools confuse clients and degrade reliability.

### Prefer deterministic outputs

LLM-facing systems behave better when tools return stable, structured results instead of loose prose blobs.

### Make resources addressable

If something is contextual data, try to give it a stable URI and a clean read path rather than forcing everything through tools. That aligns with the protocol’s resource model. ([Model Context Protocol][3])

### Treat prompts as UX assets

Prompts are not just strings in code. They are reusable server-defined affordances for the client UI and model workflow. ([Model Context Protocol][4])

### Build policy in from day one

Do not bolt on permission checks later. A tool that can mutate data, spend money, or expose secrets needs explicit control surfaces.

---

## 10. Common architectural patterns

### Pattern 1: Thin adapter server

The server mostly translates MCP calls into an existing API.

Good for:

* internal service exposure
* wrapping SaaS APIs
* quick integrations

Tradeoff:

* easy to build
* often poor ergonomics unless you redesign the exposed tools/resources thoughtfully

### Pattern 2: Domain façade server

The server creates a higher-level capability model over several backend systems.

Good for:

* workflows spanning multiple systems
* developer tools
* knowledge/workspace assistants

Tradeoff:

* better UX for clients
* more server-side orchestration complexity

### Pattern 3: Local-context server

The server exposes local filesystem, codebase, workspace, editor state, or generated artifacts over stdio.

Good for:

* desktop tools
* IDE integrations
* local agent workflows

Tradeoff:

* fast and simple transport
* stronger need for sandboxing and path restrictions

---

## 11. Security model: what to think about early

MCP’s official architecture puts strong emphasis on security boundaries and authorization decisions across hosts, clients, and servers. For HTTP transports, authorization is explicitly specified at the transport layer; for stdio, credentials are typically handled through the environment rather than HTTP-style auth. ([Model Context Protocol][2])

For a generic server, the practical checklist is:

* restrict accessible scope aggressively
* validate every tool input
* sanitize resource reads
* never trust model-generated arguments
* separate read-only and mutating tools
* log sensitive actions
* keep secrets out of tool outputs
* rate-limit expensive or dangerous operations

The model may be “smart,” but from a security standpoint it is still an untrusted caller mediated by a host.

---

## 12. A concrete example

Suppose you are building an MCP server for a product team knowledge stack.

### Resources

* `doc://specs/auth-flow`
* `doc://designs/onboarding`
* `db://schema/customers`

These let the client read relevant design docs and schemas. ([Model Context Protocol][3])

### Tools

* `search_docs(query, scope, top_k)`
* `create_ticket(title, description, priority)`
* `run_sql_readonly(query)`

These execute actions.

### Prompts

* `summarize_spec(spec_uri)`
* `draft_bug_report(ticket_context)`
* `compare_designs(old_uri, new_uri)`

These provide reusable guided interactions. ([Model Context Protocol][4])

Internally, the server might route all of this to:

* an embeddings/search backend
* Jira API
* read-only analytics replica
* document store

That is a textbook MCP server: one protocol surface, multiple domain integrations, explicit capability types.

---

## 13. Failure modes to avoid

### “One mega-tool”

A single tool like `do_anything(action, payload)` is architecturally lazy and hard for clients to use well.

### Leaking backend complexity

Do not expose raw internal API weirdness unless the user really needs it.

### Mixing mutable and read-only semantics

Keep side-effecting operations clearly separate from retrieval.

### Ignoring capability metadata

If the server claims support for list changes or subscriptions, it needs to behave consistently. ([Model Context Protocol][3])

### Treating initialization as optional

It is not. The protocol lifecycle starts with initialization and capability negotiation. ([Model Context Protocol][6])

### Returning prose where structure is needed

Structured payloads are easier for hosts and models to use safely.

---

## 14. The simplest conceptual implementation

If you wanted to explain a generic MCP server in one paragraph to an experienced backend engineer, this would be the shortest accurate version:

An MCP server is a **stateful JSON-RPC service** that, after an initialization handshake and capability negotiation, exposes **discoverable tools, resources, and prompts** to a client over **stdio or HTTP**. Internally, it should be designed as a layered adapter: transport handling, protocol/session management, capability registry, domain integrations, and policy/observability. The quality of the server depends less on the raw backend connectivity and more on whether its exposed capabilities are narrow, well-described, safe, and stable. ([Model Context Protocol][6])

---

## 15. Recommended mental model

Use this as your default frame:

* **Transport** gets bytes in and out.
* **Protocol layer** enforces MCP rules.
* **Registry** tells the world what the server offers.
* **Handlers** implement tool/resource/prompt semantics.
* **Domain adapters** talk to real systems.
* **Policy** keeps everything safe.
* **Observability** makes it operable.

That is the architecture of a generic MCP server.

If you want, I can next turn this into either:

1. a **more formal design doc**, or
2. a **language-specific implementation primer** in TypeScript, Python, or Go.

[1]: https://modelcontextprotocol.io/specification/2025-11-25/basic?utm_source=chatgpt.com "Overview"
[2]: https://modelcontextprotocol.io/specification/2025-06-18/architecture?utm_source=chatgpt.com "Architecture"
[3]: https://modelcontextprotocol.io/specification/2025-06-18/server/resources?utm_source=chatgpt.com "Resources"
[4]: https://modelcontextprotocol.io/specification/2025-06-18/server/prompts?utm_source=chatgpt.com "Prompts"
[5]: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports?utm_source=chatgpt.com "Transports"
[6]: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle?utm_source=chatgpt.com "Lifecycle"
