/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const basePath = (process.env.VITE_BASE_PATH ?? '/').replace(/\/?$/, '/')

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Hoa Ngữ Cô Mai — Học HSK 3.0 & Từ vựng thông minh',
        short_name: 'Hoa Ngữ Cô Mai',
        description: 'Ứng dụng học tiếng Trung & luyện thi HSK 3.0 cho học viên Việt Nam.',
        theme_color: '#2B6B5C',
        background_color: '#F5F7F5',
        display: 'standalone',
        start_url: basePath,
        scope: basePath,
        lang: 'vi',
        icons: [
          { src: `${basePath}favicon.svg`, sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/data/vocab/search-index.json', '**/data/vocab/extra.json', '**/data/examples/**'],
        runtimeCaching: [
          {
            urlPattern: /\/data\/vocab\/(vocab-meta|hsk-[1-7-9]+)\.json$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'hsk-core-vocab-v12',
              expiration: { maxEntries: 16, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/data\/vocab\/(search-index|extra)\.json$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'hsk-vocab-ondemand-v12',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 4, maxAgeSeconds: 14 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/data\/(grammar|exams|examples)\/.*\.json$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'hsk-study-packs-v12',
              expiration: { maxEntries: 32, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
