import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import type { Plugin } from 'vite';

/**
 * Vite plugin: warns (dev) or errors (build) if any source file accesses
 * `import.meta.env` as a whole object, which inlines every env var into
 * the bundle — including secrets.  Accessing individual keys like
 * `import.meta.env.VITE_SUPABASE_URL` is fine.
 */
function envLeakGuard(): Plugin {
  const pattern = /import\.meta\.env(?!\.\w)/g;
  return {
    name: 'env-leak-guard',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('node_modules')) return;
      // Strip single-line comments and block comments before checking
      const stripped = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      if (pattern.test(stripped)) {
        const msg = `[env-leak-guard] ${id} accesses import.meta.env as an object — this leaks ALL env vars into the bundle. Use import.meta.env.VITE_* instead.`;
        if (this.meta?.watchMode) { console.warn(msg); }
        else { this.error(msg); }
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
    define: {
        global: 'window',
        __DEV__: JSON.stringify(mode !== 'production'),
        'process.env.NODE_ENV': JSON.stringify(mode),
    },
    plugins: [react(), envLeakGuard()],
    resolve: {
        alias: {
            'react-native': 'react-native-web',
            'react-native-linear-gradient': 'react-native-web-linear-gradient',
            '@env': resolve('./src/config/env-mock.ts'),
            // Force a single React instance to avoid "Invalid hook call" warnings
            'react': resolve('./node_modules/react'),
            'react-dom': resolve('./node_modules/react-dom'),
        },
        // Deduplicate React to prevent multiple copies
        dedupe: ['react', 'react-dom', 'react-native-web'],
        extensions: [
            '.web.js',
            '.web.jsx',
            '.web.ts',
            '.web.tsx',
            '.js',
            '.jsx',
            '.ts',
            '.tsx',
        ],
    },
    optimizeDeps: {
        entries: ['index.html', 'index.web.html'],
        // Pre-bundle react-native-web to avoid issues
        include: ['react-native-web', 'firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/storage'],
        esbuildOptions: {
            resolveExtensions: [
                '.web.js',
                '.web.jsx',
                '.web.ts',
                '.web.tsx',
                '.js',
                '.jsx',
                '.ts',
                '.tsx',
            ],
            loader: {
                '.js': 'tsx',
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
    },
}));
