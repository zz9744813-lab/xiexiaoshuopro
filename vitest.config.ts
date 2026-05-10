import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { config } from 'dotenv'

// 加载 .env.local
config({ path: '.env.local' })

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
