import { readFile, rm } from "node:fs/promises";
import type { Bundle } from "../bundle/types.js";
import { compileSource } from "../compiler/compileSource.js";
import { sortDiagnostics, type Diagnostic } from "../diagnostics/types.js";
import type {
  ChangeSetMode,
  ChangeSetResult,
  ChangeSetSummary,
  DocumentPath,
  DocumentRevision,
  UndoChangeSetArgs
} from "./contracts.js";
import { validateGraph } from "../validator/validateGraph.js";
import {
  createChangeSetJournal,
  type ChangeSetJournal,
  type JournalInverseMetadata
} from "./journal.js";
import { computeDocumentRevision, normalizeTextToLf, writeCanonicalLfText } from "./revisions.js";
import type { AuthoringWorkspace } from "./workspace.js";
import type { SourceSpan } from "../types.js";

interface EvaluatedUndoText {
  revision: DocumentRevision;
  diagnostics: Diagnostic[];
}

function createDiagnostic(
  file: string,
  code: string,
  message: string,
  span?: SourceSpan
): Diagnostic {
  return {
    stage: "cli",
    code,
    severity: "error",
    message,
    file,
    span
  };
}

function createEmptySummary(): ChangeSetSummary {
  return {
    node_insertions: [],
    node_deletions: [],
    node_renames: [],
    property_changes: [],
    edge_insertions: [],
    edge_deletions: [],
    ordering_changes: []
  };
}

function createBaseUndoChangeSet(
  changeSetId: string,
  path: DocumentPath,
  documentEffect: ChangeSetResult["document_effect"],
  baseRevision: DocumentRevision | null,
  mode: ChangeSetMode
): ChangeSetResult {
  return {
    kind: "sdd-change-set",
    change_set_id: changeSetId,
    path,
    origin: "undo_change_set",
    document_effect: documentEffect,
    base_revision: baseRevision,
    mode,
    status: "rejected",
    undo_eligible: false,
    operations: [],
    summary: createEmptySummary(),
    diagnostics: []
  };
}

function rejectUndoChangeSet(result: ChangeSetResult, diagnostics: Diagnostic[]): ChangeSetResult {
  result.status = "rejected";
  result.undo_eligible = false;
  result.diagnostics = sortDiagnostics(diagnostics);
  delete result.resulting_revision;
  return result;
}

function evaluateUndoText(
  bundle: Bundle,
  documentPath: DocumentPath,
  text: string,
  validateProfile: UndoChangeSetArgs["validate_profile"]
): EvaluatedUndoText {
  const compileResult = compileSource(
    {
      path: documentPath,
      text
    },
    bundle
  );
  const diagnostics = [...compileResult.diagnostics];

  if (validateProfile && compileResult.graph) {
    diagnostics.push(...validateGraph(compileResult.graph, bundle, validateProfile).diagnostics);
  }

  return {
    revision: computeDocumentRevision(text),
    diagnostics: sortDiagnostics(diagnostics)
  };
}

async function readCurrentDocument(
  absolutePath: string
): Promise<{ text: string; revision: DocumentRevision } | undefined> {
  try {
    const rawText = await readFile(absolutePath, "utf8");
    const canonicalText = normalizeTextToLf(rawText);
    return {
      text: canonicalText,
      revision: computeDocumentRevision(canonicalText)
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function unsupportedInverseDiagnostic(path: DocumentPath, inverse: JournalInverseMetadata): Diagnostic {
  return createDiagnostic(
    path,
    "sdd.undo_unsupported_inverse",
    `Change set inverse '${inverse.kind}' is not supported by checkpoint 4 undo.`
  );
}

export async function undoChangeSet(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  args: UndoChangeSetArgs,
  journal = createChangeSetJournal(workspace)
): Promise<ChangeSetResult> {
  const mode = args.mode ?? "dry_run";
  const changeSet = createBaseUndoChangeSet(journal.createChangeSetId(), "", "updated", null, mode);
  const record = await journal.getChangeSetRecord(args.change_set_id);

  if (!record) {
    const rejected = rejectUndoChangeSet(changeSet, [
      createDiagnostic("", "sdd.undo_unknown_change_set", `Change set '${args.change_set_id}' was not found.`)
    ]);

    if (mode === "dry_run") {
      await journal.recordChangeSet(rejected);
    }

    return rejected;
  }

  changeSet.path = record.change_set.path;
  changeSet.base_revision = record.change_set.resulting_revision ?? null;
  if (record.inverse.kind === "delete_document") {
    changeSet.document_effect = "deleted";
  }

  if (record.change_set.mode !== "commit") {
    const rejected = rejectUndoChangeSet(changeSet, [
      createDiagnostic(
        changeSet.path,
        "sdd.undo_not_committed",
        `Change set '${args.change_set_id}' is not a committed record and cannot be undone.`
      )
    ]);

    if (mode === "dry_run") {
      await journal.recordChangeSet(rejected);
    }

    return rejected;
  }

  if (!record.change_set.undo_eligible) {
    const rejected = rejectUndoChangeSet(changeSet, [
      createDiagnostic(
        changeSet.path,
        "sdd.undo_not_eligible",
        `Change set '${args.change_set_id}' is not eligible for undo.`
      )
    ]);

    if (mode === "dry_run") {
      await journal.recordChangeSet(rejected);
    }

    return rejected;
  }

  if (record.inverse.kind === "none" || record.inverse.kind === "apply_inverse_change_set") {
    const rejected = rejectUndoChangeSet(changeSet, [
      unsupportedInverseDiagnostic(changeSet.path, record.inverse)
    ]);

    if (mode === "dry_run") {
      await journal.recordChangeSet(rejected);
    }

    return rejected;
  }

  const resolvedPath = workspace.resolveDocumentPath(record.change_set.path);
  const currentDocument = await readCurrentDocument(resolvedPath.absolutePath);
  const expectedRevision = record.change_set.resulting_revision;
  if (!currentDocument || !expectedRevision || currentDocument.revision !== expectedRevision) {
    const currentRevision = currentDocument?.revision ?? "<missing>";
    const rejected = rejectUndoChangeSet(changeSet, [
      createDiagnostic(
        changeSet.path,
        "sdd.undo_revision_mismatch",
        `Current revision '${currentRevision}' does not match undo target revision '${expectedRevision ?? "<missing>"}'.`
      )
    ]);

    if (mode === "dry_run") {
      await journal.recordChangeSet(rejected);
    }

    return rejected;
  }

  if (record.inverse.kind === "delete_document") {
    changeSet.status = "applied";
    changeSet.undo_eligible = false;
    changeSet.diagnostics = [];
    delete changeSet.resulting_revision;

    if (mode === "commit") {
      await rm(resolvedPath.absolutePath);
      await journal.recordChangeSet(changeSet, {
        inverse: { kind: "none" }
      });
    } else {
      await journal.recordChangeSet(changeSet);
    }

    return changeSet;
  }

  const candidateText = normalizeTextToLf(record.inverse.text);
  const evaluated = evaluateUndoText(bundle, changeSet.path, candidateText, args.validate_profile);
  changeSet.status = "applied";
  changeSet.undo_eligible = false;
  changeSet.diagnostics = evaluated.diagnostics;
  changeSet.resulting_revision = evaluated.revision;

  if (mode === "commit") {
    await writeCanonicalLfText(resolvedPath.absolutePath, candidateText);
    await journal.recordChangeSet(changeSet, {
      inverse: { kind: "none" }
    });
  } else {
    await journal.recordChangeSet(changeSet);
  }

  return changeSet;
}
