import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  Cpu,
  Download,
  Github,
  HardDrive,
  Layers,
  Shield,
  Zap,
  Clock,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Apple,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

interface ProcessItem {
  pid: number;
  name: string;
  physMb: number;
}

interface Workload {
  id: string;
  name: string;
  category: string;
  bgColor: string;
  borderColor: string;
  physRamMb: number;
  cpuPct: number;
  pssMb: number;
  pids: ProcessItem[];
}

const sampleWorkloads: Workload[] = [
  {
    id: "daemons",
    name: "macOS System Daemons",
    category: "SystemDaemon",
    bgColor: "bg-slate-800/80 hover:bg-slate-700/80",
    borderColor: "border-slate-600",
    physRamMb: 2780,
    cpuPct: 3.2,
    pssMb: 2400,
    pids: [
      { pid: 1, name: "launchd", physMb: 42.0 },
      { pid: 184, name: "WindowServer", physMb: 850.0 },
      { pid: 320, name: "kernelmanagerd", physMb: 120.0 },
      { pid: 412, name: "syspolicyd", physMb: 88.0 },
      { pid: 501, name: "mds_stores", physMb: 420.0 },
      { pid: 610, name: "coreaudiod", physMb: 64.0 },
    ],
  },
  {
    id: "brave",
    name: "Brave Browser",
    category: "Browser",
    bgColor: "bg-blue-900/70 hover:bg-blue-800/70",
    borderColor: "border-blue-500/50",
    physRamMb: 2240,
    cpuPct: 8.5,
    pssMb: 1980,
    pids: [
      { pid: 7120, name: "Brave Browser (Main)", physMb: 450.0 },
      { pid: 7124, name: "Brave Helper (GPU)", physMb: 380.0 },
      { pid: 7129, name: "Brave Helper (Renderer 1)", physMb: 310.0 },
      { pid: 7132, name: "Brave Helper (Renderer 2)", physMb: 290.0 },
      { pid: 7140, name: "Brave Helper (Renderer 3)", physMb: 240.0 },
      { pid: 7145, name: "Brave Helper (Network)", physMb: 180.0 },
    ],
  },
  {
    id: "antigravity",
    name: "Antigravity IDE",
    category: "Ide",
    bgColor: "bg-purple-900/70 hover:bg-purple-800/70",
    borderColor: "border-purple-500/50",
    physRamMb: 1480,
    cpuPct: 14.2,
    pssMb: 1350,
    pids: [
      { pid: 14201, name: "Antigravity Main Process", physMb: 520.0 },
      { pid: 14215, name: "gopls (Go Language Server)", physMb: 380.0 },
      { pid: 14220, name: "tsserver (TypeScript Server)", physMb: 240.0 },
      { pid: 14228, name: "mcp-server (Stitch MCP Helper)", physMb: 180.0 },
      { pid: 14234, name: "extensionHost", physMb: 160.0 },
    ],
  },
  {
    id: "docker",
    name: "Docker Container Runtime",
    category: "ContainerRuntime",
    bgColor: "bg-sky-900/70 hover:bg-sky-800/70",
    borderColor: "border-sky-500/50",
    physRamMb: 1120,
    cpuPct: 4.1,
    pssMb: 1050,
    pids: [
      { pid: 22100, name: "com.docker.backend", physMb: 680.0 },
      { pid: 22105, name: "vpnkit", physMb: 240.0 },
      { pid: 22110, name: "docker-index", physMb: 200.0 },
    ],
  },
  {
    id: "ollama",
    name: "Ollama Local LLM (Llama 3)",
    category: "LocalLlm",
    bgColor: "bg-amber-900/70 hover:bg-amber-800/70",
    borderColor: "border-amber-500/50",
    physRamMb: 920,
    cpuPct: 22.8,
    pssMb: 900,
    pids: [
      { pid: 31050, name: "ollama_llama3_runner", physMb: 850.0 },
      { pid: 31052, name: "ollama_daemon", physMb: 70.0 },
    ],
  },
  {
    id: "chrome",
    name: "Google Chrome",
    category: "Browser",
    bgColor: "bg-emerald-900/70 hover:bg-emerald-800/70",
    borderColor: "border-emerald-500/50",
    physRamMb: 340,
    cpuPct: 1.2,
    pssMb: 310,
    pids: [{ pid: 8812, name: "Google Chrome Helper", physMb: 340.0 }],
  },
];

function Index() {
  const [activeMetric, setActiveMetric] = useState<"phys" | "cpu" | "pss">("phys");
  const [selectedWorkloadId, setSelectedWorkloadId] = useState<string>("antigravity");
  const [timelineVal, setTimelineVal] = useState<number>(60);

  const selectedWorkload =
    sampleWorkloads.find((w) => w.id === selectedWorkloadId) || sampleWorkloads[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-black">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 font-bold text-xl tracking-tight">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              🟩
            </span>
            <span>
              disk<span className="text-emerald-400">Mon</span>
            </span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              v0.1.0-alpha
            </span>
          </div>

          <nav className="flex items-center gap-6 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-slate-100 transition-colors">
              Features
            </a>
            <a href="#demo" className="hover:text-slate-100 transition-colors">
              Live Treemap
            </a>
            <a href="#architecture" className="hover:text-slate-100 transition-colors">
              Architecture
            </a>
            <a
              href="https://github.com/antcybersec/diskMon"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-slate-300 hover:text-white"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
            <a
              href="#download"
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold transition-all shadow-lg shadow-emerald-500/20"
            >
              Download
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Rust-Powered GPU Treemap Resource Diagnoser
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight mb-6">
            Visual System Resource Diagnosis <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500">
              Beyond the Process Table
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Stop guessing which PID is consuming your machine's RAM. <strong>diskMon</strong> translates raw processes into intuitive spatial workload treemaps—helping developers pinpoint resource spikes, swap onset, and child process trees instantly.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <a
              href="https://github.com/antcybersec/diskMon/releases"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base transition-all shadow-xl shadow-emerald-500/25 hover:-translate-y-0.5"
            >
              <Apple className="w-5 h-5" />
              <span>Download for macOS (.dmg)</span>
            </a>
            <a
              href="https://github.com/antcybersec/diskMon/releases"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 font-bold text-base transition-all hover:-translate-y-0.5"
            >
              <Monitor className="w-5 h-5 text-blue-400" />
              <span>Download for Windows (.exe)</span>
            </a>
            <a
              href="https://github.com/antcybersec/diskMon"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 font-medium text-base transition-all"
            >
              <Github className="w-5 h-5" />
              <span>Source Code</span>
            </a>
          </div>

          <div className="text-xs text-slate-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Runs natively on Apple Silicon (M1/M2/M3/M4), Intel Macs, and Windows 10/11</span>
          </div>
        </div>
      </section>

      {/* Interactive Treemap Simulator Section */}
      <section id="demo" className="py-16 bg-slate-900/40 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Interactive Spatial Resource Treemap
            </h2>
            <p className="text-slate-400">
              Experience how <strong>diskMon</strong> organizes 300+ fragmented PIDs into logical workload tiles. Click any region to inspect member child process hierarchies.
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Visualization Metric:
                </span>
                <div className="inline-flex p-1 bg-slate-950 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setActiveMetric("phys")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      activeMetric === "phys"
                        ? "bg-slate-800 text-slate-100 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Physical RAM Footprint
                  </button>
                  <button
                    onClick={() => setActiveMetric("cpu")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      activeMetric === "cpu"
                        ? "bg-slate-800 text-slate-100 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    CPU Utilization %
                  </button>
                  <button
                    onClick={() => setActiveMetric("pss")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      activeMetric === "pss"
                        ? "bg-slate-800 text-slate-100 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Proportional PSS
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Memory Pressure: Normal (32%)</span>
              </div>
            </div>

            {/* Treemap Grid & Detail View */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[460px]">
              {/* Treemap Mosaic (2 Cols) */}
              <div className="lg:col-span-2 grid grid-cols-3 grid-rows-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                {sampleWorkloads.map((w) => {
                  const isSelected = w.id === selectedWorkloadId;
                  const displayVal =
                    activeMetric === "cpu"
                      ? `${w.cpuPct}% CPU`
                      : w.physRamMb >= 1024
                      ? `${(w.physRamMb / 1024).toFixed(2)} GB`
                      : `${w.physRamMb} MB`;

                  return (
                    <button
                      key={w.id}
                      onClick={() => setSelectedWorkloadId(w.id)}
                      className={`relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between group ${
                        w.bgColor
                      } ${w.borderColor} ${
                        isSelected
                          ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-[0.99]"
                          : "opacity-90 hover:opacity-100"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-mono font-medium text-slate-300 opacity-75 mb-1">
                          {w.category}
                        </div>
                        <div className="font-bold text-sm sm:text-base text-white group-hover:text-emerald-300 transition-colors">
                          {w.name}
                        </div>
                      </div>
                      <div className="text-xs font-mono font-semibold text-emerald-400 bg-slate-950/60 px-2 py-1 rounded w-fit border border-white/10">
                        {displayVal}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detail Sidebar (1 Col) */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="font-bold text-lg text-white">
                        {selectedWorkload.name}
                      </h3>
                      <span className="text-xs font-mono text-emerald-400">
                        {selectedWorkload.category}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-400 mb-1">Physical RAM</div>
                      <div className="text-lg font-mono font-bold text-emerald-400">
                        {(selectedWorkload.physRamMb / 1024).toFixed(2)} GB
                      </div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-400 mb-1">Child PIDs</div>
                      <div className="text-lg font-mono font-bold text-cyan-400">
                        {selectedWorkload.pids.length}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      Member Process Hierarchy
                    </h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {selectedWorkload.pids.map((p) => (
                        <div
                          key={p.pid}
                          className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-md border border-slate-800/80 text-xs font-mono"
                        >
                          <span className="text-slate-300">
                            PID {p.pid} — <strong className="text-white">{p.name}</strong>
                          </span>
                          <span className="text-emerald-400">{p.physMb} MB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>100% Local Sampling</span>
                  <span className="text-emerald-400 font-mono">0.0% Overhead</span>
                </div>
              </div>
            </div>

            {/* History Controls Footer */}
            <div className="mt-6 pt-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Temporal Time Machine:</span>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={timelineVal}
                  onChange={(e) => setTimelineVal(parseInt(e.target.value))}
                  className="w-40 accent-emerald-500 cursor-pointer"
                />
                <span className="font-mono text-emerald-400 font-bold">
                  {timelineVal === 60 ? "Live (Now)" : `-${60 - timelineVal}m ago`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Temporally-Coherent Hysteresis Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Why diskMon Replaces Traditional Process Monitors
            </h2>
            <p className="text-slate-400">
              Built for software engineers, AI developers, and power users who need evidence-based resource clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
              <Layers className="w-10 h-10 text-emerald-400 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-3">Developer Process Grouping</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Instead of scattering 35 Chrome or Brave renderers across 400 PIDs, diskMon automatically groups IDEs, Language Servers (`gopls`, `tsserver`), Docker containers, and local LLMs into single workload tiles.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
              <Zap className="w-10 h-10 text-cyan-400 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-3">Temporally-Coherent Layout</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Naive treemaps jump constantly as memory fluctuates. diskMon applies rank hysteresis and noise filtering so rectangles stay spatially stable while updating at 60 FPS.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
              <Clock className="w-10 h-10 text-blue-400 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-3">Time Machine Delta Engine</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Slide back to any point in time to answer: <em>"Which workload consumed +3.2 GB in the last 5 minutes?"</em> View exact byte diffs per process group.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
              <AlertTriangle className="w-10 h-10 text-amber-400 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-3">Deterministic Diagnostics</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                No non-deterministic guesswork. Rule-based alerts flag sustained memory leaks, swap thrashing contributors, and unthrottled background CPU drain with concrete evidence.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
              <HardDrive className="w-10 h-10 text-purple-400 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-3">Accurate Memory Accounting</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Uses Apple's native Mach <code>ri_phys_footprint</code> on macOS and <code>smaps_rollup</code> PSS on Linux to eliminate false double-counting of shared library memory.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
              <Shield className="w-10 h-10 text-rose-400 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-3">Privacy-First & Local</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Runs 100% locally with zero cloud telemetry. Generates 1-click incident reports with automatic home directory path redaction for clean GitHub bug reporting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Architecture Specs Section */}
      <section id="architecture" className="py-20 bg-slate-900/40 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Technical Architecture & Telemetry Specs
              </h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                diskMon is architected as a modular Rust workspace delivering sub-millisecond telemetry sampling with zero idle CPU overhead.
              </p>

              <div className="space-y-4">
                <div className="flex justify-between pb-3 border-b border-slate-800 text-sm">
                  <span className="text-slate-400">Core Language</span>
                  <span className="font-mono font-bold text-emerald-400">Rust 2021 Edition</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-slate-800 text-sm">
                  <span className="text-slate-400">UI Framework</span>
                  <span className="font-mono font-bold text-emerald-400">GPU-Accelerated GPUI (Metal / Direct3D)</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-slate-800 text-sm">
                  <span className="text-slate-400">macOS Collector</span>
                  <span className="font-mono font-bold text-emerald-400">Mach Kernel / libproc / sysctl FFI</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-slate-800 text-sm">
                  <span className="text-slate-400">Windows Collector</span>
                  <span className="font-mono font-bold text-emerald-400">Win32 GetProcessMemoryInfo & PEB</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-slate-800 text-sm">
                  <span className="text-slate-400">Sampling Latency</span>
                  <span className="font-mono font-bold text-emerald-400">300+ PIDs in &lt; 2.5 milliseconds</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-slate-800 text-sm">
                  <span className="text-slate-400">Memory Footprint</span>
                  <span className="font-mono font-bold text-emerald-400">&lt; 40 MB total RAM</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto shadow-xl">
              <div className="text-slate-500 mb-4">// diskMon Modular Rust Workspace Structure</div>
              <pre>{`diskMon/
├── crates/
│   ├── resource-core/       # Data models, Grouping Engine, Treemap, Diagnostics
│   ├── resource-platform/   # Mach / libproc C FFI & OS Telemetry Collectors
│   ├── resource-ui/         # GPUI GPU Desktop Interface
│   └── resource-cli/        # Terminal Diagnostic Engine
└── website/                 # Landing Page & Interactive Simulator`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Get diskMon for Your Desktop
            </h2>
            <p className="text-slate-400">
              Free and open source under the MIT License.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 text-center flex flex-col justify-between">
              <div>
                <Apple className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">macOS</h3>
                <p className="text-xs text-slate-400 mb-4">Apple Silicon (M1–M4) & Intel Macs</p>
                <span className="inline-block text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 mb-6">
                  macOS 12.0+ Required
                </span>
              </div>
              <div>
                <a
                  href="https://github.com/antcybersec/diskMon/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all mb-4"
                >
                  <Download className="w-4 h-4" />
                  <span>Download diskMon.dmg</span>
                </a>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400">
                  brew install --cask diskmon
                </div>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 text-center flex flex-col justify-between">
              <div>
                <Monitor className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Windows</h3>
                <p className="text-xs text-slate-400 mb-4">Windows 10 & Windows 11 (64-bit)</p>
                <span className="inline-block text-xs font-semibold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 mb-6">
                  Native Win32 Executable
                </span>
              </div>
              <div>
                <a
                  href="https://github.com/antcybersec/diskMon/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all mb-4"
                >
                  <Download className="w-4 h-4" />
                  <span>Download diskMon-setup.exe</span>
                </a>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-blue-400">
                  winget install diskMon
                </div>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 text-center flex flex-col justify-between">
              <div>
                <Terminal className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Linux</h3>
                <p className="text-xs text-slate-400 mb-4">Arch, Ubuntu, Fedora, AppImage</p>
                <span className="inline-block text-xs font-semibold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 mb-6">
                  cgroups v2 & smaps_rollup
                </span>
              </div>
              <div>
                <a
                  href="https://github.com/antcybersec/diskMon/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-700 hover:border-slate-600 text-slate-200 font-bold text-sm transition-all mb-4"
                >
                  <Download className="w-4 h-4" />
                  <span>Download AppImage</span>
                </a>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-purple-400">
                  yay -S diskmon-bin
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-950 border-t border-slate-800 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-2 font-bold text-slate-300 text-sm">
            <span>diskMon</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-500 font-normal">
              Visual System Resource Diagnosis Application
            </span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/antcybersec/diskMon"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              GitHub
            </a>
            <a href="#architecture" className="hover:text-slate-300 transition-colors">
              Documentation
            </a>
            <a
              href="https://github.com/antcybersec/diskMon/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              MIT License
            </a>
          </div>

          <div>&copy; 2026 diskMon Open Source Project. Built with Rust.</div>
        </div>
      </footer>
    </div>
  );
}
