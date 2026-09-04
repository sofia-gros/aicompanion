import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        avatar: resolve(__dirname, 'avatar.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
