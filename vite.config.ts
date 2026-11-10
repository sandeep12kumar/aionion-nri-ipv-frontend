import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The automated test sets these, so it can run beside the normal dev servers.
const api = `http://localhost:${process.env.API_PORT || 4000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.APP_PORT || 5173),
    proxy: {
      '/api': api,
    },
  },
});
