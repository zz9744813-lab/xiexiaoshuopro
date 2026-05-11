import { Agent } from '@mastra/core/agent'
import { deepseekChat } from '@/lib/models'

export const worldTickAgent = new Agent({
  id: 'world-tick',
  name: 'world-tick',
  instructions: '你是世界观管理员。在两章之间，世界在继续运转。负责生成世界事件。',
  model: deepseekChat(),
})
