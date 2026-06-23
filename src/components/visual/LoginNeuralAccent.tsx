import { useEffect, useRef } from 'react';

type NodePoint = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  activation: number;
  twinkle: number;
  twinkleSpeed: number;
  neighbors: number[];
};

type Pulse = {
  from: number;
  to: number;
  progress: number;
  speed: number;
};

export function LoginNeuralAccent() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let nodes: NodePoint[] = [];
    let pulses: Pulse[] = [];
    let rafId = 0;
    let lastT = 0;
    let neighborTick = 0;

    const linkDistFor = (w: number) => Math.min(145, Math.max(90, w / 4.8));

    /** 1 no canto inferior esquerdo → mais claro; 0 no centro/topo → mais dim */
    const spatialFalloff = (x: number, y: number): number => {
      const distCorner = Math.hypot(x, height - y);
      const maxDist = Math.hypot(width, height);
      const t = Math.max(0, 1 - distCorner / maxDist);
      return Math.pow(t, 1.22);
    };

    const buildNeighbors = () => {
      const lim = linkDistFor(width);
      const lim2 = lim * lim;

      for (let i = 0; i < nodes.length; i++) {
        const ngh: number[] = [];

        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;

          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;

          if (dx * dx + dy * dy < lim2) {
            ngh.push(j);
          }
        }

        nodes[i].neighbors = ngh;
      }
    };

    const spawnPulse = (from: number, to: number) => {
      if (pulses.length > 18) return;

      pulses.push({
        from,
        to,
        progress: 0,
        speed: 0.009 + Math.random() * 0.006,
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();

      width = rect.width;
      height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      const area = width * height;
      const target = Math.min(42, Math.max(24, Math.floor(area / 14000)));

      nodes = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.07,
        vy: (Math.random() - 0.5) * 0.07,
        r: Math.random() * 1.0 + 0.65,
        alpha: Math.random() * 0.28 + 0.32,
        activation: 0,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.006 + 0.0025,
        neighbors: [],
      }));

      pulses = [];
      buildNeighbors();
    };

    const tick = (t: number) => {
      const dt = lastT ? Math.min(50, t - lastT) : 16;
      lastT = t;

      const step = reducedMotion ? 0 : dt / 16;

      ctx.clearRect(0, 0, width, height);

      neighborTick += step;

      if (neighborTick > 40) {
        buildNeighbors();
        neighborTick = 0;
      }

      if (!reducedMotion && Math.random() < 0.02 && nodes.length) {
        const idx = Math.floor(Math.random() * nodes.length);
        nodes[idx].activation = Math.min(1, nodes[idx].activation + 0.55);

        const ngh = nodes[idx].neighbors;
        const fanOut = Math.min(1, ngh.length);

        for (let k = 0; k < fanOut; k++) {
          const target = ngh[Math.floor(Math.random() * ngh.length)];
          spawnPulse(idx, target);
        }
      }

      for (const p of nodes) {
        if (step > 0) {
          p.x += p.vx * step;
          p.y += p.vy * step;

          if (p.x < -12) p.x = width + 12;
          if (p.x > width + 12) p.x = -12;
          if (p.y < -12) p.y = height + 12;
          if (p.y > height + 12) p.y = -12;

          p.twinkle += p.twinkleSpeed * step;
          p.activation *= Math.pow(0.94, step);

          if (p.activation < 0.01) p.activation = 0;
        }
      }

      const lim = linkDistFor(width);
      ctx.lineWidth = 0.65;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];

        for (let k = 0; k < a.neighbors.length; k++) {
          const j = a.neighbors[k];

          if (j <= i) continue;

          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);

          if (d >= lim) continue;

          const base = (1 - d / lim) * 0.24;
          const boost = Math.max(a.activation, b.activation) * 0.28;

          const fa = spatialFalloff(a.x, a.y);
          const fb = spatialFalloff(b.x, b.y);

          const linkGrad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          linkGrad.addColorStop(0, `rgba(88, 116, 164, ${(base + boost) * fa})`);
          linkGrad.addColorStop(1, `rgba(88, 116, 164, ${(base + boost) * fb})`);

          ctx.strokeStyle = linkGrad;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      const survivors: Pulse[] = [];

      for (const pulse of pulses) {
        if (step > 0) pulse.progress += pulse.speed * step;

        const fromN = nodes[pulse.from];
        const toN = nodes[pulse.to];

        if (!fromN || !toN) continue;

        if (pulse.progress >= 1) {
          toN.activation = Math.min(1, toN.activation + 0.48);

          if (!reducedMotion && Math.random() < 0.18 && toN.neighbors.length) {
            let next = toN.neighbors[Math.floor(Math.random() * toN.neighbors.length)];

            if (next === pulse.from && toN.neighbors.length > 1) {
              next =
                toN.neighbors[(toN.neighbors.indexOf(next) + 1) % toN.neighbors.length];
            }

            if (next !== pulse.from) {
              spawnPulse(pulse.to, next);
            }
          }

          continue;
        }

        survivors.push(pulse);

        const px = fromN.x + (toN.x - fromN.x) * pulse.progress;
        const py = fromN.y + (toN.y - fromN.y) * pulse.progress;
        const pf = spatialFalloff(px, py);

        const trailLen = 0.16;
        const tStart = Math.max(0, pulse.progress - trailLen);

        const sx = fromN.x + (toN.x - fromN.x) * tStart;
        const sy = fromN.y + (toN.y - fromN.y) * tStart;

        const trailGrad = ctx.createLinearGradient(sx, sy, px, py);
        trailGrad.addColorStop(0, 'rgba(128,157,205,0)');
        trailGrad.addColorStop(1, `rgba(128,157,205,${0.55 * pf})`);

        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = 1.1;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(px, py);
        ctx.stroke();

        const halo = ctx.createRadialGradient(px, py, 0, px, py, 7);
        halo.addColorStop(0, `rgba(128,157,205,${0.58 * pf})`);
        halo.addColorStop(1, 'rgba(128,157,205,0)');

        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(190,210,238,${0.88 * pf})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.35, 0, Math.PI * 2);
        ctx.fill();
      }

      pulses = survivors;

      for (const p of nodes) {
        const tw = 0.62 + Math.sin(p.twinkle) * 0.28;
        const spatial = spatialFalloff(p.x, p.y);
        const a = Math.min(1, (p.alpha * tw + p.activation * 0.42) * spatial);
        const r = p.r + p.activation * 1.2;

        const nodeHalo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4.5 + p.activation * 6);

        nodeHalo.addColorStop(0, `rgba(88,116,164,${a * 0.38})`);
        nodeHalo.addColorStop(1, 'rgba(88,116,164,0)');

        ctx.fillStyle = nodeHalo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 4.5 + p.activation * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle =
          p.activation > 0.15
            ? `rgba(190,210,238,${a * 0.85})`
            : `rgba(128,157,205,${a * 0.72})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(tick);
    };

    resize();
    rafId = requestAnimationFrame(tick);

    const onResize = () => resize();

    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        className="absolute bottom-0 left-0 h-[58vh] min-h-[420px] w-[54vw] min-w-[580px] max-w-[820px]"
        style={{
          maskImage:
            'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.88) 32%, rgba(0,0,0,0.52) 62%, transparent 92%)',
          WebkitMaskImage:
            'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.88) 32%, rgba(0,0,0,0.52) 62%, transparent 92%)',
        }}
      >
        <canvas ref={canvasRef} className="h-full w-full opacity-[0.88]" aria-hidden="true" />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(to_top,transparent_0%,rgba(5,7,10,0.05)_38%,rgba(5,7,10,0.38)_88%)]" />
    </div>
  );
}
