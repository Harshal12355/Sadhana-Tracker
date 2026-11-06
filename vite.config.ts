import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import {
  pwaDevOptions,
  pwaIncludeAssets,
  pwaManifest,
  pwaRegisterType,
  pwaWorkbox,
} from './src/pwa/pwaOptions';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: pwaRegisterType,
      devOptions: pwaDevOptions,
      includeAssets: [...pwaIncludeAssets],
      manifest: pwaManifest,
      workbox: pwaWorkbox,
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
