import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const APPS_SCRIPT_PATH = '/macros/s/AKfycbxe1O-qQNS9Fs0gxSm22sHfhmDQyGtxHn0Qjk0bvQqcdYF_qbQqdGNONfh9mHe2rcrF/exec'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/selection': {
        target: 'https://script.google.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => APPS_SCRIPT_PATH
      }
    }
  }
})
