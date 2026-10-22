import { checkpointSchema, type Checkpoint } from '../../domain/state';
import { sortQueue } from './queue';

/** JSON objects are sorted recursively; array order is semantic except the scheduler queue. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function serializeCheckpoint(checkpoint: Checkpoint): Uint8Array {
  const valid = checkpointSchema.parse(checkpoint);
  return new TextEncoder().encode(canonicalJson({ ...valid, queue: sortQueue(valid.queue) }));
}
export function deserializeCheckpoint(bytes: Uint8Array): Checkpoint {
  const checkpoint = checkpointSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  return { ...checkpoint, queue: sortQueue(checkpoint.queue) };
}
/** FNV-1a 64-bit reproducibility fingerprint, NOT an authenticity/security hash. */
export function hashCheckpoint(checkpoint: Checkpoint): string {
  let hash = BigInt('14695981039346656037');
  const prime = BigInt('1099511628211');
  for (const byte of serializeCheckpoint(checkpoint)) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * prime);
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}
