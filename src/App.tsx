/**
 * App.tsx — Root application component for the CPU Scheduling Simulator.
 *
 * This component is the central hub of the application. It:
 *   1. Manages global application state (processes, algorithm settings, theme, tab).
 *   2. Orchestrates simulation by calling the backend Python API or falling back
 *      to the TypeScript scheduler when the backend is offline.
 *   3. Renders the header, navigation tabs, and the three main content panels:
 *        - "Interactive Sim Stage"   → ProcessManager + LiveSimulation + metrics table
 *        - "Comparative Analytics"   → PerformanceDashboard (bar charts + comparison matrix)
 *        - "Python Source Package"   → SourceViewer (code display with copy/download)
 */
import { useState, useEffect } from "react";
import { defaultProcesses } from "./defaultData";
import { TSScheduler } from "./utils/scheduler_engine";
import { Process, SimulationResult, AlgorithmDetail, AlgorithmKey } from "./types";
import ProcessManager from "./components/ProcessManager";
import LiveSimulation from "./components/LiveSimulation";
import PerformanceDashboard from "./components/PerformanceDashboard";

import SourceViewer from "./components/SourceViewer";
import {
  Cpu,
  TrendingUp,
  FileCode,
  HelpCircle,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";

/**
 * Static metadata for all 7 supported scheduling algorithms.
 * Used to populate the algorithm selector sidebar and the "Concept Spec" description panel.
 * The `key` field must match the AlgorithmKey union type and the keys returned by
 * run_all_simulations (Python) and TSScheduler.runAll (TypeScript).
 */
const ALGORITHMS: AlgorithmDetail[] = [
  {
    name: "First-Come First-Served (FCFS)",
    key: "FCFS",
    description: "Executes threads in exact order of arrival. Non-preemptive, highly prone to the 'Convoy Effect' where short tasks wait behind giant compute workloads.",
    isPreemptive: false,
    type: "core",
  },
  {
    name: "Shortest Job First (SJF)",
    key: "SJF",
    description: "Schedules the arrived process with the minimum CPU total burst duration first. Incredibly optimal for average wait times but requires perfect prediction of future durations.",
    isPreemptive: false,
    type: "core",
  },
  {
    name: "Shortest Remaining Time First (SRTF)",
    key: "SRTF",
    description: "Preemptive extension of SJF. At any clock tick, if a newly arrived process possesses a shorter remaining time, the active CPU thread is preempted immediately.",
    isPreemptive: true,
    type: "advanced",
  },
  {
    name: "Round Robin (RR)",
    key: "RR",
    description: "Allocates cyclic execution slots up to a configured 'Time Quantum'. Preempts threads when quantum terminates, placing them back in the Ready list. Perfect fair-share algorithm.",
    isPreemptive: true,
    type: "core",
  },
  {
    name: "Priority Scheduling (Non-Preemptive)",
    key: "PriorityNP",
    description: "Schedules the arrived thread with maximum priority. Does not preempt running tasks. High priority items compile immediately when CPU frees up.",
    isPreemptive: false,
    type: "core",
  },
  {
    name: "Priority Scheduling (Preemptive)",
    key: "PriorityP",
    description: "Preemptive priority scheduling. Immediately suspends active thread if a newly arrived job has superior priority. Highly optimal but prone to low priority starvation.",
    isPreemptive: true,
    type: "advanced",
  },
  {
    name: "Multilevel Queue Scheduling (MLQ)",
    key: "MLQ",
    description: "Organizes processes into distinct hardware queues: Queue 0 for High Priority interactive jobs (utilizes RR quantum 2), Queue 1 for Low Priority batch jobs (utilizes FCFS). Q0 always preempts Q1.",
    isPreemptive: true,
    type: "advanced",
  },
];

export default function App() {
  // ── Process State ────────────────────────────────────────────────────────
  const [processes, setProcesses] = useState<Process[]>(defaultProcesses); // Active process list
  const [lowerIsHigher, setLowerIsHigher] = useState<boolean>(true);        // Priority mapping direction
  const [rrQuantum, setRrQuantum] = useState<number>(2);                    // Round Robin time quantum

  // ── UI Navigation State ──────────────────────────────────────────────────
  const [activeAlgo, setActiveAlgo] = useState<AlgorithmKey>("FCFS");                             // Currently selected algorithm
  const [currTab, setCurrTab] = useState<"simulate" | "analytics" | "source">("simulate");        // Active navigation tab

  // ── Simulation Result State ──────────────────────────────────────────────
  const [simulatorResults, setSimulatorResults] = useState<Record<string, SimulationResult> | null>(null); // Results map for all 7 algorithms
  const [calculationSource, setCalculationSource] = useState<string>("");  // "python" or "typescript_fallback_*"
  const [triggerCount, setTriggerCount] = useState(0);     // Incremented to force re-simulation
  const [simError, setSimError] = useState("");            // Error message shown in fallback banner
  const [isSimulating, setIsSimulating] = useState(false); // Loading state while simulation runs

  // ── Theme State ──────────────────────────────────────────────────────────
  // Initialize from localStorage, falling back to the system's color scheme preference
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("cpu-sim-theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Sync theme class on <html> element and persist to localStorage whenever isDark changes
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove("light"); // Dark mode is the default — remove "light" class
    } else {
      root.classList.add("light");    // Add "light" class to trigger CSS light theme variables
    }
    localStorage.setItem("cpu-sim-theme", isDark ? "dark" : "light");
  }, [isDark]);

  // ── Auto-run simulation on any relevant state change ─────────────────────
  // Whenever the process list, priority direction, quantum, or triggerCount changes,
  // automatically re-run all 7 algorithms to keep the results in sync.
  useEffect(() => {
    runCoreSimulation();
  }, [processes, lowerIsHigher, rrQuantum, triggerCount]);

  /**
   * runCoreSimulation — Triggers a full simulation run across all 7 algorithms.
   *
   * Primary path: POST to /api/simulate-python (runs Python subprocess on server).
   * Fallback path: TSScheduler.runAll() runs directly in the browser using the
   *   TypeScript mirror implementation, enabling offline / no-backend operation.
   *
   * The calculationSource state tracks which path was used and is displayed in
   * the navigation bar's "Sim Engine" indicator pill.
   */
  const runCoreSimulation = async () => {
    // Don't simulate with an empty process list — clear any previous results
    if (processes.length === 0) {
      setSimulatorResults(null);
      setCalculationSource("");
      return;
    }

    setIsSimulating(true);
    setSimError("");

    try {
      // Primary path: invoke the Python backend API
      const response = await fetch("/api/simulate-python", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processes,
          quantum: rrQuantum,
          lower_is_higher: lowerIsHigher,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Python (or server-side TS fallback) returned results successfully
        setSimulatorResults(data.results);
        setCalculationSource(data.source); // e.g. "python" or "typescript_fallback_exec_error"
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      // Fallback: API fetch failed entirely (server offline, network error)
      // Run algorithms directly in the browser using the TypeScript implementation
      const localResults = TSScheduler.runAll(processes, rrQuantum, lowerIsHigher);
      setSimulatorResults(localResults);
      setCalculationSource("typescript_fallback_local");
      setSimError(`Could not connect to backend server Python controller (${err.message}). Seamlessly fell back to static TypeScript runtime simulation.`);
    } finally {
      setIsSimulating(false);
    }
  };

  // Extract the result for the currently selected algorithm (used throughout the Simulate tab)
  const activeResult = simulatorResults ? simulatorResults[activeAlgo] : null;

  return (
    <div className={`min-h-screen pb-16 flex flex-col font-sans select-none antialiased theme-bg-root theme-text transition-colors`}>
      {/* 1. COMP6697001 Formal Academic Head Banner styled like a Bento item */}
      <header className="theme-bg-header backdrop-blur-sm border-b theme-border select-none shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6 md:py-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500 px-2.5 py-1 rounded-md border border-indigo-500/25 font-mono">
                COMP6697001 - Operating Systems
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-md border border-amber-500/20 font-mono flex items-center gap-1">
                <Sparkles size={10} />
                <span>Final course project</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-500/25 font-mono">
                Computer Science Major
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight theme-text-heading flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                <Cpu className="text-white shrink-0" size={20} />
              </div>
              <span>PySchedule Simulator (Kernel Engine)</span>
            </h1>
            <p className="text-xs theme-text-secondary max-w-2xl leading-relaxed">
              Design, formulate, and analyze FCFS, Non-preemptive SJF, Preemptive SRTF, Round Robin, Priority Scheduling, and Multilevel Queued task simulators. Powered by a high-optimized compiled virtual logic board.
            </p>
          </div>

          <div className="shrink-0 flex items-start gap-4">
            <div className="text-left md:text-right text-xs theme-text-secondary border-l theme-border md:border-l-0 md:border-r theme-border pl-4 md:pl-0 md:pr-4 space-y-0.5 font-mono">
              <div><strong className="theme-text font-semibold">Lecturer:</strong> Dr. Satrio Pradono Suryodiningrat</div>
              <div><strong className="text-indigo-500 font-semibold">University:</strong> Binus International University</div>
              <div><strong className="text-amber-500 font-semibold">Student 1:</strong> Michael Arianno C / 2802499711</div>
              <div><strong className="text-amber-500 font-semibold">Student 2:</strong> Timothy Jonathan I / 2802521825</div>
            </div>

            {/* ── Theme Toggle Button ── */}
            <button
              id="theme-toggle-btn"
              onClick={() => setIsDark(!isDark)}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className={`shrink-0 p-2.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                isDark
                  ? "bg-white/5 border-white/10 text-amber-400 hover:bg-white/10 hover:text-amber-300 hover:border-amber-500/30 shadow-inner"
                  : "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100 hover:border-amber-300 shadow-sm"
              }`}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Persistent Navigation Tabs nested as Bento Panel */}
      <div className="theme-bg-nav backdrop-blur-md border-b theme-border sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <nav className="flex space-x-1.5 py-2 md:py-2.5">
            <button
              onClick={() => setCurrTab("simulate")}
              className={`text-xs md:text-sm py-2 px-3.5 md:px-4 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-2 ${currTab === "simulate"
                ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.1)] font-bold"
                : "theme-text-secondary hover:theme-text hover:theme-bg-card border border-transparent"
                }`}
            >
              <Cpu size={14} />
              <span>Interactive Sim Stage</span>
            </button>

            <button
              onClick={() => setCurrTab("analytics")}
              className={`text-xs md:text-sm py-2 px-3.5 md:px-4 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-2 ${currTab === "analytics"
                ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.1)] font-bold"
                : "theme-text-secondary hover:theme-text hover:theme-bg-card border border-transparent"
                }`}
            >
              <TrendingUp size={14} />
              <span>Comparative Analytics</span>
            </button>

            <button
              onClick={() => setCurrTab("source")}
              className={`text-xs md:text-sm py-2 px-3.5 md:px-4 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-2 ${currTab === "source"
                ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.1)] font-bold"
                : "theme-text-secondary hover:theme-text hover:theme-bg-card border border-transparent"
                }`}
            >
              <FileCode size={14} />
              <span>Python Source Package</span>
            </button>
          </nav>

          {/* Core Calculation Engine Indicator */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-[10px] theme-text-muted uppercase font-mono">Sim Engine:</span>
            {isSimulating ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] theme-text-secondary theme-bg-card border theme-border py-1 px-3 rounded-full font-mono">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></span>
                <span>Resolving Thread...</span>
              </span>
            ) : calculationSource === "python" ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 py-1 px-3 rounded-full font-mono font-bold">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                <span>Active Python Runtime Engine</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/30 py-1 px-3 rounded-full font-mono font-bold" title={simError}>
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                <span>TypeScript Fallback Emulation</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Primary Content Sections */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex-1 w-full space-y-6">
        {simError && currTab === "simulate" && (
          <div className="bg-amber-500/5 border border-amber-500/20 text-amber-500 p-4 rounded-2xl text-xs space-y-1">
            <p className="font-bold flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-amber-500 rounded-full"></span>
              <span>Running simulation under local emulated typescript sandbox due to connectivity guidelines.</span>
            </p>
            <p className="opacity-90 font-medium font-sans">Rest assured: All calculations are mathematically identical to output generated by core python3 calculations.</p>
          </div>
        )}

        {currTab === "simulate" && (
          <div className="space-y-6">
            {/* 3a. Process Managers Section */}
            <section aria-label="Processes Configuration">
              <ProcessManager
                processes={processes}
                onUpdateProcesses={setProcesses}
                lowerIsHigher={lowerIsHigher}
                onUpdateLowerIsHigher={setLowerIsHigher}
                rrQuantum={rrQuantum}
                onUpdateQuantum={setRrQuantum}
                isDark={isDark}
              />
            </section>

            {/* 3b. Interactive Scheduling Stage */}
            {processes.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Left side: Selector sidebar */}
                <div className="theme-bg-card border theme-border rounded-2xl p-5 space-y-4 shadow-xl">
                  <h3 className="text-[10px] font-bold theme-text-muted uppercase tracking-widest pl-1">
                    Select Algorithm
                  </h3>
                  <div className="space-y-1.5">
                    {ALGORITHMS.map((algo) => (
                      <button
                        key={algo.key}
                        onClick={() => setActiveAlgo(algo.key)}
                        className={`w-full text-left text-xs py-3 px-3.5 rounded-xl font-medium transition-all cursor-pointer flex flex-col gap-0.5 border ${activeAlgo === algo.key
                          ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.15)] font-bold"
                          : "theme-bg-card-subtle border-transparent theme-text-secondary hover:theme-bg-card hover:theme-text"
                          }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate">{algo.name}</span>
                          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter ${algo.type === "core"
                            ? activeAlgo === algo.key ? "bg-indigo-500/20 text-indigo-300" : "theme-bg-inset theme-text-secondary"
                            : activeAlgo === algo.key ? "bg-violet-500/20 text-violet-300" : "bg-indigo-500/10 text-indigo-500"
                            }`}>
                            {algo.type}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="border-t theme-border pt-4">
                    <div className="p-4 theme-bg-card-subtle border theme-border-subtle rounded-xl space-y-2">
                      <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                        Concept Spec
                      </div>
                      <p className="text-[11px] theme-text-secondary leading-relaxed font-normal font-sans">
                        {ALGORITHMS.find((a) => a.key === activeAlgo)?.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right side: Simulation Playback Controls and Stage */}
                <div className="lg:col-span-3 space-y-6">
                  {/* Realtime sandbox animation stage */}
                  <LiveSimulation simulation={activeResult} inputs={processes} isDark={isDark} />

                  {/* Single Algorithm Wait/Turnaround Metrics Cards */}
                  {activeResult && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="theme-bg-card-subtle border theme-border p-4 rounded-xl shadow-xs font-mono flex flex-col justify-between">
                        <span className="text-[9px] font-mono uppercase theme-text-muted flex items-center gap-1">
                          <span className="w-1 h-1 theme-bg-inset rounded-full border theme-border"></span>
                          Total Completion
                        </span>
                        <div className="text-lg font-bold theme-text-heading mt-1">
                          {activeResult.timeline.length > 0 ? activeResult.timeline[activeResult.timeline.length - 1].end : 0} ms
                        </div>
                      </div>

                      <div className="bg-emerald-950/5 border border-emerald-500/20 p-4 rounded-xl shadow-xs font-mono flex flex-col justify-between">
                        <span className="text-[9px] font-mono uppercase text-emerald-500 flex items-center gap-1">
                          <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                          Avg Wait (WT)
                        </span>
                        <div className="text-lg font-bold text-emerald-500 mt-1">
                          {activeResult.average_waiting_time} ms
                        </div>
                      </div>

                      <div className="bg-blue-950/5 border border-blue-500/20 p-4 rounded-xl shadow-xs font-mono flex flex-col justify-between">
                        <span className="text-[9px] font-mono uppercase text-blue-500 flex items-center gap-1">
                          <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                          Avg Turnaround (TAT)
                        </span>
                        <div className="text-lg font-bold text-blue-500 mt-1">
                          {activeResult.average_turnaround_time} ms
                        </div>
                      </div>

                      <div className="bg-indigo-950/5 border border-indigo-500/10 p-4 rounded-xl shadow-xs font-mono flex flex-col justify-between">
                        <span className="text-[9px] font-mono uppercase text-indigo-400 flex items-center gap-1">
                          <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                          CPU Efficiency
                        </span>
                        <div className="text-lg font-bold text-indigo-400 mt-1">
                          {(() => {
                            const total = activeResult.timeline.length > 0 ? activeResult.timeline[activeResult.timeline.length - 1].end : 1;
                            const idle = activeResult.timeline.filter(b => b.pid === "IDLE").reduce((sum, b) => sum + (b.end - b.start), 0);
                            return `${Math.max(0, Math.min(100, Math.round(((total - idle) / total) * 100)))}%`;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Calculated metrics process grid table */}
                  {activeResult && (
                    <div className="theme-bg-card-subtle border theme-border rounded-2xl overflow-hidden shadow-2xs">
                      <div className="px-5 py-3.5 theme-bg-card border-b theme-border flex items-center justify-between">
                        <span className="text-xs font-bold theme-text uppercase tracking-wider flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#4f46e5] rounded-full"></span>
                          <span>Task Statistics: {ALGORITHMS.find((a) => a.key === activeAlgo)?.name}</span>
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="theme-bg-inset theme-text-secondary font-semibold uppercase text-[9px] tracking-wider border-b theme-border">
                            <tr>
                              <th className="px-5 py-3">ID</th>
                              <th className="px-5 py-3 text-center">Arrival</th>
                              <th className="px-5 py-3 text-center">Burst</th>
                              <th className="px-5 py-3 text-center">Priority</th>
                              <th className="px-5 py-3 text-center">Wait (WT)</th>
                              <th className="px-5 py-3 text-center">Turnaround (TAT)</th>
                              <th className="px-5 py-3 text-center">Completion (CT)</th>
                              <th className="px-5 py-3 text-center">Response (RT)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y theme-border-subtle">
                            {activeResult.processes.map((p) => (
                              <tr key={p.pid} className="hover:theme-bg-card transition-colors font-mono">
                                <td className="px-5 py-3 theme-text-heading font-bold">{p.pid}</td>
                                <td className="px-5 py-3 text-center theme-text-secondary">{p.arrival_time} ms</td>
                                <td className="px-5 py-3 text-center theme-text-secondary">{p.burst_time} ms</td>
                                <td className="px-5 py-3 text-center text-indigo-400 font-bold">#{p.priority}</td>
                                <td className="px-5 py-3 text-center font-bold text-emerald-500">{p.waiting_time} ms</td>
                                <td className="px-5 py-3 text-center font-bold text-blue-500">{p.turnaround_time} ms</td>
                                <td className="px-5 py-3 text-center theme-text-secondary">{p.completion_time} ms</td>
                                <td className="px-5 py-3 text-center theme-text-secondary">{p.response_time} ms</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="theme-bg-card-subtle p-12 rounded-2xl border theme-border text-center theme-text-muted font-medium py-16 flex flex-col items-center justify-center space-y-3 shadow-md">
                <Cpu size={32} className="theme-text-muted stroke-1" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold theme-text">Ready List is Empty</p>
                  <p className="text-xs theme-text-secondary max-w-sm mx-auto leading-relaxed">Please add a process value or generate a random workload above to launch the simulation.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {currTab === "analytics" && (
          <section aria-label="Performance Comparisons">
            <PerformanceDashboard allResults={simulatorResults} activeAlgoKey={activeAlgo} isDark={isDark} />
          </section>
        )}

        {currTab === "source" && (
          <section aria-label="Python Developer Source Code Codeboard">
            <SourceViewer isDark={isDark} />
          </section>
        )}


      </main>
    </div>
  );
}
