import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // React changes when React changes, which is rarely. Keeping it in its
        // own file means a browser that has been here before only re-downloads
        // the application, not the framework underneath it.
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
    // The Word reader is a 500kB chunk, loaded only when someone uploads a .docx.
    // It is already split out, so the default warning is about a file nobody
    // fetches unless they need it.
    chunkSizeWarningLimit: 600,
  },
});
