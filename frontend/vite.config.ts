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
  server: {
    port: 5173,
    strictPort: true,
  },
});
