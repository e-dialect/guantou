import { defineConfig } from 'vite';
import uniModule from '@dcloudio/vite-plugin-uni';
import alias from '@rollup/plugin-alias';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const projectRootDir = fileURLToPath(new URL('.', import.meta.url));
const uni = uniModule.default;
// https://vitejs.dev/config/
export default defineConfig({
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
