import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [
      vue(),
      AutoImport({
        dts: false, // 禁用生成 auto-imports.d.ts
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        dts: false, // 禁用生成 components.d.ts
        resolvers: [ElementPlusResolver()],
      }),
    ],
    build: {
      commonjsOptions: {
        include: /node_modules|src/,
      },
      outDir: 'dist',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    base: './',
    server: {
      port: 5173,
    }
  };
});
