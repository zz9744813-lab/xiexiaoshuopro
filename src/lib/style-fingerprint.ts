// lib/style-fingerprint.ts - 文风指纹计算
export interface StyleFingerprint {
  avgSentenceLength: number;
  sentenceLengthVariance: number;
  vocabRichness: number; // type-token ratio
  dialogueRatio: number;
  repeatedPhrases: Array<{ phrase: string; count: number }>;
  paragraphCount: number;
  wordCount: number;
}

/**
 * 计算文本的文风指纹
 */
export function computeStyleFingerprint(text: string): StyleFingerprint {
  // 分句
  const sentences = text
    .split(/[。！？\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // 句长统计
  const sentenceLengths = sentences.map(s => s.length);
  const avgSentenceLength = sentenceLengths.length > 0
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
    : 0;

  // 句长方差
  const sentenceLengthVariance = sentenceLengths.length > 0
    ? sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgSentenceLength, 2), 0) / sentenceLengths.length
    : 0;

  // 词汇丰富度 (简化：用字符级 type-token ratio)
  const chars = text.replace(/[\s\n。！？，、；：""''（）【】]/g, '');
  const uniqueChars = new Set(chars);
  const vocabRichness = chars.length > 0 ? uniqueChars.size / chars.length : 0;

  // 对话比例
  const dialogueMatches = text.match(/["「『].*?["」』]/g) || [];
  const dialogueLength = dialogueMatches.reduce((sum, d) => sum + d.length, 0);
  const dialogueRatio = text.length > 0 ? dialogueLength / text.length : 0;

  // 重复短语检测 (3-6 字的重复)
  const phraseMap = new Map<string, number>();
  for (let len = 3; len <= 6; len++) {
    for (let i = 0; i <= text.length - len; i++) {
      const phrase = text.slice(i, i + len);
      if (!/[\s\n。！？，]/.test(phrase)) {
        phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
      }
    }
  }
  const repeatedPhrases = Array.from(phraseMap.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase, count]) => ({ phrase, count }));

  // 段落数
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

  return {
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    sentenceLengthVariance: Math.round(sentenceLengthVariance * 10) / 10,
    vocabRichness: Math.round(vocabRichness * 1000) / 1000,
    dialogueRatio: Math.round(dialogueRatio * 1000) / 1000,
    repeatedPhrases,
    paragraphCount: paragraphs.length,
    wordCount: text.length,
  };
}

/**
 * 检测文风漂移
 */
export function detectDrift(
  current: StyleFingerprint,
  baseline: StyleFingerprint,
  thresholds = { sentenceLength: 0.25, vocabRichness: 0.15, dialogueRatio: 0.3 }
): Array<{ axis: string; baselineValue: number; currentValue: number; driftPercent: number }> {
  const drifts: Array<{ axis: string; baselineValue: number; currentValue: number; driftPercent: number }> = [];

  if (baseline.avgSentenceLength > 0) {
    const drift = Math.abs(current.avgSentenceLength - baseline.avgSentenceLength) / baseline.avgSentenceLength;
    if (drift > thresholds.sentenceLength) {
      drifts.push({
        axis: "avg_sentence_length",
        baselineValue: baseline.avgSentenceLength,
        currentValue: current.avgSentenceLength,
        driftPercent: Math.round(drift * 100),
      });
    }
  }

  if (baseline.vocabRichness > 0) {
    const drift = Math.abs(current.vocabRichness - baseline.vocabRichness) / baseline.vocabRichness;
    if (drift > thresholds.vocabRichness) {
      drifts.push({
        axis: "vocab_richness",
        baselineValue: baseline.vocabRichness,
        currentValue: current.vocabRichness,
        driftPercent: Math.round(drift * 100),
      });
    }
  }

  if (baseline.dialogueRatio > 0) {
    const drift = Math.abs(current.dialogueRatio - baseline.dialogueRatio) / baseline.dialogueRatio;
    if (drift > thresholds.dialogueRatio) {
      drifts.push({
        axis: "dialogue_ratio",
        baselineValue: baseline.dialogueRatio,
        currentValue: current.dialogueRatio,
        driftPercent: Math.round(drift * 100),
      });
    }
  }

  return drifts;
}
