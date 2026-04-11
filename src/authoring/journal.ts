import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { sortDiagnostics } from "../diagnostics/types.js";
import type { ChangeOperation, ChangeSetId, ChangeSetResult, DocumentPath } from "./contracts.js";
import { stringifyCanonicalJson, writeCanonicalLfText } from "./revisions.js";
import type { AuthoringWorkspace } from "./workspace.js";

const CHANGE_SET_DIRECTORY = "change-sets";
const CHANGE_SET_ID_PATTERN = /^chg_[A-Za-z0-9._-]+$/;

export interface JournalInverseNone {
  kind: "none";
}

export interface JournalInverseDeleteDocument {
  kind: "delete_document";
  path: DocumentPath;
}

export interface JournalInverseApplyChangeSet {
  kind: "apply_inverse_change_set";
  operations: ChangeOperation[];
}

export interface JournalInverseRestoreDocument {
  kind: "restore_document";
  path: DocumentPath;
  revision: string;
  text: string;
}

export type JournalInverseMetadata =
  | JournalInverseNone
  | JournalInverseDeleteDocument
  | JournalInverseApplyChangeSet
  | JournalInverseRestoreDocument;

export interface PersistedChangeSetRecord {
  kind: "sdd-journal-change-set-record";
  version: 1;
  created_at: string;
  change_set: ChangeSetResult;
  inverse: JournalInverseMetadata;
}

export interface ChangeSetJournalDeps {
  idFactory?: () => string;
  clock?: () => Date;
}

export interface ChangeSetJournal {
  createChangeSetId(): ChangeSetId;
  recordChangeSet(
    result: ChangeSetResult,
    options?: { inverse?: JournalInverseMetadata }
  ): Promise<PersistedChangeSetRecord>;
  getChangeSetRecord(changeSetId: ChangeSetId): Promise<PersistedChangeSetRecord | undefined>;
}

function defaultChangeSetIdFactory(): ChangeSetId {
  return `chg_${randomUUID()}`;
}

function validateChangeSetId(changeSetId: string): ChangeSetId {
  if (!CHANGE_SET_ID_PATTERN.test(changeSetId)) {
    throw new Error(`Invalid change-set ID '${changeSetId}'.`);
  }

  return changeSetId;
}

function normalizeChangeSetResult(result: ChangeSetResult): ChangeSetResult {
  const cloned = structuredClone(result);
  cloned.diagnostics = sortDiagnostics(cloned.diagnostics);
  cloned.projection_results = cloned.projection_results?.map((projectionResult) => ({
    ...projectionResult,
    diagnostics: sortDiagnostics(projectionResult.diagnostics)
  }));
  return cloned;
}

function normalizePersistedRecord(record: PersistedChangeSetRecord): PersistedChangeSetRecord {
  const cloned = structuredClone(record);
  cloned.change_set = normalizeChangeSetResult(cloned.change_set);
  return cloned;
}

function getCommittedRecordPath(workspace: AuthoringWorkspace, changeSetId: ChangeSetId): string {
  return workspace.resolveStatePath(path.posix.join(CHANGE_SET_DIRECTORY, `${changeSetId}.json`));
}

export function createDeleteDocumentInverse(path: DocumentPath): JournalInverseDeleteDocument {
  return {
    kind: "delete_document",
    path
  };
}

export function createRestoreDocumentInverse(
  path: DocumentPath,
  revision: string,
  text: string
): JournalInverseRestoreDocument {
  return {
    kind: "restore_document",
    path,
    revision,
    text
  };
}

export function createChangeSetJournal(
  workspace: AuthoringWorkspace,
  deps: ChangeSetJournalDeps = {}
): ChangeSetJournal {
  const idFactory = deps.idFactory ?? defaultChangeSetIdFactory;
  const clock = deps.clock ?? (() => new Date());
  const dryRunRecords = new Map<ChangeSetId, PersistedChangeSetRecord>();

  async function recordCommittedChangeSet(record: PersistedChangeSetRecord): Promise<void> {
    const directoryPath = workspace.resolveStatePath(CHANGE_SET_DIRECTORY);
    await mkdir(directoryPath, { recursive: true });
    const recordPath = getCommittedRecordPath(workspace, record.change_set.change_set_id);
    await writeCanonicalLfText(recordPath, stringifyCanonicalJson(record));
  }

  return {
    createChangeSetId(): ChangeSetId {
      return validateChangeSetId(idFactory());
    },

    async recordChangeSet(
      result: ChangeSetResult,
      options: { inverse?: JournalInverseMetadata } = {}
    ): Promise<PersistedChangeSetRecord> {
      const changeSetId = validateChangeSetId(result.change_set_id);
      const record = normalizePersistedRecord({
        kind: "sdd-journal-change-set-record",
        version: 1,
        created_at: clock().toISOString(),
        change_set: {
          ...result,
          change_set_id: changeSetId
        },
        inverse: options.inverse ?? { kind: "none" }
      });

      if (record.change_set.mode === "commit") {
        await recordCommittedChangeSet(record);
        dryRunRecords.delete(changeSetId);
      } else {
        dryRunRecords.set(changeSetId, record);
      }

      return structuredClone(record);
    },

    async getChangeSetRecord(changeSetId: ChangeSetId): Promise<PersistedChangeSetRecord | undefined> {
      const validatedId = validateChangeSetId(changeSetId);
      const dryRunRecord = dryRunRecords.get(validatedId);
      if (dryRunRecord) {
        return normalizePersistedRecord(dryRunRecord);
      }

      try {
        const recordPath = getCommittedRecordPath(workspace, validatedId);
        const rawRecord = await readFile(recordPath, "utf8");
        return normalizePersistedRecord(JSON.parse(rawRecord) as PersistedChangeSetRecord);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return undefined;
        }

        throw error;
      }
    }
  };
}
