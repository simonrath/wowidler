import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog, CoverageReport } from '../../src/domain/content';
import { isNormalized } from '../../src/content/provenance';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Existing upstream gaps are retained separately from generated normalization gaps. */
export function writeCoverageArtifacts(directory: string, report: CoverageReport, catalog: Catalog, sourceGaps: { id: string; reason: string; [key: string]: unknown }[] = []): void {
  mkdirSync(directory, { recursive: true });
  const json = (name: string, value: unknown) => writeFileSync(join(directory, name), `${JSON.stringify(value, null, 2)}\n`);
  json('coverage.json', report);
  const gaps = new Map(sourceGaps.map(gap => [gap.id, gap]));
  for (const gap of report.gaps) gaps.set(gap.id, gap);
  json('gaps.json', { snapshotId: report.snapshotId, gaps: [...gaps.values()] });
  json('provenance-audit.json', { snapshotId: report.snapshotId, entities: catalog.entities.map(entry => isNormalized(entry) ? entry : { key: entry.key, status: 'missing-field-provenance', sources: entry.sources }) });
  const rows = Object.entries(report.categories).map(([name, c]) => `<tr><th scope="row">${escape(name)}</th><td>${c.included ? 'Ja' : 'Nein'}</td><td>${c.expectedCount ?? 'Nenner unbekannt'}</td><td>${c.captured}</td><td>${c.connected}</td><td>${c.playable}</td><td>${c.tested}</td><td>${c.percent === null ? 'Nicht belegt' : `${c.percent.toFixed(1)} %`}</td></tr>`).join('\n');
  writeFileSync(join(directory, 'coverage.html'), `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Inhaltsabdeckung</title><style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:0 20px;color:#18202b}table{border-collapse:collapse;width:100%}th,td{padding:9px;border-bottom:1px solid #ccd3dc;text-align:left}thead{background:#edf1f6}.scroll{overflow:auto}</style></head><body><h1>Inhaltsabdeckung</h1><p>${escape(report.snapshotId)}</p><p>Globale Vollständigkeit: <strong>${report.complete ? 'belegt' : 'gesperrt'}</strong>.</p><p>Erfasst, verbunden, spielbar und geprüft sind getrennte Stufen. Prozentwerte beziehen sich auf erfasste Pflicht-IDs. Ein unbekannter Nenner oder fehlende unabhängige ID-Liste erlaubt keinen Prozentwert. Geprüft verlangt eine erfolgreiche Ausführung für genau diesen Inhaltsfingerabdruck.</p><div class="scroll"><table><thead><tr><th>Kategorie</th><th>Pflicht</th><th>Referenzzahl</th><th>Erfasst</th><th>Verbunden</th><th>Spielbar</th><th>Geprüft</th><th>Erfasst / Referenz</th></tr></thead><tbody>${rows}</tbody></table></div><p>${report.gaps.length} offene Abdeckungslücken; Quellenlücken siehe gaps.json.</p></body></html>\n`);
}
