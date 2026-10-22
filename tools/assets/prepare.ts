import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface SourceAsset { path: string; blob_sha: string; sha256: string; bytes: number; width: number; height: number }
export interface AtlasCrop { id: string; source: string; rectangle: number[]; rotate?: number }
export interface AssetManifest {
  sourceRoot: string; outputRoot: string;
  sourceLock: { repository: string; commit: string; files: SourceAsset[] };
  crops: AtlasCrop[];
}
export interface PreparedAssetManifest {
  commit: string;
  files: Record<string, { url: string; width: number; height: number }>;
  crops: Record<string, { url: string; rectangle: number[]; sourceDimensions: number[] }>;
}
const hash = (algorithm: string, bytes: Buffer) => createHash(algorithm).update(bytes).digest('hex');
function within(root: string, path: string) {
  const base = resolve(root); const target = resolve(base, path);
  if (!target.startsWith(base + sep)) throw new Error(`Unsafe asset path: ${path}`);
  return target;
}
/** Offline only: validate every original before writing anything. Crops retain exact PNG pixels
 * in a lossless SVG viewport, so no decoder or image resizing dependency is required. */
export function prepareAssets(manifest: AssetManifest): PreparedAssetManifest {
  if (!/^[a-f0-9]{40}$/.test(manifest.sourceLock.commit)) throw new Error('An immutable commit is required');
  const bytes = new Map<string, Buffer>();
  const result: PreparedAssetManifest = { commit: manifest.sourceLock.commit, files: {}, crops: {} };
  for (const file of manifest.sourceLock.files) {
    if (bytes.has(file.path)) throw new Error(`Duplicate asset: ${file.path}`);
    const data = readFileSync(within(manifest.sourceRoot, file.path));
    if (data.length < 24 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || data.subarray(12, 16).toString() !== 'IHDR') throw new Error(`Not a PNG: ${file.path}`);
    if (data.readUInt32BE(16) !== file.width || data.readUInt32BE(20) !== file.height) throw new Error(`PNG dimensions mismatch: ${file.path}`);
    if (data.length !== file.bytes || hash('sha256', data) !== file.sha256 || hash('sha1', Buffer.concat([Buffer.from(`blob ${data.length}\0`), data])) !== file.blob_sha) throw new Error(`Source integrity mismatch: ${file.path}`);
    bytes.set(file.path, data);
    result.files[file.path] = { url: `/assets/native/${file.path}`, width: file.width, height: file.height };
  }
  for (const crop of manifest.crops) {
    const file = result.files[crop.source]; const [x, y, w, h] = crop.rectangle;
    if (!/^[a-z0-9-]+$/.test(crop.id) || result.crops[crop.id]) throw new Error(`Invalid or duplicate crop: ${crop.id}`);
    if (!file || crop.rectangle.length !== 4 || !crop.rectangle.every(Number.isInteger) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > file.width || y + h > file.height) throw new Error(`Crop outside declared source: ${crop.id}`);
    if (crop.rotate !== undefined && (w !== h || ![0, 90, 180, 270].includes(crop.rotate))) throw new Error(`Unsupported crop rotation: ${crop.id}`);
    result.crops[crop.id] = { url: `/assets/crops/${crop.id}.svg`, rectangle: crop.rectangle, sourceDimensions: [file.width, file.height] };
  }
  for (const [path, data] of bytes) {
    const target = within(manifest.outputRoot, `native/${path}`); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, data);
  }
  for (const crop of manifest.crops) {
    const [x, y, w, h] = crop.rectangle; const file = result.files[crop.source];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g transform="rotate(${crop.rotate ?? 0} ${w / 2} ${h / 2})"><svg width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" overflow="hidden"><image width="${file.width}" height="${file.height}" href="data:image/png;base64,${bytes.get(crop.source)!.toString('base64')}"/></svg></g></svg>\n`;
    const target = within(manifest.outputRoot, `crops/${crop.id}.svg`); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, svg);
  }
  return result;
}

// Rebuild from admitted originals by default, or provide an already-captured source directory.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = prepareAssets({
    sourceRoot: process.argv[2] ?? 'public/assets/native', outputRoot: 'public/assets',
    sourceLock: JSON.parse(readFileSync('assets/source-lock.json', 'utf8')),
    crops: JSON.parse(readFileSync('assets/crops.json', 'utf8')),
  });
  console.log(`Verified ${Object.keys(result.files).length} PNGs; prepared ${Object.keys(result.crops).length} viewport crops.`);
}
