import { z } from 'zod';
export interface Issue { path: (string | number)[]; message: string }
export type Validation = { ok: true } | { ok: false; issues: Issue[] };
export interface GameError { code: 'invalid' | 'missing-content' | 'unplayable-content' | 'conflict' | 'forbidden' | 'paused'; message: string; issues?: Issue[] }
export type Result<T> = { ok: true; value: T } | { ok: false; error: GameError };
export function parseDomain<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): Result<T> {
  const parsed = schema.safeParse(input);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: { code: 'invalid', message: 'Domain validation failed', issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) } };
}
