import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const APPS_SCRIPT_PATH = '/macros/s/AKfycbzGT2wpze1xsDR4AdFHHPOmHq5p9tpizMgCVeti364Dajk4A5cBb7_EKlyKGwLPBQ/exec'

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
