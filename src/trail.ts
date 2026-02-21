import type { Custard, SimulationResult } from './types';
import type { RenderedKey, LayoutInfo } from './renderer';
import { renderKeyboardOnCanvas } from './renderer';

export interface TrailController {
  play: () => void;
  stop: () => void;
}

export function renderFingerTrail(
  canvas: HTMLCanvasElement,
  custard: Custard,
  renderedKeys: RenderedKey[],
  layoutInfo: LayoutInfo,
  simResult: SimulationResult
): TrailController {
  const li = layoutInfo;
  let animId: number | null = null;

  const points = simResult.keyHits.map(hit => {
    let cx = (hit.x + hit.width / 2) * li.cellW;
    let cy = (hit.y + hit.height / 2) * li.cellH;

    const offset = 0.2;
    if (hit.flickDirection === 'left') cx -= hit.width * li.cellW * offset;
    if (hit.flickDirection === 'right') cx += hit.width * li.cellW * offset;
    if (hit.flickDirection === 'top') cy -= hit.height * li.cellH * offset;
    if (hit.flickDirection === 'bottom') cy += hit.height * li.cellH * offset;

    return { x: cx, y: cy };
  });

  function play() {
    stop();

    const ctx = renderKeyboardOnCanvas(canvas, custard, renderedKeys, li);
    ctx.fillStyle = 'rgba(248, 249, 250, 0.5)';
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

        const alpha = Math.min(0.12, 0.04 + dist * 0.001);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.strokeStyle = `rgba(112, 72, 232, ${alpha})`;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(curr.x, curr.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 139, 230, 0.05)';
        ctx.fill();
      }

      drawn = target;

      if (progress < 1) {
        animId = requestAnimationFrame(frame);
      } else {
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
  }

  return { play, stop };
}
