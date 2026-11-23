/*
 * Sample data and helpers shared by the interactive preview and the scroll story.
 * Layout, colours and wording follow crates/resource-ui (app.rs, treemap.rs, theme.rs).
 * Nothing here reads from the visitor's device.
 */

export type Category = 'browser' | 'ide' | 'lsp' | 'build' | 'container' | 'database' | 'llm' | 'app' | 'system';
export type Metric = 'mem' | 'cpu' | 'disk';

export const CATEGORY: Record<Category, { name: string; color: string }> = {
  browser: { name: 'Browsers', color: '#f2ae3d' },
  ide: { name: 'IDEs', color: '#b07ce8' },
  lsp: { name: 'Language servers', color: '#6c9cf0' },
  build: { name: 'Builds', color: '#ec6a5c' },
  container: { name: 'Containers', color: '#4fbfae' },
  database: { name: 'Databases', color: '#9cc85a' },
  llm: { name: 'Local AI', color: '#ea8ab3' },
  app: { name: 'Apps', color: '#f08a3c' },
  system: { name: 'System', color: '#7d7973' },
};
export const METRICS: { key: Metric; label: string }[] = [{ key: 'mem', label: 'Memory' }, { key: 'cpu', label: 'CPU' }, { key: 'disk', label: 'Disk I/O' }];
export const TOTAL_RAM_MB = 32 * 1024;

export interface Proc { pid: number; ppid: number; name: string; mem: number; cpu: number; disk: number; threads: number }
export interface Workload { id: string; name: string; category: Category; procs: Proc[]; mem: number; cpu: number; disk: number; alert?: string | undefined; growth: number }

/** Builds a workload: named processes first, then `filler` copies sharing the remaining memory. */
export function workload(id: string, name: string, category: Category, memMb: number, count: number, cpu: number, diskKbs: number,
  named: [string, number][], filler: string, extra: { alert?: string; growth?: number } = {}): Workload {
  const base = 300 + (id.length * 977 + memMb * 13) % 60000;
  const rest = count - named.length;
  const left = memMb - named.reduce((a, [, m]) => a + m, 0);
  const weights = Array.from({ length: rest }, (_, i) => 0.86 ** i);
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const mems = [...named.map(([, m]) => m), ...weights.map(w => (left * w) / wsum)];
  const share = mems.map((m, i) => m * (1 + 0.6 * Math.sin(i * 2.3 + base)) + 1);
  const shareSum = share.reduce((a, b) => a + b, 0);
  const procs = mems.map((mem, i) => ({
    pid: base + i * 7,
    ppid: i === 0 ? 1 : base,
    name: named[i]?.[0] ?? filler,
    mem,
    cpu: (cpu * share[i]!) / shareSum,
    disk: (diskKbs * share[i]!) / shareSum,
    threads: 4 + Math.round(mem / 40) % 60,
  }));
  return { id, name, category, procs, mem: memMb, cpu, disk: diskKbs, alert: extra.alert, growth: extra.growth ?? 0.01 };
}

export const WORKLOADS: Workload[] = [
  workload('chrome', 'Google Chrome', 'browser', 4710, 38, 23, 1400,
    [['Google Chrome Helper (GPU)', 540], ['Google Chrome', 410], ['Google Chrome Helper (Renderer)', 392], ['Google Chrome Helper (Renderer)', 344], ['Google Chrome Helper', 128]],
    'Google Chrome Helper (Renderer)', { alert: 'Grew 312 MB in 5 min', growth: 0.07 }),
  workload('ollama', 'Ollama', 'llm', 3150, 2, 85, 220, [['ollama_llama_server', 2960], ['ollama', 190]], 'ollama'),
  workload('docker', 'Docker', 'container', 2870, 9, 9, 12600,
    [['com.docker.virtualization', 2110], ['com.docker.backend', 310], ['Docker Desktop', 180], ['Docker Desktop Helper (Renderer)', 120]], 'com.docker.build'),
  workload('vscode', 'Visual Studio Code', 'ide', 1950, 14, 6, 340,
    [['Code Helper (Renderer)', 620], ['Code Helper (Plugin)', 480], ['Code Helper (GPU)', 210], ['Code', 160]], 'Code Helper'),
  workload('system', 'macOS System', 'system', 1640, 268, 4, 900,
    [['WindowServer', 380], ['mds_stores', 160], ['Spotlight', 92], ['launchd', 41], ['corespotlightd', 38]], 'system daemon'),
  workload('rust-analyzer', 'rust-analyzer', 'lsp', 1130, 1, 3, 40, [['rust-analyzer', 1130]], 'rust-analyzer', { alert: 'Grew 140 MB in 5 min', growth: 0.12 }),
  workload('slack', 'Slack', 'app', 820, 6, 1, 60, [['Slack Helper (Renderer)', 410], ['Slack', 190]], 'Slack Helper'),
  workload('cargo', 'Cargo build', 'build', 640, 5, 380, 2200, [['rustc', 380], ['rustc', 150], ['cargo', 60]], 'rustc', { alert: 'CPU above 100% for 30 s' }),
  workload('figma', 'Figma', 'app', 590, 6, 2, 30, [['Figma Helper (Renderer)', 330], ['Figma', 140]], 'Figma Helper'),
  workload('spotify', 'Spotify', 'app', 380, 4, 2, 80, [['Spotify Helper (Renderer)', 190], ['Spotify', 120]], 'Spotify Helper'),
  workload('postgres', 'PostgreSQL', 'database', 290, 7, 1, 160, [['postgres', 120]], 'postgres'),
];
/** Small apps the real app rolls into a single grey tile. */
export const MORE = { apps: 22, procs: 52, mem: 420, cpu: 3, disk: 90 };
export const PROCESS_COUNT = WORKLOADS.reduce((a, w) => a + w.procs.length, 0) + MORE.procs;
export const APP_COUNT = WORKLOADS.length + MORE.apps;

export const valueOf = (x: { mem: number; cpu: number; disk: number }, m: Metric) => (m === 'mem' ? x.mem : m === 'cpu' ? x.cpu : x.disk);
export function mb(v: number) { return v >= 1024 ? `${(v / 1024).toFixed(2)} GB` : `${Math.round(v)} MB`; }
export function rate(kbs: number) { return kbs >= 1024 ? `${Math.round(kbs / 1024)} MB/s` : `${Math.round(kbs)} KB/s`; }
export function cpu(p: number) { return `${p >= 10 ? Math.round(p) : p.toFixed(1)}%`; }
export const format = (x: { mem: number; cpu: number; disk: number }, m: Metric) => (m === 'mem' ? mb(x.mem) : m === 'cpu' ? cpu(x.cpu) : rate(x.disk));

/** Gentle live wobble so the sample feels like it is being sampled every 2 s. */
export function live<T extends { mem: number; cpu: number; disk: number }>(x: T, seed: number, tick: number, growth = 0): T {
  const s = Math.sin(tick * 0.9 + seed);
  return { ...x, mem: x.mem * (1 + 0.006 * s + growth * 0.02 * Math.min(tick, 30) / 30), cpu: Math.max(0.1, x.cpu * (1 + 0.18 * s)), disk: Math.max(0, x.disk * (1 + 0.35 * Math.sin(tick * 1.7 + seed))) };
}

export type Rect = { x: number; y: number; w: number; h: number };
/** Squarified treemap layout (Bruls et al.), the same algorithm resource-core uses. */
export function squarify<T extends { value: number }>(items: T[], r: Rect): (T & Rect)[] {
  const total = items.reduce((a, i) => a + i.value, 0);
  if (!total || r.w <= 0 || r.h <= 0) return [];
  const scale = (r.w * r.h) / total;
  let rest = items.map(item => ({ item, area: item.value * scale }));
  let { x, y, w, h } = r;
  const out: (T & Rect)[] = [];
  const worst = (row: { area: number }[], side: number) => {
    const s = row.reduce((a, c) => a + c.area, 0);
    const max = Math.max(...row.map(c => c.area)), min = Math.min(...row.map(c => c.area));
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  while (rest.length) {
    const side = Math.min(w, h);
    const row = [rest[0]!];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]!], side) <= worst(row, side)) row.push(rest[i++]!);
    rest = rest.slice(i);
    const thick = row.reduce((a, c) => a + c.area, 0) / side;
    let off = 0;
    for (const c of row) {
      const len = c.area / thick;
      out.push(w >= h ? { ...c.item, x, y: y + off, w: thick, h: len } : { ...c.item, x: x + off, y, w: len, h: thick });
      off += len;
    }
    if (w >= h) { x += thick; w -= thick; } else { y += thick; h -= thick; }
  }
  return out;
}

/** Mixes a category colour into the app background, like theme.rs does for tile fills. */
export const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, #121110)`;
