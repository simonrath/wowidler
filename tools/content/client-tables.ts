/** Build-time admission of the captured JSONL extraction format, not a binary DB2 parser. */
import { gunzipSync } from 'node:zlib';
import { z } from 'zod';
import { verifySourceFile } from './lock';
import { sourceLockSchema, type SourceFile, type SourceLock } from './schema';
import type { SourceSelection } from '../../src/domain/content';

export interface CapturedBytes { file: SourceFile; bytes: Uint8Array }
export interface BuildTableInput {
  actualBuild: string;
  locale: { status: 'unknown'; reason: string };
  hotfix: { status: 'unknown'; reason: string };
  manifest: CapturedBytes; lock: SourceLock;
  tables: (CapturedBytes & { name: string; definition: SourceFile; definitionBytes: Uint8Array })[];
}
export interface ClientTableRow { id: number; fields: Record<string, unknown> }
export interface ClientTableImportResult {
  build: string; locale: BuildTableInput['locale']; hotfix: BuildTableInput['hotfix'];
  tables: Record<string, { rows: ClientTableRow[]; source: SourceFile; definition: SourceFile; status: string }>;
  gaps: string[];
}
const uncertainty = z.object({ status: z.literal('unknown'), reason: z.string().trim().min(1) }).strict();
const headerSchema = z.object({ kind: z.literal('table'), schemaVersion: z.literal(1), gameVersion: z.literal('forever'), source: z.literal('foreverclient'), table: z.string(), clientBuild: z.number().int().positive(), fileDataId: z.number().int().positive(), definitionSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const rowSchema = z.object({ kind: z.literal('record'), id: z.number().int().positive(), fields: z.record(z.unknown()) }).strict();
/** Caller-supplied records must match the admitted lock as well as exact bytes. */
export function verifyCaptured(capture: CapturedBytes, lock: SourceLock): void {
  const admitted = lock.files.find(f => f.sourceId === capture.file.sourceId && f.path === capture.file.path);
  if (!admitted || JSON.stringify(admitted) !== JSON.stringify(capture.file) || !verifySourceFile(capture.bytes, admitted).ok) throw Error(`Unadmitted or changed source: ${capture.file.path}`);
}
export function importBuildTables(input: BuildTableInput): ClientTableImportResult {
  const lock = sourceLockSchema.parse(input.lock);
  const locale = uncertainty.parse(input.locale), hotfix = uncertainty.parse(input.hotfix);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(input.actualBuild) || !input.tables.length) throw Error('Actual build and table bytes required');
  verifyCaptured(input.manifest, lock);
  const manifest = JSON.parse(Buffer.from(input.manifest.bytes).toString('utf8'));
  if (manifest.gameVersion !== 'forever' || manifest.source !== 'foreverclient' || manifest.client?.version !== input.actualBuild) throw Error('Client manifest build mismatch');
  const tables: ClientTableImportResult['tables'] = {};
  for (const table of input.tables) {
    verifyCaptured(table, lock); verifyCaptured({ file: table.definition, bytes: table.definitionBytes }, lock);
    if (tables[table.name]) throw Error('Duplicate client table');
    const lines = gunzipSync(table.bytes).toString('utf8').trimEnd().split('\n');
    const header = headerSchema.parse(JSON.parse(lines.shift()!));
    const entry = manifest.tables.find((t: { name: string }) => t.name === table.name);
    const definition = Buffer.from(table.definitionBytes).toString('utf8');
    const exactBuild = definition.split(/\r?\n/).some(line => line.startsWith('BUILD ') && line.slice(6).split(/,\s*/).includes(input.actualBuild));
    if (header.table !== table.name || header.clientBuild !== manifest.client.buildNumber || String(header.clientBuild) !== table.file.build ||
      table.file.path !== `data/forever/client-extract/${table.name}.jsonl.gz` || table.definition.path !== `definitions/${table.name}.dbd` ||
      table.definition.commit !== manifest.definitions.repositoryRevision || table.definition.build !== input.actualBuild ||
      header.definitionSha256 !== table.definition.sha256 || entry?.definitionSha256 !== header.definitionSha256 || entry.fileDataId !== header.fileDataId || !exactBuild) throw Error(`Table/build/definition mismatch: ${table.name}`);
    if (!['written', 'partial_encrypted'].includes(entry.status)) throw Error(`Unavailable client table: ${table.name}`);
    const rows = lines.map(line => rowSchema.parse(JSON.parse(line)));
    if (new Set(rows.map(r => r.id)).size !== rows.length || rows.some(r => r.fields.ID !== r.id) || rows.length !== entry.recordCount) throw Error(`Malformed or incomplete capture: ${table.name}`);
    tables[table.name] = { rows: rows.map(({ id, fields }) => ({ id, fields })), source: table.file, definition: table.definition, status: entry.status };
  }
  return { build: input.actualBuild, locale, hotfix, tables, gaps: ['Client locale is unknown: ' + locale.reason, 'Client hotfix state is unknown: ' + hotfix.reason, 'Captured records do not establish server availability; encrypted omissions remain unknown.'] };
}
export const tableRowSource = (result: ClientTableImportResult, table: string, id: number, field?: string): SourceSelection => {
  const file = result.tables[table]?.source;
  if (!file || !result.tables[table].rows.some(r => r.id === id)) throw Error(`Missing client row ${table}/${id}`);
  return { sourceId: file.sourceId, path: file.path, sha256: file.sha256, selector: `record[id=${id}]/fields${field ? '/' + field : ''}` };
};
