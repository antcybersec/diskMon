import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Cpu,
  Download,
  Github,
  HardDrive,
  Layers,
  Clock,
  ShieldCheck,
  Terminal,
  Zap,
  CheckCircle2,
  ChevronRight,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  component: Index,
});

interface WorkloadItem {
  id: string;
  name: string;
  category: string;
  colorClass: string;
  physRamMb: number;
  cpuPct: number;
  pssMb: number;
  pids: { pid: number; name: string; physMb: number }[];
}

const sampleWorkloads: WorkloadItem[] = [
  {
    id: "daemons",
    name: "macOS System Daemons",
    category: "SystemDaemon",
    colorClass: "bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-100",
    physRamMb: 2782,
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
    colorClass: "bg-blue-900 hover:bg-blue-800 border-blue-600 text-blue-100",
    physRamMb: 2171,
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
    colorClass: "bg-purple-900 hover:bg-purple-800 border-purple-600 text-purple-100",
    physRamMb: 1572,
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
    colorClass: "bg-cyan-950 hover:bg-cyan-900 border-cyan-700 text-cyan-100",
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
    colorClass: "bg-amber-950 hover:bg-amber-900 border-amber-700 text-amber-100",
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
    colorClass: "bg-emerald-950 hover:bg-emerald-900 border-emerald-700 text-emerald-100",
    physRamMb: 340,
    cpuPct: 1.2,
    pssMb: 310,
    pids: [{ pid: 8812, name: "Google Chrome Helper", physMb: 340.0 }],
  },
];

function Index() {
  const [activeMetric, setActiveMetric] = useState<"phys" | "cpu" | "pss">("phys");
  const [selectedWorkloadId, setSelectedWorkloadId] = useState<string>("antigravity");
  const [timeValue, setTimeValue] = useState<number>([60]);

  const selectedWorkload =
    sampleWorkloads.find((w) => w.id === selectedWorkloadId) || sampleWorkloads[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
              🟩
            </div>
            <span className="font-bold text-xl tracking-tight">
              disk<span className="text-emerald-400">Mon</span>
            </span>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs">
              v0.1.0
            </Badge>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-slate-100 transition-colors">
              Features
            </a>
            <a href="#treemap" className="hover:text-slate-100 transition-colors">
              Live Treemap
            </a>
            <a href="#architecture" className="hover:text-slate-100 transition-colors">
              Architecture
            </a>
            <a href="#download" className="hover:text-slate-100 transition-colors">
              Downloads
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/antcybersec/diskMon"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20">
              <a href="#download">
                <Download className="w-4 h-4 mr-2" />
                Download diskMon
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden border-b border-slate-800/60">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
          <Badge variant="outline" className="mb-6 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold rounded-full">
            <Zap className="w-3.5 h-3.5 mr-1.5 inline text-emerald-400" /> Rust & GPUI GPU-Accelerated Resource Diagnoser
          </Badge>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight mb-6">
            Visual System Resource Diagnosis <br />
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Beyond the Process Table
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Stop guessing which PID is consuming your machine&apos;s RAM. <strong className="text-slate-200">diskMon</strong> translates raw process lists into intuitive, spatial treemap workloads—pinpointing memory pressure, swap thrashing, and process trees instantly.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            <Button size="lg" asChild className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 shadow-xl shadow-emerald-500/25">
              <a href="https://github.com/antcybersec/diskMon/releases" target="_blank" rel="noreferrer">
                <Download className="w-5 h-5 mr-2" />
                Download for macOS (.dmg)
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-200">
              <a href="https://github.com/antcybersec/diskMon/releases" target="_blank" rel="noreferrer">
                <Monitor className="w-5 h-5 mr-2 text-slate-400" />
                Download for Windows (.exe)
              </a>
            </Button>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Native Apple Silicon & Intel macOS</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Native Win32 Executable</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 100% Open Source (MIT)</span>
          </div>
        </div>
      </section>

      {/* Interactive Treemap Section */}
      <section id="treemap" className="py-20 border-b border-slate-800/60 bg-slate-950/40">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Interactive Spatial Resource Treemap</h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Explore how diskMon organizes 300+ fragmented PIDs into logical workload tiles. Click any region to inspect member child processes.
            </p>
          </div>

          <Card className="border-slate-800 bg-slate-900/80 backdrop-blur shadow-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Metric View:</span>
                <Tabs value={activeMetric} onValueChange={(v) => setActiveMetric(v as any)} className="w-auto">
                  <TabsList className="bg-slate-950 border border-slate-800">
                    <TabsTrigger value="phys" className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-400">
                      Physical RAM (Footprint)
                    </TabsTrigger>
                    <TabsTrigger value="cpu" className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-400">
                      CPU Utilization
                    </TabsTrigger>
                    <TabsTrigger value="pss" className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-400">
                      Proportional PSS
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs px-3 py-1">
                  Memory Pressure: Normal (32%)
                </Badge>
              </div>
            </div>

            {/* Treemap Body Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[480px]">
              {/* Treemap Canvas Simulated Tiles */}
              <div className="lg:col-span-2 p-4 bg-slate-950/90 relative min-h-[400px] grid grid-cols-6 grid-rows-6 gap-2">
                {sampleWorkloads.map((w, idx) => {
                  const isSelected = w.id === selectedWorkloadId;
                  const gridSpanClass =
                    idx === 0
                      ? "col-span-4 row-span-4"
                      : idx === 1
                      ? "col-span-2 row-span-4"
                      : idx === 2
                      ? "col-span-3 row-span-2"
                      : idx === 3
                      ? "col-span-2 row-span-2"
                      : "col-span-1 row-span-2";

                  return (
                    <button
                      key={w.id}
                      onClick={() => setSelectedWorkloadId(w.id)}
                      className={`p-3 rounded-lg border text-left transition-all duration-200 flex flex-col justify-between group ${w.colorClass} ${gridSpanClass} ${
                        isSelected ? "ring-2 ring-emerald-400 scale-[0.99]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-xs sm:text-sm truncate mr-2">{w.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-black/40 text-slate-300 border-none">
                          {w.category}
                        </Badge>
                      </div>

                      <div>
                        <span className="font-mono text-xs sm:text-sm font-bold block">
                          {activeMetric === "cpu"
                            ? `${w.cpuPct}% CPU`
                            : activeMetric === "pss"
                            ? `${w.pssMb} MB PSS`
                            : `${(w.physRamMb / 1024).toFixed(2)} GB`}
                        </span>
                        <span className="text-[10px] opacity-75">{w.pids.length} Member PIDs</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Sidebar Inspector Panel */}
              <div className="p-6 bg-slate-900/60 border-l border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-base text-slate-100">{selectedWorkload.name}</h3>
                      <span className="text-xs text-emerald-400 font-medium">{selectedWorkload.category}</span>
                    </div>
                    <Badge variant="outline" className="border-slate-700 text-slate-400">
                      ID: {selectedWorkload.id}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-500 block">Physical Footprint</span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {(selectedWorkload.physRamMb / 1024).toFixed(2)} GB
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-500 block">Child PIDs</span>
                      <span className="text-lg font-bold font-mono text-slate-200">
                        {selectedWorkload.pids.length}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Member Process Hierarchy
                  </h4>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {selectedWorkload.pids.map((p) => (
                      <div
                        key={p.pid}
                        className="p-2.5 rounded bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-slate-300 truncate max-w-[160px]">
                          <span className="text-slate-500">PID {p.pid}</span> {p.name}
                        </span>
                        <span className="text-emerald-400 font-semibold">{p.physMb} MB</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-between">
                  <span>Additive Shared Page Safety Active</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              </div>
            </div>

            {/* History Slider Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 max-w-md">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-slate-400 whitespace-nowrap">Time Machine:</span>
                <Slider
                  value={timeValue}
                  onValueChange={(val) => setTimeValue(val)}
                  max={60}
                  step={1}
                  className="flex-1 accent-emerald-500"
                />
                <span className="text-xs font-mono font-bold text-emerald-400 whitespace-nowrap min-w-[70px]">
                  {timeValue[0] === 60 ? "Live (Now)" : `-${60 - timeValue[0]}m ago`}
                </span>
              </div>

              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Temporally-Coherent Hysteresis Active
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="py-20 border-b border-slate-800/60">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Core Subsystem Differentiators</h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Designed from the ground up to solve process fragmentation and explain resource spikes with empirical evidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur hover:border-slate-700 transition-all">
              <CardHeader>
                <Layers className="w-8 h-8 text-emerald-400 mb-2" />
                <CardTitle className="text-lg">Developer Process Grouping</CardTitle>
                <CardDescription className="text-slate-400 text-xs sm:text-sm">
                  Automatically groups scattered renderers, IDE extension hosts, language servers (`gopls`, `tsserver`), and Docker containers into logical workload tiles.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur hover:border-slate-700 transition-all">
              <CardHeader>
                <Activity className="w-8 h-8 text-cyan-400 mb-2" />
                <CardTitle className="text-lg">Temporal Hysteresis Layout</CardTitle>
                <CardDescription className="text-slate-400 text-xs sm:text-sm">
                  Naive treemaps jump erratically when memory fluctuates. diskMon applies rank hysteresis and 1MB delta noise filtering to keep tiles spatially stable.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur hover:border-slate-700 transition-all">
              <CardHeader>
                <Clock className="w-8 h-8 text-purple-400 mb-2" />
                <CardTitle className="text-lg">Time Machine Resource Delta</CardTitle>
                <CardDescription className="text-slate-400 text-xs sm:text-sm">
                  Slide back to any point in history to answer: <em>&quot;Which workload consumed +3.2 GB in the last 5 minutes?&quot;</em> View exact byte diffs per process group.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur hover:border-slate-700 transition-all">
              <CardHeader>
                <Zap className="w-8 h-8 text-amber-400 mb-2" />
                <CardTitle className="text-lg">Deterministic Diagnostic Engine</CardTitle>
                <CardDescription className="text-slate-400 text-xs sm:text-sm">
                  Rule-based diagnostic alerts flag sustained memory leaks, swap thrashing contributors, and unthrottled background CPU drain with concrete evidence.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur hover:border-slate-700 transition-all">
              <CardHeader>
                <HardDrive className="w-8 h-8 text-blue-400 mb-2" />
                <CardTitle className="text-lg">Accurate Memory Accounting</CardTitle>
                <CardDescription className="text-slate-400 text-xs sm:text-sm">
                  Uses native Mach `ri_phys_footprint` on macOS and `smaps_rollup` PSS on Linux to eliminate false double-counting of shared framework text pages.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur hover:border-slate-700 transition-all">
              <CardHeader>
                <ShieldCheck className="w-8 h-8 text-rose-400 mb-2" />
                <CardTitle className="text-lg">Privacy-First Incident Export</CardTitle>
                <CardDescription className="text-slate-400 text-xs sm:text-sm">
                  Runs 100% locally with zero cloud telemetry. Generates 1-click markdown diagnostic reports with automatic home directory path redactions.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Architecture & Telemetry Specs */}
      <section id="architecture" className="py-20 border-b border-slate-800/60 bg-slate-950/40">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="border-slate-800 bg-slate-900/80 backdrop-blur p-8">
            <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
              <div className="space-y-4 max-w-lg">
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                  Technical Architecture
                </Badge>
                <h2 className="text-2xl font-bold tracking-tight">Sub-Millisecond System Telemetry Engine</h2>
                <p className="text-slate-400 text-sm">
                  diskMon is architected as a modular Rust workspace delivering high sampling frequency with zero self-induced CPU or memory overhead.
                </p>

                <div className="space-y-2 text-xs font-mono text-slate-300">
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-500">Core Language</span>
                    <span className="text-emerald-400">Rust 2021 Edition</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-500">UI Rendering</span>
                    <span className="text-emerald-400">GPU-Accelerated GPUI (Metal / Direct3D)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-500">macOS Collector</span>
                    <span className="text-emerald-400">Mach kernel / libproc FFI</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-500">Sampling Latency</span>
                    <span className="text-emerald-400">300+ PIDs in &lt; 2.5 milliseconds</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Memory Footprint</span>
                    <span className="text-emerald-400">&lt; 40 MB Total RAM</span>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400">
                <div className="flex items-center gap-1.5 mb-3 text-slate-500 text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  workspace architecture
                </div>
                <pre className="leading-relaxed">
{`diskMon/
├── crates/
│   ├── resource-core/
│   │   ├── grouping/
│   │   ├── treemap/
│   │   ├── history/
│   │   └── diagnostics/
│   ├── resource-platform/
│   │   └── macos/ (libproc)
│   ├── resource-ui/
│   └── resource-cli/
└── website/`}
                </pre>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Download diskMon for Desktop</h2>
            <p className="text-slate-400 text-sm">
              Free and open source under the MIT License. Cross-platform builds for macOS, Windows, and Linux.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur text-center p-6 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-4 text-2xl">
                  
                </div>
                <h3 className="font-bold text-lg mb-1">macOS</h3>
                <p className="text-xs text-slate-400 mb-4">Apple Silicon (M1/M2/M3/M4) & Intel</p>
                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-[10px] mb-6">
                  macOS 12.0+ Required
                </Badge>
              </div>

              <div className="space-y-3">
                <Button asChild className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold">
                  <a href="https://github.com/antcybersec/diskMon/releases" target="_blank" rel="noreferrer">
                    Download diskMon.dmg
                  </a>
                </Button>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400">
                  brew install --cask diskmon
                </div>
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur text-center p-6 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-4 text-2xl">
                  🪟
                </div>
                <h3 className="font-bold text-lg mb-1">Windows</h3>
                <p className="text-xs text-slate-400 mb-4">Windows 10 & Windows 11 (64-bit)</p>
                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-[10px] mb-6">
                  Native Win32 Executable
                </Badge>
              </div>

              <div className="space-y-3">
                <Button asChild className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold">
                  <a href="https://github.com/antcybersec/diskMon/releases" target="_blank" rel="noreferrer">
                    Download diskMon-setup.exe
                  </a>
                </Button>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400">
                  winget install diskMon
                </div>
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur text-center p-6 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-4 text-2xl">
                  🐧
                </div>
                <h3 className="font-bold text-lg mb-1">Linux</h3>
                <p className="text-xs text-slate-400 mb-4">Arch, Ubuntu, Fedora, AppImage</p>
                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-[10px] mb-6">
                  cgroups v2 & smaps_rollup
                </Badge>
              </div>

              <div className="space-y-3">
                <Button variant="outline" asChild className="w-full border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-200">
                  <a href="https://github.com/antcybersec/diskMon/releases" target="_blank" rel="noreferrer">
                    Download AppImage
                  </a>
                </Button>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400">
                  yay -S diskmon-bin
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-10 bg-slate-950 text-xs text-slate-500">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">diskMon</span>
            <span>— Visual System Resource Diagnosis Project</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="https://github.com/antcybersec/diskMon" target="_blank" rel="noreferrer" className="hover:text-slate-300">
              GitHub Repository
            </a>
            <a href="#architecture" className="hover:text-slate-300">
              Architecture
            </a>
            <a href="https://github.com/antcybersec/diskMon/blob/main/LICENSE" target="_blank" rel="noreferrer" className="hover:text-slate-300">
              MIT License
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
