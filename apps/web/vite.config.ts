import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Forward API calls to the NestJS server so the browser sees one origin.
    proxy: {
      '/v1': 'http://localhost:3000',
    },
  },
});
