import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/apex-app.js',
        chunkFileNames: 'assets/apex-[name].js',
        assetFileNames: 'assets/apex-asset.[ext]',
      },
    },
  },
});
