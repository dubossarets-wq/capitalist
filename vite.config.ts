import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// В режиме разработки (npm run dev) WebSocket и /api проксируются на локальный сервер (npm run server)
// BASE — подпуть сайта (для GitHub Pages: /имя-репозитория/)
export default defineConfig({
  base: process.env.BASE || '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:8080', ws: true },
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], react: ['react', 'react-dom'] },
      },
    },
  },
});
