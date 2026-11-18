import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['shared/src/**/*.test.ts', 'app/src/**/*.test.ts'] } },
      {
        test: {
          name: 'integration',
          include: ['supabase/tests/**/*.test.ts'],
          testTimeout: 20_000,
        },
      },
    ],
  },
})
