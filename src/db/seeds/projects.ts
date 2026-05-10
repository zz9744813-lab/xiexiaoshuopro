// db/seeds/projects.ts - 示例项目种子数据
import { db } from '../index'
import { projects, volumes, characters, projectSettings } from '../schema'
import { logger } from '@/lib/logger'

export async function seedProjects() {
  logger.info('Seeding projects...')

  // 检查是否已有项目
  const existingProjects = await db.select().from(projects)
  if (existingProjects.length > 0) {
    logger.info('Projects already exist, skipping seed')
    return
  }

  // 创建示例项目 - 仙侠小说
  const [xianxiaProject] = await db
    .insert(projects)
    .values({
      title: '青云问道',
      genre: '仙侠',
      genreConfig: {
        tone: '古典仙侠',
        cultivationSystem: '练气-筑基-金丹-元婴-化神',
        worldRules: ['弱肉强食', '机缘造化', '因果循环'],
        prohibitedTropes: ['无脑打脸', '系统流'],
      },
      authorNotes: '一个关于问道长生、探寻真理的故事。主角从凡人一步步踏上修仙之路。',
      modelRouting: {
        default: 'primary',
        draft: 'primary',
        review: 'primary',
      },
      safetyLevel: 'normal',
    })
    .returning()

  logger.info('Created demo project', { projectId: xianxiaProject.id })

  // 项目设置
  await db.insert(projectSettings).values([
    { projectId: xianxiaProject.id, key: 'targetWordCount', value: 1000000 },
    { projectId: xianxiaProject.id, key: 'targetVolumes', value: 10 },
    { projectId: xianxiaProject.id, key: 'chaptersPerVolume', value: 30 },
  ])

  // 创建第一卷
  const [volume1] = await db
    .insert(volumes)
    .values({
      projectId: xianxiaProject.id,
      volumeNum: 1,
      title: '初入仙途',
      thesis: '平凡少年偶得机缘，踏入修仙之路，开始改变命运',
      arcBeats: [
        { beat: '主角林凡家境贫寒，但有修仙资质', order: 1 },
        { beat: '意外获得上古传承，获得修炼功法', order: 2 },
        { beat: '拜入青云宗，成为外门弟子', order: 3 },
        { beat: '与同门产生矛盾，遭受欺凌', order: 4 },
        { beat: '通过努力修炼，在宗门大比中脱颖而出', order: 5 },
      ],
      readerPromise: '见证一个凡人如何凭借毅力和智慧，在修仙世界站稳脚跟',
      status: 'planning',
    })
    .returning()

  logger.info('Created demo volume', { volumeId: volume1.id })

  // 创建主要角色
  await db.insert(characters).values([
    {
      projectId: xianxiaProject.id,
      name: '林凡',
      tier: 'principal',
      appearance: '十六七岁少年，面容清秀，眼神坚毅，常穿青色布衣',
      publicRole: '青云宗外门弟子，上古传承获得者',
      voiceMd: '沉稳内敛，不善言辞但心中有主见。面对强者不卑不亢，面对弱者心怀善意。',
      secretMotive: '探寻父母失踪的真相',
      trueIntent: '变强以保护自己珍视的人',
      arcGoal: '从凡人成长为一方强者',
      arcPosition: 0,
      currentEmotionalState: '期待与忐忑并存',
      alive: true,
      appearanceCount: 0,
    },
    {
      projectId: xianxiaProject.id,
      name: '苏婉儿',
      tier: 'principal',
      appearance: '十八岁少女，容貌绝美，气质清冷如月，常着白衣',
      publicRole: '青云宗内门天才弟子，林凡的引路人',
      voiceMd: '清冷疏离，但内心温柔。对修炼有极高追求，对感情懵懂。',
      secretMotive: '寻找能治愈师尊伤势的灵药',
      trueIntent: '打破宗门对女子的偏见',
      arcGoal: '成为青云宗第一位女掌门',
      arcPosition: 20,
      currentEmotionalState: '专注修炼，对林凡渐生好感',
      alive: true,
      appearanceCount: 0,
    },
    {
      projectId: xianxiaProject.id,
      name: '张狂',
      tier: 'recurring',
      appearance: '二十岁左右，身材魁梧，面带傲气，穿内门服饰',
      publicRole: '青云宗内门弟子，宗门大长老之孙',
      voiceMd: '狂妄自大，目中无人，惯于用身份压人',
      secretMotive: '嫉妒任何可能威胁他地位的人',
      trueIntent: '维护自己在宗门的特权地位',
      arcGoal: '成为青云宗掌门',
      arcPosition: 15,
      currentEmotionalState: '对林凡的崛起感到威胁',
      alive: true,
      appearanceCount: 0,
    },
    {
      projectId: xianxiaProject.id,
      name: '青云宗长老',
      tier: 'walk_on',
      appearance: '白发老者，仙风道骨',
      publicRole: '青云宗执法长老',
      voiceMd: '威严公正，但偶尔偏袒内门弟子',
      arcPosition: 0,
      alive: true,
      appearanceCount: 0,
    },
  ])

  logger.info('Created demo characters')

  // 创建言情小说示例项目
  const [romanceProject] = await db
    .insert(projects)
    .values({
      title: '时光与你都很甜',
      genre: '现言',
      genreConfig: {
        tone: '甜宠治愈',
        setting: '现代都市',
        themes: ['成长', '治愈', '双向奔赴'],
        styleNotes: '细腻的情感描写，温暖的日常互动',
      },
      authorNotes: '两个性格迥异的人，在碰撞中逐渐靠近，互相治愈的故事。',
      safetyLevel: 'normal',
    })
    .returning()

  logger.info('Created romance demo project', { projectId: romanceProject.id })

  // 创建科幻小说示例项目
  const [scifiProject] = await db
    .insert(projects)
    .values({
      title: '星际漂流者',
      genre: '科幻',
      genreConfig: {
        tone: '硬科幻',
        setting: '近未来太空',
        technologyLevel: '可控核聚变、初级曲率引擎',
        themes: ['人类命运', '文明冲突', '技术伦理'],
      },
      authorNotes: '一艘失联的科考船，一群在绝望中寻找希望的船员。',
      safetyLevel: 'normal',
    })
    .returning()

  logger.info('Created sci-fi demo project', { projectId: scifiProject.id })

  logger.info('All seeds completed')
}
