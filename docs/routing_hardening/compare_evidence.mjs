/** Compare two capture_baseline.mjs runs, excluding output-directory metadata. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const [left, right, reportPath] = process.argv.slice(2);
if (!left || !right) throw new Error('Usage: node compare_evidence.mjs LEFT RIGHT [REPORT]');
const a = JSON.parse(await readFile(path.join(left, 'matrix.json'), 'utf8'));
const b = JSON.parse(await readFile(path.join(right, 'matrix.json'), 'utf8'));
const names = (await readdir(left)).filter(name => /\.(scene\.json|evidence\.json|svg|png)$/.test(name)).sort();
const rightNames = (await readdir(right)).filter(name => /\.(scene\.json|evidence\.json|svg|png)$/.test(name)).sort();
const mismatches = [], hashes = {};
for (const name of names) {
  const x = await readFile(path.join(left, name)), y = await readFile(path.join(right, name));
  if (!x.equals(y)) mismatches.push(name);
  hashes[name] = createHash('sha256').update(x).digest('hex');
}
const dirtyRows = a.rows.filter(row => ['emitted', 'shared', 'terminalAudit', 'independent'].some(key => Object.keys(row[key]).length));
const report = { sourceSha256: a.fingerprint.sourceSha256,
  sameSource: a.fingerprint.sourceSha256 === b.fingerprint.sourceSha256,
  sameFiles: JSON.stringify(names) === JSON.stringify(rightNames),
  sameRows: JSON.stringify(a.rows) === JSON.stringify(b.rows),
  cases: a.rows.length, comparedArtifacts: names.length, dirtyRows, mismatches, hashes };
if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, hashes: undefined }, null, 2));
if (!report.sameSource || !report.sameFiles || !report.sameRows || dirtyRows.length || mismatches.length) process.exitCode = 1;
