import { defineConfig } from 'vite';
import uniModule from '@dcloudio/vite-plugin-uni';
import alias from '@rollup/plugin-alias';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const projectRootDir = fileURLToPath(new URL('.', import.meta.url));
const uni = uniModule.default;
// https://vitejs.dev/config/
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        // The mp-weixin compiler still enters Sass through Vue SFC's legacy
        // adapter. Keep this one upstream deprecation scoped and explicit;
        // project-authored Sass is already on the module API.
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  plugins: [
    uni(),
    alias(),
  ],
  resolve: {
    alias: {
      '@': resolve(projectRootDir, 'src'),
    },
  },
});
