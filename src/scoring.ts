import type { SimulationResult, ScoreResult, KeyHit } from './types';

export function calculateScore(result: SimulationResult): ScoreResult {
  const coverage = result.totalChars > 0
    ? result.mappedChars / result.totalChars
    : 0;

  const distance = calculateDistance(result.keyHits);
  const averageDistance = result.keyHits.length > 1
    ? distance / (result.keyHits.length - 1)
    : 0;

  const evenness = calculateEvenness(result.frequencyMap, result.mappedChars);
  const sameKeyRate = calculateSameKeyRate(result.keyHits);

  let maxFreqKey = '';
  let maxFreq = 0;
  for (const [key, freq] of result.frequencyMap) {
    if (freq > maxFreq) {
      maxFreq = freq;
      maxFreqKey = key;
    }
  }
  const uniqueKeysUsed = result.frequencyMap.size;

  const coverageScore = coverage * 100;
  // 距離: 平均距離が小さいほど高スコア。0なら100、3以上で0
  const distanceScore = Math.max(0, 100 - (averageDistance / 3) * 100);
  const evennessScore = evenness * 100;
  // 同キー連続: 低いほど高スコア
  const sameKeyScore = (1 - sameKeyRate) * 100;

  const total = Math.round(
    coverageScore * 0.25 +
    distanceScore * 0.30 +
    evennessScore * 0.25 +
    sameKeyScore * 0.20
  );

  return {
    total: Math.min(100, Math.max(0, total)),
    coverage: Math.round(coverageScore),
    distance: Math.round(distanceScore),
    evenness: Math.round(evennessScore),
    sameKeyRate: Math.round(sameKeyScore),
    details: {
      totalKeystrokes: result.keyHits.length,
      uniqueKeysUsed,
      averageDistance: Math.round(averageDistance * 100) / 100,
      maxFrequencyKey: maxFreqKey,
      maxFrequency: maxFreq,
    },
  };
}

function calculateDistance(keyHits: KeyHit[]): number {
  let totalDist = 0;
  for (let i = 1; i < keyHits.length; i++) {
    const prev = keyHits[i - 1];
    const curr = keyHits[i];
    const prevCX = prev.x + prev.width / 2;
    const prevCY = prev.y + prev.height / 2;
    const currCX = curr.x + curr.width / 2;
    const currCY = curr.y + curr.height / 2;
    totalDist += Math.sqrt(
      (currCX - prevCX) ** 2 + (currCY - prevCY) ** 2
    );
  }
  return totalDist;
}

function calculateEvenness(frequencyMap: Map<string, number>, total: number): number {
  if (total === 0 || frequencyMap.size <= 1) return 0;

  const n = frequencyMap.size;
  const maxEntropy = Math.log2(n);
  if (maxEntropy === 0) return 1;

  let entropy = 0;
  for (const freq of frequencyMap.values()) {
    const p = freq / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy / maxEntropy;
}

function calculateSameKeyRate(keyHits: KeyHit[]): number {
  if (keyHits.length <= 1) return 0;

  let sameCount = 0;
  for (let i = 1; i < keyHits.length; i++) {
    const prev = keyHits[i - 1];
    const curr = keyHits[i];
    if (prev.x === curr.x && prev.y === curr.y &&
        prev.flickDirection === curr.flickDirection) {
      sameCount++;
    }
  }

  return sameCount / (keyHits.length - 1);
}
