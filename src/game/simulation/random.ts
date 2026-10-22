import type { RngState } from '../../domain/ids';

const rotateLeft = (value: number, bits: number) => ((value << bits) | (value >>> (32 - bits))) >>> 0;
function validateState(state: RngState): void {
  if (state.length !== 4 || state.some(word => !Number.isInteger(word) || word < 0 || word > 0xffffffff) || state.every(word => word === 0)) throw new Error('Expected four nonzero-in-total uint32 RNG words');
}
/** xoshiro128** 1.1. No implicit seed, clock, or global mutable state. */
export function nextUint32(state: RngState): { value: number; state: RngState } {
  validateState(state);
  let [a, b, c, d] = state;
  const value = Math.imul(rotateLeft(Math.imul(b, 5), 7), 9) >>> 0;
  const t = b << 9;
  c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = rotateLeft(d, 11);
  return { value, state: [a >>> 0, b >>> 0, c >>> 0, d >>> 0] };
}
/** Inclusive integer interval; rejection sampling avoids modulo bias. Every draw is persisted. */
export function randomInt(state: RngState, min: number, max: number): { value: number; state: RngState } {
  const span = max - min + 1;
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || max < min || span > 0x100000000) throw new Error('Invalid random integer interval');
  const limit = Math.floor(0x100000000 / span) * span;
  let draw;
  do { draw = nextUint32(state); state = draw.state; } while (draw.value >= limit);
  return { value: min + draw.value % span, state };
}
