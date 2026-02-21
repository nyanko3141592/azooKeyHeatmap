import type {
  Custard,
  CustardKeyEntry,
  GridFitSpecifier,
  CustardCustomKey,
  CustardSystemKey,
  CustardKeyLabelStyle,
  DirectionalLabel,
  FlickDirection,
} from './types';
import { getLabelText, getSystemKeyLabel, getVariationInputs } from './parser';

const COLORS = {
  normal: { bg: '#ffffff', border: '#c0c0c0', text: '#333333' },
  special: { bg: '#adb5bd', border: '#868e96', text: '#ffffff' },
  selected: { bg: '#4dabf7', border: '#339af0', text: '#ffffff' },
  unimportant: { bg: '#e9ecef', border: '#ced4da', text: '#999999' },
  system: { bg: '#adb5bd', border: '#868e96', text: '#ffffff' },
};

const KEY_PADDING = 3;
const KEY_RADIUS = 8;

function getDPR(): number {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

export interface RenderedKey {
  entry: CustardKeyEntry;
  rect: { x: number; y: number; w: number; h: number };
}

export interface LayoutInfo {
  cellW: number;
  cellH: number;
  totalW: number;
  totalH: number;
  rowCount: number;
  colCount: number;
  isTenkey: boolean;
}

function computeMedianKeyWidth(keys: CustardKeyEntry[]): number {
  const widths: number[] = [];
  for (const entry of keys) {
    if (entry.specifier_type === 'grid_fit') {
      const spec = entry.specifier as GridFitSpecifier;
      widths.push(spec.width ?? 1);
    } else {
      widths.push(1);
    }
  }
  if (widths.length === 0) return 1;
  widths.sort((a, b) => a - b);
  return widths[Math.floor(widths.length / 2)];
}

export function computeLayout(custard: Custard, maxWidth: number): LayoutInfo {
  const layout = custard.interface.key_layout;
  const declaredRowCount = Math.floor(layout.row_count || 0);
  const declaredColCount = Math.floor(layout.column_count || 0);
  const isTenkey = custard.interface.key_style === 'tenkey_style';

  let computedCol = 0;
  let computedRow = 0;
  for (const entry of custard.interface.keys) {
    if (entry.specifier_type === 'grid_fit') {
      const spec = entry.specifier as GridFitSpecifier;
      const rightEdge = spec.x + (spec.width ?? 1);
      const bottomEdge = spec.y + (spec.height ?? 1);
      if (rightEdge > computedCol) computedCol = rightEdge;
      if (bottomEdge > computedRow) computedRow = bottomEdge;
    }
  }

  const rowCount = Math.max(1, declaredRowCount > 0 ? declaredRowCount : computedCol);
  const colCount = Math.max(1, declaredColCount > 0 ? declaredColCount : computedRow);
  const cellW = maxWidth / rowCount;
  const medianKeyWidth = computeMedianKeyWidth(custard.interface.keys);
  const effectiveKeyW = cellW * medianKeyWidth;
  const cellH = isTenkey ? effectiveKeyW * 0.95 : effectiveKeyW * 0.55;
  const totalW = cellW * rowCount;
  const totalH = cellH * colCount;

  return { cellW, cellH, totalW, totalH, rowCount, colCount, isTenkey };
}

export function computeRenderedKeys(custard: Custard, li: LayoutInfo): RenderedKey[] {
  const renderedKeys: RenderedKey[] = [];
  for (const entry of custard.interface.keys) {
    let kx: number, ky: number, kw: number, kh: number;
    if (entry.specifier_type === 'grid_fit') {
      const spec = entry.specifier as GridFitSpecifier;
      kx = spec.x * li.cellW + KEY_PADDING;
      ky = spec.y * li.cellH + KEY_PADDING;
      kw = Math.max(1, (spec.width ?? 1) * li.cellW - KEY_PADDING * 2);
      kh = Math.max(1, (spec.height ?? 1) * li.cellH - KEY_PADDING * 2);
    } else {
      const spec = entry.specifier as { index: number };
      const col = spec.index % li.rowCount;
      const row = Math.floor(spec.index / li.rowCount);
      kx = col * li.cellW + KEY_PADDING;
      ky = row * li.cellH + KEY_PADDING;
      kw = Math.max(1, li.cellW - KEY_PADDING * 2);
      kh = Math.max(1, li.cellH - KEY_PADDING * 2);
    }
    renderedKeys.push({ entry, rect: { x: kx, y: ky, w: kw, h: kh } });
  }
  return renderedKeys;
}

function setupCanvas(canvas: HTMLCanvasElement, totalW: number, totalH: number): CanvasRenderingContext2D {
  const dpr = getDPR();
  canvas.style.width = `${totalW}px`;
  canvas.style.height = `${totalH}px`;
  canvas.width = Math.round(totalW * dpr);
  canvas.height = Math.round(totalH * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, totalW, totalH);
  return ctx;
}

export function drawKeyboardToCtx(
  ctx: CanvasRenderingContext2D,
  custard: Custard,
  renderedKeys: RenderedKey[],
  li: LayoutInfo
): void {
  ctx.fillStyle = '#f1f3f5';
  ctx.fillRect(0, 0, li.totalW, li.totalH);

  for (const rk of renderedKeys) {
    const { entry, rect } = rk;
    if (entry.key_type === 'system') {
      drawSystemKey(ctx, entry.key as CustardSystemKey, rect.x, rect.y, rect.w, rect.h);
    } else {
      drawCustomKey(ctx, entry.key as CustardCustomKey, rect.x, rect.y, rect.w, rect.h, li.isTenkey);
    }
  }
}

export function renderKeyboard(
  canvas: HTMLCanvasElement,
  custard: Custard,
  maxWidth = 400
): { renderedKeys: RenderedKey[]; layoutInfo: LayoutInfo } {
  const layout = custard.interface.key_layout;
  if (layout.type !== 'grid_fit' && layout.type !== 'grid_scroll') {
    throw new Error(`未対応のレイアウト: ${(layout as { type: string }).type}`);
  }

  const li = computeLayout(custard, maxWidth);
  const renderedKeys = computeRenderedKeys(custard, li);
  const ctx = setupCanvas(canvas, li.totalW, li.totalH);
  drawKeyboardToCtx(ctx, custard, renderedKeys, li);

  return { renderedKeys, layoutInfo: li };
}

export function renderKeyboardOnCanvas(
  canvas: HTMLCanvasElement,
  custard: Custard,
  renderedKeys: RenderedKey[],
  li: LayoutInfo
): CanvasRenderingContext2D {
  const ctx = setupCanvas(canvas, li.totalW, li.totalH);
  drawKeyboardToCtx(ctx, custard, renderedKeys, li);
  return ctx;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawKeyBackground(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  colors: { bg: string; border: string }
) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  roundRect(ctx, x, y, w, h, KEY_RADIUS);
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.restore();

  roundRect(ctx, x, y, w, h, KEY_RADIUS);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawSystemKey(
  ctx: CanvasRenderingContext2D,
  key: CustardSystemKey,
  x: number, y: number, w: number, h: number
) {
  drawKeyBackground(ctx, x, y, w, h, COLORS.system);

  const label = getSystemKeyLabel(key);
  const fontSize = Math.min(w * 0.3, h * 0.35, 14);
  ctx.fillStyle = COLORS.system.text;
  ctx.font = `${fontSize}px -apple-system, "Hiragino Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2, w - 4);
}

function drawCustomKey(
  ctx: CanvasRenderingContext2D,
  key: CustardCustomKey,
  x: number, y: number, w: number, h: number,
  isTenkey: boolean
) {
  const colorSet = COLORS[key.design.color] || COLORS.normal;
  drawKeyBackground(ctx, x, y, w, h, colorSet);

  const label = key.design.label;
  drawLabel(ctx, label, x, y, w, h, colorSet.text);

  if (isTenkey) {
    const flickInputs = getVariationInputs(key);
    drawFlickLabels(ctx, flickInputs, x, y, w, h);
    if (hasDirectionalLabel(label)) {
      drawDirectionalLabelsFromDesign(ctx, label, x, y, w, h);
    }
  }
}

function hasDirectionalLabel(label: CustardKeyLabelStyle): boolean {
  return 'type' in label && label.type === 'main_and_directions';
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  label: CustardKeyLabelStyle,
  x: number, y: number, w: number, h: number,
  textColor: string
) {
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if ('type' in label) {
    switch (label.type) {
      case 'main_and_sub': {
        const typed = label as { type: 'main_and_sub'; main: string; sub: string };
        const mainSize = Math.min(w * 0.35, h * 0.3, 18);
        const subSize = Math.min(w * 0.2, h * 0.18, 10);
        ctx.font = `bold ${mainSize}px -apple-system, "Hiragino Sans", sans-serif`;
        ctx.fillText(typed.main, x + w / 2, y + h * 0.38, w - 6);
        ctx.font = `${subSize}px -apple-system, "Hiragino Sans", sans-serif`;
        ctx.fillStyle = '#888';
        ctx.fillText(typed.sub, x + w / 2, y + h * 0.65, w - 6);
        return;
      }
      case 'main_and_directions': {
        const typed = label as { type: 'main_and_directions'; main: string };
        const mainSize = Math.min(w * 0.35, h * 0.3, 18);
        ctx.font = `bold ${mainSize}px -apple-system, "Hiragino Sans", sans-serif`;
        ctx.fillText(typed.main, x + w / 2, y + h / 2, w - 6);
        return;
      }
    }
  }

  const text = getLabelText(label);
  const fontSize = Math.min(w * 0.35, h * 0.35, 20);
  ctx.font = `${fontSize}px -apple-system, "Hiragino Sans", sans-serif`;
  ctx.fillText(text, x + w / 2, y + h / 2, w - 4);
}

function drawFlickLabels(
  ctx: CanvasRenderingContext2D,
  flickInputs: Map<string, string>,
  x: number, y: number, w: number, h: number
) {
  const fontSize = Math.min(w * 0.15, h * 0.13, 9);
  ctx.font = `${fontSize}px -apple-system, "Hiragino Sans", sans-serif`;
  ctx.fillStyle = '#999';

  const positions: Record<FlickDirection, { tx: number; ty: number }> = {
    left:   { tx: x + w * 0.12, ty: y + h / 2 },
    right:  { tx: x + w * 0.88, ty: y + h / 2 },
    top:    { tx: x + w / 2,    ty: y + h * 0.12 },
    bottom: { tx: x + w / 2,    ty: y + h * 0.88 },
  };

  for (const [dir, text] of flickInputs) {
    const pos = positions[dir as FlickDirection];
    if (pos) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, pos.tx, pos.ty, w * 0.25);
    }
  }
}

function drawDirectionalLabelsFromDesign(
  ctx: CanvasRenderingContext2D,
  label: CustardKeyLabelStyle,
  x: number, y: number, w: number, h: number
) {
  if (!('type' in label) || label.type !== 'main_and_directions') return;
  const typed = label as { type: 'main_and_directions'; main: string; directions: DirectionalLabel };
  const dirs = typed.directions;

  const fontSize = Math.min(w * 0.15, h * 0.13, 9);
  ctx.font = `${fontSize}px -apple-system, "Hiragino Sans", sans-serif`;
  ctx.fillStyle = '#999';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (dirs.left) ctx.fillText(dirs.left, x + w * 0.12, y + h / 2, w * 0.25);
  if (dirs.right) ctx.fillText(dirs.right, x + w * 0.88, y + h / 2, w * 0.25);
  if (dirs.top) ctx.fillText(dirs.top, x + w / 2, y + h * 0.12, w * 0.25);
  if (dirs.bottom) ctx.fillText(dirs.bottom, x + w / 2, y + h * 0.88, w * 0.25);
}
