import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleLlm, type LlmEnv } from './server/handler';

/**
 * 服务端专属环境变量：写在 .env 里，不带 VITE_ 前缀，
 * 因此 Vite 不会把它们打进前端产物，浏览器拿不到。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') as LlmEnv;

  const llmApi: Plugin = {
    name: 'llm-api',
    configureServer(server) {
      server.middlewares.use('/api/llm', (req, res, next) => {
        handleLlm(req, res, env).catch(next);
      });
    }
  };

  return {
    plugins: [react(), llmApi],
    server: { port: 5173, host: '127.0.0.1' },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('@tiptap') || id.includes('prosemirror')) {
              return 'editor-vendor';
            }
          }
        }
      }
    }
  };
});
