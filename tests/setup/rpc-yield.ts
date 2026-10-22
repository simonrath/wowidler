import { setImmediate } from 'node:timers/promises';
import { afterEach } from 'vitest';

// Large synchronous source imports can keep the worker busy across a whole file.
// Yield between tests so Vitest's onTaskUpdate IPC replies are processed before
// its fixed 60-second RPC deadline. Assertions and unhandled errors stay enabled.
afterEach(async () => { await setImmediate(); });
