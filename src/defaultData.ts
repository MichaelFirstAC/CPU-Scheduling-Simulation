/**
 * defaultData.ts — Default process workload for the CPU Scheduling Simulator.
 *
 * This module exports the initial set of processes shown when the application
 * first loads. It provides a meaningful starting demo with 4 processes spanning
 * both MLQ queues, different priorities, and staggered arrival times — giving
 * a good initial demonstration of all algorithm behaviors.
 *
 * Users can modify, delete, or replace these processes via the ProcessManager UI.
 */

import { Process } from "./types";

/**
 * Default sample workload: 4 processes with mixed priorities, burst times,
 * arrival times, and queue assignments.
 *
 * Assignment breakdown:
 *   P1: Arrives at t=0, 8ms burst, priority 3, Q0 (RR)
 *   P2: Arrives at t=1, 4ms burst, priority 1 (highest), Q0 (RR)
 *   P3: Arrives at t=2, 9ms burst, priority 4 (lowest), Q1 (FCFS)
 *   P4: Arrives at t=3, 5ms burst, priority 2, Q1 (FCFS)
 *
 * This spread exercises:
 *   - Priority inversion (P2 arrives late but has highest priority)
 *   - IDLE gaps (no gap here since P1 starts at t=0)
 *   - MLQ preemption (Q0 processes P1/P2 preempt Q1 processes P3/P4)
 *   - Round Robin cycling within Q0 (quantum=2)
 */
export const defaultProcesses: Process[] = [
  { pid: "P1", arrival_time: 0, burst_time: 8, priority: 3, queue_id: 0 },
  { pid: "P2", arrival_time: 1, burst_time: 4, priority: 1, queue_id: 0 },
  { pid: "P3", arrival_time: 2, burst_time: 9, priority: 4, queue_id: 1 },
  { pid: "P4", arrival_time: 3, burst_time: 5, priority: 2, queue_id: 1 },
];
