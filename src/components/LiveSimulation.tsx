import { useState, useEffect, useRef } from "react";
import { SimulationResult, Process } from "../types";
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Cpu, CheckCircle, Users } from "lucide-react";

interface LiveSimulationProps {
  simulation: SimulationResult | null;
  inputs: Process[];
}

export default function LiveSimulation({ simulation, inputs }: LiveSimulationProps) {
  if (!simulation || simulation.timeline.length === 0) {
    return (
      <div className="bg-slate-900/40 p-12 rounded-2xl border border-slate-800 text-center py-16 text-slate-405 shadow-xl flex flex-col items-center justify-center space-y-4">
        <Cpu size={32} className="text-slate-650 stroke-1 animate-pulse" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-205">No Simulation Data Loaded</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Please add processes and click "Add to Ready List" first to enable visual tracking.
          </p>
        </div>
      </div>
    );
  }

  const { timeline, processes } = simulation;
  const totalTime = timeline[timeline.length - 1].end;

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000); // Ticks per millisecond (1000ms, 500ms, 250ms)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalTime) {
            setIsPlaying(false);
            return totalTime;
          }
          return prev + 1;
        });
      }, speed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, totalTime]);

  // If inputs change, reset current time
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, [simulation]);

  // Compute states at currentTime T
  const getStatesAtTime = (t: number) => {
    const readyQueue: Array<{ pid: string; remaining: number; burst: number; queue_id: number }> = [];
    const completedList: Array<{ pid: string; completion: number }> = [];
    let activeProcess: { pid: string; remaining: number; burst: number; queue_id: number; progress: number } | null = null;

    inputs.forEach((orig) => {
      // Find all completed blocks or parts of blocks for this PID before time T
      let executedTime = 0;
      timeline.forEach((block) => {
        if (block.pid === orig.pid) {
          if (block.end <= t) {
            executedTime += (block.end - block.start);
          } else if (block.start < t && t < block.end) {
            executedTime += (t - block.start);
          }
        }
      });

      const remaining = Math.max(0, orig.burst_time - executedTime);
      const isCompleted = remaining === 0;
      const isArrived = orig.arrival_time <= t;

      if (isArrived) {
        if (isCompleted) {
          // Find completion time from the final block
          const finalBlock = timeline.filter(b => b.pid === orig.pid).pop();
          completedList.push({
            pid: orig.pid,
            completion: finalBlock ? finalBlock.end : t
          });
        } else {
          // It's still active or waiting in ready queue
          // Check if this process is running currently
          const currentBlock = timeline.find(b => b.start <= t && t < b.end);
          const isRunning = currentBlock && currentBlock.pid === orig.pid;

          const pInfo = {
            pid: orig.pid,
            remaining,
            burst: orig.burst_time,
            queue_id: orig.queue_id,
          };

          if (isRunning) {
            activeProcess = {
              ...pInfo,
              progress: Math.round(((orig.burst_time - remaining) / orig.burst_time) * 100),
            };
          } else {
            readyQueue.push(pInfo);
          }
        }
      }
    });

    // Check if CPU is Idle
    const curBlock = timeline.find(b => b.start <= t && t < b.end);
    if (curBlock && curBlock.pid === "IDLE") {
      activeProcess = {
        pid: "IDLE",
        remaining: curBlock.end - t,
        burst: curBlock.end - curBlock.start,
        queue_id: -1,
        progress: Math.round(((t - curBlock.start) / (curBlock.end - curBlock.start)) * 100)
      };
    }

    return { readyQueue, completedList, activeProcess };
  };

  const { readyQueue, completedList, activeProcess } = getStatesAtTime(currentTime);

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleReset = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };
  const handleStepBack = () => {
    setIsPlaying(false);
    setCurrentTime(prev => Math.max(0, prev - 1));
  };
  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentTime(prev => Math.min(totalTime, prev + 1));
  };

  const getColorForPid = (pid: string) => {
    if (pid === "IDLE") return "bg-slate-800 text-slate-400 border-slate-700";
    const colors: Record<string, string> = {
      P1: "bg-blue-600 text-white border-blue-500",
      P2: "bg-emerald-600 text-white border-emerald-500",
      P3: "bg-amber-600 text-white border-amber-500",
      P4: "bg-purple-600 text-white border-purple-500",
      P5: "bg-rose-600 text-white border-rose-500",
      P6: "bg-cyan-600 text-white border-cyan-500",
      P7: "bg-teal-600 text-white border-teal-500",
      P8: "bg-indigo-600 text-white border-indigo-500",
    };
    return colors[pid] || "bg-violet-600 text-white border-violet-500";
  };

  return (
    <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-6 animate-fade-in font-sans">
      {/* Simulation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#4f46e5] rounded-full animate-ping"></span>
            Real-Time CPU State Simulator
          </h3>
          <p className="text-xs text-slate-500 font-sans">Play, pause, or step through the clock to visualize kernel thread state transitions.</p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 border border-slate-800 bg-slate-950 p-1.5 rounded-xl mr-1">
            <button
              onClick={handleStepBack}
              disabled={currentTime === 0}
              className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
              title="Step Backward"
            >
              <SkipBack size={13} />
            </button>
            <button
              onClick={handlePlayPause}
              className={`p-1.5 rounded-full cursor-pointer transition-transform duration-100 ${
                isPlaying ? "bg-indigo-600 text-white hover:scale-105" : "bg-emerald-600 text-white hover:scale-105"
              }`}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={handleStepForward}
              disabled={currentTime === totalTime}
              className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
              title="Step Forward"
            >
              <SkipForward size={13} />
            </button>
            <span className="w-px h-4 bg-slate-800 mx-0.5"></span>
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white cursor-pointer transition-colors"
              title="Reset"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider font-bold">Speed</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="text-xs text-slate-300 border border-slate-800 rounded-lg px-2.5 py-1.5 bg-slate-950 cursor-pointer focus:outline-none transition-colors hover:border-slate-700"
            >
              <option value={1500}>0.5x Slow</option>
              <option value={1000}>1.0x Normal</option>
              <option value={500}>2.0x Fast</option>
              <option value={200}>5.0x Extreme</option>
            </select>
          </div>
        </div>
      </div>

      {/* Visual State Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/20 p-5 rounded-2xl border border-slate-850/80">
        {/* State 1: Ready Queue */}
        <div className="flex flex-col h-56 bg-slate-900/40 border border-slate-850 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-3 border-b border-slate-850 pb-2">
            <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={12} className="text-indigo-400 animate-pulse" />
              <span>Ready Queue (Waiting)</span>
            </h4>
            <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md font-bold">
              {readyQueue.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-none">
            {readyQueue.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-12 italic font-sans">Ready queue stands empty</p>
            ) : (
              readyQueue.map((p) => (
                <div
                  key={p.pid}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-850 bg-slate-950/60 hover:border-slate-700 transition-all duration-200"
                >
                  <div className="flex items-center gap-2 font-mono">
                    <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] ${getColorForPid(p.pid)}`}>
                      {p.pid}
                    </span>
                    <span className="text-[11px] text-slate-300">Rem: {p.remaining} ms</span>
                  </div>
                  <span className={`text-[8px] font-bold uppercase tracking-wider font-mono px-1.5 py-0.5 rounded ${
                    p.queue_id === 0 ? "bg-amber-500/10 text-amber-300" : "bg-purple-500/10 text-purple-300"
                  }`}>
                    Q{p.queue_id}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* State 2: running CPU */}
        <div className="flex flex-col h-56 bg-slate-900/40 border-2 border-indigo-500/15 rounded-2xl p-4 shadow-xl relative overflow-hidden justify-between">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500 rounded-full -mr-10 -mt-10 opacity-[0.03] pointer-events-none"></div>

          <div className="w-full flex items-center justify-between mb-3 border-b border-slate-850 pb-2">
            <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={12} className="text-emerald-400 animate-pulse" />
              <span>Active CPU Core</span>
            </h4>
            <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-450 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
              Executing
            </span>
          </div>

          {activeProcess ? (
            <div className="w-full flex-1 flex flex-col justify-center items-center text-center space-y-4">
              <div
                key={activeProcess.pid}
                className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shadow-lg font-mono border transition-all duration-200 ${getColorForPid(activeProcess.pid)}`}
              >
                <span className="text-base font-black tracking-tight">{activeProcess.pid}</span>
              </div>

              <div className="w-full space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold text-slate-400 px-1 font-mono uppercase tracking-wider text-[9px]">
                  <span>Scheduler Load</span>
                  <span>{activeProcess.pid === "IDLE" ? "N/A" : `${activeProcess.progress}%`}</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                  <div
                    style={{ width: `${activeProcess.pid === "IDLE" ? 0 : activeProcess.progress}%` }}
                    className={`h-full transition-[width] ease-out duration-300 ${activeProcess.pid === "IDLE" ? "bg-slate-800" : "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"}`}
                  ></div>
                </div>
                <div className="text-[9px] text-slate-500 font-mono">
                  {activeProcess.pid === "IDLE" ? "CPU is currently standing idle" : `Remaining: ${activeProcess.remaining} ms / Duration: ${activeProcess.burst} ms`}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-slate-500 text-center py-6">
              <Cpu size={24} className="text-slate-700 animate-pulse mb-1.5" />
              <p className="text-xs font-semibold text-slate-400">Idle / System Stalled</p>
            </div>
          )}
        </div>

        {/* State 3: Completed */}
        <div className="flex flex-col h-56 bg-slate-900/40 border border-slate-850 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-3 border-b border-slate-850 pb-2">
            <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle size={12} className="text-slate-455" />
              <span>Terminated (Completed)</span>
            </h4>
            <span className="text-[9px] font-mono bg-slate-950 text-slate-400 border border-slate-850 px-2 py-0.5 rounded-md font-bold">
              {completedList.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-none">
            {completedList.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-12 italic font-sans block">No threads completed yet</p>
            ) : (
              completedList.map((p) => (
                <div key={p.pid} className="flex items-center justify-between p-2 rounded-lg border border-slate-850/80 bg-slate-950/30">
                  <div className="flex items-center gap-2 font-mono">
                    <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] opacity-80 ${getColorForPid(p.pid)}`}>
                      {p.pid}
                    </span>
                    <span className="text-[11px] text-slate-500 line-through">Exit success</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">CT: {p.completion} ms</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Gantt Timeline visualization */}
      <div className="space-y-3 font-sans">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest pl-1">Timeline / Gantt Chart</span>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 border border-slate-850 px-3.5 py-1.5 rounded-xl">
            System Clock: <strong className="font-bold text-indigo-400">{currentTime} ms</strong> / {totalTime} ms
          </span>
        </div>

        {/* Timeline blocks */}
        <div className="w-full overflow-x-auto border border-slate-850 rounded-2xl bg-[#030716]/60 p-5 scrollbar-none">
          <div className="min-w-full flex h-14 relative border-l border-r border-slate-800">
            {timeline.map((block, index) => {
              const widthPct = ((block.end - block.start) / totalTime) * 100;
              const isCurrent = currentTime >= block.start && currentTime < block.end;
              const isPast = currentTime >= block.end;

              return (
                <div
                  key={index}
                  style={{ width: `${widthPct}%` }}
                  className={`relative flex flex-col justify-center items-center h-full border-r border-slate-800/80 font-mono select-none text-[10px] transition-all duration-150 ${
                    isCurrent
                      ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#020617] z-10 font-bold opacity-100"
                      : isPast
                      ? "opacity-60"
                      : "opacity-35"
                  } ${getColorForPid(block.pid)}`}
                >
                  <span className="font-bold tracking-tight">{block.pid}</span>
                  <span className="text-[8px] opacity-80 font-semibold">{block.start} - {block.end}</span>

                  {isCurrent && (
                    <div className="absolute top-0 bottom-0 left-0 right-0 border border-dashed border-white/20 gantt-stripes pointer-events-none"></div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="relative w-full h-4 mt-2 mb-1">
            <span className="absolute left-0 text-[10px] font-mono text-slate-500">0 ms</span>
            {timeline.map((block, index) => (
              <span
                key={index}
                style={{ left: `${(block.end / totalTime) * 100}%` }}
                className="absolute text-[10px] font-mono text-slate-500 transform -translate-x-1/2"
              >
                {block.end} ms
              </span>
            ))}
          </div>

          {/* Interactive timeline slider */}
          <div className="mt-4">
            <input
              type="range"
              min="0"
              max={totalTime}
              value={currentTime}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentTime(Number(e.target.value));
              }}
              className="w-full accent-indigo-500 h-1.5 bg-slate-950 border border-slate-850 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
