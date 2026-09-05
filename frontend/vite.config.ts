import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Middleware to block requests to sensitive dotfiles (e.g. /.env, /.git)
const blockDotFilesPlugin = (): Plugin => ({
  name: 'block-dot-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url?.split('?')[0] || '';
      if (url === '/.env' || url.startsWith('/.env.') || url.startsWith('/.git')) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), blockDotFilesPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    hmr: {
      overlay: false,
    },
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'edumate.com.vn',
    ],
  },
})
