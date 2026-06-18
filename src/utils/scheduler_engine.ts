// CPU Scheduling Algorithms in TypeScript
// Matches the Python implementations exactly to serve as a reliable engine for real-time visualization & fallback

export interface ProcessInput {
  pid: string;
  arrival_time: number;
  burst_time: number;
  priority: number;
  queue_id: number;
}

export interface ProcessResult {
  pid: string;
  arrival_time: number;
  burst_time: number;
  priority: number;
  queue_id: number;
  waiting_time: number;
  turnaround_time: number;
  completion_time: number;
  response_time: number;
}

export interface GanttBlock {
  pid: string;
  start: number;
  end: number;
}

export interface SimulationResult {
  algorithm: string;
  timeline: GanttBlock[];
  processes: ProcessResult[];
  average_waiting_time: number;
  average_turnaround_time: number;
}

export class TSScheduler {
  static runFCFS(processes: ProcessInput[]): SimulationResult {
    const list = processes.map(p => ({
      ...p,
      remaining_time: p.burst_time,
      start_time: -1,
      completion_time: -1,
      waiting_time: 0,
      turnaround_time: 0,
      response_time: -1,
    })).sort((a, b) => a.arrival_time - b.arrival_time);

    const timeline: GanttBlock[] = [];
    let currentTime = 0;

    for (const p of list) {
      if (currentTime < p.arrival_time) {
        timeline.push({ pid: "IDLE", start: currentTime, end: p.arrival_time });
        currentTime = p.arrival_time;
      }

      p.start_time = currentTime;
      p.response_time = p.start_time - p.arrival_time;
      timeline.push({ pid: p.pid, start: currentTime, end: currentTime + p.burst_time });
      currentTime += p.burst_time;
      p.completion_time = currentTime;
      p.turnaround_time = p.completion_time - p.arrival_time;
      p.waiting_time = p.turnaround_time - p.burst_time;
    }

    const avg_waiting = list.reduce((sum, p) => sum + p.waiting_time, 0) / (list.length || 1);
    const avg_turnaround = list.reduce((sum, p) => sum + p.turnaround_time, 0) / (list.length || 1);

    return {
      algorithm: "First Come First Serve (FCFS)",
      timeline,
      processes: list.sort((a, b) => a.pid.localeCompare(b.pid)),
      average_waiting_time: Math.round(avg_waiting * 100) / 100,
      average_turnaround_time: Math.round(avg_turnaround * 100) / 100,
    };
  }

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
    const completed: typeof list = [];

    while (completed.length < list.length) {
      const available = list.filter(p => p.arrival_time <= currentTime && !completed.includes(p));

      if (available.length === 0) {
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

      // Sort by burst time first, then arrival time as a tiebreaker
      available.sort((a, b) => {
        if (a.burst_time !== b.burst_time) return a.burst_time - b.burst_time;
        return a.arrival_time - b.arrival_time;
      });

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

    let lastPid: string | null = null;
    let blockStart = 0;

    while (completed.length < list.length) {
      const available = list.filter(p => p.arrival_time <= currentTime && p.remaining_time > 0);

      if (available.length === 0) {
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

      // Sort by remaining time first, then arrival time as a tiebreaker
      available.sort((a, b) => {
        if (a.remaining_time !== b.remaining_time) return a.remaining_time - b.remaining_time;
        return a.arrival_time - b.arrival_time;
      });

      const selected = available[0];

      if (selected.start_time === -1) {
        selected.start_time = currentTime;
        selected.response_time = currentTime - selected.arrival_time;
      }

      if (lastPid !== selected.pid) {
        if (lastPid !== null) {
          timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
        }
        lastPid = selected.pid;
        blockStart = currentTime;
      }

      selected.remaining_time -= 1;
      currentTime += 1;

      if (selected.remaining_time === 0) {
        selected.completion_time = currentTime;
        selected.turnaround_time = selected.completion_time - selected.arrival_time;
        selected.waiting_time = selected.turnaround_time - selected.burst_time;
        completed.push(selected);
      }
    }

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

  static runRoundRobin(processes: ProcessInput[], quantum = 2): SimulationResult {
    const list = processes.map(p => ({
      ...p,
      remaining_time: p.burst_time,
      start_time: -1,
      completion_time: -1,
      waiting_time: 0,
      turnaround_time: 0,
      response_time: -1,
    })).sort((a, b) => a.arrival_time - b.arrival_time);

    const timeline: GanttBlock[] = [];
    let currentTime = 0;
    const readyQueue: typeof list = [];
    const visited = new Set<string>();
    let completedCount = 0;

    // Load initial processes arrived at time <= currentTime
    for (const p of list) {
      if (p.arrival_time <= currentTime) {
        readyQueue.push(p);
        visited.add(p.pid);
      }
    }

    while (completedCount < list.length) {
      if (readyQueue.length === 0) {
        // Enqueue next arriving process
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
          break;
        }
      }

      if (readyQueue.length > 0) {
        const currentProcess = readyQueue.shift()!;

        if (currentProcess.start_time === -1) {
          currentProcess.start_time = currentTime;
          currentProcess.response_time = currentTime - currentProcess.arrival_time;
        }

        const execTime = Math.min(quantum, currentProcess.remaining_time);

        timeline.push({
          pid: currentProcess.pid,
          start: currentTime,
          end: currentTime + execTime,
        });

        currentTime += execTime;
        currentProcess.remaining_time -= execTime;

        // Check if other processes arrived during this execution block first
        for (const p of list) {
          if (p.arrival_time <= currentTime && !visited.has(p.pid) && p.remaining_time > 0) {
            readyQueue.push(p);
            visited.add(p.pid);
          }
        }

        // Now append current process if it remains uncompleted
        if (currentProcess.remaining_time > 0) {
          readyQueue.push(currentProcess);
        } else {
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
      while (completed.length < list.length) {
        const available = list.filter(p => p.arrival_time <= currentTime && !completed.includes(p));

        if (available.length === 0) {
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

        // Sort by priority value.
        available.sort((a, b) => {
          const priorityDiff = lowerIsHigher ? a.priority - b.priority : b.priority - a.priority;
          if (priorityDiff !== 0) return priorityDiff;
          return a.arrival_time - b.arrival_time;
        });

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
      let lastPid: string | null = null;
      let blockStart = 0;

      while (completed.length < list.length) {
        const available = list.filter(p => p.arrival_time <= currentTime && p.remaining_time > 0);

        if (available.length === 0) {
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

        available.sort((a, b) => {
          const priorityDiff = lowerIsHigher ? a.priority - b.priority : b.priority - a.priority;
          if (priorityDiff !== 0) return priorityDiff;
          return a.arrival_time - b.arrival_time;
        });

        const selected = available[0];

        if (selected.start_time === -1) {
          selected.start_time = currentTime;
          selected.response_time = currentTime - selected.arrival_time;
        }

        if (lastPid !== selected.pid) {
          if (lastPid !== null) {
            timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
          }
          lastPid = selected.pid;
          blockStart = currentTime;
        }

        selected.remaining_time -= 1;
        currentTime += 1;

        if (selected.remaining_time === 0) {
          selected.completion_time = currentTime;
          selected.turnaround_time = selected.completion_time - selected.arrival_time;
          selected.waiting_time = selected.turnaround_time - selected.burst_time;
          completed.push(selected);
        }
      }

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

    let lastPid: string | null = null;
    let blockStart = 0;

    const q0_rr_tracker: Record<string, number> = {};
    const q0_ready: typeof list = [];
    const q0_visited = new Set<string>();

    while (completed.length < totalCount) {
      // Find arrived active processes
      const arrived_q0 = list.filter(p => p.arrival_time <= currentTime && p.queue_id === 0 && p.remaining_time > 0);
      const arrived_q1 = list.filter(p => p.arrival_time <= currentTime && p.queue_id === 1 && p.remaining_time > 0);

      // Enqueue to Q0
      for (const p of arrived_q0) {
        if (!q0_visited.has(p.pid)) {
          q0_ready.push(p);
          q0_visited.add(p.pid);
        }
      }

      let selectedProcess: typeof list[0] | null = null;

      if (q0_ready.length > 0) {
        selectedProcess = q0_ready[0];
        if (selectedProcess.start_time === -1) {
          selectedProcess.start_time = currentTime;
          selectedProcess.response_time = currentTime - selectedProcess.arrival_time;
        }
        q0_rr_tracker[selectedProcess.pid] = (q0_rr_tracker[selectedProcess.pid] || 0) + 1;
      } else if (arrived_q1.length > 0) {
        arrived_q1.sort((a, b) => a.arrival_time - b.arrival_time);
        selectedProcess = arrived_q1[0];
        if (selectedProcess.start_time === -1) {
          selectedProcess.start_time = currentTime;
          selectedProcess.response_time = currentTime - selectedProcess.arrival_time;
        }
      }

      if (selectedProcess === null) {
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

      if (lastPid !== selectedProcess.pid) {
        if (lastPid !== null) {
          timeline.push({ pid: lastPid, start: blockStart, end: currentTime });
        }
        lastPid = selectedProcess.pid;
        blockStart = currentTime;
      }

      selectedProcess.remaining_time -= 1;
      currentTime += 1;

      if (selectedProcess.queue_id === 0) {
        const elapsedQuantum = q0_rr_tracker[selectedProcess.pid] || 0;
        if (selectedProcess.remaining_time === 0) {
          selectedProcess.completion_time = currentTime;
          selectedProcess.turnaround_time = selectedProcess.completion_time - selectedProcess.arrival_time;
          selectedProcess.waiting_time = selectedProcess.turnaround_time - selectedProcess.burst_time;
          completed.push(selectedProcess);
          q0_ready.shift();
          delete q0_rr_tracker[selectedProcess.pid];
        } else if (elapsedQuantum >= 2) {
          q0_ready.shift();
          // Load other arrived Q0 processes
          const nextArrivedQ0 = list.filter(p => p.arrival_time <= currentTime && p.queue_id === 0 && p.remaining_time > 0 && !q0_visited.has(p.pid));
          for (const p of nextArrivedQ0) {
            q0_ready.push(p);
            q0_visited.add(p.pid);
          }
          q0_ready.push(selectedProcess);
          q0_rr_tracker[selectedProcess.pid] = 0;
        }
      } else {
        if (selectedProcess.remaining_time === 0) {
          selectedProcess.completion_time = currentTime;
          selectedProcess.turnaround_time = selectedProcess.completion_time - selectedProcess.arrival_time;
          selectedProcess.waiting_time = selectedProcess.turnaround_time - selectedProcess.burst_time;
          completed.push(selectedProcess);
        }
      }
    }

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

  static runAll(processes: ProcessInput[], rrQuantum = 2, lowerIsHigher = true): Record<string, SimulationResult> {
    return {
      FCFS: this.runFCFS(processes),
      SJF: this.runSJF(processes),
      SRTF: this.runSRTF(processes),
      RR: this.runRoundRobin(processes, rrQuantum),
      PriorityNP: this.runPriority(processes, false, lowerIsHigher),
      PriorityP: this.runPriority(processes, true, lowerIsHigher),
      MLQ: this.runMultilevelQueue(processes),
    };
  }
}
