import type { Custard, SimulationResult } from './types';
import type { RenderedKey, LayoutInfo } from './renderer';
import { renderKeyboardOnCanvas } from './renderer';

export interface TrailController {
  play: () => void;
  stop: () => void;
}

export function renderFingerTrail(
  canvas: HTMLCanvasElement,
  cursorEl: HTMLElement,
  custard: Custard,
  renderedKeys: RenderedKey[],
  layoutInfo: LayoutInfo,
  simResult: SimulationResult
): TrailController {
  const li = layoutInfo;
  let animId: number | null = null;

  const points: Array<{ x: number; y: number; isFlick: boolean }> = [];
  for (const hit of simResult.keyHits) {
    const cx = (hit.x + hit.width / 2) * li.cellW;
    const cy = (hit.y + hit.height / 2) * li.cellH;

    points.push({ x: cx, y: cy, isFlick: false });

    if (hit.flickDirection) {
      const offset = 0.22;
      let fx = cx, fy = cy;
      if (hit.flickDirection === 'left') fx -= hit.width * li.cellW * offset;
      if (hit.flickDirection === 'right') fx += hit.width * li.cellW * offset;
      if (hit.flickDirection === 'top') fy -= hit.height * li.cellH * offset;
      if (hit.flickDirection === 'bottom') fy += hit.height * li.cellH * offset;
      points.push({ x: fx, y: fy, isFlick: true });
    }
  }

  function play() {
    stop();
    cursorEl.style.opacity = '0';

    const ctx = renderKeyboardOnCanvas(canvas, custard, renderedKeys, li);
    ctx.fillStyle = 'rgba(248, 249, 250, 0.45)';
    ctx.fillRect(0, 0, li.totalW, li.totalH);

    if (points.length < 2) return;

    let drawn = 0;
    const total = points.length;
    const duration = 3500;
    const startTime = performance.now();

    function frame(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 2.5);
      const target = Math.floor(eased * total);

      for (let i = drawn + 1; i <= target && i < total; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dist = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);

        if (curr.isFlick) {
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.strokeStyle = 'rgba(34, 139, 230, 0.18)';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.stroke();
        } else {
          const alpha = Math.min(0.25, 0.08 + dist * 0.003);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.strokeStyle = `rgba(112, 72, 232, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(curr.x, curr.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 139, 230, 0.1)';
        ctx.fill();
      }

      drawn = target;

      if (drawn > 0 && drawn < total) {
        const pos = points[drawn];
        cursorEl.style.left = `${pos.x}px`;
        cursorEl.style.top = `${pos.y}px`;
        cursorEl.style.opacity = '1';
      }

      if (progress < 1) {
        animId = requestAnimationFrame(frame);
      } else {
        cursorEl.style.opacity = '0';
        animId = null;
      }
    }

    animId = requestAnimationFrame(frame);
  }

  function stop() {
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    cursorEl.style.opacity = '0';
  }

  return { play, stop };
}
