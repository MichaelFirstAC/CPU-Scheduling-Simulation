import { Process } from "./types";

export const defaultProcesses: Process[] = [
  { pid: "P1", arrival_time: 0, burst_time: 8, priority: 3, queue_id: 0 },
  { pid: "P2", arrival_time: 1, burst_time: 4, priority: 1, queue_id: 0 },
  { pid: "P3", arrival_time: 2, burst_time: 9, priority: 4, queue_id: 1 },
  { pid: "P4", arrival_time: 3, burst_time: 5, priority: 2, queue_id: 1 },
];
