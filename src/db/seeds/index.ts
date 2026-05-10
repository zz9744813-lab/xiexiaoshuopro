// db/seeds/index.ts - 种子数据入口
import { db, pool } from '../index'
import { seedProjects } from './projects'
import { logger } from '@/lib/logger'

export async function runSeeds() {
  logger.info('Starting database seeds...')

  try {
    await seedProjects()
    logger.info('Database seeds completed successfully')
  } catch (error) {
    logger.error('Database seeds failed', { error: (error as Error).message })
    throw error
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runSeeds()
    .then(() => {
      console.log('Seeds completed')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Seeds failed:', err)
      process.exit(1)
    })
}
