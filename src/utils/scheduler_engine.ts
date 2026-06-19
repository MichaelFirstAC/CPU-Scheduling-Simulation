// CPU Scheduling Algorithms in TypeScript
// Matches the Python implementations exactly to serve as a reliable engine
// for real-time visualization & fallback when the Python backend is unavailable.
//
// This module is the TypeScript mirror of src/python/cpu_scheduler.py.
// It is used by two consumers:
//   1. server.ts — as a fallback when spawning Python fails
//   2. App.tsx   — as a client-side fallback when the fetch to /api/simulate-python fails

// ── Input/Output Type Definitions ─────────────────────────────────────────────

/**
 * Raw process input data as provided by the user or default dataset.
 * Maps directly to the Python Process constructor arguments.
 */
export interface ProcessInput {
  pid: string;           // Unique process identifier, e.g. "P1"
  arrival_time: number;  // Clock tick when the process enters the ready queue
  burst_time: number;    // Total CPU time required to complete this process
  priority: number;      // Priority number for Priority Scheduling algorithms
  queue_id: number;      // MLQ queue assignment: 0 = Q0 (high priority RR), 1 = Q1 (low priority FCFS)
}

/**
 * Per-process output metrics computed after simulation.
 * Extends ProcessInput with the computed scheduling metrics.
 */
export interface ProcessResult {
  pid: string;
  arrival_time: number;
  burst_time: number;
  priority: number;
  queue_id: number;
  waiting_time: number;      // Total time spent waiting in the ready queue (not executing)
  turnaround_time: number;   // completion_time - arrival_time
  completion_time: number;   // Clock tick when this process finished
  response_time: number;     // start_time - arrival_time (time until first CPU assignment)
}

/**
 * A single block in the Gantt chart timeline.
 * Represents a contiguous period where one process (or IDLE) held the CPU.
 */
export interface GanttBlock {
  pid: string;    // Process ID, or "IDLE" if the CPU was idle during this period
  start: number;  // Clock tick where this block starts
  end: number;    // Clock tick where this block ends (exclusive)
}

/**
 * Complete result of running one scheduling algorithm.
 * Matches the Python run_* method return structure.
 */
export interface SimulationResult {
  algorithm: string;               // Full descriptive algorithm name (e.g. "Round Robin (RR) [Quantum = 2]")
  timeline: GanttBlock[];          // Ordered list of Gantt chart blocks
  processes: ProcessResult[];      // Per-process metrics sorted by PID
  average_waiting_time: number;    // Mean waiting time across all processes
  average_turnaround_time: number; // Mean turnaround time across all processes
}

/**
 * TSScheduler provides TypeScript implementations of all 7 CPU scheduling algorithms.
 *
 * All methods are static and return a SimulationResult.
 * The implementations mirror the Python cpu_scheduler.py algorithms exactly
 * to ensure consistent output between the Python backend and the TS fallback.
 */
export class TSScheduler {
  /**
   * First Come First Serve (FCFS) CPU Scheduling.
   *
   * Sorts processes by arrival time and executes them in order.
   * Non-preemptive — once a process starts, it runs until completion.
   * Inserts IDLE blocks when the CPU is waiting for the next arrival.
   *
   * @param processes - Array of process inputs
   * @returns SimulationResult for FCFS
   */
  static runFCFS(processes: ProcessInput[]): SimulationResult {
    // Create working copies with additional simulation-state fields
    const list = processes.map(p => ({
      ...p,
      remaining_time: p.burst_time, // starts equal to burst time
      start_time: -1,               // -1 means not yet started
      completion_time: -1,
      waiting_time: 0,
      turnaround_time: 0,
      response_time: -1,
    })).sort((a, b) => a.arrival_time - b.arrival_time); // FCFS order = arrival order

    const timeline: GanttBlock[] = [];
    let currentTime = 0; // Simulated clock

    for (const p of list) {
      // If CPU is idle between previous completion and this process's arrival
      if (currentTime < p.arrival_time) {
        timeline.push({ pid: "IDLE", start: currentTime, end: p.arrival_time });
        currentTime = p.arrival_time;
      }

      // Assign CPU to this process for its full burst (non-preemptive)
      p.start_time = currentTime;
      p.response_time = p.start_time - p.arrival_time; // Time until first CPU assignment
      timeline.push({ pid: p.pid, start: currentTime, end: currentTime + p.burst_time });
      currentTime += p.burst_time;
      p.completion_time = currentTime;
      p.turnaround_time = p.completion_time - p.arrival_time;
      p.waiting_time = p.turnaround_time - p.burst_time;
    }

    // Compute averages
    const avg_waiting = list.reduce((sum, p) => sum + p.waiting_time, 0) / (list.length || 1);
    const avg_turnaround = list.reduce((sum, p) => sum + p.turnaround_time, 0) / (list.length || 1);

    return {
      algorithm: "First Come First Serve (FCFS)",
      timeline,
      processes: list.sort((a, b) => a.pid.localeCompare(b.pid)), // Sort output by PID
      average_waiting_time: Math.round(avg_waiting * 100) / 100,
      average_turnaround_time: Math.round(avg_turnaround * 100) / 100,
    };
  }

  /**
   * Shortest Job First (Non-preemptive) CPU Scheduling.
   *
   * At each scheduling decision, selects the arrived process with the
   * smallest burst_time. Arrival time breaks ties (FCFS among equal burst times).
   * Non-preemptive — the selected process runs to completion.
   *
   * @param processes - Array of process inputs
   * @returns SimulationResult for SJF
   */
  static runSJF(processes: ProcessInput[]): SimulationResult {
    const list = processes.map(p => ({
      ...p,
      remaining_time: p.burst_time,
      start_time: -1,
      completion_time: -1,
      waiting_time: 0,
      turnaround_time: 0,
      response_time: -1,
    }));

    const timeline: GanttBlock[] = [];
    let currentTime = 0;
    const completed: typeof list = []; // Tracks finished processes in completion order

    while (completed.length < list.length) {
      // Find processes that have arrived but are not yet done
      const available = list.filter(p => p.arrival_time <= currentTime && !completed.includes(p));

      if (available.length === 0) {
        // No process ready — advance to next arriving process
        const uncompleted = list.filter(p => !completed.includes(p));
        if (uncompleted.length > 0) {
          const nextArrival = Math.min(...uncompleted.map(p => p.arrival_time));
          timeline.push({ pid: "IDLE", start: currentTime, end: nextArrival });
          currentTime = nextArrival;
          continue; // Re-check availability at the new time
        } else {
          break; // All done
        }
      }

      // Sort by burst time first, then arrival time as a tiebreaker (FCFS among equals)
      available.sort((a, b) => {
        if (a.burst_time !== b.burst_time) return a.burst_time - b.burst_time;
        return a.arrival_time - b.arrival_time;
      });

      // Select the shortest job and run it to completion (non-preemptive)
      const selected = available[0];
      selected.start_time = currentTime;
      selected.response_time = selected.start_time - selected.arrival_time;
      timeline.push({ pid: selected.pid, start: currentTime, end: currentTime + selected.burst_time });
      currentTime += selected.burst_time;
      selected.completion_time = currentTime;
      selected.turnaround_time = selected.completion_time - selected.arrival_time;
      selected.waiting_time = selected.turnaround_time - selected.burst_time;
      completed.push(selected);
    }

    const avg_waiting = list.reduce((sum, p) => sum + p.waiting_time, 0) / (list.length || 1);
    const avg_turnaround = list.reduce((sum, p) => sum + p.turnaround_time, 0) / (list.length || 1);

    return {
      algorithm: "Shortest Job First (SJF) [Non-preemptive]",
      timeline,
      processes: list.sort((a, b) => a.pid.localeCompare(b.pid)),
      average_waiting_time: Math.round(avg_waiting * 100) / 100,
      average_turnaround_time: Math.round(avg_turnaround * 100) / 100,
    };
  }

  /**
   * Shortest Remaining Time First (SRTF) — Preemptive SJF.
   *
   * At every clock tick, selects the arrived process with the smallest
   * remaining_time. If a newly arrived process has less remaining time than
   * the currently running process, preemption occurs immediately.
   *
   * Uses tick-by-tick simulation (1 unit per iteration). Consecutive ticks
   * for the same process are merged into a single Gantt block using
   * lastPid/blockStart tracking.
   *
   * @param processes - Array of process inputs
   * @returns SimulationResult for SRTF
   */
  static runSRTF(processes: ProcessInput[]): SimulationResult {
    const list = processes.map(p => ({
      ...p,
      remaining_time: p.burst_time,
      start_time: -1,
      completion_time: -1,
      waiting_time: 0,
      turnaround_time: 0,
      response_time: -1,
    }));

    const timeline: GanttBlock[] = [];
    let currentTime = 0;
    const completed: typeof list = [];

    // Track the previous PID and start time to merge same-process ticks into blocks
    let lastPid: string | null = null;
    let blockStart = 0;

    while (completed.length < list.length) {
      // Get processes that have arrived with remaining burst time
      const available = list.filter(p => p.arrival_time <= currentTime && p.remaining_time > 0);

      if (available.length === 0) {
        // CPU idle — advance to next arriving process
        const uncompleted = list.filter(p => p.remaining_time > 0);
        if (uncompleted.length > 0) {
          const nextArrival = Math.min(...uncompleted.map(p => p.arrival_time));
          // Flush previous process block before going idle
          if (lastPid !== "IDLE") {
            if (lastPid !== null) {
              timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
            }
            lastPid = "IDLE";
            blockStart = currentTime;
          }
          currentTime = nextArrival;
          continue;
        } else {
          break;
        }
      }

      // Sort by remaining time first, then arrival time as a tiebreaker
      available.sort((a, b) => {
        if (a.remaining_time !== b.remaining_time) return a.remaining_time - b.remaining_time;
        return a.arrival_time - b.arrival_time;
      });

      const selected = available[0]; // Process with shortest remaining time

      // Record first CPU assignment for response time
      if (selected.start_time === -1) {
        selected.start_time = currentTime;
        selected.response_time = currentTime - selected.arrival_time;
      }

      // Detect process switch — flush previous block and start new one
      if (lastPid !== selected.pid) {
        if (lastPid !== null) {
          timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
        }
        lastPid = selected.pid;
        blockStart = currentTime;
      }

      // Execute for exactly 1 tick, then re-evaluate (enables preemption each tick)
      selected.remaining_time -= 1;
      currentTime += 1;

      // Check completion
      if (selected.remaining_time === 0) {
        selected.completion_time = currentTime;
        selected.turnaround_time = selected.completion_time - selected.arrival_time;
        selected.waiting_time = selected.turnaround_time - selected.burst_time;
        completed.push(selected);
      }
    }

    // Flush the final running block
    if (lastPid !== null) {
      timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
    }

    const avg_waiting = list.reduce((sum, p) => sum + p.waiting_time, 0) / (list.length || 1);
    const avg_turnaround = list.reduce((sum, p) => sum + p.turnaround_time, 0) / (list.length || 1);

    return {
      algorithm: "Shortest Remaining Time First (SRTF)",
      timeline,
      processes: list.sort((a, b) => a.pid.localeCompare(b.pid)),
      average_waiting_time: Math.round(avg_waiting * 100) / 100,
      average_turnaround_time: Math.round(avg_turnaround * 100) / 100,
    };
  }

  /**
   * Round Robin (RR) CPU Scheduling.
   *
   * Each process receives a fixed time quantum. When the quantum expires, the
   * process is preempted and placed at the back of the ready queue. Newly arrived
   * processes are added to the queue between quantum slices (before re-enqueuing
   * the preempted process) to ensure fair ordering.
   *
   * A `visited` Set tracks which processes have been enqueued to avoid duplicates.
   *
   * @param processes - Array of process inputs
   * @param quantum - Time slice length per scheduling turn (default=2)
   * @returns SimulationResult for RR
   */
  static runRoundRobin(processes: ProcessInput[], quantum = 2): SimulationResult {
    const list = processes.map(p => ({
      ...p,
      remaining_time: p.burst_time,
      start_time: -1,
      completion_time: -1,
      waiting_time: 0,
      turnaround_time: 0,
      response_time: -1,
    })).sort((a, b) => a.arrival_time - b.arrival_time); // Pre-sort for initial queue seeding

    const timeline: GanttBlock[] = [];
    let currentTime = 0;
    const readyQueue: typeof list = []; // FIFO ready queue
    const visited = new Set<string>(); // Tracks PIDs already added to the ready queue
    let completedCount = 0;

    // Seed the ready queue with all processes that have already arrived at t=0
    for (const p of list) {
      if (p.arrival_time <= currentTime) {
        readyQueue.push(p);
        visited.add(p.pid);
      }
    }

    while (completedCount < list.length) {
      if (readyQueue.length === 0) {
        // Ready queue empty — advance time to next arriving process
        const uncompleted = list.filter(p => p.remaining_time > 0);
        if (uncompleted.length > 0) {
          const nextArrival = Math.min(...uncompleted.map(p => p.arrival_time));
          timeline.push({ pid: "IDLE", start: currentTime, end: nextArrival });
          currentTime = nextArrival;

          // Add newly arrived processes to ready queue
          for (const p of list) {
            if (p.arrival_time <= currentTime && !visited.has(p.pid) && p.remaining_time > 0) {
              readyQueue.push(p);
              visited.add(p.pid);
            }
          }
        } else {
          break; // All done
        }
      }

      if (readyQueue.length > 0) {
        const currentProcess = readyQueue.shift()!; // Dequeue front process (FIFO)

        // Track first CPU assignment for response time
        if (currentProcess.start_time === -1) {
          currentProcess.start_time = currentTime;
          currentProcess.response_time = currentTime - currentProcess.arrival_time;
        }

        // Execute for min(quantum, remaining) ticks
        const execTime = Math.min(quantum, currentProcess.remaining_time);

        timeline.push({
          pid: currentProcess.pid,
          start: currentTime,
          end: currentTime + execTime,
        });

        currentTime += execTime;
        currentProcess.remaining_time -= execTime;

        // Add newly arrived processes BEFORE re-enqueuing the preempted process
        // (ensures new arrivals go before the preempted process in the queue)
        for (const p of list) {
          if (p.arrival_time <= currentTime && !visited.has(p.pid) && p.remaining_time > 0) {
            readyQueue.push(p);
            visited.add(p.pid);
          }
        }

        // Re-enqueue the preempted process at the back if it still has remaining time
        if (currentProcess.remaining_time > 0) {
          readyQueue.push(currentProcess);
        } else {
          // Process completed in this quantum slice
          currentProcess.completion_time = currentTime;
          currentProcess.turnaround_time = currentProcess.completion_time - currentProcess.arrival_time;
          currentProcess.waiting_time = currentProcess.turnaround_time - currentProcess.burst_time;
          completedCount += 1;
        }
      }
    }

    const avg_waiting = list.reduce((sum, p) => sum + p.waiting_time, 0) / (list.length || 1);
    const avg_turnaround = list.reduce((sum, p) => sum + p.turnaround_time, 0) / (list.length || 1);

    return {
      algorithm: `Round Robin (RR) [Quantum = ${quantum}]`,
      timeline,
      processes: list.sort((a, b) => a.pid.localeCompare(b.pid)),
      average_waiting_time: Math.round(avg_waiting * 100) / 100,
      average_turnaround_time: Math.round(avg_turnaround * 100) / 100,
    };
  }

  /**
   * Priority Scheduling — supports both Non-Preemptive and Preemptive modes.
   *
   * Processes are selected by priority. The `lowerIsHigher` flag controls
   * whether a numerically lower value means higher priority (Unix style) or
   * a numerically higher value means higher priority (Windows style).
   *
   * Non-Preemptive:
   *   Once a process is selected and starts executing, it runs to completion.
   *   A higher priority process arriving mid-execution must wait.
   *
   * Preemptive:
   *   At every clock tick, re-evaluates available processes. Immediately
   *   preempts the running process if a higher priority one arrives.
   *   Uses the same lastPid/blockStart merging pattern as SRTF.
   *
   * @param processes - Array of process inputs
   * @param preemptive - If true, use preemptive mode (default=false)
   * @param lowerIsHigher - If true, lower priority number = higher urgency (default=true)
   * @returns SimulationResult for Priority (NP or P)
   */
  static runPriority(
    processes: ProcessInput[],
    preemptive = false,
    lowerIsHigher = true
  ): SimulationResult {
    const list = processes.map(p => ({
      ...p,
      remaining_time: p.burst_time,
      start_time: -1,
      completion_time: -1,
      waiting_time: 0,
      turnaround_time: 0,
      response_time: -1,
    }));

    const timeline: GanttBlock[] = [];
    let currentTime = 0;
    const completed: typeof list = [];

    if (!preemptive) {
      // ── NON-PREEMPTIVE PRIORITY ────────────────────────────────────────────
      while (completed.length < list.length) {
        // Get available (arrived, not finished) processes
        const available = list.filter(p => p.arrival_time <= currentTime && !completed.includes(p));

        if (available.length === 0) {
          // Idle gap
          const uncompleted = list.filter(p => !completed.includes(p));
          if (uncompleted.length > 0) {
            const nextArrival = Math.min(...uncompleted.map(p => p.arrival_time));
            timeline.push({ pid: "IDLE", start: currentTime, end: nextArrival });
            currentTime = nextArrival;
            continue;
          } else {
            break;
          }
        }

        // Sort by priority value (direction determined by lowerIsHigher),
        // then by arrival_time as a tiebreaker (FCFS among equal priorities)
        available.sort((a, b) => {
          const priorityDiff = lowerIsHigher ? a.priority - b.priority : b.priority - a.priority;
          if (priorityDiff !== 0) return priorityDiff;
          return a.arrival_time - b.arrival_time;
        });

        // Select and run the highest priority process to completion (non-preemptive)
        const selected = available[0];
        selected.start_time = currentTime;
        selected.response_time = selected.start_time - selected.arrival_time;
        timeline.push({ pid: selected.pid, start: currentTime, end: currentTime + selected.burst_time });
        currentTime += selected.burst_time;
        selected.completion_time = currentTime;
        selected.turnaround_time = selected.completion_time - selected.arrival_time;
        selected.waiting_time = selected.turnaround_time - selected.burst_time;
        completed.push(selected);
      }
    } else {
      // ── PREEMPTIVE PRIORITY ────────────────────────────────────────────────
      let lastPid: string | null = null;
      let blockStart = 0;

      while (completed.length < list.length) {
        // Get arrived processes with remaining burst time
        const available = list.filter(p => p.arrival_time <= currentTime && p.remaining_time > 0);

        if (available.length === 0) {
          // CPU idle — advance to next arriving process
          const uncompleted = list.filter(p => p.remaining_time > 0);
          if (uncompleted.length > 0) {
            const nextArrival = Math.min(...uncompleted.map(p => p.arrival_time));
            if (lastPid !== "IDLE") {
              if (lastPid !== null) {
                timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
              }
              lastPid = "IDLE";
              blockStart = currentTime;
            }
            currentTime = nextArrival;
            continue;
          } else {
            break;
          }
        }

        // Sort by priority each tick to enable immediate preemption on new arrivals
        available.sort((a, b) => {
          const priorityDiff = lowerIsHigher ? a.priority - b.priority : b.priority - a.priority;
          if (priorityDiff !== 0) return priorityDiff;
          return a.arrival_time - b.arrival_time;
        });

        const selected = available[0]; // Highest priority available process

        // Record first CPU assignment
        if (selected.start_time === -1) {
          selected.start_time = currentTime;
          selected.response_time = currentTime - selected.arrival_time;
        }

        // Detect process switch — flush previous Gantt block
        if (lastPid !== selected.pid) {
          if (lastPid !== null) {
            timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
          }
          lastPid = selected.pid;
          blockStart = currentTime;
        }

        // Execute 1 tick then re-evaluate priority (enables preemption each tick)
        selected.remaining_time -= 1;
        currentTime += 1;

        if (selected.remaining_time === 0) {
          selected.completion_time = currentTime;
          selected.turnaround_time = selected.completion_time - selected.arrival_time;
          selected.waiting_time = selected.turnaround_time - selected.burst_time;
          completed.push(selected);
        }
      }

      // Flush the final block
      if (lastPid !== null) {
        timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
      }
    }

    const avg_waiting = list.reduce((sum, p) => sum + p.waiting_time, 0) / (list.length || 1);
    const avg_turnaround = list.reduce((sum, p) => sum + p.turnaround_time, 0) / (list.length || 1);

    return {
      algorithm: `Priority [${preemptive ? "Preemptive" : "Non-preemptive"}]`,
      timeline,
      processes: list.sort((a, b) => a.pid.localeCompare(b.pid)),
      average_waiting_time: Math.round(avg_waiting * 100) / 100,
      average_turnaround_time: Math.round(avg_turnaround * 100) / 100,
    };
  }

  /**
   * Multilevel Queue (MLQ) CPU Scheduling.
   *
   * Two priority levels (queues):
   *   Queue 0 (High Priority, queue_id=0): System/Interactive — Round Robin, quantum=2.
   *   Queue 1 (Low Priority, queue_id=1): Batch — FCFS.
   *
   * Q0 always preempts Q1. Within Q0, the RR quantum is enforced via a
   * per-process tick counter (q0_rr_tracker). Q1 runs FCFS sequentially,
   * but is implicitly preempted whenever Q0 becomes non-empty.
   *
   * @param processes - Array of process inputs (must include queue_id)
   * @returns SimulationResult for MLQ
   */
  static runMultilevelQueue(processes: ProcessInput[]): SimulationResult {
    const list = processes.map(p => ({
      ...p,
      remaining_time: p.burst_time,
      start_time: -1,
      completion_time: -1,
      waiting_time: 0,
      turnaround_time: 0,
      response_time: -1,
    }));

    const timeline: GanttBlock[] = [];
    let currentTime = 0;
    const completed: typeof list = [];
    const totalCount = list.length;

    // Gantt block boundary tracking
    let lastPid: string | null = null;
    let blockStart = 0;

    // ── Queue 0 (Round Robin) State ───────────────────────────────────────────
    // q0_rr_tracker: maps pid -> consecutive ticks used in the current quantum slot
    //   When this reaches >= 2 (the quantum), the process is cycled to back of q0_ready
    const q0_rr_tracker: Record<string, number> = {};
    const q0_ready: typeof list = [];        // FIFO queue for Q0 processes
    const q0_visited = new Set<string>();    // PIDs already added to q0_ready

    while (completed.length < totalCount) {
      // ── Update active process lists at current_time ────────────────────────
      // Find arrived Q0 processes with remaining work
      const arrived_q0 = list.filter(p => p.arrival_time <= currentTime && p.queue_id === 0 && p.remaining_time > 0);
      // Find arrived Q1 processes with remaining work (for FCFS selection)
      const arrived_q1 = list.filter(p => p.arrival_time <= currentTime && p.queue_id === 1 && p.remaining_time > 0);

      // Enqueue newly arrived Q0 processes (avoid duplicates via q0_visited)
      for (const p of arrived_q0) {
        if (!q0_visited.has(p.pid)) {
          q0_ready.push(p);
          q0_visited.add(p.pid);
        }
      }

      let selectedProcess: typeof list[0] | null = null;

      if (q0_ready.length > 0) {
        // ── Q0 has priority — select front of Q0 queue ─────────────────────
        selectedProcess = q0_ready[0];
        if (selectedProcess.start_time === -1) {
          selectedProcess.start_time = currentTime;
          selectedProcess.response_time = currentTime - selectedProcess.arrival_time;
        }
        // Increment the RR quantum slot counter for this tick
        q0_rr_tracker[selectedProcess.pid] = (q0_rr_tracker[selectedProcess.pid] || 0) + 1;
      } else if (arrived_q1.length > 0) {
        // ── Q0 empty — run earliest Q1 process (FCFS within Q1) ───────────
        arrived_q1.sort((a, b) => a.arrival_time - b.arrival_time);
        selectedProcess = arrived_q1[0];
        if (selectedProcess.start_time === -1) {
          selectedProcess.start_time = currentTime;
          selectedProcess.response_time = currentTime - selectedProcess.arrival_time;
        }
      }

      if (selectedProcess === null) {
        // ── Both queues empty — CPU IDLE ────────────────────────────────────
        const uncompleted = list.filter(p => p.remaining_time > 0);
        if (uncompleted.length > 0) {
          const nextArrival = Math.min(...uncompleted.map(p => p.arrival_time));
          if (lastPid !== "IDLE") {
            if (lastPid !== null) {
              timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
            }
            lastPid = "IDLE";
            blockStart = currentTime;
          }
          currentTime = nextArrival;
          continue;
        } else {
          break; // All processes done
        }
      }

      // ── Detect process switch and record Gantt block boundary ──────────────
      if (lastPid !== selectedProcess.pid) {
        if (lastPid !== null) {
          timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
        }
        lastPid = selectedProcess.pid;
        blockStart = currentTime;
      }

      // ── Execute for exactly 1 clock tick ──────────────────────────────────
      selectedProcess.remaining_time -= 1;
      currentTime += 1;

      // ── Post-tick: handle Q0 RR quantum and completion ────────────────────
      if (selectedProcess.queue_id === 0) {
        const elapsedQuantum = q0_rr_tracker[selectedProcess.pid] || 0;

        if (selectedProcess.remaining_time === 0) {
          // Process finished — record completion and remove from Q0
          selectedProcess.completion_time = currentTime;
          selectedProcess.turnaround_time = selectedProcess.completion_time - selectedProcess.arrival_time;
          selectedProcess.waiting_time = selectedProcess.turnaround_time - selectedProcess.burst_time;
          completed.push(selectedProcess);
          q0_ready.shift(); // Remove from front of Q0 queue
          delete q0_rr_tracker[selectedProcess.pid]; // Clean up tracker entry

        } else if (elapsedQuantum >= 2) {
          // Quantum expired — preempt and cycle to back of Q0 queue
          q0_ready.shift();
          // Add any Q0 processes that arrived during this tick (before re-enqueuing preempted)
          const nextArrivedQ0 = list.filter(p =>
            p.arrival_time <= currentTime &&
            p.queue_id === 0 &&
            p.remaining_time > 0 &&
            !q0_visited.has(p.pid)
          );
          for (const p of nextArrivedQ0) {
            q0_ready.push(p);
            q0_visited.add(p.pid);
          }
          // Re-enqueue preempted process at the back of Q0
          q0_ready.push(selectedProcess);
          // Reset quantum counter for the next slot
          q0_rr_tracker[selectedProcess.pid] = 0;
        }
      } else {
        // ── Q1 (FCFS) — only action is completion check ───────────────────
        if (selectedProcess.remaining_time === 0) {
          selectedProcess.completion_time = currentTime;
          selectedProcess.turnaround_time = selectedProcess.completion_time - selectedProcess.arrival_time;
          selectedProcess.waiting_time = selectedProcess.turnaround_time - selectedProcess.burst_time;
          completed.push(selectedProcess);
        }
      }
    }

    // Flush the final Gantt block
    if (lastPid !== null) {
      timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
    }

    const avg_waiting = list.reduce((sum, p) => sum + p.waiting_time, 0) / (list.length || 1);
    const avg_turnaround = list.reduce((sum, p) => sum + p.turnaround_time, 0) / (list.length || 1);

    return {
      algorithm: "Multilevel Queue (MLQ) [Q0: RR, Q1: FCFS]",
      timeline,
      processes: list.sort((a, b) => a.pid.localeCompare(b.pid)),
      average_waiting_time: Math.round(avg_waiting * 100) / 100,
      average_turnaround_time: Math.round(avg_turnaround * 100) / 100,
    };
  }

  /**
   * Convenience method that runs all 7 scheduling algorithms on the same process set.
   *
   * Returns a record keyed by AlgorithmKey matching the frontend's expected keys:
   * FCFS, SJF, SRTF, RR, PriorityNP, PriorityP, MLQ
   *
   * @param processes - Array of process inputs
   * @param rrQuantum - Time quantum for Round Robin (default=2)
   * @param lowerIsHigher - Priority mapping for Priority algorithms (default=true)
   * @returns Record mapping AlgorithmKey -> SimulationResult
   */
  static runAll(processes: ProcessInput[], rrQuantum = 2, lowerIsHigher = true): Record<string, SimulationResult> {
    return {
      FCFS: this.runFCFS(processes),
      SJF: this.runSJF(processes),
      SRTF: this.runSRTF(processes),
      RR: this.runRoundRobin(processes, rrQuantum),
      PriorityNP: this.runPriority(processes, false, lowerIsHigher), // Non-Preemptive Priority
      PriorityP: this.runPriority(processes, true, lowerIsHigher),   // Preemptive Priority
      MLQ: this.runMultilevelQueue(processes),
    };
  }
}
