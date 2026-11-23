import { useId, type ReactNode, type Ref } from 'react';
import { useRevealProgress } from '@/hooks/use-reveal-progress';
import { MORE, WORKLOADS, squarify } from '@/lib/disk-sample';

/*
 * Thin-stroke isometric drawings for the three "Inside diskMon" cards. Each one plays a short
 * animation the first time it scrolls into view. Strokes use currentColor and faces use theme
 * tokens, so the same drawing works on paper and on dark.
 */

type P = [number, number];
interface Box { x: number; y: number; z: number; w: number; d: number; h: number }

const COS = Math.cos(Math.PI / 6);
const UNIT = 14;
/** x runs down-right, y runs down-left, z runs up. */
const iso = (x: number, y: number, z: number): P => [(x - y) * COS * UNIT, ((x + y) * 0.5 - z) * UNIT];
const pts = (ps: P[]) => ps.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (v: number) => 1 - (1 - v) ** 3;
/** Eased progress of one element that starts at `start` and runs for `span` of the overall timeline. */
const phase = (t: number, start: number, span: number) => easeOut(clamp01((t - start) / span));

function faces({ x, y, z, w, d, h }: Box) {
  const top = z + h;
  return {
    top: [iso(x, y, top), iso(x + w, y, top), iso(x + w, y + d, top), iso(x, y + d, top)],
    right: [iso(x + w, y, top), iso(x + w, y + d, top), iso(x + w, y + d, z), iso(x + w, y, z)],
    left: [iso(x, y + d, top), iso(x + w, y + d, top), iso(x + w, y + d, z), iso(x, y + d, z)],
  };
}

/** Fits the boxes, with extra room at the sides for the mono labels. */
function viewBox(boxes: Box[], padX = 10, pad = 10) {
  const all = boxes.flatMap(b => { const f = faces(b); return [...f.top, ...f.left, ...f.right]; });
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const x0 = Math.min(...xs) - padX, y0 = Math.min(...ys) - pad;
  return `${x0.toFixed(0)} ${y0.toFixed(0)} ${(Math.max(...xs) - x0 + padX).toFixed(0)} ${(Math.max(...ys) - y0 + pad).toFixed(0)}`;
}

/** Back-to-front order for boxes standing on one plane with non-overlapping footprints. */
function depthSort<T extends Box>(boxes: T[]): T[] {
  const behind = (a: Box, b: Box) => (a.x + a.w <= b.x + 1e-6 && a.y < b.y + b.d) || (a.y + a.d <= b.y + 1e-6 && a.x < b.x + b.w);
  const left = [...boxes];
  const out: T[] = [];
  while (left.length) {
    const i = left.findIndex(c => !left.some(o => o !== c && behind(o, c)));
    out.push(...left.splice(Math.max(0, i), 1));
  }
  return out;
}

function Solid({ box, className = '', hatch }: { box: Box; className?: string; hatch?: string | undefined }) {
  const f = faces(box);
  return <g className={`iso-solid ${className}`}>
    <polygon className="f-left" points={pts(f.left)} />
    <polygon className="f-right" points={pts(f.right)} />
    <polygon className="f-top" points={pts(f.top)} />
    {hatch && <g className="f-hatch" fill={`url(#${hatch})`}><polygon points={pts(f.left)} /><polygon points={pts(f.right)} /><polygon points={pts(f.top)} /></g>}
  </g>;
}

/** Dashed outline of a box: bottom and top rims plus the four uprights. */
function Wire({ box, className = '' }: { box: Box; className?: string }) {
  const { x, y, z, w, d, h } = box;
  const rim = (zz: number) => [iso(x, y, zz), iso(x + w, y, zz), iso(x + w, y + d, zz), iso(x, y + d, zz)];
  const corners: [number, number][] = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
  return <g className={`iso-wire ${className}`}>
    <polygon points={pts(rim(z))} />
    {h > 0 && <polygon points={pts(rim(z + h))} />}
    {h > 0 && corners.map(([cx, cy], i) => { const [a, b] = [iso(cx, cy, z), iso(cx, cy, z + h)]; return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />; })}
  </g>;
}

/** A small mono label with a leader line to an anchor point. */
function Label({ at, dx, dy, children, anchor = 'start' }: { at: P; dx: number; dy: number; children: ReactNode; anchor?: 'start' | 'end' }) {
  const tx = at[0] + dx, ty = at[1] + dy;
  return <g className="iso-label">
    <line x1={at[0]} y1={at[1]} x2={tx} y2={ty + 3} />
    <circle cx={at[0]} cy={at[1]} r={1.6} />
    <text x={anchor === 'start' ? tx + 3 : tx - 3} y={ty} textAnchor={anchor}>{children}</text>
  </g>;
}

function Frame({ label, viewBox: vb, children, frameRef }: { label: string; viewBox: string; children: ReactNode; frameRef: Ref<SVGSVGElement> }) {
  return <svg ref={frameRef} className="iso-art" viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>{children}</svg>;
}

// --- 01 / GROUP: loose helper processes drop into one app ------------------------------------

const CUBE = 1.35, GAP = 0.4, ORIGIN = 1.05;
const slot = (i: number, j: number): Box => ({ x: ORIGIN + i * (CUBE + GAP), y: ORIGIN + j * (CUBE + GAP), z: 0, w: CUBE, d: CUBE, h: CUBE });
const FALLING = [[2, 2, 3.3], [2, 1, 4], [1, 2, 4.7]] as const;

const GROUP_BASE: Box = { x: 0, y: 0, z: -0.4, w: 7.3, d: 7.3, h: 0.4 };
const GROUP_APP: Box = { x: 0.6, y: 0.6, z: 0, w: 6.1, d: 6.1, h: 2.2 };
const GROUP_VIEW = viewBox([GROUP_BASE, ...FALLING.map(([i, j, z]) => ({ ...slot(i, j), z }))], 62);

export function GroupArt() {
  const [ref, t] = useRevealProgress<SVGSVGElement>(1500);
  const base = GROUP_BASE, app = GROUP_APP;

  const cubes = depthSort([
    ...[[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]].map(([i, j]) => ({ ...slot(i!, j!), cls: 'is-accent', guide: false, falling: -1 })),
    ...FALLING.map(([i, j, z0], k) => {
      const p = phase(t, 0.12 + k * 0.17, 0.5);
      return { ...slot(i, j), z: z0 * (1 - p), cls: p >= 1 ? 'is-accent' : 'is-loose', guide: p < 1, falling: k };
    }),
  ]);
  const lastFalling = cubes.find(c => c.falling === FALLING.length - 1)!;

  return <Frame frameRef={ref} label="Isometric drawing: loose process cubes drop into one app box" viewBox={GROUP_VIEW}>
    <Solid box={base} className="is-base" />
    <Wire box={app} className="is-dashed" />
    {FALLING.map(([i, j], k) => <Wire key={k} box={{ ...slot(i, j), h: 0 }} className="is-dashed is-faint" />)}
    {cubes.map((c, k) => <g key={k}>
      {c.guide && (() => { const cx = c.x + c.w / 2, cy = c.y + c.d / 2; const [a, b] = [iso(cx, cy, 0), iso(cx, cy, c.z)]; return <line className="iso-guide" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />; })()}
      <Solid box={c} className={c.cls} />
    </g>)}
    <Label at={iso(app.x, app.y, app.h)} dx={22} dy={-12}>GOOGLE CHROME</Label>
    {/* Follows the last falling cube down, so it ends up pointing at a helper inside the app. */}
    <Label at={iso(lastFalling.x, lastFalling.y + CUBE, lastFalling.z + CUBE * 0.5)} dx={-34} dy={-14} anchor="end">38 HELPERS</Label>
  </Frame>;
}

// --- 02 / MAP: the treemap as a slab, every tile raised by its memory -------------------------

const BY_MEM = [...WORKLOADS].sort((a, b) => b.mem - a.mem);
const MAP_ITEMS = BY_MEM.slice(0, 8).map(w => ({ id: w.id, value: w.mem }));
MAP_ITEMS.push({ id: 'more', value: MORE.mem + BY_MEM.slice(8).reduce((a, w) => a + w.mem, 0) });
const MAP_MAX = Math.max(...MAP_ITEMS.map(i => i.value));

const MAP_BASE: Box = { x: 0, y: 0, z: -0.4, w: 9, d: 7, h: 0.4 };
const MAP_TILES = squarify(MAP_ITEMS, { x: 0.35, y: 0.35, w: 8.3, h: 6.3 })
  .map((r, k) => ({ id: r.id, k, x: r.x + 0.1, y: r.y + 0.1, w: r.w - 0.2, d: r.h - 0.2, z: 0, h: 0.25 + 2.9 * (r.value / MAP_MAX) }));
const MAP_VIEW = viewBox([MAP_BASE, ...MAP_TILES], 56, 22);

export function MapArt() {
  const [ref, t] = useRevealProgress<SVGSVGElement>(1600);
  const base = MAP_BASE, tiles = MAP_TILES, vb = MAP_VIEW;
  const grown = depthSort(tiles.map(tile => ({ ...tile, h: 0.12 + (tile.h - 0.12) * phase(t, tile.k * 0.07, 0.55) })));
  const chrome = grown.find(g => g.id === 'chrome')!;

  return <Frame frameRef={ref} label="Isometric drawing: a treemap whose tiles rise by memory used" viewBox={vb}>
    <Solid box={base} className="is-base" />
    {grown.map(g => <Solid key={g.id} box={g} className={g.id === 'chrome' ? 'is-accent' : g.id === 'more' ? 'is-faint' : ''} />)}
    <Label at={iso(chrome.x + chrome.w * 0.5, chrome.y, chrome.z + chrome.h)} dx={-10} dy={-18} anchor="end">CHROME · 4.60 GB</Label>
    <Label at={iso(base.x + base.w, base.y + base.d, -0.4)} dx={14} dy={6}>SIZED BY MEMORY</Label>
  </Frame>;
}

// --- 03 / DIAGNOSE: one tile keeps growing, gets hatched and flagged --------------------------

const DIAG_ITEMS = [{ id: 'leak', value: 9 }, { id: 'a', value: 7 }, { id: 'b', value: 5 }, { id: 'c', value: 4 }, { id: 'd', value: 3 }, { id: 'e', value: 2.5 }, { id: 'f', value: 2 }];
const DIAG_LOW: Record<string, number> = { leak: 0.7, a: 0.85, b: 0.6, c: 0.75, d: 0.5, e: 0.65, f: 0.45 };
const LEAK_TOP = 3.7;

const DIAG_BASE: Box = { x: 0, y: 0, z: -0.4, w: 8.6, d: 6.6, h: 0.4 };
const DIAG_TILES = squarify(DIAG_ITEMS, { x: 0.35, y: 0.35, w: 7.9, h: 5.9 })
  .map(r => ({ id: r.id, x: r.x + 0.1, y: r.y + 0.1, w: r.w - 0.2, d: r.h - 0.2, z: 0, h: DIAG_LOW[r.id]! }));
const DIAG_LEAK = DIAG_TILES.find(x => x.id === 'leak')!;
const DIAG_VIEW = viewBox([DIAG_BASE, ...DIAG_TILES, { ...DIAG_LEAK, h: LEAK_TOP + 1.7 }], 56);

export function DiagnoseArt() {
  const [ref, t] = useRevealProgress<SVGSVGElement>(1700);
  const hatch = useId().replace(/:/g, '');
  const base = DIAG_BASE, tiles = DIAG_TILES, leakBase = DIAG_LEAK, vb = DIAG_VIEW;
  const grow = phase(t, 0.1, 0.75);
  const flag = phase(t, 0.8, 0.2);
  const leak = { ...leakBase, h: leakBase.h + (LEAK_TOP - leakBase.h) * grow };
  const sorted = depthSort(tiles.map(x => (x.id === 'leak' ? leak : x)));
  const cx = leak.x + leak.w / 2, cy = leak.y + leak.d / 2;
  const [poleA, poleB] = [iso(cx, cy, leak.h), iso(cx, cy, leak.h + 1.5 * flag)];

  return <Frame frameRef={ref} label="Isometric drawing: one tile grows, is hatched and gets an alert flag" viewBox={vb}>
    <defs>
      <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2="5" className="iso-hatch-line" />
      </pattern>
    </defs>
    <Solid box={base} className="is-base" />
    {sorted.map(x => x.id === 'leak'
      ? <g key="leak"><Solid box={leak} className="is-alert" hatch={grow > 0.05 ? hatch : undefined} /><Wire box={{ ...leakBase, h: 0, z: leakBase.h }} className="is-dashed is-ghost" /></g>
      : <Solid key={x.id} box={x} />)}
    {flag > 0 && <g className="iso-flag" style={{ opacity: flag }}>
      <line x1={poleA[0]} y1={poleA[1]} x2={poleB[0]} y2={poleB[1]} />
      <polygon points={pts([poleB, [poleB[0] + 13, poleB[1] + 4], [poleB[0], poleB[1] + 8]])} />
      <text x={poleB[0] + 17} y={poleB[1] + 7}>+1.3 GB · 5 MIN</text>
    </g>}
    <Label at={iso(leakBase.x, leakBase.y + leakBase.d, leakBase.h)} dx={-22} dy={-16} anchor="end">5 MIN AGO</Label>
  </Frame>;
}
