import type { ErrorObject } from "ajv";
import Ajv2020Import from "ajv/dist/2020.js";
import type { Bundle } from "../bundle/types.js";
import { sortDiagnostics } from "../diagnostics/types.js";
import { parseSource } from "../parser/parseSource.js";
import type { SourceInput, Diagnostic } from "../types.js";
import { buildGraph } from "./buildGraph.js";
import { canonicalizeGraph } from "./canonicalize.js";
import { attachGraphSourcePath, type CompileResult } from "./types.js";

const Ajv2020 = Ajv2020Import as unknown as new (options: Record<string, unknown>) => {
  compile(schema: object): {
    (data: unknown): boolean;
    errors?: ErrorObject[] | null;
  };
};

function schemaDiagnostics(sourcePath: string, errors: ErrorObject[] | null | undefined): Diagnostic[] {
  return (
    errors?.map((error) => ({
      stage: "compile" as const,
      code: "compile.schema_validation_failed",
      severity: "error" as const,
      message: `${error.instancePath || "/"} ${error.message ?? "schema validation failed"}`,
      file: sourcePath
    })) ?? []
  );
}

export function compileSource(input: SourceInput, bundle: Bundle): CompileResult {
  const parseResult = parseSource(input, bundle);
  if (!parseResult.document) {
    return {
      diagnostics: sortDiagnostics(parseResult.diagnostics)
    };
  }

  const built = buildGraph(parseResult.document, input.path);
  if (!built.graph) {
    return {
      diagnostics: sortDiagnostics([...parseResult.diagnostics, ...built.diagnostics])
    };
  }

  const graph = canonicalizeGraph(built.graph);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false
  });
  const validate = ajv.compile(bundle.schema);
  const valid = validate(graph);
  const diagnostics = [...parseResult.diagnostics, ...built.diagnostics];
  if (!valid) {
    diagnostics.push(...schemaDiagnostics(input.path, validate.errors));
    return {
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  attachGraphSourcePath(graph, input.path);
  return {
    graph,
    diagnostics: sortDiagnostics(diagnostics)
  };
}
