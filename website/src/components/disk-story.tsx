import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FileText, SquareActivity, SquareCheck, SquareDashed, SquareTerminal, type LucideIcon } from 'lucide-react';
import { DiskLogo } from './disk-logo';
import { CATEGORY, MORE, TOTAL_RAM_MB, WORKLOADS, mb, squarify, tint, workload, type Category, type Workload } from '@/lib/disk-sample';

/*
 * A pinned, scroll-driven walkthrough of one afternoon with diskMon. The page scrolls
 * through four steps; the window on the right morphs to show what diskMon shows at
 * each one, with a single callout pointing at the part that matters. Sample data only.
 */

interface Step { title: string; text: ReactNode; color: string; icon: LucideIcon; callout: string }

const STEPS: Step[] = [
  {
    title: 'Every process finds its app',
    text: 'diskMon folds hundreds of processes into the apps you actually run. Chrome’s 38 helpers become one tile, sized by the memory they hold together.',
    color: '#f2ae3d', icon: SquareDashed, callout: 'Workloads',
  },
  {
    title: 'A leak gets flagged as it grows',
    text: 'During a build, the VS Code extension host climbs past 1.5 GB. diskMon hatches the tile and says why, before swap starts to stall your machine.',
    color: '#ec6a5c', icon: SquareActivity, callout: 'Leak alert',
  },
  {
    title: 'The fix comes with numbers',
    text: 'Export a report on main and another on your fix branch. Same build, same point in it: the extension host drops from 1.54 GB to 180 MB, ready to paste into the PR.',
    color: '#5fcf8f', icon: SquareCheck, callout: 'Reports',
  },
  {
    title: 'Idle models give memory back',
    text: <>A 14B model in Ollama keeps about 9 GB resident between prompts. Run <code>ollama stop</code> and diskMon shows free memory jump from 8.4 GB to 17.6 GB.</>,
    color: '#ea8ab3', icon: SquareTerminal, callout: 'Free memory',
  },
];

const VSCODE = {
  calm: workload('vscode', 'Visual Studio Code', 'ide', 1150, 14, 6, 340,
    [['Code Helper (Renderer)', 520], ['Code Helper (Plugin)', 230], ['Code Helper (GPU)', 160], ['Code', 120]], 'Code Helper'),
  leak: workload('vscode', 'Visual Studio Code', 'ide', 2480, 14, 9, 340,
    [['Code Helper (Renderer)', 540], ['Code Helper (Plugin)', 1580], ['Code Helper (GPU)', 160], ['Code', 120]], 'Code Helper', { alert: 'Grew 1.3 GB in 5 min' }),
  fixed: workload('vscode', 'Visual Studio Code', 'ide', 1080, 14, 6, 340,
    [['Code Helper (Renderer)', 530], ['Code Helper (Plugin)', 180], ['Code Helper (GPU)', 160], ['Code', 120]], 'Code Helper'),
};
const OLLAMA_LOADED = workload('ollama', 'Ollama', 'llm', 9600, 2, 4, 30, [['ollama_llama_server', 9410], ['ollama', 190]], 'ollama');
const OLLAMA = {
  loaded: OLLAMA_LOADED,
  // Same processes with the model server gone, so the tile shrinks instead of being replaced.
  idle: { ...OLLAMA_LOADED, mem: 190, procs: OLLAMA_LOADED.procs.map(p => (p.name === 'ollama' ? p : { ...p, mem: 0 })) },
};

/** The machine as diskMon sees it at a given step. Alerts are off except where the step is about one. */
function scene(step: number, unloaded: boolean): Workload[] {
  return WORKLOADS.map(w => {
    if (w.id === 'vscode') return step === 0 ? VSCODE.calm : step === 1 ? VSCODE.leak : VSCODE.fixed;
    if (w.id === 'ollama') return step === 3 && unloaded ? OLLAMA.idle : OLLAMA.loaded;
    return { ...w, alert: undefined };
  });
}

const FOCUS = ['chrome', 'vscode', 'vscode', 'ollama'];
const SUBTITLE = ['Browsers · 38 processes', 'IDEs · Grew 1.3 GB in 5 min', 'IDEs · No alerts', ''];
const SWAP = ['0 MB', '1.20 GB', '0 MB', '0 MB'];
const HEADER_H = 20;
const STEP_SCROLL_VH = 72;

/** Sparkline shapes for the selected app: steady, climbing, steady and low, then a drop. */
function sparkPoints(kind: 'steady' | 'climb' | 'low' | 'drop', unloaded: boolean) {
  const n = 120;
  const pts = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const wob = 0.025 * Math.sin(i / 5) + 0.012 * Math.sin(i * 1.7);
    if (kind === 'climb') return 0.18 + 0.72 * t ** 1.4 + wob * 0.6;
    if (kind === 'low') return 0.3 + wob;
    if (kind === 'drop') return unloaded && t > 0.82 ? 0.06 + wob * 0.2 : 0.78 + wob * 0.5;
    return 0.55 + wob;
  });
  return pts.map((v, i) => `${(i / (n - 1)) * 100},${36 - v * 34}`).join(' ');
}

function Callout({ label, dir = 'right', className = '' }: { label: string; dir?: 'right' | 'left' | 'down'; className?: string }) {
  return <span className={`st-callout is-${dir} ${className}`} aria-hidden="true"><i className="st-callout-dot" /><i className="st-callout-line" /><b>{label}</b></span>;
}

export function DiskStory() {
  const [active, setActive] = useState(0);
  const [unloaded, setUnloaded] = useState(false);
  const [size, setSize] = useState({ w: 560, h: 340 });
  const trackRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Pinned scroll: the track is several screens tall, the stage sticks, and scroll progress picks the step.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const travel = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / travel));
      setActive(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, []);

  // On the last step, "run" ollama stop a beat after the step appears so the change reads as cause and effect.
  useEffect(() => {
    if (active !== 3) { setUnloaded(false); return; }
    const id = setTimeout(() => setUnloaded(true), 1400);
    return () => clearTimeout(id);
  }, [active]);

  useLayoutEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / STEPS.length) * travel, behavior: 'smooth' });
  };

  const workloads = useMemo(() => scene(active, unloaded), [active, unloaded]);
  const used = workloads.reduce((a, w) => a + w.mem, 0) + MORE.mem;
  const free = TOTAL_RAM_MB - used;
  const focusId = FOCUS[active]!;
  const focusW = workloads.find(w => w.id === focusId)!;
  const step = STEPS[active]!;

  // --- treemap ----------------------------------------------------------------------------
  const tiles: ReactNode[] = [];
  const items: { id: string; value: number; wl?: Workload }[] = [...workloads].sort((a, b) => b.mem - a.mem).map(w => ({ id: w.id, value: w.mem, wl: w }));
  items.push({ id: 'more', value: MORE.mem });
  for (const n of squarify(items, { x: 0, y: 0, w: size.w, h: size.h })) {
    const t = { x: n.x + 1.5, y: n.y + 1.5, w: Math.max(0, n.w - 3), h: Math.max(0, n.h - 3) };
    const box: CSSProperties = { left: t.x, top: t.y, width: t.w, height: t.h };
    const w = n.wl;
    if (!w) {
      tiles.push(<div key="more" className="dm-tile dm-more st-dim" style={box}>
        {t.w > 70 && t.h > 18 && <span className="dm-label"><b>{MORE.apps} more apps</b></span>}
      </div>);
      continue;
    }
    const color = CATEGORY[w.category].color;
    const isFocus = w.id === focusId;
    const header = t.h >= HEADER_H * 2 && t.w >= 70;
    const body = { x: 2, y: HEADER_H + 2, w: t.w - 4, h: t.h - HEADER_H - 4 };
    const kids = header && body.w >= 8 && body.h >= 8
      ? squarify(w.procs.map((p, i) => ({ ...p, i, value: p.mem })).filter(p => p.value > 0).sort((a, b) => b.value - a.value).slice(0, 24), body)
      : [];
    tiles.push(<div key={w.id} className={`dm-tile ${w.alert ? 'is-flagged' : ''} ${isFocus ? 'is-focus' : 'st-dim'}`}
      style={{ ...box, background: tint(color, 22), ['--c' as string]: color }}>
      {header ? <span className="dm-band" style={{ background: tint(color, 34), borderTopColor: color }}><b>{w.name}</b>{t.w > 140 && <small>{mb(w.mem)}</small>}</span>
        : t.w > 50 && t.h > 18 && <span className="dm-label"><b>{w.name}</b></span>}
      {kids.map(k => {
        const r = { x: body.x + k.x + 1, y: body.y + k.y + 1, w: k.w - 2, h: k.h - 2 };
        if (r.w < 2 || r.h < 2) return null;
        return <span key={k.i} className="dm-child" style={{ left: r.x, top: r.y, width: r.w, height: r.h, background: tint(color, 40) }}>
          {r.w > 64 && r.h > 30 && <span className="dm-stacked"><b>{k.name}</b><small>{mb(k.mem)}</small></span>}
        </span>;
      })}
    </div>);
    // A frame that tracks the focused tile (same transition) and carries the callout outside the tile's clip.
    if (isFocus && active < 2) tiles.push(<div key="focus-frame" className="st-focus-frame" style={box}>
      <Callout key={active} label={step.callout} dir={t.x + t.w > size.w * 0.72 ? 'left' : 'right'} />
    </div>);
  }

  // Memory meter: one segment per category in use, then free memory.
  const byCategory = (Object.keys(CATEGORY) as Category[]).map(c => ({ c, mem: workloads.filter(w => w.category === c).reduce((a, w) => a + w.mem, 0) })).filter(x => x.mem > 0);
  const spark = sparkPoints((['steady', 'climb', 'low', 'drop'] as const)[active]!, unloaded);
  const focusColor = CATEGORY[focusW.category].color;
  const subtitle = active === 3 ? (unloaded ? 'Local AI · No model loaded' : 'Local AI · qwen2.5-coder:14b loaded') : SUBTITLE[active];

  return <div className="story-track" ref={trackRef} style={{ height: `calc(${STEPS.length * STEP_SCROLL_VH}vh + 100vh)` }}>
    <div className="story-pin" style={{ ['--step' as string]: step.color }}>
      <ol className="story-steps">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return <li key={s.title} className={i === active ? 'is-active' : ''} style={{ ['--sc' as string]: s.color }}>
            <button type="button" onClick={() => goTo(i)} aria-current={i === active ? 'step' : undefined}>
              <Icon className="story-step-icon" aria-hidden="true" />
              <span className="story-step-title">{s.title}</span>
            </button>
            <p>{s.text}</p>
          </li>;
        })}
      </ol>

      <div className="story-stage">
        <div className="story-frame">
          <div className="dm-window st-window" aria-label="diskMon sample window for the current step">
            <div className="dm-titlebar"><div className="traffic-lights"><i /><i /><i /></div><span>diskMon</span><span className="preview-label">SAMPLE DATA</span></div>
            <div className="st-header">
              <div className="dm-crumbs"><DiskLogo size={16} /><b>diskMon</b><span className="dm-muted">/</span><span>All apps</span></div>
              <div className="st-controls">
                <span className="st-seg"><span className="is-on">Memory</span><span>CPU</span><span className="st-hide-sm">Disk I/O</span></span>
                <span className={`st-export ${active === 2 ? 'is-hot' : ''}`}>Export report</span>
              </div>
            </div>
            <div className="st-legend">
              <b>{mb(used)}</b><span className="dm-muted">used</span><span className="dm-muted">·</span>
              <span className="st-free-inline"><b>{mb(free)}</b> <span className="dm-muted">free</span>{active === 3 && <Callout key="free-sm" label={step.callout} className="st-only-sm" />}</span>
            </div>
            <div className="st-body">
              <div className="st-map-wrap">
                <div className="st-map" ref={mapRef}>{tiles}</div>

                {/* Sits over Ollama (top left, idle in this step) so the shrunken VS Code tile stays in view. */}
                {active === 2 && <div className="st-pop is-top" key="report">
                  <header><b>Exported reports</b><span>Visual Studio Code</span></header>
                  <ul>
                    <li><FileText aria-hidden="true" /><span><b>main</b><small>diskmon-report-1795950120.md</small></span><em className="is-bad">2.42 GB</em></li>
                    <li><FileText aria-hidden="true" /><span><b>fix/ext-host-leak</b><small>diskmon-report-1795951860.md</small></span><em className="is-good">1.05 GB</em></li>
                  </ul>
                  <footer><span>Extension host</span><b>1.54 GB → 180 MB</b></footer>
                  <Callout key="report-callout" label={step.callout} dir="down" />
                </div>}

                {active === 3 && <div className="st-pop st-term" key="term">
                  <header><b>Terminal</b><span>zsh</span></header>
                  <code><span className="st-prompt">$</span><span className="st-typed">ollama stop qwen2.5-coder:14b</span>{!unloaded && <i className="st-caret" />}</code>
                  {unloaded && <code><span className="st-prompt">$</span><i className="st-caret" /></code>}
                </div>}
              </div>

              <aside className="st-side">
                <section>
                  <h4>SELECTION</h4>
                  <div className="dm-sel-name"><i style={{ background: focusColor }} />{focusW.name}</div>
                  <div className="dm-big">{mb(focusW.mem).split(' ')[0]}<small>{mb(focusW.mem).split(' ')[1]}</small></div>
                  <div className={`dm-small ${active === 1 ? 'st-alert-text' : 'dm-muted'}`}>{subtitle}</div>
                  <div className="dm-spark-label"><span>LAST 5 MIN</span></div>
                  <svg key={`${active}-${unloaded}`} className="dm-spark st-spark" viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
                    <polyline points={spark} pathLength={100} fill="none" stroke={focusColor} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                  </svg>
                </section>
                <section className="st-memory">
                  <h4>MEMORY</h4>
                  <div className="dm-meter">
                    {byCategory.map(x => <i key={x.c} style={{ width: `${(x.mem / TOTAL_RAM_MB) * 100}%`, background: CATEGORY[x.c].color }} />)}
                    <i style={{ width: `${(MORE.mem / TOTAL_RAM_MB) * 100}%`, background: '#4a4743' }} />
                  </div>
                  <dl className="dm-rows">
                    <div className="st-free-row"><dt>Free</dt><dd>{mb(free)}</dd>{active === 3 && <Callout key="free-lg" label={step.callout} dir="left" className="st-only-lg" />}</div>
                    <div><dt>Total</dt><dd>32.00 GB</dd></div>
                    <div><dt>Swap used</dt><dd className={active === 1 ? 'st-alert-text' : ''}>{SWAP[active]}</dd></div>
                  </dl>
                </section>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>;
}
