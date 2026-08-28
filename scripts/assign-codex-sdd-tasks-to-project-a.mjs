#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const PROJECT_A_ID = "local-2855531d6e6ddbb08c2e9755421c4f38";
const PROJECT_A_ROOT = String.raw`\\wsl$\Ubuntu\home\knut\projects\sdd`;
const PROJECT_B_ID = "local-35f7cb39b725e59442b5c5289f97deb2";
const PROJECT_B_ROOT = String.raw`\\wsl.localhost\Ubuntu\home\knut\projects\sdd`;
const SDD_CWD = "/home/knut/projects/sdd";
const LOCAL_HOST_ID = "local";

// These assertions deliberately pin the migration to the state audited on
// 2026-08-27. If Codex changes the state before this script is applied, stop
// and re-audit instead of silently migrating a different set of tasks.
const EXPECTED_UNASSIGNED_TASKS = 72;
const EXPECTED_UNASSIGNED_THREAD_IDS_SHA256 =
  "717ca8de8631ef412e3668319bf28f58a0df7d8654d911c5e0d466d7b46202f1";
const MINIMUM_PROJECT_A_ASSIGNMENTS = 70;

const DEFAULT_CODEX_DIR = "/mnt/c/Users/Knut/.codex";
const CATALOG_BASENAME = "codex-dev.db";
const CATALOG_SUFFIXES = ["", "-wal", "-shm"];

function usage() {
  console.log(`Usage:
  node scripts/assign-codex-sdd-tasks-to-project-a.mjs
  node scripts/assign-codex-sdd-tasks-to-project-a.mjs --apply

Options:
  --apply              Back up the files and apply the 72 assignments.
                       Supplying this flag confirms that Codex Desktop has
                       been fully quit, including any background process.
  --codex-dir <path>   Override the Codex data directory.
                       Default: ${DEFAULT_CODEX_DIR}
  --help               Show this help.

Without --apply, the script performs a read-only dry run.`);
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function parseArguments(argv) {
  let apply = false;
  let codexDir = DEFAULT_CODEX_DIR;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      apply = true;
    } else if (argument === "--codex-dir") {
      const value = argv[index + 1];
      assert(value && !value.startsWith("--"), "--codex-dir requires a path.");
      codexDir = value;
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      usage();
      process.exit(0);
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }

  return { apply, codexDir: resolve(codexDir) };
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function threadIdSetHash(tasks) {
  const payload = `${tasks
    .map((task) => task.thread_id)
    .sort()
    .join("\n")}\n`;
  return createHash("sha256").update(payload).digest("hex");
}

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function existingCatalogFiles(catalogPath) {
  return CATALOG_SUFFIXES.map((suffix) => `${catalogPath}${suffix}`).filter(existsSync);
}

function catalogFingerprint(catalogPath) {
  return existingCatalogFiles(catalogPath).map((path) => ({
    name: basename(path),
    size: statSync(path).size,
    sha256: sha256File(path),
  }));
}

function fingerprintsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function copyCatalogSnapshot(catalogPath, destinationDirectory) {
  mkdirSync(destinationDirectory, { recursive: true });
  for (const sourcePath of existingCatalogFiles(catalogPath)) {
    copyFileSync(sourcePath, join(destinationDirectory, basename(sourcePath)));
  }
  return join(destinationDirectory, CATALOG_BASENAME);
}

function readCatalogTasks(catalogPath) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "codex-project-migration-"));
  try {
    const snapshotPath = copyCatalogSnapshot(catalogPath, temporaryDirectory);
    const database = new DatabaseSync(snapshotPath, { readOnly: true });
    try {
      return database
        .prepare(
          `select thread_id, display_title, cwd, source_kind
             from local_thread_catalog
            where host_id = ? and cwd = ?
            order by thread_id`,
        )
        .all(LOCAL_HOST_ID, SDD_CWD)
        .map((row) => ({ ...row }));
    } finally {
      database.close();
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function readState(statePath) {
  let state;
  try {
    state = JSON.parse(readFileSync(statePath, "utf8"));
  } catch (error) {
    fail(`Cannot parse ${statePath}: ${error.message}`);
  }
  assert(state && typeof state === "object" && !Array.isArray(state), "Global state must be a JSON object.");
  return state;
}

function audit(state, tasks) {
  const projects = state["local-projects"];
  assert(projects && typeof projects === "object", "Missing local-projects in global state.");

  const projectA = projects[PROJECT_A_ID];
  const projectB = projects[PROJECT_B_ID];
  assert(projectA, `Project A ${PROJECT_A_ID} is missing.`);
  assert(projectB, `Project B ${PROJECT_B_ID} is missing.`);
  assert(
    Array.isArray(projectA.rootPaths) && projectA.rootPaths.includes(PROJECT_A_ROOT),
    `Project A does not contain the expected root ${PROJECT_A_ROOT}.`,
  );
  assert(
    Array.isArray(projectB.rootPaths) && projectB.rootPaths.includes(PROJECT_B_ROOT),
    `Project B does not contain the expected root ${PROJECT_B_ROOT}.`,
  );

  const selectedProject = state["selected-project"];
  assert(
    selectedProject?.type === "local" && selectedProject.projectId === PROJECT_A_ID,
    `Project A is not the selected local project. Found: ${JSON.stringify(selectedProject)}`,
  );

  const assignments = state["thread-project-assignments"] ?? {};
  assert(
    assignments && typeof assignments === "object" && !Array.isArray(assignments),
    "thread-project-assignments must be an object.",
  );
  const projectlessIds = new Set(state["projectless-thread-ids"] ?? []);

  const projectATasks = [];
  const projectBTasks = [];
  const otherAssignedTasks = [];
  const unassignedTasks = [];
  const explicitlyProjectlessTasks = [];

  for (const task of tasks) {
    const assignment = assignments[task.thread_id];
    if (!assignment) {
      unassignedTasks.push(task);
      if (projectlessIds.has(task.thread_id)) explicitlyProjectlessTasks.push(task);
    } else if (assignment.projectKind === "local" && assignment.projectId === PROJECT_A_ID) {
      projectATasks.push(task);
    } else if (assignment.projectKind === "local" && assignment.projectId === PROJECT_B_ID) {
      projectBTasks.push(task);
    } else {
      otherAssignedTasks.push({ task, assignment });
    }
  }

  assert(
    projectATasks.length >= MINIMUM_PROJECT_A_ASSIGNMENTS,
    `Expected at least ${MINIMUM_PROJECT_A_ASSIGNMENTS} explicit Project A assignments, found ${projectATasks.length}.`,
  );
  assert(projectBTasks.length === 0, `Expected no explicit Project B assignments, found ${projectBTasks.length}.`);
  assert(otherAssignedTasks.length === 0, `Found ${otherAssignedTasks.length} assignments to unexpected projects.`);
  assert(
    unassignedTasks.length === EXPECTED_UNASSIGNED_TASKS,
    `Expected ${EXPECTED_UNASSIGNED_TASKS} unassigned tasks, found ${unassignedTasks.length}.`,
  );
  assert(
    threadIdSetHash(unassignedTasks) === EXPECTED_UNASSIGNED_THREAD_IDS_SHA256,
    "The unassigned task IDs differ from the audited 72-task set. Re-audit before applying.",
  );
  assert(
    explicitlyProjectlessTasks.length === 0,
    `Refusing to assign ${explicitlyProjectlessTasks.length} tasks explicitly marked projectless.`,
  );
  assert(
    unassignedTasks.every((task) => task.source_kind === "vscode"),
    "At least one candidate task has an unexpected source_kind.",
  );

  return { assignments, projectATasks, unassignedTasks };
}

function backupFiles({ codexDir, statePath, catalogPath, stateHash, catalogFiles, auditResult }) {
  const backupDirectory = join(
    codexDir,
    "backups",
    `assign-sdd-tasks-to-project-a-${timestampForPath()}`,
  );
  assert(!existsSync(backupDirectory), `Backup directory already exists: ${backupDirectory}`);
  mkdirSync(backupDirectory, { recursive: true });

  copyFileSync(statePath, join(backupDirectory, basename(statePath)));
  const stateBakPath = `${statePath}.bak`;
  if (existsSync(stateBakPath)) copyFileSync(stateBakPath, join(backupDirectory, basename(stateBakPath)));

  const catalogBackupDirectory = join(backupDirectory, "sqlite");
  copyCatalogSnapshot(catalogPath, catalogBackupDirectory);

  const manifest = {
    createdAt: new Date().toISOString(),
    migration: "Assign previously unassigned /home/knut/projects/sdd tasks to Project A",
    projectAId: PROJECT_A_ID,
    projectARoot: PROJECT_A_ROOT,
    catalogTaskCount: auditResult.projectATasks.length + auditResult.unassignedTasks.length,
    existingProjectAAssignmentCount: auditResult.projectATasks.length,
    addedAssignmentCount: auditResult.unassignedTasks.length,
    addedThreadIds: auditResult.unassignedTasks.map((task) => task.thread_id),
    sourceFiles: {
      globalState: {
        path: statePath,
        sha256: stateHash,
      },
      localTaskCatalog: {
        path: catalogPath,
        files: catalogFiles,
      },
    },
  };
  writeFileSync(join(backupDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return backupDirectory;
}

function atomicWriteJson(path, value) {
  const originalMode = statSync(path).mode & 0o777;
  const temporaryPath = join(dirname(path), `.${basename(path)}.migration-${process.pid}.tmp`);
  const payload = JSON.stringify(value);

  try {
    writeFileSync(temporaryPath, payload, { encoding: "utf8", mode: originalMode });
    const fileDescriptor = openSync(temporaryPath, "r");
    try {
      fsyncSync(fileDescriptor);
    } finally {
      closeSync(fileDescriptor);
    }
    JSON.parse(readFileSync(temporaryPath, "utf8"));
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function main() {
  const { apply, codexDir } = parseArguments(process.argv.slice(2));
  const statePath = join(codexDir, ".codex-global-state.json");
  const catalogPath = join(codexDir, "sqlite", CATALOG_BASENAME);

  assert(existsSync(statePath), `Missing global state: ${statePath}`);
  assert(existsSync(catalogPath), `Missing local task catalog: ${catalogPath}`);

  const initialStateHash = sha256File(statePath);
  const initialCatalogFingerprint = catalogFingerprint(catalogPath);
  const state = readState(statePath);
  const tasks = readCatalogTasks(catalogPath);
  const auditResult = audit(state, tasks);

  console.log(`Codex directory: ${codexDir}`);
  console.log(`Project A: ${PROJECT_A_ID}`);
  console.log(`SDD tasks in catalog: ${tasks.length}`);
  console.log(`Already assigned to Project A: ${auditResult.projectATasks.length}`);
  console.log(`Unassigned candidates: ${auditResult.unassignedTasks.length}`);

  if (!apply) {
    console.log("Dry run passed. No files were changed.");
    console.log("After fully quitting Codex Desktop, rerun with --apply.");
    return;
  }

  console.log("--apply confirms that Codex Desktop and its background process are fully quit.");

  // Recheck the inputs immediately before backing up and writing. This catches
  // concurrent state changes, although it cannot itself prove that the app is quit.
  assert(sha256File(statePath) === initialStateHash, "Global state changed during the audit. Nothing was written.");
  assert(
    fingerprintsEqual(catalogFingerprint(catalogPath), initialCatalogFingerprint),
    "Local task catalog changed during the audit. Nothing was written.",
  );

  const backupDirectory = backupFiles({
    codexDir,
    statePath,
    catalogPath,
    stateHash: initialStateHash,
    catalogFiles: initialCatalogFingerprint,
    auditResult,
  });

  const assignments = state["thread-project-assignments"] ?? {};
  for (const task of auditResult.unassignedTasks) {
    assignments[task.thread_id] = {
      projectKind: "local",
      projectId: PROJECT_A_ID,
    };
  }
  state["thread-project-assignments"] = assignments;

  // The catalog must still match the backed-up snapshot before the atomic state
  // replacement. If it changed, the backup is retained and the state is untouched.
  assert(
    fingerprintsEqual(catalogFingerprint(catalogPath), initialCatalogFingerprint),
    `Local task catalog changed after backup. State was not modified. Backup: ${backupDirectory}`,
  );
  assert(
    sha256File(statePath) === initialStateHash,
    `Global state changed after backup. State was not modified. Backup: ${backupDirectory}`,
  );

  atomicWriteJson(statePath, state);

  const verifiedState = readState(statePath);
  const verifiedAssignments = verifiedState["thread-project-assignments"] ?? {};
  const failedThreadIds = auditResult.unassignedTasks
    .map((task) => task.thread_id)
    .filter(
      (threadId) =>
        verifiedAssignments[threadId]?.projectKind !== "local" ||
        verifiedAssignments[threadId]?.projectId !== PROJECT_A_ID,
    );
  assert(failedThreadIds.length === 0, `Post-write verification failed for ${failedThreadIds.length} tasks.`);

  console.log(`Assigned ${auditResult.unassignedTasks.length} tasks to Project A.`);
  console.log(`Backup: ${backupDirectory}`);
  console.log("Restart Codex Desktop and verify old tasks before removing Project B.");
  console.log(`Rollback source: ${join(backupDirectory, basename(statePath))}`);
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
