import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.js'],
    exclude: ['test/ocr-benchmark.js', 'test/event-ocr-benchmark.js', 'test/vision-benchmark.js'],
    testTimeout: 15000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/renderer/**', 'src/main.js', 'src/preload.cjs'],
    },
  },
});
