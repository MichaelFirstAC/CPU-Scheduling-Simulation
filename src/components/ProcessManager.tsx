import React, { useState } from "react";
import { Process } from "../types";
import { Plus, Trash2, Shuffle, AlertCircle } from "lucide-react";

interface ProcessManagerProps {
  processes: Process[];
  onUpdateProcesses: (processes: Process[]) => void;
  lowerIsHigher: boolean;
  onUpdateLowerIsHigher: (val: boolean) => void;
  rrQuantum: number;
  onUpdateQuantum: (val: number) => void;
}

export default function ProcessManager({
  processes,
  onUpdateProcesses,
  lowerIsHigher,
  onUpdateLowerIsHigher,
  rrQuantum,
  onUpdateQuantum,
}: ProcessManagerProps) {
  const [pidInput, setPidInput] = useState(`P${processes.length + 1}`);
  const [arrivalInput, setArrivalInput] = useState(0);
  const [burstInput, setBurstInput] = useState(5);
  const [priorityInput, setPriorityInput] = useState(1);
  const [queueInput, setQueueInput] = useState(0); // Q0 is RR, Q1 is FCFS
  const [errorMsg, setErrorMsg] = useState("");

  const handleAddProcess = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const normalizedPid = pidInput.trim().toUpperCase();
    if (!normalizedPid) {
      setErrorMsg("Process ID cannot be empty.");
      return;
    }

    if (processes.some((p) => p.pid === normalizedPid)) {
      setErrorMsg(`Process ${normalizedPid} already exists! Use a unique ID.`);
      return;
    }

    if (arrivalInput < 0 || burstInput <= 0 || priorityInput < 0) {
      setErrorMsg("Arrival time must be >= 0, and Burst time must be > 0.");
      return;
    }

    const newProcess: Process = {
      pid: normalizedPid,
      arrival_time: Number(arrivalInput),
      burst_time: Number(burstInput),
      priority: Number(priorityInput),
      queue_id: Number(queueInput),
    };

    const updated = [...processes, newProcess].sort((a, b) => a.arrival_time - b.arrival_time);
    onUpdateProcesses(updated);

    // Auto increment default entry fields
    const nextNum = processes.length + 2;
    setPidInput(`P${nextNum}`);
    // Keep arrival matching same or incremental
    const lastArr = processes.length > 0 ? processes[processes.length - 1].arrival_time : 0;
    setArrivalInput(Math.max(0, lastArr + 2));
    setBurstInput(5);
    setPriorityInput(1);
  };

  const handleDeleteProcess = (pidToDelete: string) => {
    const updated = processes.filter((p) => p.pid !== pidToDelete);
    onUpdateProcesses(updated);
  };

  const handleRandomWorkload = () => {
    const randomCount = Math.floor(Math.random() * 3) + 4; // 4 to 6 processes
    const generated: Process[] = [];
    const ids = ["P1", "P2", "P3", "P4", "P5", "P6", "P7"];

    for (let i = 0; i < randomCount; i++) {
      generated.push({
        pid: ids[i],
        arrival_time: i === 0 ? 0 : Math.floor(Math.random() * 8), // staggered arrivals
        burst_time: Math.floor(Math.random() * 7) + 3, // burst between 3-10
        priority: Math.floor(Math.random() * 4) + 1, // priority between 1-4
        queue_id: Math.random() > 0.5 ? 0 : 1, // random queues
      });
    }

    generated.sort((a, b) => a.arrival_time - b.arrival_time);
    onUpdateProcesses(generated);
  };

  const handleClearAll = () => {
    onUpdateProcesses([]);
    setPidInput("P1");
    setArrivalInput(0);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* 1. Add Process Form */}
      <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between h-full">
        <div>
          <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center justify-between font-sans">
            <span className="uppercase tracking-widest text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
              Add Simulation Process
            </span>
            <span className="text-[9px] bg-slate-950 text-slate-500 border border-slate-850 px-2.5 py-1 rounded-full font-mono font-bold uppercase tracking-wider">
              Inputs
            </span>
          </h2>

          <form onSubmit={handleAddProcess} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5 font-mono">
                Process ID (Unique Name)
              </label>
              <input
                type="text"
                value={pidInput}
                onChange={(e) => setPidInput(e.target.value)}
                className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 placeholder-slate-750 transition-all font-sans"
                placeholder="e.g. P1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1.5 font-mono">
                  Arrival Time (ms)
                </label>
                <input
                  type="number"
                  min="0"
                  value={arrivalInput}
                  onChange={(e) => setArrivalInput(Number(e.target.value))}
                  className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1.5 font-mono">
                  Burst Time (ms)
                </label>
                <input
                  type="number"
                  min="1"
                  value={burstInput}
                  onChange={(e) => setBurstInput(Number(e.target.value))}
                  className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-sans"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1.5 font-mono">
                  Priority Value
                </label>
                <input
                  type="number"
                  min="0"
                  value={priorityInput}
                  onChange={(e) => setPriorityInput(Number(e.target.value))}
                  className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1.5 font-mono">
                  MLQ Target Queue
                </label>
                <select
                  value={queueInput}
                  onChange={(e) => setQueueInput(Number(e.target.value))}
                  className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-sans"
                >
                  <option value={0}>Q0: High (RR)</option>
                  <option value={1}>Q1: Low (FCFS)</option>
                </select>
              </div>
            </div>

            {errorMsg && (
              <div className="text-red-300 text-xs flex items-center gap-1.5 bg-red-500/5 p-2.5 rounded-xl border border-red-500/20 animate-pulse font-sans">
                <AlertCircle size={14} className="shrink-0 text-red-450" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-650 border border-indigo-500/20 text-white font-bold text-xs py-3 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(79,70,229,0.15)] hover:shadow-[0_0_20px_rgba(79,70,229,0.25)] transition-all uppercase tracking-wider"
            >
              <Plus size={14} />
              <span>Add to Ready List</span>
            </button>
          </form>
        </div>

        <div className="mt-5 border-t border-slate-800/80 pt-4 flex gap-2 font-sans">
          <button
            onClick={handleRandomWorkload}
            className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-350 hover:text-white font-bold text-xs py-2 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
          >
            <Shuffle size={13} />
            <span>Random Workload</span>
          </button>
          <button
            onClick={handleClearAll}
            className="bg-slate-950 border border-slate-800 hover:text-red-400 hover:border-red-900/40 px-4 py-2 rounded-xl text-xs font-bold text-slate-450 cursor-pointer transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* 2. Global Parameters Settings */}
      <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center justify-between font-sans uppercase tracking-widest">
            <span>Algorithm Parameters</span>
            <span className="text-[9px] bg-slate-950 text-slate-500 border border-slate-850 px-2.5 py-1 rounded-full font-mono font-bold uppercase tracking-wider">
              Settings
            </span>
          </h2>

          <div className="space-y-5 text-xs">
            <div>
              <label className="block text-slate-450 font-bold mb-1.5 uppercase font-mono tracking-wider text-[9px]">
                Round Robin Time Quantum
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={rrQuantum}
                  onChange={(e) => onUpdateQuantum(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-slate-950 rounded-lg cursor-pointer border border-slate-850"
                />
                <span className="text-sm font-mono font-bold bg-slate-950 text-indigo-400 px-3 py-1 rounded-xl border border-slate-800 min-w-10 text-center shadow-inner">
                  {rrQuantum}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-sans leading-relaxed">
                Specifies maximum contiguous CPU-burst duration allowed before a process is context-switched in Round Robin.
              </p>
            </div>

            <div className="border-t border-slate-850 pt-4">
              <label className="block text-slate-455 font-bold mb-2 uppercase font-mono tracking-wider text-[9px]">
                Priority Assignment Mapping
              </label>
              <div className="grid grid-cols-1 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-850 font-sans">
                <button
                  type="button"
                  onClick={() => onUpdateLowerIsHigher(true)}
                  className={`text-[11px] py-2 px-3 rounded-lg font-semibold transition-all ${
                    lowerIsHigher
                      ? "bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 font-bold shadow-sm"
                      : "text-slate-500 hover:text-slate-350"
                  }`}
                >
                  Lower value = High Priority (Unix)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateLowerIsHigher(false)}
                  className={`text-[11px] py-2 px-3 rounded-lg font-semibold transition-all ${
                    !lowerIsHigher
                      ? "bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 font-bold shadow-sm"
                      : "text-slate-500 hover:text-slate-350"
                  }`}
                >
                  Higher value = High Priority (Windows)
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-sans leading-relaxed">
                Sets default direction for Priority Non-preemptive and Preemptive algorithm execution.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#030716]/60 p-3.5 rounded-xl border border-slate-850 text-[10px] text-indigo-400 font-sans mt-4 leading-relaxed">
          <div className="font-bold text-slate-300 mb-0.5 uppercase tracking-wider text-[9px]">Multilevel Queue Rule:</div>
          <div>Queue 0 is System/Interactive (High Priority, RR-Quantum=2). Queue 1 is Batch (Low Priority, FCFS). System calls in Q0 always preempt batch runs in Q1.</div>
        </div>
      </div>

      {/* 3. Processes Table */}
      <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col h-full lg:max-h-[385px] overflow-hidden">
        <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center justify-between shrink-0 font-sans uppercase tracking-widest">
          <span>Active Ready Queue ({processes.length})</span>
          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-full font-bold">
            Ready Queue
          </span>
        </h2>

        {processes.length === 0 ? (
          <div className="flex-1 border-2 border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <Shuffle size={20} className="text-slate-600 mb-2 animate-pulse" />
            <p className="text-xs font-semibold text-slate-300">Ready Queue Empty</p>
            <p className="text-[10px] text-slate-505 max-w-xs mt-1 leading-relaxed">Click "Random Workload" or add processes above to begin.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto border border-slate-850 rounded-xl scrollbar-none">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#020617] text-slate-400 uppercase text-[9px] tracking-wider sticky top-0 border-b border-slate-850">
                <tr>
                  <th className="px-3.5 py-2.5">ID</th>
                  <th className="px-3.5 py-2.5 text-center">Arrival</th>
                  <th className="px-3.5 py-2.5 text-center">Burst</th>
                  <th className="px-3.5 py-2.5 text-center">Priority</th>
                  <th className="px-3.5 py-2.5 text-center">Queue</th>
                  <th className="px-3 py-2.5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 font-mono">
                {processes.map((p) => (
                  <tr key={p.pid} className="hover:bg-slate-900/30 transition-colors">
                    <td className="px-3.5 py-2.5 font-bold text-slate-200">{p.pid}</td>
                    <td className="px-3.5 py-2.5 text-center text-slate-400">{p.arrival_time} ms</td>
                    <td className="px-3.5 py-2.5 text-center text-slate-400">{p.burst_time} ms</td>
                    <td className="px-3.5 py-2.5 text-center text-indigo-400 font-bold">#{p.priority}</td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[8px] tracking-wider font-mono ${
                        p.queue_id === 0
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/25"
                          : "bg-violet-500/10 text-violet-300 border border-violet-500/25"
                      }`}>
                        Q{p.queue_id}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => handleDeleteProcess(p.pid)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded-md cursor-pointer transition-colors"
                        title="Delete Process"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
