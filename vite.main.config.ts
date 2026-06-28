import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // better-sqlite3 is a native module; keep it external so Electron loads
      // its rebuilt .node binding at runtime instead of Vite bundling bindings().
      external: ['better-sqlite3'],
    },
  },
});
