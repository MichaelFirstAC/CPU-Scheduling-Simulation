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
  isDark: boolean;
}

export default function PerformanceDashboard({
  allResults,
  activeAlgoKey,
  isDark,
}: PerformanceDashboardProps) {
  if (!allResults) {
    return (
      <div className="theme-bg-card p-12 rounded-2xl border theme-border text-center py-16 theme-text-secondary shadow-xl max-w-2xl mx-auto flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full theme-bg-inset flex items-center justify-center border theme-border animate-pulse">
          <TrendingDown size={22} className="theme-text-muted" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold theme-text">No Simulation Data Generated Yet</p>
          <p className="text-xs theme-text-secondary max-w-sm mx-auto leading-relaxed">
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

  // Chart styling based on theme
  const chartGridColor = isDark ? "#1e293b" : "#e2e8f0";
  const chartAxisColor = isDark ? "#475569" : "#94a3b8";
  const tooltipBg = isDark ? "#0f172a" : "#ffffff";
  const tooltipBorder = isDark ? "#334155" : "#e2e8f0";
  const tooltipColor = isDark ? "#f1f5f9" : "#0f172a";

  return (
    <div className="space-y-6">
      {/* Overview insights banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-emerald-950/10 border border-emerald-500/20 p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.03] pointer-events-none">
            <Award size={140} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Minimum Avg Waiting Time
            </span>
            <h4 className="text-2xl font-bold mt-2 theme-text-heading font-sans">{bestWT?.alias || "N/A"}</h4>
          </div>
          <p className="text-xs theme-text-secondary flex items-center gap-1.5 font-mono pt-3 border-t border-emerald-500/10">
            <span>Average WT:</span>
            <strong className="font-bold text-emerald-500">{bestWT?.waiting ?? 0} ms</strong>
          </p>
        </div>

        <div className="bg-blue-950/10 border border-blue-500/20 p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.03] pointer-events-none">
            <Award size={140} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Minimum Avg Turnaround
            </span>
            <h4 className="text-2xl font-bold mt-2 theme-text-heading font-sans">{bestTAT?.alias || "N/A"}</h4>
          </div>
          <p className="text-xs theme-text-secondary flex items-center gap-1.5 font-mono pt-3 border-t border-blue-500/10">
            <span>Average TAT:</span>
            <strong className="font-bold text-blue-500">{bestTAT?.turnaround ?? 0} ms</strong>
          </p>
        </div>

        <div className="theme-bg-card p-5 rounded-2xl border theme-border shadow-md flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-bold uppercase tracking-wider font-mono">
              <ShieldAlert size={12} className="text-indigo-400" />
              <span>Schedules Evaluation Note</span>
            </div>
            <p className="text-xs theme-text-secondary mt-2.5 leading-relaxed font-sans">
              <strong className="theme-text">Shortest Job First / SRTF</strong> generally yields mathematical minimum waiting times, but is highly prone to process <strong className="theme-text">starvation</strong> of longer jobs.
            </p>
          </div>
          <p className="text-[10px] theme-text-muted font-mono mt-3">*Evaluated over {chartData.length} core algorithms</p>
        </div>
      </div>

      {/* Side-by-side Recharts graph */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waiting Time Chart */}
        <div className="theme-bg-card-subtle p-5 rounded-2xl border theme-border">
          <h3 className="text-xs font-bold theme-text uppercase tracking-widest mb-5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            Average Waiting Time Benchmarks (Lower is Better)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                <XAxis dataKey="alias" stroke={chartAxisColor} fontSize={10} tickLine={false} />
                <YAxis stroke={chartAxisColor} fontSize={10} tickLine={false} />
                <Tooltip
                  cursor={{ fill: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(226,232,240,0.4)" }}
                  contentStyle={{ background: tooltipBg, borderRadius: "8px", border: `1px solid ${tooltipBorder}`, color: tooltipColor, fontSize: "11px" }}
                />
                <Bar dataKey="waiting" name="Avg Waiting Time" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Turnaround Time Chart */}
        <div className="theme-bg-card-subtle p-5 rounded-2xl border theme-border">
          <h3 className="text-xs font-bold theme-text uppercase tracking-widest mb-5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            Average Turnaround Time Benchmarks (Lower is Better)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                <XAxis dataKey="alias" stroke={chartAxisColor} fontSize={10} tickLine={false} />
                <YAxis stroke={chartAxisColor} fontSize={10} tickLine={false} />
                <Tooltip
                  cursor={{ fill: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(226,232,240,0.4)" }}
                  contentStyle={{ background: tooltipBg, borderRadius: "8px", border: `1px solid ${tooltipBorder}`, color: tooltipColor, fontSize: "11px" }}
                />
                <Bar dataKey="turnaround" name="Avg Turnaround" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comparative Performance Matrix Table */}
      <div className="theme-bg-card-subtle border theme-border rounded-2xl overflow-hidden shadow-md">
        <div className="p-4 theme-bg-card border-b theme-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold theme-text uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet size={14} className="theme-text-secondary" />
            <span>Side-by-Side Performance Comparison Matrix</span>
          </h3>
          <span className="text-[9px] font-mono theme-bg-input border theme-border theme-text-secondary px-2.5 py-1 rounded">
            All values loaded in milliseconds (ms)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="theme-bg-inset theme-text-secondary font-semibold uppercase text-[9px] tracking-wider border-b theme-border">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Scheduling Algorithm</th>
                <th className="px-4 py-3.5 font-semibold text-center">Avg Waiting Time (WT)</th>
                <th className="px-4 py-3.5 font-semibold text-center">Avg Turnaround Time (TAT)</th>
                <th className="px-4 py-3.5 font-semibold text-center">CPU Utilization (%)</th>
                <th className="px-4 py-3.5 font-semibold text-center">Throughput (proc/ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y theme-border-subtle font-mono">
              {chartData.map((row) => (
                <tr
                  key={row.key}
                  className={`hover:theme-bg-card transition-colors ${
                    row.key === activeAlgoKey ? "bg-indigo-500/5 theme-text border-l-2 border-indigo-500 font-bold" : "theme-text-secondary"
                  }`}
                >
                  <td className="px-5 py-3 font-semibold theme-text font-sans flex items-center gap-2">
                    <span>{row.alias}</span>
                    {row.key === activeAlgoKey && (
                      <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={row.waiting === bestWT?.waiting ? "text-emerald-500 font-bold" : "theme-text-secondary"}>
                      {row.waiting} ms
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={row.turnaround === bestTAT?.turnaround ? "text-blue-500 font-bold" : "theme-text-secondary"}>
                      {row.turnaround} ms
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-12 theme-bg-input h-1.5 rounded-full overflow-hidden border theme-border">
                        <div
                          style={{ width: `${row.cpu_utilization}%` }}
                          className="bg-indigo-500 h-full"
                        ></div>
                      </div>
                      <span className="font-mono theme-text-secondary">{row.cpu_utilization}%</span>
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
