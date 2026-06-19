/**
 * types.ts — Shared TypeScript type definitions for the CPU Scheduling Simulator.
 *
 * These interfaces define the data contracts between:
 *   - The Python backend (cpu_scheduler.py) results
 *   - The TypeScript fallback engine (scheduler_engine.ts)
 *   - React UI components (App.tsx, LiveSimulation, PerformanceDashboard, etc.)
 *
 * All interfaces here must remain in sync with the Python to_dict() output
 * and the TSScheduler return types.
 */

/**
 * Raw process definition as entered by the user in the ProcessManager form.
 * This is the input data before any scheduling simulation is run.
 */
export interface Process {
  pid: string;           // Unique identifier, e.g. "P1", "P2". Normalized to uppercase.
  arrival_time: number;  // Clock tick when this process enters the ready queue (>= 0).
  burst_time: number;    // Total CPU time needed by this process to finish (> 0).
  priority: number;      // Priority number for Priority Scheduling. Interpretation
                         // depends on the lowerIsHigher global setting.
  queue_id: number;      // MLQ queue assignment:
                         //   0 = Queue 0 — High Priority (Round Robin, quantum=2)
                         //   1 = Queue 1 — Low Priority  (FCFS)
}

/**
 * Per-process output after a scheduling algorithm has been simulated.
 * Extends the base Process fields with computed scheduling metrics.
 * Matches the Python Process.to_dict() output and ProcessResult in scheduler_engine.ts.
 */
export interface ProcessRunResult {
  pid: string;
  arrival_time: number;
  burst_time: number;
  priority: number;
  queue_id: number;
  waiting_time: number;      // Total idle time in the ready queue (not executing).
                             // Formula: turnaround_time - burst_time
  turnaround_time: number;   // Total time from arrival to completion.
                             // Formula: completion_time - arrival_time
  completion_time: number;   // The clock tick when this process finished executing.
  response_time: number;     // Time from arrival until first CPU assignment.
                             // Formula: start_time - arrival_time
}

/**
 * A single block in the Gantt chart execution timeline.
 * Represents a contiguous period during which one process (or IDLE) held the CPU.
 */
export interface GanttBlock {
  pid: string;    // Process ID owning this block, or "IDLE" for idle periods.
  start: number;  // Inclusive start tick of this block.
  end: number;    // Exclusive end tick of this block (duration = end - start).
}

/**
 * Complete result returned by any single scheduling algorithm.
 * This is the top-level data structure consumed by LiveSimulation,
 * PerformanceDashboard, and the metrics table in App.tsx.
 */
export interface SimulationResult {
  algorithm: string;               // Full descriptive name, e.g. "Round Robin (RR) [Quantum = 2]"
  timeline: GanttBlock[];          // Ordered list of Gantt execution blocks (IDLE + process blocks)
  processes: ProcessRunResult[];   // Per-process metrics, sorted by PID for display consistency
  average_waiting_time: number;    // Mean waiting time across all processes (rounded to 2 dp)
  average_turnaround_time: number; // Mean turnaround time across all processes (rounded to 2 dp)
}

/**
 * Union type of valid algorithm keys.
 *
 * These string literals are used as keys in the results record returned by
 * run_all_simulations (Python) and TSScheduler.runAll (TypeScript), and must
 * match exactly between both implementations.
 *
 *   FCFS       — First Come First Serve
 *   SJF        — Shortest Job First (Non-preemptive)
 *   SRTF       — Shortest Remaining Time First (Preemptive SJF)
 *   RR         — Round Robin
 *   PriorityNP — Priority Scheduling (Non-Preemptive)
 *   PriorityP  — Priority Scheduling (Preemptive)
 *   MLQ        — Multilevel Queue
 */
export type AlgorithmKey = "FCFS" | "SJF" | "SRTF" | "RR" | "PriorityNP" | "PriorityP" | "MLQ";

/**
 * Metadata for a single scheduling algorithm displayed in the algorithm selector sidebar.
 * Used to build the ALGORITHMS array in App.tsx.
 */
export interface AlgorithmDetail {
  name: string;           // Human-readable display name shown in the UI
  key: AlgorithmKey;      // Identifier key used to look up results in simulatorResults
  description: string;    // Short conceptual description shown in the "Concept Spec" panel
  isPreemptive: boolean;  // Whether this algorithm uses preemption (for display badges)
  type: "core" | "advanced"; // Classification for the sidebar badge label
}
