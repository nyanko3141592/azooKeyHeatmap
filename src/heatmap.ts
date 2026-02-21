import type { Custard, SimulationResult, FlickDirection } from './types';
import type { RenderedKey, LayoutInfo } from './renderer';
import { renderKeyboardOnCanvas } from './renderer';
import { getKeyFrequency, getFlickFrequency } from './simulator';
import type { FlickFrequencyEntry } from './simulator';

function frequencyToColor(normalized: number): string {
  let r: number, g: number, b: number;
  if (normalized < 0.5) {
    const t = normalized * 2;
    r = Math.round(t * 255);
    g = Math.round(100 + t * 155);
    b = Math.round(255 - t * 200);
  } else {
    const t = (normalized - 0.5) * 2;
    r = 255;
    g = Math.round(255 - t * 255);
    b = Math.round(55 - t * 55);
  }
  return `rgba(${r},${g},${b},0.55)`;
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

export function renderHeatmap(
  canvas: HTMLCanvasElement,
  custard: Custard,
  renderedKeys: RenderedKey[],
  layoutInfo: LayoutInfo,
  simResult: SimulationResult
): void {
  const ctx = renderKeyboardOnCanvas(canvas, custard, renderedKeys, layoutInfo);

  const keyFreq = getKeyFrequency(simResult, custard.interface.keys);
  let maxFreq = 0;
  for (const freq of keyFreq.values()) {
    if (freq > maxFreq) maxFreq = freq;
  }
  if (maxFreq === 0) return;

  for (let i = 0; i < renderedKeys.length; i++) {
    const freq = keyFreq.get(i) || 0;
    if (freq === 0) continue;

    const normalized = freq / maxFreq;
    const rk = renderedKeys[i];

    ctx.save();
    roundRect(ctx, rk.rect.x, rk.rect.y, rk.rect.w, rk.rect.h, 8);
    ctx.clip();
    ctx.fillStyle = frequencyToColor(normalized);
    ctx.fillRect(rk.rect.x, rk.rect.y, rk.rect.w, rk.rect.h);
    ctx.restore();

    const fontSize = Math.min(rk.rect.w * 0.22, rk.rect.h * 0.2, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.font = `bold ${fontSize}px -apple-system, "Hiragino Sans", sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(freq), rk.rect.x + rk.rect.w - 4, rk.rect.y + rk.rect.h - 3);
  }
}

const FLICK_DIRS: FlickDirection[] = ['left', 'top', 'right', 'bottom'];

function clipZone(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  zone: 'center' | FlickDirection
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const inset = Math.min(w, h) * 0.22;

  ctx.beginPath();
  switch (zone) {
    case 'top':
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(cx + inset, cy - inset);
      ctx.lineTo(cx - inset, cy - inset);
      break;
    case 'right':
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(cx + inset, cy + inset);
      ctx.lineTo(cx + inset, cy - inset);
      break;
    case 'bottom':
      ctx.moveTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(cx - inset, cy + inset);
      ctx.lineTo(cx + inset, cy + inset);
      break;
    case 'left':
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y);
      ctx.lineTo(cx - inset, cy - inset);
      ctx.lineTo(cx - inset, cy + inset);
      break;
    case 'center':
      ctx.moveTo(cx - inset, cy - inset);
      ctx.lineTo(cx + inset, cy - inset);
      ctx.lineTo(cx + inset, cy + inset);
      ctx.lineTo(cx - inset, cy + inset);
      break;
  }
  ctx.closePath();
}

function drawZoneDividers(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const inset = Math.min(w, h) * 0.22;

  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.5;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(cx - inset, cy - inset);
  ctx.moveTo(x + w, y);
  ctx.lineTo(cx + inset, cy - inset);
  ctx.moveTo(x + w, y + h);
  ctx.lineTo(cx + inset, cy + inset);
  ctx.moveTo(x, y + h);
  ctx.lineTo(cx - inset, cy + inset);
  ctx.stroke();

  ctx.strokeRect(cx - inset, cy - inset, inset * 2, inset * 2);
}

type ZoneName = 'center' | FlickDirection;

function getZoneLabelPos(
  x: number, y: number, w: number, h: number,
  zone: ZoneName
): { tx: number; ty: number; align: CanvasTextAlign; baseline: CanvasTextBaseline } {
  const cx = x + w / 2;
  const cy = y + h / 2;
  switch (zone) {
    case 'center':
      return { tx: cx, ty: cy, align: 'center', baseline: 'middle' };
    case 'top':
      return { tx: cx, ty: y + (cy - y) * 0.35, align: 'center', baseline: 'middle' };
    case 'bottom':
      return { tx: cx, ty: cy + (y + h - cy) * 0.65, align: 'center', baseline: 'middle' };
    case 'left':
      return { tx: x + (cx - x) * 0.35, ty: cy, align: 'center', baseline: 'middle' };
    case 'right':
      return { tx: cx + (x + w - cx) * 0.65, ty: cy, align: 'center', baseline: 'middle' };
  }
}

export function renderFlickHeatmap(
  canvas: HTMLCanvasElement,
  custard: Custard,
  renderedKeys: RenderedKey[],
  layoutInfo: LayoutInfo,
  simResult: SimulationResult
): void {
  const ctx = renderKeyboardOnCanvas(canvas, custard, renderedKeys, layoutInfo);
  const flickFreq = getFlickFrequency(simResult);

  let maxZoneFreq = 0;
  for (const entry of flickFreq.values()) {
    for (const dir of FLICK_DIRS) {
      if (entry[dir] > maxZoneFreq) maxZoneFreq = entry[dir];
    }
    if (entry.center > maxZoneFreq) maxZoneFreq = entry.center;
  }
  if (maxZoneFreq === 0) return;

  for (let i = 0; i < renderedKeys.length; i++) {
    const freq = flickFreq.get(i);
    if (!freq || freq.total === 0) continue;

    const rk = renderedKeys[i];
    const { x, y, w, h } = rk.rect;

    const hasFlickData = FLICK_DIRS.some(d => freq[d] > 0);

    if (!hasFlickData) {
      const normalized = freq.center / maxZoneFreq;
      ctx.save();
      roundRect(ctx, x, y, w, h, 8);
      ctx.clip();
      ctx.fillStyle = frequencyToColor(normalized);
      ctx.fillRect(x, y, w, h);
      ctx.restore();

      const fontSize = Math.min(w * 0.22, h * 0.2, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.font = `bold ${fontSize}px -apple-system, "Hiragino Sans", sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(freq.center), x + w - 4, y + h - 3);
      continue;
    }

    const zones: ZoneName[] = ['center', ...FLICK_DIRS];
    for (const zone of zones) {
      const zoneFreq = freq[zone];
      if (zoneFreq === 0) continue;

      const normalized = zoneFreq / maxZoneFreq;

      ctx.save();
      roundRect(ctx, x, y, w, h, 8);
      ctx.clip();
      clipZone(ctx, x, y, w, h, zone);
      ctx.clip();
      ctx.fillStyle = frequencyToColor(normalized);
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

    ctx.save();
    roundRect(ctx, x, y, w, h, 8);
    ctx.clip();
    drawZoneDividers(ctx, x, y, w, h);
    ctx.restore();

    const fontSize = Math.min(w * 0.16, h * 0.14, 9);
    ctx.font = `bold ${fontSize}px -apple-system, "Hiragino Sans", sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';

    for (const zone of zones) {
      const zoneFreq = freq[zone];
      if (zoneFreq === 0) continue;

      const pos = getZoneLabelPos(x, y, w, h, zone);
      ctx.textAlign = pos.align;
      ctx.textBaseline = pos.baseline;
      ctx.fillText(String(zoneFreq), pos.tx, pos.ty);
    }
  }
}
