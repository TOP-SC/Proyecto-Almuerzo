import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const APPS_SCRIPT_PATH = '/macros/s/AKfycbyoLc6_riQVmGI-XiJ-Er_3svaWx5dF59eRTov8ZsvhdhUHg7TOmbnr_1p_4kroTyXe/exec'

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
