import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { serviceWorkerPlugin } from './src/sw-plugin.ts';

export default defineConfig({
  // Relative base lets the build work both on GitHub Pages (/misparim/) and from any static folder.
  base: './',
  plugins: [serviceWorkerPlugin({ publicDir: resolve(import.meta.dirname, 'public') })],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
