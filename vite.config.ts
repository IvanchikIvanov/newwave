import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: process.env.GITHUB_PAGES ? '/newwave/' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_TURN_SERVER': JSON.stringify(env.VITE_TURN_SERVER),
        'process.env.VITE_TURN_USERNAME': JSON.stringify(env.VITE_TURN_USERNAME),
        'process.env.VITE_TURN_PASSWORD': JSON.stringify(env.VITE_TURN_PASSWORD),
        'process.env.VITE_PEERJS_HOST': JSON.stringify(env.VITE_PEERJS_HOST),
        'process.env.VITE_PEERJS_PORT': JSON.stringify(env.VITE_PEERJS_PORT),
        'process.env.VITE_PEERJS_KEY': JSON.stringify(env.VITE_PEERJS_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
