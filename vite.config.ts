import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Allow relative paths for Electron
  server: {
    port: 5175,
    strictPort: true,
    host: true, // Listen on all addresses, including IPv4 and IPv6
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'types': path.resolve(__dirname, './types'),
    },
  },
})
