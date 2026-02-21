import './style.css';
import type { Custard, EvaluationMode, SimulationResult } from './types';
import { parseCustard } from './parser';
import { renderKeyboard } from './renderer';
import type { RenderedKey, LayoutInfo } from './renderer';
import { simulate } from './simulator';
import { renderHeatmap, renderFlickHeatmap } from './heatmap';
import { calculateScore } from './scoring';

let currentCustard: Custard | null = null;
let renderedKeys: RenderedKey[] = [];
let layoutInfo: LayoutInfo | null = null;

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

function loadCustard(custard: Custard) {
  currentCustard = custard;
  resultsSection.classList.add('hidden');
  clearError();

  keyboardName.textContent = `${custard.metadata.display_name} (${custard.identifier})`;

  const containerWidth = Math.min(
    document.getElementById('keyboard-container')!.clientWidth - 20,
    420
  );
  const result = renderKeyboard(keyboardCanvas, custard, containerWidth);
  renderedKeys = result.renderedKeys;
  layoutInfo = result.layoutInfo;

  keyboardSection.classList.remove('hidden');
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

  const customText = customCorpus.value.trim() || undefined;

  try {
    const simResult = simulate(currentCustard, mode, customText);
    displayResults(simResult);
  } catch (err) {
    showError(`評価中にエラーが発生しました: ${(err as Error).message}`);
  }
});

function displayResults(simResult: SimulationResult) {
  if (!currentCustard || !layoutInfo) return;

  renderHeatmap(heatmapCanvas, currentCustard, renderedKeys, layoutInfo, simResult);
  renderFlickHeatmap(flickHeatmapCanvas, currentCustard, renderedKeys, layoutInfo, simResult);

  const score = calculateScore(simResult);

  setScoreValue('score-total', String(score.total));
  setScoreValue('score-coverage', `${score.coverage}%`);
  setScoreValue('score-distance', String(score.distance));
  setScoreValue('score-evenness', `${score.evenness}%`);
  setScoreValue('score-same-key', String(score.sameKeyRate));

  const statsTable = document.getElementById('stats-table')!;
  const unmappedList = simResult.unmappedChars.size > 0
    ? Array.from(simResult.unmappedChars).slice(0, 20).map(c => c === ' ' ? '(空白)' : c).join(', ')
    : 'なし';

  statsTable.innerHTML = `
    <table>
      <tr><th>総入力文字数</th><td>${simResult.totalChars}</td></tr>
      <tr><th>マッピング成功</th><td>${simResult.mappedChars} / ${simResult.totalChars}</td></tr>
      <tr><th>総打鍵数</th><td>${score.details.totalKeystrokes}</td></tr>
      <tr><th>使用キー数</th><td>${score.details.uniqueKeysUsed}</td></tr>
      <tr><th>平均打鍵距離</th><td>${score.details.averageDistance}</td></tr>
      <tr><th>最頻キー</th><td>${score.details.maxFrequencyKey} (${score.details.maxFrequency}回)</td></tr>
      <tr><th>マッピング不可文字</th><td>${unmappedList}</td></tr>
    </table>
  `;

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function setScoreValue(id: string, value: string) {
  const card = document.getElementById(id);
  if (card) {
    const valueEl = card.querySelector('.score-value');
    if (valueEl) valueEl.textContent = value;
  }
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
