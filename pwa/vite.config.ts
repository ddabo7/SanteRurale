/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },

  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',

    rollupOptions: {
      output: {
        manualChunks: {
          // Code splitting pour optimiser le chargement
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query', 'axios'],
          'db-vendor': ['dexie', 'dexie-react-hooks'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },

    // Compression et obfuscation avec Terser (mode sûr pour React)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,      // Supprimer tous les console.log
        drop_debugger: true,      // Supprimer debugger
        pure_funcs: ['console.info', 'console.debug', 'console.warn'], // Supprimer d'autres console
        passes: 2,                // Passer 2 fois pour une meilleure compression
      },
      mangle: {
        safari10: true,          // Compatibilité Safari 10+
        // Note: toplevel désactivé pour éviter de casser React/libs externes
      },
      format: {
        comments: false,         // Supprimer tous les commentaires
      },
    },

    // Désactiver les source maps en production pour plus de sécurité
    sourcemap: false,
  },

  server: {
    port: 5173,
    host: true, // Écoute sur toutes les interfaces (Docker)
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: 4173,
    host: true,
  },

  // Configuration Vitest
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/*',
        'dist/',
      ],
    },
  },
})
