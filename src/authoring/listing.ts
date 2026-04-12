import { readFile } from "node:fs/promises";
import type { Bundle } from "../bundle/types.js";
import { sortDiagnostics } from "../diagnostics/types.js";
import { parseSource } from "../parser/parseSource.js";
import type { NodeBlock } from "../parser/types.js";
import type {
  DocumentPath,
  DocumentRevision,
  DocumentUri,
  ListDocumentsArgs,
  ListDocumentsResult,
  SearchGraphArgs,
  SearchGraphResult
} from "./contracts.js";
import { collectDocumentPaths } from "./documentPaths.js";
import { computeDocumentRevision, normalizeTextToLf } from "./revisions.js";
import type { AuthoringWorkspace } from "./workspace.js";
import { compileSource } from "../compiler/compileSource.js";

function createDocumentUri(documentPath: DocumentPath): DocumentUri {
  return `sdd://document/${documentPath}`;
}

export async function listDocuments(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: ListDocumentsArgs = {}
): Promise<ListDocumentsResult> {
  const under = args.under ? workspace.normalizePublicPath(args.under, { allowDirectory: true }) : ".";
  const limit = args.limit ?? Number.POSITIVE_INFINITY;
  const paths = await collectDocumentPaths(workspace, under);
  const documents: ListDocumentsResult["documents"] = [];
  const diagnostics = [];

  for (const documentPath of paths) {
    if (documents.length >= limit) {
      break;
    }

    const resolved = workspace.resolveDocumentPath(documentPath);
    const rawText = await readFile(resolved.absolutePath, "utf8");
    const canonicalText = normalizeTextToLf(rawText);
    const revision = computeDocumentRevision(canonicalText);
    const parseResult = parseSource(
      {
        path: resolved.publicPath,
        text: canonicalText
      },
      bundle
    );

    if (!parseResult.document) {
      diagnostics.push(...parseResult.diagnostics);
      continue;
    }

    documents.push({
      path: resolved.publicPath,
      uri: createDocumentUri(resolved.publicPath),
      revision,
      effective_version: parseResult.document.effectiveVersion,
      top_level_block_count: parseResult.document.items.filter(
        (item): item is NodeBlock => item.kind === "NodeBlock"
      ).length
    });
  }

  return {
    kind: "sdd-document-list",
    documents,
    diagnostics: sortDiagnostics(diagnostics)
  };
}

function normalizeSearchTerm(value: string): string {
  return value.toLocaleLowerCase();
}

function matchesQuery(
  query: string | undefined,
  node: { id: string; type: string; name: string }
): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeSearchTerm(query);
  return [node.id, node.type, node.name].some((candidate) =>
    normalizeSearchTerm(candidate).includes(normalizedQuery)
  );
}

export async function searchGraph(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: SearchGraphArgs
): Promise<SearchGraphResult> {
  if (!args.query && !args.node_type && !args.node_id) {
    throw new Error("At least one of query, node_type, or node_id must be provided.");
  }

  const under = args.under ? workspace.normalizePublicPath(args.under, { allowDirectory: true }) : ".";
  const limit = args.limit ?? Number.POSITIVE_INFINITY;
  const paths = await collectDocumentPaths(workspace, under);
  const matches: SearchGraphResult["matches"] = [];
  const diagnostics = [];

  for (const documentPath of paths) {
    const resolved = workspace.resolveDocumentPath(documentPath);
    const rawText = await readFile(resolved.absolutePath, "utf8");
    const canonicalText = normalizeTextToLf(rawText);
    const revision: DocumentRevision = computeDocumentRevision(canonicalText);
    const compileResult = compileSource(
      {
        path: resolved.publicPath,
        text: canonicalText
      },
      bundle
    );

    if (!compileResult.graph) {
      diagnostics.push(...compileResult.diagnostics);
      continue;
    }

    for (const node of compileResult.graph.nodes) {
      const matchedOn: Array<"query" | "node_type" | "node_id"> = [];

      if (!matchesQuery(args.query, node)) {
        continue;
      }
      if (args.query) {
        matchedOn.push("query");
      }

      if (args.node_type !== undefined) {
        if (node.type !== args.node_type) {
          continue;
        }
        matchedOn.push("node_type");
      }

      if (args.node_id !== undefined) {
        if (node.id !== args.node_id) {
          continue;
        }
        matchedOn.push("node_id");
      }

      matches.push({
        path: resolved.publicPath,
        uri: createDocumentUri(resolved.publicPath),
        revision,
        node_id: node.id,
        node_type: node.type,
        name: node.name,
        matched_on: matchedOn
      });
    }
  }

  matches.sort((left, right) => {
    const pathOrder = left.path.localeCompare(right.path);
    if (pathOrder !== 0) {
      return pathOrder;
    }

    return left.node_id.localeCompare(right.node_id);
  });

  return {
    kind: "sdd-search-results",
    matches: matches.slice(0, limit),
    diagnostics: sortDiagnostics(diagnostics)
  };
}
