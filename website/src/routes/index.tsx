import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  Github,
  HardDrive,
  Layers,
  LayoutGrid,
  Monitor,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";

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
  bgClass: string;
  borderClass: string;
  textClass: string;
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
    bgClass: "bg-slate-800/80 hover:bg-slate-800",
    borderClass: "border-slate-700",
    textClass: "text-slate-300",
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
    bgClass: "bg-blue-900/80 hover:bg-blue-900",
    borderClass: "border-blue-700",
    textClass: "text-blue-300",
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
    bgClass: "bg-purple-900/80 hover:bg-purple-900",
    borderClass: "border-purple-700",
    textClass: "text-purple-300",
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
    bgClass: "bg-cyan-900/80 hover:bg-cyan-900",
    borderClass: "border-cyan-700",
    textClass: "text-cyan-300",
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
    name: "Ollama Local LLM",
    category: "LocalLlm",
    bgClass: "bg-amber-900/80 hover:bg-amber-900",
    borderClass: "border-amber-700",
    textClass: "text-amber-300",
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
    bgClass: "bg-emerald-900/80 hover:bg-emerald-900",
    borderClass: "border-emerald-700",
    textClass: "text-emerald-300",
    physRamMb: 340,
    cpuPct: 1.2,
    pssMb: 310,
    pids: [{ pid: 8812, name: "Google Chrome Helper", physMb: 340.0 }],
  },
];

function Index() {
  const [activeMetric, setActiveMetric] = useState<"phys" | "cpu" | "pss">("phys");
  const [selectedWorkload, setSelectedWorkload] = useState<Workload>(sampleWorkloads[2]); // Default: Antigravity IDE
  const [sliderValue, setSliderValue] = useState<number>([100]);

  const totalPhysMb = sampleWorkloads.reduce((acc, w) => acc + w.physRamMb, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              disk<span className="text-emerald-400">Mon</span>
            </span>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
              v0.1.0-alpha
            </Badge>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#demo" className="hover:text-white transition-colors">Live Treemap</a>
            <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
            <a href="#download" className="hover:text-white transition-colors">Downloads</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/antcybersec/diskMon"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <Button asChild size="sm" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold">
              <a href="#download">
                <ArrowDownToLine className="h-4 w-4 mr-1.5" />
                Download App
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24 border-b border-slate-800/60">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <Badge variant="outline" className="mb-6 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 py-1 px-3 text-xs font-semibold uppercase tracking-wider">
            <Zap className="h-3.5 w-3.5 mr-1.5 inline text-emerald-400" />
            Rust & GPUI Powered Spatial Resource Diagnoser
          </Badge>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl max-w-4xl mx-auto leading-tight">
            Visual System Resource Diagnosis <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Beyond the Process Table
            </span>
          </h1>

          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Stop guessing which PID is consuming your machine&apos;s RAM. <strong>diskMon</strong> translates raw process lists into intuitive, spatial treemap workloads—helping developers pinpoint resource pressure, swap onset, and child process trees instantly.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold px-8 shadow-lg shadow-emerald-500/20">
              <a href="#download">
                <ArrowDownToLine className="h-5 w-5 mr-2" />
                Download for macOS (.dmg)
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white">
              <a href="#download">
                <Monitor className="h-5 w-5 mr-2" />
                Download for Windows (.exe)
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-slate-400 hover:text-white">
              <a href="https://github.com/antcybersec/diskMon" target="_blank" rel="noopener noreferrer">
                <Github className="h-5 w-5 mr-2" />
                Source Code
              </a>
            </Button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> macOS (Apple Silicon & Intel)</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Windows 10 & 11</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> MIT Open Source</span>
          </div>
        </div>
      </section>

      {/* Interactive Treemap Demo Section */}
      <section id="demo" className="py-20 border-b border-slate-800/60 bg-slate-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Interactive Spatial Treemap Simulator
            </h2>
            <p className="mt-3 text-slate-400 max-w-xl mx-auto">
              Experience how diskMon consolidates 300+ scattered PIDs into logical workload tiles. Click any region to drill down into child helper processes.
            </p>
          </div>

          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-2">Metric:</span>
                <Button
                  size="sm"
                  variant={activeMetric === "phys" ? "default" : "outline"}
                  onClick={() => setActiveMetric("phys")}
                  className={activeMetric === "phys" ? "bg-emerald-500 text-slate-950 font-bold" : "border-slate-700 text-slate-300"}
                >
                  Physical Footprint (RAM)
                </Button>
                <Button
                  size="sm"
                  variant={activeMetric === "cpu" ? "default" : "outline"}
                  onClick={() => setActiveMetric("cpu")}
                  className={activeMetric === "cpu" ? "bg-emerald-500 text-slate-950 font-bold" : "border-slate-700 text-slate-300"}
                >
                  CPU Utilization (%)
                </Button>
                <Button
                  size="sm"
                  variant={activeMetric === "pss" ? "default" : "outline"}
                  onClick={() => setActiveMetric("pss")}
                  className={activeMetric === "pss" ? "bg-emerald-500 text-slate-950 font-bold" : "border-slate-700 text-slate-300"}
                >
                  Proportional PSS
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse mr-1.5 inline-block" />
                  Memory Pressure: Normal (32%)
                </Badge>
              </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              {/* Treemap Visualization Container */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                  <span>WORKLOAD TREEMAP CANVAS (1200 x 800 Area Solver)</span>
                  <span>304 PIDs Aggregated</span>
                </div>

                <div className="grid grid-cols-12 gap-2.5 h-[420px]">
                  {sampleWorkloads.map((w) => {
                    const pct = Math.round((w.physRamMb / totalPhysMb) * 100);
                    const colSpan = pct > 25 ? "col-span-6" : pct > 15 ? "col-span-4" : "col-span-2";
                    const rowSpan = pct > 20 ? "row-span-2" : "row-span-1";
                    const isSelected = selectedWorkload.id === w.id;

                    return (
                      <button
                        key={w.id}
                        onClick={() => setSelectedWorkload(w)}
                        className={`${colSpan} ${rowSpan} ${w.bgClass} ${w.borderClass} ${
                          isSelected ? "ring-2 ring-emerald-400 scale-[0.99]" : ""
                        } border rounded-xl p-4 text-left transition-all duration-200 flex flex-col justify-between group relative overflow-hidden`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm group-hover:translate-x-0.5 transition-transform">
                              {w.name}
                            </span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-black/40 text-slate-300">
                              {w.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300/80 mt-1 font-mono">
                            {w.pids.length} member process{w.pids.length > 1 ? "es" : ""}
                          </p>
                        </div>

                        <div className="mt-4 flex items-end justify-between">
                          <span className={`font-mono font-extrabold text-lg ${w.textClass}`}>
                            {activeMetric === "cpu"
                              ? `${w.cpuPct}% CPU`
                              : `${(w.physRamMb / 1024).toFixed(2)} GB`}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {pct}% RAM
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar Workload Inspector */}
              <div className="lg:col-span-1 space-y-4">
                <Card className="border-slate-800 bg-slate-950/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold text-white">
                        {selectedWorkload.name}
                      </CardTitle>
                      <Badge variant="outline" className="border-slate-700 bg-slate-900 text-emerald-400 text-xs">
                        {selectedWorkload.category}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-slate-400">
                      Aggregated Child Process Inspection
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-xs text-slate-400 font-medium block">Physical Footprint</span>
                        <span className="text-lg font-bold font-mono text-emerald-400">
                          {(selectedWorkload.physRamMb / 1024).toFixed(2)} GB
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-xs text-slate-400 font-medium block">CPU Utilization</span>
                        <span className="text-lg font-bold font-mono text-cyan-400">
                          {selectedWorkload.cpuPct}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-400 font-medium">
                        <span>Workload RAM Share</span>
                        <span>{Math.round((selectedWorkload.physRamMb / totalPhysMb) * 100)}%</span>
                      </div>
                      <Progress value={Math.round((selectedWorkload.physRamMb / totalPhysMb) * 100)} className="h-2 bg-slate-800" />
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Member Process Hierarchy ({selectedWorkload.pids.length})
                      </h4>
                      <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                        {selectedWorkload.pids.map((p) => (
                          <div
                            key={p.pid}
                            className="flex items-center justify-between p-2 rounded bg-slate-900/90 border border-slate-800/80 text-xs font-mono"
                          >
                            <span className="text-slate-300 truncate max-w-[170px]" title={p.name}>
                              <span className="text-slate-400 mr-1.5">[{p.pid}]</span>
                              {p.name}
                            </span>
                            <span className="text-emerald-400 font-semibold">{p.physMb} MB</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Time Machine Footer */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-t border-slate-800 bg-slate-900/80 text-xs text-slate-400">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Clock className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-slate-300">Temporal Time Machine:</span>
                <Slider
                  defaultValue={[100]}
                  max={100}
                  step={1}
                  value={sliderValue}
                  onValueChange={(val) => setSliderValue(val)}
                  className="w-44"
                />
                <span className="font-mono text-emerald-400 font-bold">
                  {sliderValue[0] === 100 ? "Live (Now)" : `-${Math.round((100 - sliderValue[0]) * 0.6)}m ago`}
                </span>
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Temporally-Coherent Rank Hysteresis Active
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 border-b border-slate-800/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Why diskMon Replaces Traditional Process Tables
            </h2>
            <p className="mt-3 text-slate-400 max-w-xl mx-auto">
              Designed specifically for software engineers, AI developers, and power users who need evidence-based resource diagnosis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md hover:border-emerald-500/40 transition-all duration-300">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
                  <Layers className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg text-white">Developer Process Grouping</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                Instead of scattering 35 Chrome or Brave renderers across 400 PIDs, diskMon automatically groups IDEs, Language Servers (`gopls`, `tsserver`), Docker containers, and local LLMs into unified workload tiles.
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md hover:border-emerald-500/40 transition-all duration-300">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2">
                  <LayoutGrid className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg text-white">Temporally-Coherent Treemap</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                Naive treemaps jump constantly as memory fluctuates. diskMon applies rank hysteresis and 1MB noise filtering so spatial rectangles remain spatially stable while rendering smoothly at 60 FPS.
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md hover:border-emerald-500/40 transition-all duration-300">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-2">
                  <Clock className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg text-white">Time-Machine Resource Delta</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                Slide back to any point in time to answer: <em>&quot;Which workload consumed +3.2 GB in the last 5 minutes?&quot;</em> View exact byte diffs per process group.
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md hover:border-emerald-500/40 transition-all duration-300">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg text-white">Deterministic Diagnostics</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                No non-deterministic guesswork. Rule-based alerts flag sustained memory leaks, swap thrashing contributors, and unthrottled background CPU drain with concrete evidence.
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md hover:border-emerald-500/40 transition-all duration-300">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-2">
                  <HardDrive className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg text-white">Accurate Memory Accounting</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                Uses Apple&apos;s native Mach <code>ri_phys_footprint</code> on macOS and <code>smaps_rollup</code> PSS on Linux to eliminate false double-counting of shared library memory.
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md hover:border-emerald-500/40 transition-all duration-300">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-2">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg text-white">Privacy-First Incident Export</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                Runs 100% locally with zero cloud telemetry. Generates 1-click incident reports with automatic home directory path redaction for clean GitHub bug reporting.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Technical Architecture Specs */}
      <section id="architecture" className="py-20 border-b border-slate-800/60 bg-slate-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs mb-3">
                  System Architecture Specs
                </Badge>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Built for Sub-Millisecond Telemetry & Zero Overhead
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  diskMon is architected as a modular Rust workspace delivering high performance without burning CPU cycles or adding memory overhead.
                </p>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Systems Language</span>
                    <span className="font-semibold text-emerald-400">Rust 2021 Edition</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">UI Rendering Engine</span>
                    <span className="font-semibold text-cyan-400">GPU GPUI (Metal / Direct3D)</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">macOS Telemetry API</span>
                    <span className="font-semibold text-emerald-400">Mach / libproc / sysctl FFI</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Windows Telemetry API</span>
                    <span className="font-semibold text-cyan-400">Win32 GetProcessMemoryInfo & PEB</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Sampling Latency Benchmark</span>
                    <span className="font-semibold text-emerald-400">300+ PIDs in 2.1 ms</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Total Monitor Footprint</span>
                    <span className="font-semibold text-emerald-400">&lt; 40 MB RAM</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 p-5 font-mono text-xs text-emerald-300 overflow-x-auto shadow-inner">
                <div className="flex items-center gap-1.5 pb-3 mb-3 border-b border-slate-800 text-slate-400 text-[11px]">
                  <Terminal className="h-3.5 w-3.5" />
                  <span>diskMon Cargo Workspace Topology</span>
                </div>
                <pre>{`diskMon/
├── Cargo.toml                  # Workspace Manifest
└── crates/
    ├── resource-core/          # Grouping Engine, Treemap, Diagnostics
    ├── resource-platform/      # Mach / libproc C FFI Telemetry
    ├── resource-ui/            # GPUI GPU Desktop Interface
    └── resource-cli/           # Terminal Diagnostic Engine
`}</pre>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-3">
            Get diskMon for Your Desktop
          </h2>
          <p className="text-slate-400 max-w-md mx-auto mb-12 text-sm">
            Free and open source under the MIT License.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between items-center hover:border-emerald-500/40 transition-colors">
              <div>
                <div className="text-4xl mb-3"></div>
                <h3 className="text-xl font-bold text-white">macOS</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">Apple Silicon (M1–M4) & Intel Macs</p>
                <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs mb-6">
                  macOS 12.0+ Required
                </Badge>
              </div>
              <div className="w-full space-y-3">
                <Button asChild className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold">
                  <a href="https://github.com/antcybersec/diskMon/releases" target="_blank" rel="noopener noreferrer">
                    Download diskMon.dmg
                  </a>
                </Button>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400">
                  brew install --cask diskmon
                </div>
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between items-center hover:border-emerald-500/40 transition-colors">
              <div>
                <div className="text-4xl mb-3">🪟</div>
                <h3 className="text-xl font-bold text-white">Windows</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">Windows 10 & Windows 11 (64-bit)</p>
                <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs mb-6">
                  Native Win32 Executable
                </Badge>
              </div>
              <div className="w-full space-y-3">
                <Button asChild className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold">
                  <a href="https://github.com/antcybersec/diskMon/releases" target="_blank" rel="noopener noreferrer">
                    Download diskMon-setup.exe
                  </a>
                </Button>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400">
                  winget install diskMon
                </div>
              </div>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between items-center hover:border-emerald-500/40 transition-colors">
              <div>
                <div className="text-4xl mb-3">🐧</div>
                <h3 className="text-xl font-bold text-white">Linux</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">Arch, Ubuntu, Fedora, AppImage</p>
                <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs mb-6">
                  cgroups v2 & smaps_rollup
                </Badge>
              </div>
              <div className="w-full space-y-3">
                <Button asChild variant="outline" className="w-full border-slate-700 text-slate-200 hover:bg-slate-800">
                  <a href="https://github.com/antcybersec/diskMon/releases" target="_blank" rel="noopener noreferrer">
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
      <footer className="border-t border-slate-800/80 bg-slate-950 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-emerald-400" />
            <span className="font-bold text-white text-sm">
              disk<span className="text-emerald-400">Mon</span>
            </span>
            <span className="text-xs text-slate-400 ml-2">
              © 2026 diskMon Open Source Project.
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400 font-medium">
            <a href="https://github.com/antcybersec/diskMon" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              GitHub Repository
            </a>
            <a href="#architecture" className="hover:text-white transition-colors">
              Architecture Specs
            </a>
            <a href="https://github.com/antcybersec/diskMon/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              MIT License
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
