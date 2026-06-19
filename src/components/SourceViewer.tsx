/**
 * SourceViewer.tsx — Python Source Code Package Browser.
 *
 * Provides a code viewer panel where users can browse, copy, and download
 * the Python source files powering this simulator. Uses a two-panel layout:
 *   Left sidebar: file tab selector (cpu_scheduler.py, driver.py, requirements.txt, CLI instructions)
 *   Right panel: scrollable code display with Copy and Download action buttons.
 *
 * The cpu_scheduler.py source is fetched live from the backend via
 * GET /api/get-python-code. The other files (driver.py, requirements.txt,
 * instructions.md) are embedded as static template strings to ensure they
 * are always available even when the backend is offline.
 */
import { useState, useEffect } from "react";
import { Terminal, Copy, Download, Code, CheckCircle, FileCode, Loader2 } from "lucide-react";

/** Props accepted by the SourceViewer component */
interface SourceViewerProps {
  isDark: boolean; // Theme mode (not directly used in this component but accepted for API consistency)
}

export default function SourceViewer({ isDark }: SourceViewerProps) {
  // Currently visible file tab
  const [activeTab, setActiveTab] = useState<"scheduler" | "driver" | "reqs" | "run">("scheduler");
  // Python source fetched from backend (cpu_scheduler.py)
  const [pythonCode, setPythonCode] = useState("");
  const [loading, setLoading] = useState(false);  // Loading state while fetching from backend
  const [copied, setCopied] = useState(false);    // Clipboard copy confirmation state

  // Static strings for driver, requirements, and instructions
  // These are embedded directly so they work offline without a backend
  const driverCode = `#!/usr/bin/env python3
"""
Operating Systems final project (COMP6697001) - CPU Scheduling CLI Driver

This script imports cpu_scheduler.py and runs all required scheduling techniques 
(FCFS, SJF, SRTF, RR, Priority, MLQ) from custom inputs, outputs comparative 
metrics, and prints text-based visual Gantt charts.
"""

from cpu_scheduler import CPU_Scheduler, run_all_simulations, format_gantt_text

def run_driver_simulation():
    print("=" * 70)
    print("COMP6697001 - Operating Systems: CPU Scheduler Testing Driver")
    print("=" * 70)

    # 1. Setting up sample workloads
    processes = [
        {"pid": "P1", "arrival_time": 0, "burst_time": 6, "priority": 2, "queue_id": 0},
        {"pid": "P2", "arrival_time": 2, "burst_time": 4, "priority": 1, "queue_id": 0},
        {"pid": "P3", "arrival_time": 3, "burst_time": 8, "priority": 4, "queue_id": 1},
        {"pid": "P4", "arrival_time": 5, "burst_time": 2, "priority": 3, "queue_id": 1},
    ]

    print("\\n[Input Processes]:")
    print(f"{'PID':<6} | {'Arrival':<10} | {'Burst':<8} | {'Priority':<10} | {'Queue ID (MLQ)':<15}")
    print("-" * 55)
    for p in processes:
        print(f"{p['pid']:<6} | {p['arrival_time']:<10} | {p['burst_time']:<8} | {p['priority']:<10} | {p['queue_id']:<15}")

    # 2. Run All Simulations side-by-side
    print("\\nRunning algorithms...")
    all_results = run_all_simulations(processes)

    # 3. Output results and ASCII Gantt Charts
    for key, res in all_results.items():
        print("\\n" + "#" * 60)
        print(f" Algorithm: {res['algorithm']}")
        print("#" * 60)

        # Print Gantt
        print("\\nGantt Chart Execution:")
        print(format_gantt_text(res['timeline']))

        # Print statistics table
        print(f"\\n{'PID':<6} | {'Arrival':<10} | {'Burst':<8} | {'Completion':<12} | {'Turnaround (TAT)':<16} | {'Waiting (WT)':<12}")
        print("-" * 75)
        for p in res['processes']:
            print(f"{p['pid']:<6} | {p['arrival_time']:<10} | {p['burst_time']:<8} | {p['completion_time']:<12} | {p['turnaround_time']:<16} | {p['waiting_time']:<12}")

        print("-" * 75)
        print(f"Average Waiting Time (AWT)       : {res['average_waiting_time']} ms")
        print(f"Average Turnaround Time (ATAT)   : {res['average_turnaround_time']} ms")

    print("\\n" + "=" * 70)
    print("Driver Execution Complete successfully!")
    print("=" * 70)

if __name__ == "__main__":
    run_driver_simulation()
`;

  const reqsText = `pandas>=2.0.0
matplotlib>=3.7.0
`;

  const instructionsText = `# CPU Scheduling Simulator - CLI Instructions

Follow these simple steps to run and evaluate your Python-based CPU Scheduling Simulator locally:

## Prerequisites
Ensure Python 3.x is installed on your local computer. Ensure you install matplotlib if you wish to draw customized graphs:

\`\`\`bash
pip install -r requirements.txt
\`\`\`

## Running the Simulators
We have packaged the scheduler.py and driver.py as clean separate modules.

1. **How to run the main Interactive CLI driver file**:
   Ensure both \`cpu_scheduler.py\` and \`driver.py\` are downloaded into the same directory, then prompt:
   \`\`\`bash
   python driver.py
   \`\`\`

2. **How to feed customized process inputs directly**:
   You can easily import our CPU_Scheduler class into your own Custom python files:
   \`\`\`python
   from cpu_scheduler import CPU_Scheduler

   processes = [
       {"pid": "P1", "arrival_time": 0, "burst_time": 5, "priority": 1},
       {"pid": "P2", "arrival_time": 1, "burst_time": 3, "priority": 2},
   ]

   result = CPU_Scheduler.run_srtf(processes)
   print("Average WT:", result["average_waiting_time"])
   \`\`\`

3. **Check the Output**:
   The execution terminal prints a structured ASCII Gantt table with average Waiting Time (AWT) and Turnaround time calculations!
`;

  // Fetch the live Python source code from the backend when the component mounts.
  // Falls back to a placeholder message if the backend is offline.
  useEffect(() => {
    setLoading(true);
    fetch("/api/get-python-code")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPythonCode(data.code); // Set actual source from file system
        } else {
          setPythonCode("# Failed to load Python code from backend, demonstrating offline fallback.");
        }
      })
      .catch(() => {
        // Backend unavailable (e.g. running on local TS-only mode)
        setPythonCode("# Offline mode: failed to load Python code.");
      })
      .finally(() => setLoading(false));
  }, []);

  /** Returns the source code string for the currently active tab */
  const getActiveCode = () => {
    switch (activeTab) {
      case "scheduler":
        return pythonCode;      // Live-fetched from backend
      case "driver":
        return driverCode;      // Static embedded string
      case "reqs":
        return reqsText;        // Static embedded string
      case "run":
        return instructionsText; // Static embedded markdown
    }
  };

  /** Returns the filename to use for the download button based on the active tab */
  const getActiveFileName = () => {
    switch (activeTab) {
      case "scheduler":
        return "cpu_scheduler.py";
      case "driver":
        return "driver.py";
      case "reqs":
        return "requirements.txt";
      case "run":
        return "instructions.md";
    }
  };

  /** handleCopy — Copies the currently displayed code to the clipboard.
   *  Shows a "Copied!" confirmation label for 2 seconds. */
  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * handleDownload — Downloads the currently displayed code as a text file.
   * Creates a temporary anchor element with a blob URL and triggers a click.
   * Cleans up the object URL after the download to avoid memory leaks.
   */
  const handleDownload = () => {
    const blob = new Blob([getActiveCode()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getActiveFileName();
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="theme-bg-card-subtle rounded-2xl border theme-border shadow-md overflow-hidden flex flex-col md:flex-row h-[550px]">
      {/* Sidebar Tabs */}
      <div className="w-full md:w-64 theme-bg-card border-b md:border-b-0 md:border-r theme-border p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-bold theme-text uppercase tracking-widest pl-1 mb-2">Python OS Package</h3>
            <p className="text-[11px] theme-text-secondary leading-relaxed">Download and bundle pristine Python 3 modules to compile and run local laws.</p>
          </div>

          <div className="space-y-1.5 font-sans">
            <button
              onClick={() => setActiveTab("scheduler")}
              className={`w-full text-left text-xs py-2.5 px-3.5 rounded-xl font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
                activeTab === "scheduler"
                  ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                  : "theme-text-secondary hover:theme-text hover:theme-bg-card-subtle border-transparent"
              }`}
            >
              <FileCode size={13} />
              <span>cpu_scheduler.py</span>
            </button>

            <button
              onClick={() => setActiveTab("driver")}
              className={`w-full text-left text-xs py-2.5 px-3.5 rounded-xl font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
                activeTab === "driver"
                  ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                  : "theme-text-secondary hover:theme-text hover:theme-bg-card-subtle border-transparent"
              }`}
            >
              <FileCode size={13} />
              <span>driver.py</span>
            </button>

            <button
              onClick={() => setActiveTab("reqs")}
              className={`w-full text-left text-xs py-2.5 px-3.5 rounded-xl font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
                activeTab === "reqs"
                  ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                  : "theme-text-secondary hover:theme-text hover:theme-bg-card-subtle border-transparent"
              }`}
            >
              <Code size={13} />
              <span>requirements.txt</span>
            </button>

            <div className="border-t theme-border my-2 pt-2"></div>

            <button
              onClick={() => setActiveTab("run")}
              className={`w-full text-left text-xs py-2.5 px-3.5 rounded-xl font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
                activeTab === "run"
                  ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                  : "theme-text-secondary hover:theme-text hover:theme-bg-card-subtle border-transparent"
              }`}
            >
              <Terminal size={13} />
              <span>How To Run CLI</span>
            </button>
          </div>
        </div>

        <div className="mt-6 border-t theme-border pt-4 text-[10px] theme-text-muted space-y-1.5 font-mono">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={10} className="text-emerald-500" />
            <span className="theme-text-secondary font-bold uppercase">Python 3.x Compliant</span>
          </div>
          <div>All functions use native sorting loops for timing precision.</div>
        </div>
      </div>

      {/* Code Display Sheet */}
      <div className="flex-1 flex flex-col h-full theme-bg-code theme-text-code overflow-hidden">
        {/* Actions head */}
        <div className="flex items-center justify-between p-4 border-b theme-border theme-bg-card shrink-0 select-none">
          <span className="text-xs font-mono theme-text-secondary pr-2 truncate">{getActiveFileName()}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 theme-bg-card-subtle hover:theme-bg-card rounded-lg theme-text-secondary hover:theme-text cursor-pointer transition-colors border theme-border flex items-center"
              title="Copy to Clipboard"
            >
              {copied ? <span className="text-[9px] text-emerald-500 font-mono px-1">Copied!</span> : <Copy size={13} />}
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 theme-bg-card-subtle hover:theme-bg-card rounded-lg theme-text-secondary hover:theme-text cursor-pointer transition-colors border theme-border flex items-center"
              title="Download File"
            >
              <Download size={13} />
            </button>
          </div>
        </div>

        {/* Text View Area */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed selection:bg-indigo-900/50 select-text scrollbar-none">
          {loading ? (
            <div className="h-full flex items-center justify-center theme-text-muted gap-2">
              <Loader2 size={16} className="animate-spin text-indigo-400" />
              <span>Resolving package modules...</span>
            </div>
          ) : (
            <pre className="whitespace-pre">{getActiveCode()}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
