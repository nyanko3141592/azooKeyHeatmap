import './style.css';
import type { Custard, CustardCustomKey, CustardSystemKey, EvaluationMode, SimulationResult, FlickDirection } from './types';
import { parseCustard, getInputText, getVariationInputs, getLabelText, getSystemKeyLabel } from './parser';
import { renderKeyboard } from './renderer';
import type { RenderedKey, LayoutInfo } from './renderer';
import { simulate } from './simulator';
import { renderHeatmap, renderFlickHeatmap } from './heatmap';
import { calculateScore } from './scoring';
import { renderFingerTrail } from './trail';
import type { TrailController } from './trail';
import type { ScoreResult } from './types';

let currentCustard: Custard | null = null;
let renderedKeys: RenderedKey[] = [];
let layoutInfo: LayoutInfo | null = null;
let lastScore: ScoreResult | null = null;
let lastMode: EvaluationMode = 'hiragana';
let trailController: TrailController | null = null;
let lastSimResult: SimulationResult | null = null;

const dropZone = document.getElementById('drop-zone')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const keyboardSection = document.getElementById('keyboard-section')!;
const keyboardName = document.getElementById('keyboard-name')!;
const keyboardCanvas = document.getElementById('keyboard-canvas') as HTMLCanvasElement;
const evaluateBtn = document.getElementById('evaluate-btn')!;
const resultsSection = document.getElementById('results-section')!;
const heatmapCanvas = document.getElementById('heatmap-canvas') as HTMLCanvasElement;
const flickHeatmapCanvas = document.getElementById('flick-heatmap-canvas') as HTMLCanvasElement;
const customCorpus = document.getElementById('custom-corpus') as HTMLTextAreaElement;

const CIRCUMFERENCE = 2 * Math.PI * 52;

const MODE_LABELS: Record<EvaluationMode, string> = {
  hiragana: '日本語入力（ひらがな）',
  romaji: 'ローマ字入力',
  english: '英字入力',
};

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer?.files[0];
  if (file) loadFile(file);
});

dropZone.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) loadFile(file);
});

document.querySelectorAll<HTMLButtonElement>('.sample-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const filename = btn.dataset.sample;
    if (!filename) return;
    try {
      const base = import.meta.env.BASE_URL;
      const resp = await fetch(`${base}samples/${filename}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const parsed = parseCustard(text);
      const custard = Array.isArray(parsed) ? parsed[0] : parsed;
      loadCustard(custard);
    } catch (err) {
      showError(`サンプルの読み込みに失敗しました: ${(err as Error).message}`);
    }
  });
});

function loadFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result as string;
      const parsed = parseCustard(text);
      const custard = Array.isArray(parsed) ? parsed[0] : parsed;
      loadCustard(custard);
    } catch (err) {
      showError(`JSON の解析に失敗しました: ${(err as Error).message}`);
    }
  };
  reader.readAsText(file);
}

function detectEvaluationMode(custard: Custard): EvaluationMode {
  if (custard.input_style === 'roman2kana') return 'romaji';
  if (custard.language === 'ja_JP') return 'hiragana';
  return 'english';
}

function loadCustard(custard: Custard) {
  currentCustard = custard;
  resultsSection.classList.add('hidden');
  clearError();

  const mode = detectEvaluationMode(custard);
  const radio = document.querySelector<HTMLInputElement>(`input[name="mode"][value="${mode}"]`);
  if (radio) radio.checked = true;

  keyboardName.textContent = `${custard.metadata.display_name} (${custard.identifier})`;

  keyboardSection.classList.remove('hidden');

  const containerWidth = Math.max(
    100,
    Math.min(
      document.getElementById('keyboard-container')!.clientWidth - 20,
      420
    )
  );
  try {
    const result = renderKeyboard(keyboardCanvas, custard, containerWidth);
    renderedKeys = result.renderedKeys;
    layoutInfo = result.layoutInfo;
  } catch (err) {
    showError(`キーボードの描画に失敗しました: ${(err as Error).message}`);
  }
}

evaluateBtn.addEventListener('click', () => {
  if (!currentCustard || !layoutInfo) return;

  const modeRadios = document.querySelectorAll<HTMLInputElement>('input[name="mode"]');
  let mode: EvaluationMode = 'hiragana';
  for (const radio of modeRadios) {
    if (radio.checked) {
      mode = radio.value as EvaluationMode;
      break;
    }
  }
  lastMode = mode;

  const customText = customCorpus.value.trim() || undefined;

  try {
    const simResult = simulate(currentCustard, mode, customText);
    displayResults(simResult);
  } catch (err) {
    showError(`評価中にエラーが発生しました: ${(err as Error).message}`);
  }
});

// ==================== Heatmap Tabs ====================
const PANEL_IDS = ['key', 'flick', 'trail'] as const;

document.querySelectorAll<HTMLButtonElement>('.heatmap-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.heatmap-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.target;
    for (const id of PANEL_IDS) {
      document.getElementById(`heatmap-panel-${id}`)!.classList.toggle('hidden', target !== id);
    }
    if (target === 'trail') {
      playTrail();
    } else if (trailController) {
      trailController.stop();
    }
  });
});

function playTrail() {
  if (!currentCustard || !layoutInfo || !lastSimResult) return;
  const trailCanvas = document.getElementById('trail-canvas') as HTMLCanvasElement;
  trailController = renderFingerTrail(trailCanvas, currentCustard, renderedKeys, layoutInfo, lastSimResult);
  trailController.play();
}

document.getElementById('trail-replay-btn')!.addEventListener('click', playTrail);

// ==================== Score Helpers ====================
function scoreColor(score: number): { primary: string; gradient: [string, string] } {
  if (score >= 80) return { primary: '#40c057', gradient: ['#40c057', '#20c997'] };
  if (score >= 60) return { primary: '#fab005', gradient: ['#fab005', '#fd7e14'] };
  if (score >= 40) return { primary: '#fd7e14', gradient: ['#fd7e14', '#fa5252'] };
  return { primary: '#fa5252', gradient: ['#fa5252', '#e03131'] };
}

function scoreRank(score: number): { rank: string; label: string } {
  if (score >= 90) return { rank: 'S', label: '極めて優秀' };
  if (score >= 80) return { rank: 'A', label: '優秀' };
  if (score >= 70) return { rank: 'B', label: '良好' };
  if (score >= 60) return { rank: 'C', label: '平均的' };
  if (score >= 50) return { rank: 'D', label: '改善の余地あり' };
  return { rank: 'F', label: '要改善' };
}

function getFreqKeyLabel(freqKey: string, custard: Custard): string {
  const parts = freqKey.split(':');
  const keyIndex = parseInt(parts[0], 10);
  const direction = parts[1] as FlickDirection | undefined;

  if (keyIndex < 0 || keyIndex >= custard.interface.keys.length) return freqKey;

  const entry = custard.interface.keys[keyIndex];
  if (entry.key_type === 'system') {
    return getSystemKeyLabel(entry.key as CustardSystemKey);
  }

  const key = entry.key as CustardCustomKey;
  if (direction) {
    const flickInputs = getVariationInputs(key);
    const flickText = flickInputs.get(direction);
    if (flickText) return flickText;
  }

  const inputText = getInputText(key);
  return inputText || getLabelText(key.design.label);
}

// ==================== Display Results ====================
function displayResults(simResult: SimulationResult) {
  if (!currentCustard || !layoutInfo) return;

  lastSimResult = simResult;
  if (trailController) { trailController.stop(); trailController = null; }

  renderHeatmap(heatmapCanvas, currentCustard, renderedKeys, layoutInfo, simResult);
  renderFlickHeatmap(flickHeatmapCanvas, currentCustard, renderedKeys, layoutInfo, simResult);

  const score = calculateScore(simResult);
  lastScore = score;
  const colors = scoreColor(score.total);
  const rank = scoreRank(score.total);

  // Ring gauge
  const ringFill = document.getElementById('score-ring-fill')!;
  const gradStop1 = document.getElementById('grad-stop-1')!;
  const gradStop2 = document.getElementById('grad-stop-2')!;
  ringFill.style.strokeDashoffset = String(CIRCUMFERENCE);
  gradStop1.setAttribute('stop-color', colors.gradient[0]);
  gradStop2.setAttribute('stop-color', colors.gradient[1]);

  document.getElementById('score-number')!.textContent = String(score.total);
  const rankEl = document.getElementById('score-rank')!;
  rankEl.textContent = `${rank.rank} - ${rank.label}`;
  rankEl.style.color = colors.primary;

  // Score info
  document.getElementById('result-kb-name')!.textContent =
    currentCustard.metadata.display_name || currentCustard.identifier;
  document.getElementById('result-eval-meta')!.textContent =
    `${MODE_LABELS[lastMode]} / ${simResult.totalChars}文字`;

  // Sub scores
  setSubScore('coverage', `${score.coverage}%`, score.coverage);
  setSubScore('distance', String(score.distance), score.distance);
  setSubScore('evenness', `${score.evenness}%`, score.evenness);
  setSubScore('samekey', String(score.sameKeyRate), score.sameKeyRate);

  // Frequency chart
  renderFrequencyChart(simResult, currentCustard);

  // Stats grid
  const efficiency = simResult.mappedChars > 0
    ? (score.details.totalKeystrokes / simResult.mappedChars).toFixed(2)
    : '-';
  const coveragePct = simResult.totalChars > 0
    ? ((simResult.mappedChars / simResult.totalChars) * 100).toFixed(1)
    : '0';

  document.getElementById('stats-grid')!.innerHTML = [
    statItem(String(simResult.totalChars), '総入力文字数'),
    statItem(`${coveragePct}%`, 'マッピング成功率'),
    statItem(String(score.details.totalKeystrokes), '総打鍵数'),
    statItem(String(score.details.uniqueKeysUsed), '使用キー数'),
    statItem(efficiency, '打鍵/文字'),
    statItem(String(score.details.averageDistance), '平均打鍵距離'),
  ].join('');

  // Unmapped chars
  const unmappedSection = document.getElementById('unmapped-section')!;
  const unmappedContainer = document.getElementById('unmapped-chars')!;
  if (simResult.unmappedChars.size > 0) {
    unmappedContainer.innerHTML = Array.from(simResult.unmappedChars)
      .slice(0, 30)
      .map(c => `<span class="unmapped-tag">${c === ' ' ? '(空白)' : escapeHtml(c)}</span>`)
      .join('');
    unmappedSection.classList.remove('hidden');
  } else {
    unmappedSection.classList.add('hidden');
  }

  // Show & animate
  resultsSection.classList.remove('hidden');
  // Reset active tab
  document.querySelectorAll('.heatmap-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.heatmap-tab[data-target="key"]')!.classList.add('active');
  for (const id of PANEL_IDS) {
    document.getElementById(`heatmap-panel-${id}`)!.classList.toggle('hidden', id !== 'key');
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const offset = CIRCUMFERENCE * (1 - score.total / 100);
      ringFill.style.strokeDashoffset = String(offset);
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function setSubScore(id: string, valueText: string, percent: number) {
  const card = document.querySelector(`.sub-score[data-id="${id}"]`)!;
  const valueEl = card.querySelector('.sub-value')!;
  const fillEl = card.querySelector<HTMLElement>('.progress-fill')!;
  const colors = scoreColor(percent);

  valueEl.textContent = valueText;
  fillEl.style.background = `linear-gradient(90deg, ${colors.gradient[0]}, ${colors.gradient[1]})`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fillEl.style.width = `${Math.min(100, percent)}%`;
    });
  });
}

function statItem(value: string, label: string): string {
  return `<div class="stat-item"><div class="stat-number">${escapeHtml(value)}</div><div class="stat-name">${escapeHtml(label)}</div></div>`;
}

function renderFrequencyChart(simResult: SimulationResult, custard: Custard) {
  const entries: Array<{ label: string; count: number }> = [];
  for (const [freqKey, freq] of simResult.frequencyMap) {
    entries.push({ label: getFreqKeyLabel(freqKey, custard), count: freq });
  }
  entries.sort((a, b) => b.count - a.count);
  const top = entries.slice(0, 10);
  const maxCount = top.length > 0 ? top[0].count : 1;
  const totalHits = Array.from(simResult.frequencyMap.values()).reduce((a, b) => a + b, 0);

  const container = document.getElementById('freq-chart')!;
  container.innerHTML = top.map((e, i) => {
    const pct = (e.count / maxCount) * 100;
    const sharePct = ((e.count / totalHits) * 100).toFixed(1);
    return `<div class="freq-row">
      <span class="freq-label">${escapeHtml(e.label)}</span>
      <div class="freq-bar-track"><div class="freq-bar-fill" data-width="${pct}" style="transition-delay:${i * 60}ms"></div></div>
      <span class="freq-count">${e.count}</span>
      <span class="freq-pct">${sharePct}%</span>
    </div>`;
  }).join('');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.querySelectorAll<HTMLElement>('.freq-bar-fill').forEach(bar => {
        bar.style.width = `${bar.dataset.width}%`;
      });
    });
  });
}

// ==================== Share ====================
document.getElementById('share-btn')!.addEventListener('click', () => {
  if (!currentCustard || !lastScore) return;
  const s = lastScore;
  const name = currentCustard.metadata.display_name || currentCustard.identifier;

  const text = [
    `azooKey キーボード評価`,
    `━━━━━━━━━━━━━━━━━━`,
    `キーボード: ${name}`,
    `モード: ${MODE_LABELS[lastMode]}`,
    ``,
    `総合スコア: ${s.total}/100 [${scoreRank(s.total).rank} - ${scoreRank(s.total).label}]`,
    ``,
    `カバー率: ${s.coverage}% | 均等性: ${s.evenness}%`,
    `打鍵距離: ${s.distance} | 同キー連続: ${s.sameKeyRate}`,
    ``,
    `総打鍵数: ${s.details.totalKeystrokes} | 使用キー数: ${s.details.uniqueKeysUsed}`,
    `平均打鍵距離: ${s.details.averageDistance}`,
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('share-btn')!;
    btn.classList.add('copied');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>コピーしました`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>結果をコピー`;
    }, 2000);
  });
});

// ==================== Utils ====================
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showError(message: string) {
  clearError();
  const el = document.createElement('div');
  el.className = 'error-message';
  el.textContent = message;
  const main = document.querySelector('main')!;
  main.insertBefore(el, main.firstChild);
}

function clearError() {
  const existing = document.querySelector('.error-message');
  if (existing) existing.remove();
}
