import type { ParseDocument, ParseBodyItem, NodeBlock } from "../parser/types.js";
import type { Diagnostic } from "../types.js";
import type { CompiledEdge, CompiledGraph, CompiledNode } from "./types.js";

function createDiagnostic(
  file: string,
  code: string,
  message: string,
  ruleId?: string,
  relatedIds?: string[]
): Diagnostic {
  return {
    stage: "compile",
    code,
    severity: "error",
    message,
    file,
    ruleId,
    relatedIds
  };
}

function collectNodeBlocks(items: ParseDocument["items"]): NodeBlock[] {
  const nodes: NodeBlock[] = [];

  const visitBlock = (block: NodeBlock): void => {
    nodes.push(block);
    for (const item of block.bodyItems) {
      if (item.kind === "NodeBlock") {
        visitBlock(item);
      }
    }
  };

  for (const item of items) {
    if (item.kind === "NodeBlock") {
      visitBlock(item);
    }
  }

  return nodes;
}

function collectEdges(block: NodeBlock): CompiledEdge[] {
  return block.bodyItems
    .filter((item): item is Extract<ParseBodyItem, { kind: "EdgeLine" }> => item.kind === "EdgeLine")
    .map((item) => ({
      from: block.id,
      type: item.relType,
      to: item.to,
      to_name: item.toName,
      event: item.event,
      guard: item.guard,
      effect: item.effect,
      props: Object.fromEntries(item.props.map((prop) => [prop.key, prop.rawValue]))
    }));
}

export function buildGraph(document: ParseDocument, sourcePath: string): { graph?: CompiledGraph; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const nodeBlocks = collectNodeBlocks(document.items);
  const nodes: CompiledNode[] = [];
  const edges: CompiledEdge[] = [];
  const seenIds = new Set<string>();

  for (const block of nodeBlocks) {
    if (seenIds.has(block.id)) {
      diagnostics.push(
        createDiagnostic(
          sourcePath,
          "compile.duplicate_node_id",
          `Duplicate node id '${block.id}'`,
          undefined,
          [block.id]
        )
      );
      continue;
    }

    seenIds.add(block.id);
    const props = Object.fromEntries(
      block.bodyItems
        .filter((item): item is Extract<ParseBodyItem, { kind: "PropertyLine" }> => item.kind === "PropertyLine")
        .map((item) => [item.key, item.rawValue])
    );
    nodes.push({
      id: block.id,
      type: block.nodeType,
      name: block.name,
      props
    });
    edges.push(...collectEdges(block));
  }

  if (diagnostics.length > 0) {
    return { diagnostics };
  }

  return {
    graph: {
      schema: "sdd-text",
      version: document.effectiveVersion,
      nodes,
      edges
    },
    diagnostics
  };
}
