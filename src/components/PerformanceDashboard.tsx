import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { SimulationResult } from "../types";
import { TrendingDown, ShieldAlert, Award, FileSpreadsheet } from "lucide-react";

interface PerformanceDashboardProps {
  allResults: Record<string, SimulationResult> | null;
  activeAlgoKey: string;
}

export default function PerformanceDashboard({
  allResults,
  activeAlgoKey,
}: PerformanceDashboardProps) {
  if (!allResults) {
    return (
      <div className="bg-slate-900/40 p-12 rounded-2xl border border-slate-800 text-center py-16 text-slate-400 shadow-xl max-w-2xl mx-auto flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-950/60 flex items-center justify-center border border-slate-850 animate-pulse">
          <TrendingDown size={22} className="text-slate-500" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-200">No Simulation Data Generated Yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Please define your ready tasks queue, customize computation parameters, and trigger the simulator to load side-by-side benchmarks.
          </p>
        </div>
      </div>
    );
  }

  // Pre-process comparison chart data
  const chartData = Object.entries(allResults).map(([key, res]) => {
    // Map algorithm keys to nicer visual names
    const names: Record<string, string> = {
      FCFS: "FCFS",
      SJF: "SJF (Non-P)",
      SRTF: "SRTF (Pre)",
      RR: "Round Robin",
      PriorityNP: "Priority (Non-P)",
      PriorityP: "Priority (Pre)",
      MLQ: "Multilevel Q",
    };

    // Calculate throughput: Processes completed / Total Clock duration
    const totalTime = res.timeline.length > 0 ? res.timeline[res.timeline.length - 1].end : 1;
    const throughput = totalTime > 0 ? (res.processes.length / totalTime) : 0;

    // Calculate Idle percentage
    const idleDuration = res.timeline
      .filter((b) => b.pid === "IDLE")
      .reduce((sum, b) => sum + (b.end - blockStart(b)), 0);

    function blockStart(b: any) {
      return b.start;
    }

    const cpuUtil = Math.max(0, Math.min(100, Math.round(((totalTime - idleDuration) / totalTime) * 100)));

    return {
      alias: names[key] || key,
      key,
      waiting: res.average_waiting_time,
      turnaround: res.average_turnaround_time,
      throughput: Number(throughput.toFixed(4)),
      cpu_utilization: cpuUtil,
    };
  });

  // Find the winning algorithms!
  const sortedByWaiting = [...chartData].sort((a, b) => a.waiting - b.waiting);
  const bestWT = sortedByWaiting[0];

  const sortedByTurnaround = [...chartData].sort((a, b) => a.turnaround - b.turnaround);
  const bestTAT = sortedByTurnaround[0];

  return (
    <div className="space-y-6">
      {/* Overview insights banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-emerald-950/10 border border-emerald-500/20 p-5 rounded-2xl text-slate-100 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.03] pointer-events-none">
            <Award size={140} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-450 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Minimum Avg Waiting Time
            </span>
            <h4 className="text-2xl font-bold mt-2 text-white font-sans">{bestWT?.alias || "N/A"}</h4>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono pt-3 border-t border-slate-800/20">
            <span>Average WT:</span>
            <strong className="font-bold text-emerald-400">{bestWT?.waiting ?? 0} ms</strong>
          </p>
        </div>

        <div className="bg-blue-950/10 border border-blue-500/20 p-5 rounded-2xl text-slate-100 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.03] pointer-events-none">
            <Award size={140} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-405 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Minimum Avg Turnaround
            </span>
            <h4 className="text-2xl font-bold mt-2 text-white font-sans">{bestTAT?.alias || "N/A"}</h4>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono pt-3 border-t border-slate-800/20">
            <span>Average TAT:</span>
            <strong className="font-bold text-blue-405">{bestTAT?.turnaround ?? 0} ms</strong>
          </p>
        </div>

        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-bold uppercase tracking-wider font-mono font-bold">
              <ShieldAlert size={12} className="text-indigo-400" />
              <span>Schedules Evaluation Note</span>
            </div>
            <p className="text-xs text-slate-400 mt-2.5 leading-relaxed font-sans">
              <strong>Shortest Job First / SRTF</strong> generally yields mathematical minimum waiting times, but is highly prone to process <strong>starvation</strong> of longer jobs.
            </p>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-3">*Evaluated over {chartData.length} core algorithms</p>
        </div>
      </div>

      {/* Side-by-side Recharts graph */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waiting Time Chart */}
        <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-800/80">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            Average Waiting Time Benchmarks (Lower is Better)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="alias" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(30, 41, 59, 0.4)" }}
                  contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "1px solid #334155", color: "#FFF", fontSize: "11px" }}
                />
                <Bar dataKey="waiting" name="Avg Waiting Time" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Turnaround Time Chart */}
        <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-800/80">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            Average Turnaround Time Benchmarks (Lower is Better)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="alias" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(30, 41, 59, 0.4)" }}
                  contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "1px solid #334155", color: "#FFF", fontSize: "11px" }}
                />
                <Bar dataKey="turnaround" name="Avg Turnaround" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comparative Performance Matrix Table */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet size={14} className="text-slate-400" />
            <span>Side-by-Side Performance Comparison Matrix</span>
          </h3>
          <span className="text-[9px] font-mono bg-slate-900 border border-slate-800 text-slate-400 px-2.5 py-1 rounded">
            All values loaded in milliseconds (ms)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#020617] text-slate-400 font-semibold uppercase text-[9px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Scheduling Algorithm</th>
                <th className="px-4 py-3.5 font-semibold text-center">Avg Waiting Time (WT)</th>
                <th className="px-4 py-3.5 font-semibold text-center">Avg Turnaround Time (TAT)</th>
                <th className="px-4 py-3.5 font-semibold text-center">CPU Utilization (%)</th>
                <th className="px-4 py-3.5 font-semibold text-center">Throughput (proc/ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60 font-mono">
              {chartData.map((row) => (
                <tr
                  key={row.key}
                  className={`hover:bg-slate-900/30 transition-colors ${
                    row.key === activeAlgoKey ? "bg-indigo-950/20 text-slate-100 border-l-2 border-indigo-500 font-bold" : "text-slate-300"
                  }`}
                >
                  <td className="px-5 py-3 font-semibold text-slate-200 font-sans flex items-center gap-2">
                    <span>{row.alias}</span>
                    {row.key === activeAlgoKey && (
                      <span className="text-[8px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={row.waiting === bestWT?.waiting ? "text-emerald-400 font-bold" : "text-slate-300"}>
                      {row.waiting} ms
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={row.turnaround === bestTAT?.turnaround ? "text-blue-405 font-bold" : "text-slate-300"}>
                      {row.turnaround} ms
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-12 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                        <div
                          style={{ width: `${row.cpu_utilization}%` }}
                          className="bg-indigo-500 h-full"
                        ></div>
                      </div>
                      <span className="font-mono text-slate-300">{row.cpu_utilization}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-violet-400">
                    {row.throughput}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
