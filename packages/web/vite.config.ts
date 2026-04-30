import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  const value = values.find((value) => value !== undefined && value.trim() !== '');
  return value?.trim();
}

const buildSha = (() => {
  const explicitSha = firstNonEmpty(process.env.VITE_OFFICIUM_BUILD_SHA);
  if (explicitSha) {
    return explicitSha;
  }

  const vercelSha = firstNonEmpty(process.env.VERCEL_GIT_COMMIT_SHA);
  if (vercelSha) {
    return vercelSha.slice(0, 12);
  }

  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
  } catch {
    return 'unknown';
  }
})();

const buildDate = new Date().toISOString();

export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
  define: {
    __OFFICIUM_BUILD_SHA__: JSON.stringify(buildSha),
    __OFFICIUM_BUILD_DATE__: JSON.stringify(buildDate)
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false
  }
});

function serviceWorkerPlugin(): Plugin {
  return {
    name: 'officium-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const appShellAssets = new Set<string>([
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/favicon.svg'
      ]);
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' || item.type === 'asset') {
          appShellAssets.add(`/${item.fileName}`);
        }
      }

      const template = readFileSync(new URL('./src/sw/service-worker.js', import.meta.url), 'utf8');
      const source = template
        .replace(
          '__OFFICIUM_APP_SHELL_VERSION__',
          JSON.stringify(`${buildSha}-${buildDate}`)
        )
        .replace(
          '__OFFICIUM_APP_SHELL_ASSETS__',
          JSON.stringify([...appShellAssets].sort(), null, 2)
        );

      this.emitFile({
        type: 'asset',
        fileName: 'service-worker.js',
        source
      });
    }
  };
}
