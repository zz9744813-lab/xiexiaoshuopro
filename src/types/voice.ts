// types/voice.ts - 角色声音结构化类型
export interface VoiceProfile {
  /** 语气基调：冷静 / 热血 / 阴沉 / 活泼 / 严肃 / 温柔 / 傲慢 / 怯懦 */
  tone: string

  /** 说话风格：简洁 / 啰嗦 / 文绉绉 / 粗俗 / 诗意 / 直白 */
  style: string

  /** 句式偏好 */
  sentencePatterns: {
    /** 倾向长句/短句/正常 */
    sentenceLength?: 'short' | 'normal' | 'long'
    /** 常用开头词（如「嗯…」「听我说，」'哼，'） */
    preferredOpeners?: string[]
    /** 习惯性结尾（如「不是吗？」「对吧？」） */
    preferredEndings?: string[]
  }

  /** 词汇偏好 */
  vocabulary: {
    /** 高频词/口头禅 */
    signaturePhrases?: string[]
    /** 避免使用的词 */
    avoidedWords?: string[]
    /** 特殊用词风格：古风 / 现代 / 方言 / 专业术语 */
    register?: string
  }

  /** 非言语习惯 */
  mannerisms: {
    /** 动作描写偏好（如「他挠了挠头」「她抿了抿嘴」） */
    actionCues?: string[]
    /** 情绪表达方式：外放 / 内敛 / 矛盾 */
    emotionalExpressiveness?: 'overt' | 'subtle' | 'conflicted'
  }

  /** 自由格式的补充描述（向后兼容 raw voiceMd） */
  rawNotes?: string
}

/**
 * 将纯文本 voiceMd 转换为 VoiceProfile
 * 由 LLM 驱动的转换函数，保留原始 voiceMd 中所有特征
 */
export interface VoiceConversionInput {
  voiceMd: string
}

export interface VoiceConversionResult {
  profile: VoiceProfile
  /** 用于 prompt 渲染的格式化字符串 */
  promptText: string
}
