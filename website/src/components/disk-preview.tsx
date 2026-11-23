import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronLeft, CornerDownLeft, Play } from 'lucide-react';
import { DiskLogo } from './disk-logo';
import { APP_COUNT, CATEGORY, METRICS, MORE, PROCESS_COUNT, TOTAL_RAM_MB, WORKLOADS, cpu, format, live, mb, rate, squarify, tint, valueOf, type Category, type Metric, type Workload } from '@/lib/disk-sample';

/*
 * An interactive replica of the diskMon desktop app, filled with sample data.
 * Layout, colours and wording follow crates/resource-ui (app.rs, treemap.rs, theme.rs).
 * Nothing here reads from the visitor's device.
 */


type Selection = { kind: 'workload'; id: string } | { kind: 'process'; id: string; pid: number } | null;
const HEADER_H = 20;
const MAX_CHILDREN = 24;

export function DiskPreview({ version, onWatchVideo }: { version: string; onWatchVideo?: () => void }) {
  const [metric, setMetric] = useState<Metric>('mem');
  const [focus, setFocus] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ kind: 'workload', id: 'chrome' });
  const [filter, setFilter] = useState('');
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const [frozenFor, setFrozenFor] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 620, h: 400 });
  const mapRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const id = setInterval(() => (paused ? setFrozenFor(s => s + 2) : setTick(t => t + 1)), 2000);
    return () => clearInterval(id);
  }, [paused]);
  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(id);
  }, [status]);

  const workloads = useMemo(() => WORKLOADS.map((w, wi) => {
    const procs = w.procs.map((p, pi) => live(p, wi * 3.1 + pi, tick, w.growth));
    const sum = (k: 'mem' | 'cpu' | 'disk') => procs.reduce((a, p) => a + p[k], 0);
    return { ...w, procs, mem: sum('mem'), cpu: sum('cpu'), disk: sum('disk') };
  }), [tick]);
  const more = useMemo(() => live(MORE, 42, tick), [tick]);
  const used = workloads.reduce((a, w) => a + w.mem, 0) + more.mem;
  const needle = filter.trim().toLowerCase();
  const matches = (w: Workload) => !needle || w.name.toLowerCase().includes(needle) || w.procs.some(p => p.name.toLowerCase().includes(needle));
  const focused = workloads.find(w => w.id === focus);

  const toggle = (next: Selection) => setSelection(s => (JSON.stringify(s) === JSON.stringify(next) ? null : next));
  const togglePause = () => { setPaused(p => !p); setFrozenFor(0); };
  const exportReport = () => setStatus('Sample only · the app saves a Markdown report to Downloads');
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLInputElement) {
      if (e.key === 'Escape') { setFilter(''); e.currentTarget.focus(); }
      return;
    }
    const keys: Record<string, () => void> = {
      '1': () => setMetric('mem'), '2': () => setMetric('cpu'), '3': () => setMetric('disk'),
      p: togglePause, e: exportReport, '/': () => filterRef.current?.focus(),
      Enter: () => { if (selection?.kind === 'workload') setFocus(selection.id); },
      Backspace: () => setFocus(null), Escape: () => { setSelection(null); setFilter(''); },
    };
    const action = keys[e.key];
    if (action) { e.preventDefault(); action(); }
  };

  // --- treemap tiles -------------------------------------------------------------------------
  const tiles: ReactNode[] = [];
  const area = { x: 0, y: 0, w: size.w, h: size.h };
  const isSel = (kind: 'workload' | 'process', id: string, pid?: number) =>
    selection?.kind === kind && selection.id === id && (kind === 'workload' || (selection.kind === 'process' && selection.pid === pid));
  if (focused) {
    const color = CATEGORY[focused.category].color;
    const items = focused.procs.map(p => ({ ...p, value: valueOf(p, metric) })).filter(p => p.value > 0).sort((a, b) => b.value - a.value).slice(0, MAX_CHILDREN * 2);
    for (const n of squarify(items, area)) {
      const dim = needle && !n.name.toLowerCase().includes(needle);
      tiles.push(<button key={n.pid} type="button" title={`${n.name} (PID ${n.pid})`} onClick={() => toggle({ kind: 'process', id: focused.id, pid: n.pid })}
        className={`dm-tile dm-zoomed ${isSel('process', focused.id, n.pid) ? 'is-selected' : ''} ${dim ? 'is-dim' : ''}`}
        style={{ left: n.x + 1.5, top: n.y + 1.5, width: Math.max(0, n.w - 3), height: Math.max(0, n.h - 3), background: tint(color, 30), borderTopColor: color }}>
        {n.w > 60 && n.h > 34 && <span className="dm-stacked"><b>{n.name}</b><small>{format(n, metric)} · PID {n.pid}</small></span>}
      </button>);
    }
  } else {
    const ranked = workloads.map(w => ({ w, value: valueOf(w, metric) })).filter(i => i.value > 0).sort((a, b) => b.value - a.value);
    const items: { id: string; value: number; wl?: typeof ranked[number]['w'] }[] = ranked.map(i => ({ id: i.w.id, value: i.value, wl: i.w }));
    if (valueOf(more, metric) > 0) items.push({ id: 'more', value: valueOf(more, metric) });
    for (const n of squarify(items, area)) {
      const t = { x: n.x + 1.5, y: n.y + 1.5, w: n.w - 3, h: n.h - 3 };
      if (t.w < 2 || t.h < 2) continue;
      const w = n.wl;
      if (!w) {
        tiles.push(<div key="more" className="dm-tile dm-more" style={{ left: t.x, top: t.y, width: t.w, height: t.h }}>
          {t.w > 60 && t.h > 18 && <span className="dm-label"><b>{MORE.apps} more apps</b><small>{format(more, metric)}</small></span>}
        </div>);
        continue;
      }
      const color = CATEGORY[w.category].color;
      const header = t.h >= HEADER_H * 2 && t.w >= 70;
      const body = { x: 2, y: HEADER_H + 2, w: t.w - 4, h: t.h - HEADER_H - 4 };
      const kids = header && body.w >= 8 && body.h >= 8
        ? squarify(w.procs.map(p => ({ ...p, value: valueOf(p, metric) })).filter(p => p.value > 0).sort((a, b) => b.value - a.value).slice(0, MAX_CHILDREN), body)
        : [];
      tiles.push(<div key={w.id} role="button" tabIndex={-1} title={`${w.name}\n${format(w, metric)} · ${w.procs.length} processes`}
        className={`dm-tile ${w.alert ? 'is-flagged' : ''} ${isSel('workload', w.id) ? 'is-selected' : ''} ${matches(w) ? '' : 'is-dim'}`}
        style={{ left: t.x, top: t.y, width: t.w, height: t.h, background: tint(color, 22), ['--c' as string]: color }}
        onClick={() => toggle({ kind: 'workload', id: w.id })} onDoubleClick={() => { setFocus(w.id); setSelection({ kind: 'workload', id: w.id }); }}>
        {header ? <span className="dm-band" style={{ background: tint(color, 34), borderTopColor: color }}><b>{w.name}</b>{t.w > 140 && <small>{format(w, metric)}</small>}</span>
          : t.w > 60 && t.h > 18 && <span className="dm-label"><b>{w.name}</b>{t.w > 140 && <small>{format(w, metric)}</small>}</span>}
        {kids.map(k => {
          const r = { x: body.x + k.x + 1, y: body.y + k.y + 1, w: k.w - 2, h: k.h - 2 };
          if (r.w < 2 || r.h < 2) return null;
          return <span key={k.pid} className={`dm-child ${isSel('process', w.id, k.pid) ? 'is-selected' : ''}`} title={`${k.name} (PID ${k.pid})\nin ${w.name}`}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h, background: tint(color, 40) }}
            onClick={e => { e.stopPropagation(); toggle({ kind: 'process', id: w.id, pid: k.pid }); }}>
            {r.w > 56 && r.h > 30 && <span className="dm-stacked"><b>{k.name}</b><small>{format(k, metric)}</small></span>}
          </span>;
        })}
      </div>);
    }
  }

  // --- side panel ----------------------------------------------------------------------------
  const selW = selection && workloads.find(w => w.id === selection.id);
  const selP = selection?.kind === 'process' ? selW?.procs.find(p => p.pid === selection.pid) : undefined;
  const subject = selP ?? selW;
  const subjectColor = selW ? CATEGORY[selW.category].color : '#f08a3c';
  const spark = useMemo(() => {
    const base = subject ? subject.mem : used;
    const growth = selW?.growth ?? 0.01;
    const pts = Array.from({ length: 150 }, (_, i) => base * (1 - growth + growth * (i / 149)) * (1 + 0.012 * Math.sin((i + tick) / 6) + 0.006 * Math.sin((i + tick) * 1.3)));
    const lo = Math.min(...pts) * 0.995, hi = Math.max(...pts) * 1.005;
    return pts.map((v, i) => `${(i / 149) * 100},${36 - ((v - lo) / (hi - lo)) * 34}`).join(' ');
  }, [subject, selW, used, tick]);
  const picks: { w: typeof workloads[number]; reason: string }[] = [];
  const pick = (w: typeof workloads[number] | undefined, reason: string) => { if (w && !picks.some(p => p.w.id === w.id)) picks.push({ w, reason }); };
  workloads.filter(w => w.alert).forEach(w => pick(w, w.alert!));
  const top = (k: (w: typeof workloads[number]) => number) => [...workloads].sort((a, b) => k(b) - k(a)).find(w => !picks.some(p => p.w.id === w.id));
  const byCpu = top(w => w.cpu); pick(byCpu, `${cpu(byCpu?.cpu ?? 0)} CPU`);
  const byDisk = top(w => w.disk); pick(byDisk, `${rate(byDisk?.disk ?? 0)} disk I/O`);
  const byCount = top(w => w.procs.length); pick(byCount, `${byCount?.procs.length ?? 0} processes`);
  const shown = picks.slice(0, 5);
  const largest = Math.max(...shown.map(p => p.w.mem));
  const memory = [{ name: 'Wired', gb: 3.1, color: '#ec6a5c' }, { name: 'Active', gb: 11.8, color: '#f08a3c' }, { name: 'Compressed', gb: 2.4, color: '#b07ce8' }, { name: 'Cached', gb: 7.0, color: '#7d7973' }];
  const present = (Object.keys(CATEGORY) as Category[]).filter(c => workloads.some(w => w.category === c));

  return <div className={`dm-window ${paused ? 'is-paused' : ''}`} tabIndex={0} onKeyDown={onKey} aria-label="Interactive diskMon preview with sample data">
    <div className="dm-titlebar"><div className="traffic-lights"><i /><i /><i /></div><span>diskMon</span><span className="preview-label">INTERACTIVE PREVIEW · SAMPLE DATA</span></div>
    <div className="dm-header">
      <div className="dm-crumbs"><DiskLogo size={16} /><b>diskMon</b><span className="dm-muted">/</span>
        <button type="button" className={focused ? 'dm-muted' : ''} onClick={() => setFocus(null)}>All apps</button>
        {focused && <><span className="dm-muted">/</span><b className="dm-crumb-current">{focused.name}</b></>}
        {paused && <span className="dm-paused">PAUSED · frozen {frozenFor}s ago</span>}
      </div>
      <div className="dm-controls">
        <div className="dm-segment" role="group" aria-label="Size tiles by">{METRICS.map((m, i) =>
          <button key={m.key} type="button" title={`Size tiles by ${m.label} (${i + 1})`} aria-pressed={metric === m.key} className={metric === m.key ? 'is-on' : ''} onClick={() => setMetric(m.key)}>{m.label}</button>)}</div>
        <input ref={filterRef} className="dm-filter" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter  /" aria-label="Filter apps and processes" />
        <button type="button" className={`dm-btn ${paused ? 'dm-resume' : ''}`} title={paused ? 'Resume live updates (P)' : 'Freeze the view on the current snapshot (P)'} onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
        <button type="button" className="dm-btn dm-export" title="Save a Markdown incident report to your Downloads folder (E)" onClick={exportReport}>Export report</button>
        {onWatchVideo && (
          <button type="button" className="dm-btn" title="Watch full 4K video walkthrough" onClick={onWatchVideo} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Play size={10} fill="currentColor" /> 4K Walkthrough
          </button>
        )}
      </div>
    </div>
    <div className="dm-legend"><b>{mb(used)}</b><span className="dm-muted">· {PROCESS_COUNT} processes · {APP_COUNT} apps</span>
      <span className="dm-keys">{present.map(c => <span key={c}><i style={{ background: CATEGORY[c].color }} />{CATEGORY[c].name}</span>)}<span><i className="dm-hatch-key" />Has an alert</span></span>
    </div>
    {status && <div className="dm-status">{status}</div>}
    <div className="dm-body">
      <div className="dm-map-wrap">
        {focused && <button type="button" className="dm-back" onClick={() => setFocus(null)}><ChevronLeft size={12} /> All apps</button>}
        <div className="dm-map" ref={mapRef}>{tiles}</div>
      </div>
      <aside className="dm-side">
        <section>
          <h4>SELECTION</h4>
          {subject ? <>
            <div className="dm-sel-name"><i style={{ background: subjectColor }} />{subject.name}</div>
            <div className="dm-big">{mb(subject.mem).split(' ')[0]}<small>{mb(subject.mem).split(' ')[1]}</small></div>
            <div className="dm-muted dm-small">{selP ? `in ${selW!.name}` : CATEGORY[selW!.category].name}{selW?.alert && !selP ? ` · ${selW.alert}` : ''}</div>
            <div className="dm-spark-label"><span>LAST 5 MIN</span></div>
            <svg className="dm-spark" viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true"><polyline points={spark} fill="none" stroke={subjectColor} strokeWidth="1.4" vectorEffect="non-scaling-stroke" /></svg>
            <dl className="dm-stats">{(selP ? [['PID', String(selP.pid)], ['PARENT', String(selP.ppid)], ['CPU', cpu(selP.cpu)], ['DISK I/O', rate(selP.disk)], ['VIRTUAL', `${(1.5 + selP.mem / 250).toFixed(2)} GB`], ['THREADS', String(selP.threads)]]
              : [['OF RAM', `${((selW!.mem / TOTAL_RAM_MB) * 100).toFixed(1)}%`], ['PROCESSES', String(selW!.procs.length)], ['CPU', cpu(selW!.cpu)], ['DISK I/O', rate(selW!.disk)]]
            ).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            {!selP && focus !== selW!.id && <button type="button" className="dm-look" onClick={() => setFocus(selW!.id)}>Look inside <CornerDownLeft size={11} /></button>}
          </> : <>
            <div className="dm-sel-name">All apps</div>
            <div className="dm-big">{mb(used).split(' ')[0]}<small>{mb(used).split(' ')[1]}</small></div>
            <div className="dm-muted dm-small">Click a tile to see what it is.</div>
          </>}
        </section>
        <section>
          <h4>WORTH A LOOK</h4>
          {shown.map(({ w, reason }) => <button type="button" key={w.id} className="dm-pick" style={{ ['--c' as string]: CATEGORY[w.category].color }} onClick={() => setSelection({ kind: 'workload', id: w.id })}>
            <span><b>{w.name}</b><span className="dm-mono">{mb(w.mem)}</span></span>
            <span><small>{reason}</small><i><i style={{ width: `${(w.mem / largest) * 100}%` }} /></i></span>
          </button>)}
        </section>
        <section>
          <h4>MEMORY</h4>
          <div className="dm-meter">{memory.map(m => <i key={m.name} style={{ width: `${(m.gb / 32) * 100}%`, background: m.color }} />)}</div>
          <div className="dm-meter-keys">{memory.map(m => <span key={m.name}><i style={{ background: m.color }} />{m.name} <b>{m.gb.toFixed(1)} GB</b></span>)}</div>
          <dl className="dm-rows">{[['Free', '7.70 GB'], ['Total', '32.00 GB'], ['Swap used', '512 MB of 2.00 GB'], ['Pressure', '38%']].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </section>
      </aside>
    </div>
    <div className="dm-footer">
      <span className="dm-shortcuts">{[['click', 'select'], ['enter', 'open'], ['bksp', 'up'], ['/', 'filter'], ['1 2 3', 'mode'], ['p', 'pause'], ['e', 'export'], ['esc', 'clear']].map(([k, a]) => <span key={k}><kbd>{k}</kbd>{a}</span>)}</span>
      <span className={paused ? 'dm-amber' : ''}>{paused ? `paused · showing the snapshot from ${frozenFor}s ago · press P to resume` : `diskMon ${version} · sampled ${PROCESS_COUNT} processes · 38 ms · updated 1s ago`}</span>
    </div>
  </div>;
}
