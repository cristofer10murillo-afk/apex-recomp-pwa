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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) {
              return 'vendor-charts';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react-dom') || id.includes('/react/')) {
              return 'vendor-react';
            }
          }
          return undefined;
        },
      },
    },
  },
});
