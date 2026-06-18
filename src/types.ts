export interface Process {
  pid: string;
  arrival_time: number;
  burst_time: number;
  priority: number;
  queue_id: number;
}

export interface ProcessRunResult {
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
  processes: ProcessRunResult[];
  average_waiting_time: number;
  average_turnaround_time: number;
}

export type AlgorithmKey = "FCFS" | "SJF" | "SRTF" | "RR" | "PriorityNP" | "PriorityP" | "MLQ";

export interface AlgorithmDetail {
  name: string;
  key: AlgorithmKey;
  description: string;
  isPreemptive: boolean;
  type: "core" | "advanced";
}
