import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'firebase/firestore': path.resolve(__dirname, './src/config/firebase.ts'),
      'firebase/app': path.resolve(__dirname, './src/config/firebase.ts'),
      'firebase/auth': path.resolve(__dirname, './src/config/firebase.ts'),
      'firebase/storage': path.resolve(__dirname, './src/config/firebase.ts'),
      'firebase/functions': path.resolve(__dirname, './src/config/firebase.ts'),
      'firebase/analytics': path.resolve(__dirname, './src/config/firebase.ts'),
      '@supabase/supabase-js': path.resolve(__dirname, './src/config/supabase.ts'),
    },
  },
  build: {
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('three')) {
              return 'vendor-three';
            }
            if (id.includes('pdfjs-dist') || id.includes('jspdf')) {
              return 'vendor-pdf';
            }
            if (id.includes('papaparse') || id.includes('zod')) {
              return 'vendor-utils';
            }
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
