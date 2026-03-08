import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const APPS_SCRIPT_PATH = '/macros/s/AKfycbzY4lMSBnRxefVobR0Ff33moGw7E3yZv43TG5rf587UQ1EtTTZ4oQPcsIJvCDuaBE87/exec'

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
