import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { projects: [
  { test: { name: 'domain', environment: 'node', setupFiles: ['tests/setup/rpc-yield.ts'], include: ['tests/**/*.test.ts'], exclude: ['tests/ui/**'] } },
  { test: { name: 'ui', environment: 'jsdom', include: ['tests/ui/**/*.test.{ts,tsx}'] } },
] } });
