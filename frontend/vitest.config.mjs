import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: /^@tdesign\/uniapp\/.+$/,
        replacement: resolve(__dirname, 'tests/stubs/TDesign.vue'),
      },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.js'],
    clearMocks: true,
    setupFiles: ['tests/setup.js'],
  },
});
