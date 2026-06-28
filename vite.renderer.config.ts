import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'node:path';

// https://vitejs.dev/config
export default defineConfig(async () => {
  const { default: tailwindcss } = await import('@tailwindcss/vite');

  return {
    plugins: [
      tanstackRouter({
        target: 'react',
        routesDirectory: './src/routes',
        routeFileIgnorePattern: '^(Home|Settings|Collections)\\.tsx$|.*\\.test\\.tsx$',
      }),
      react(),
      tailwindcss(),
    ],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  };
});
