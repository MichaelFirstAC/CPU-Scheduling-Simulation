#!/usr/bin/env python3
"""
Operating Systems - CPU Scheduling Simulator
COMP6697001 - Final Assessment

This script implements Core and Advanced CPU Scheduling Algorithms:
1. First Come First Serve (FCFS)
2. Shortest Job First (SJF) [Non-preemptive]
3. Shortest Remaining Time First (SRTF) [Preemptive SJF]
4. Round Robin (RR)
5. Priority Scheduling [Non-preemptive]
6. Priority Scheduling [Preemptive]
7. Multilevel Queue (MLQ) Scheduling

It generates:
- Full timeline execution order (Gantt chart data)
- Turnaround Time (TAT) and Waiting Time (WT) per process
- Average TAT and WT
- Side-by-side performance metrics
- A text-based Gantt chart printout
- JSON outputs for integration with frontend web visualizer
"""

import sys
import json
from typing import List, Dict, Any, Tuple, Optional


class Process:
    def __init__(
        self,
        pid: str,
        arrival_time: int,
        burst_time: int,
        priority: int = 0,
        queue_id: int = 0,
    ):
        self.pid = str(pid)
        self.arrival_time = int(arrival_time)
        self.burst_time = int(burst_time)
        self.priority = int(priority)
        self.queue_id = int(queue_id)
        
        # Simulation counters
        self.remaining_time = self.burst_time
        self.start_time = -1
        self.completion_time = -1
        self.waiting_time = 0
        self.turnaround_time = 0
        self.response_time = -1

    def reset(self):
        self.remaining_time = self.burst_time
        self.start_time = -1
        self.completion_time = -1
        self.waiting_time = 0
        self.turnaround_time = 0
        self.response_time = -1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pid": self.pid,
            "arrival_time": self.arrival_time,
            "burst_time": self.burst_time,
            "priority": self.priority,
            "queue_id": self.queue_id,
            "waiting_time": self.waiting_time,
            "turnaround_time": self.turnaround_time,
            "completion_time": self.completion_time,
            "response_time": self.response_time,
        }


def format_gantt_text(timeline: List[Dict[str, Any]]) -> str:
    """Generates an ASCII art representation of the Gantt chart."""
    if not timeline:
        return "Empty Timeline"
        
    # Top border
    top_line = "+"
    mid_line = "|"
    bottom_line = "0"
    
    for block in timeline:
        pid_str = f" {block['pid']} "
        duration = block["end"] - block["start"]
        width = max(len(pid_str), duration * 2)
        
        top_line += "-" * width + "+"
        mid_line += f"{block['pid']}".center(width) + "|"
        bottom_line += str(block["end"]).rjust(width + 1)
        
    bottom_padded = "0"
    last_end = 0
    for block in timeline:
        duration = block["end"] - block["start"]
        # calculate gap size to align process end times
        pid_str = f" {block['pid']} "
        width = max(len(pid_str), duration * 2)
        bottom_padded += str(block["end"]).rjust(width) + " "
        
    return f"{top_line}\n{mid_line}\n{top_line}\nTimeline: {timeline}"


class CPU_Scheduler:
    @staticmethod
    def run_fcfs(processes_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """First Come First Serve CPU Scheduling."""
        processes = [Process(**p) for p in processes_data]
        processes.sort(key=lambda p: p.arrival_time)
        
        timeline = []
        current_time = 0
        
        for p in processes:
            if current_time < p.arrival_time:
                # CPU is idle
                timeline.append({
                    "pid": "IDLE",
                    "start": current_time,
                    "end": p.arrival_time
                })
                current_time = p.arrival_time
                
            p.start_time = current_time
            p.response_time = p.start_time - p.arrival_time
            timeline.append({
                "pid": p.pid,
                "start": current_time,
                "end": current_time + p.burst_time
            })
            current_time += p.burst_time
            p.completion_time = current_time
            p.turnaround_time = p.completion_time - p.arrival_time
            p.waiting_time = p.turnaround_time - p.burst_time
            
        avg_waiting = sum(p.waiting_time for p in processes) / len(processes) if processes else 0
        avg_turnaround = sum(p.turnaround_time for p in processes) / len(processes) if processes else 0
        
        return {
            "algorithm": "First Come First Serve (FCFS)",
            "timeline": timeline,
            "processes": [p.to_dict() for p in processes],
            "average_waiting_time": round(avg_waiting, 2),
            "average_turnaround_time": round(avg_turnaround, 2)
        }

    @staticmethod
    def run_sjf(processes_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Shortest Job First (Non-preemptive) CPU Scheduling."""
        processes = [Process(**p) for p in processes_data]
        timeline = []
        current_time = 0
        completed = []
        
        while len(completed) < len(processes):
            # Find available processes at current time
            available = [p for p in processes if p.arrival_time <= current_time and p not in completed]
            
            if not available:
                # Find next arriving process
                uncompleted = [p for p in processes if p not in completed]
                if uncompleted:
                    next_arrival = min(p.arrival_time for p in uncompleted)
                    timeline.append({
                        "pid": "IDLE",
                        "start": current_time,
                        "end": next_arrival
                    })
                    current_time = next_arrival
                    available = [p for p in processes if p.arrival_time <= current_time and p not in completed]
                    
            if available:
                # Sort by burst_time, then sorting by arrival_time as a tie breaker
                available.sort(key=lambda p: (p.burst_time, p.arrival_time))
                selected = available[0]
                
                selected.start_time = current_time
                selected.response_time = selected.start_time - selected.arrival_time
                timeline.append({
                    "pid": selected.pid,
                    "start": current_time,
                    "end": current_time + selected.burst_time
                })
                current_time += selected.burst_time
                selected.completion_time = current_time
                selected.turnaround_time = selected.completion_time - selected.arrival_time
                selected.waiting_time = selected.turnaround_time - selected.burst_time
                completed.append(selected)
                
        # Sort completed processes back to support standardized outputs
        completed.sort(key=lambda p: p.pid)
        avg_waiting = sum(p.waiting_time for p in completed) / len(completed) if completed else 0
        avg_turnaround = sum(p.turnaround_time for p in completed) / len(completed) if completed else 0
        
        return {
            "algorithm": "Shortest Job First (SJF) [Non-preemptive]",
            "timeline": timeline,
            "processes": [p.to_dict() for p in completed],
            "average_waiting_time": round(avg_waiting, 2),
            "average_turnaround_time": round(avg_turnaround, 2)
        }

    @staticmethod
    def run_srtf(processes_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Shortest Remaining Time First (SRTF) [Preemptive SJF] CPU Scheduling."""
        processes = [Process(**p) for p in processes_data]
        timeline = []
        current_time = 0
        completed = []
        
        last_pid = None
        block_start = 0
        
        while len(completed) < len(processes):
            available = [p for p in processes if p.arrival_time <= current_time and p.remaining_time > 0]
            
            if not available:
                # CPU IDLE
                uncompleted = [p for p in processes if p.remaining_time > 0]
                if uncompleted:
                    next_arrival = min(p.arrival_time for p in uncompleted)
                    if last_pid != "IDLE":
                        if last_pid is not None:
                            timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                        last_pid = "IDLE"
                        block_start = current_time
                    current_time = next_arrival
                    continue
                else:
                    break
                    
            # Pick process with shortest remaining time
            available.sort(key=lambda p: (p.remaining_time, p.arrival_time))
            selected = available[0]
            
            # Start response tracking
            if selected.start_time == -1:
                selected.start_time = current_time
                selected.response_time = current_time - selected.arrival_time
                
            # Timeline boundary management
            if last_pid != selected.pid:
                if last_pid is not None:
                    timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                last_pid = selected.pid
                block_start = current_time
                
            # Increment time step by 1
            selected.remaining_time -= 1
            current_time += 1
            
            if selected.remaining_time == 0:
                selected.completion_time = current_time
                selected.turnaround_time = selected.completion_time - selected.arrival_time
                selected.waiting_time = selected.turnaround_time - selected.burst_time
                completed.append(selected)
                
        # Append final block
        if last_pid is not None:
            timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
            
        processes.sort(key=lambda p: p.pid)
        avg_waiting = sum(p.waiting_time for p in processes) / len(processes) if processes else 0
        avg_turnaround = sum(p.turnaround_time for p in processes) / len(processes) if processes else 0
        
        return {
            "algorithm": "Shortest Remaining Time First (SRTF)",
            "timeline": timeline,
            "processes": [p.to_dict() for p in processes],
            "average_waiting_time": round(avg_waiting, 2),
            "average_turnaround_time": round(avg_turnaround, 2)
        }

    @staticmethod
    def run_round_robin(processes_data: List[Dict[str, Any]], quantum: int = 2) -> Dict[str, Any]:
        """Round Robin (RR) CPU Scheduling with precise arrival tracking."""
        processes = [Process(**p) for p in processes_data]
        processes.sort(key=lambda p: p.arrival_time)
        
        timeline = []
        current_time = 0
        ready_queue = []
        visited = set()
        completed_count = 0
        
        # Find initial processes at time 0
        for p in processes:
            if p.arrival_time <= current_time:
                ready_queue.append(p)
                visited.add(p.pid)
                
        while completed_count < len(processes):
            if not ready_queue:
                # Find next arriving process
                uncompleted = [p for p in processes if p.remaining_time > 0]
                if uncompleted:
                    next_arrival = min(p.arrival_time for p in uncompleted)
                    timeline.append({
                        "pid": "IDLE",
                        "start": current_time,
                        "end": next_arrival
                    })
                    current_time = next_arrival
                    # Update ready queue
                    for p in processes:
                        if p.arrival_time <= current_time and p.pid not in visited and p.remaining_time > 0:
                            ready_queue.append(p)
                            visited.add(p.pid)
                else:
                    break
                    
            if ready_queue:
                current_process = ready_queue.pop(0)
                
                # Check response time
                if current_process.start_time == -1:
                    current_process.start_time = current_time
                    current_process.response_time = current_time - current_process.arrival_time
                    
                exec_time = min(quantum, current_process.remaining_time)
                
                timeline.append({
                    "pid": current_process.pid,
                    "start": current_time,
                    "end": current_time + exec_time
                })
                
                current_time += exec_time
                current_process.remaining_time -= exec_time
                
                # Check if other processes arrived during the execution step
                for p in processes:
                    if p.arrival_time <= current_time and p.pid not in visited and p.remaining_time > 0:
                        ready_queue.append(p)
                        visited.add(p.pid)
                        
                # Re-add current process if not finished
                if current_process.remaining_time > 0:
                    ready_queue.append(current_process)
                else:
                    current_process.completion_time = current_time
                    current_process.turnaround_time = current_process.completion_time - current_process.arrival_time
                    current_process.waiting_time = current_process.turnaround_time - current_process.burst_time
                    completed_count += 1
                    
        processes.sort(key=lambda p: p.pid)
        avg_waiting = sum(p.waiting_time for p in processes) / len(processes) if processes else 0
        avg_turnaround = sum(p.turnaround_time for p in processes) / len(processes) if processes else 0
        
        return {
            "algorithm": f"Round Robin (RR) [Quantum = {quantum}]",
            "timeline": timeline,
            "processes": [p.to_dict() for p in processes],
            "average_waiting_time": round(avg_waiting, 2),
            "average_turnaround_time": round(avg_turnaround, 2)
        }

    @staticmethod
    def run_priority(
        processes_data: List[Dict[str, Any]],
        preemptive: bool = False,
        lower_is_higher: bool = True,
    ) -> Dict[str, Any]:
        """Priority CPU Scheduling. Supports Preemptive and Non-preemptive, lower/higher numerical priority mapping."""
        processes = [Process(**p) for p in processes_data]
        timeline = []
        current_time = 0
        completed = []
        
        # Priority mapping helper
        # If lower_is_higher is True: sort descending by higher priority (meaning smaller number is selected)
        # We can implement order using:
        # key = priority if lower_is_higher else -priority
        
        if not preemptive:
            # NON-PREEMPTIVE PRIORITY
            while len(completed) < len(processes):
                available = [p for p in processes if p.arrival_time <= current_time and p not in completed]
                
                if not available:
                    uncompleted = [p for p in processes if p not in completed]
                    if uncompleted:
                        next_arrival = min(p.arrival_time for p in uncompleted)
                        timeline.append({
                            "pid": "IDLE",
                            "start": current_time,
                            "end": next_arrival
                        })
                        current_time = next_arrival
                        available = [p for p in processes if p.arrival_time <= current_time and p not in completed]
                        
                if available:
                    # Sort priorities. If same priority, SJF or FCFS as tie breaker
                    available.sort(key=lambda p: (p.priority if lower_is_higher else -p.priority, p.arrival_time))
                    selected = available[0]
                    
                    selected.start_time = current_time
                    selected.response_time = selected.start_time - selected.arrival_time
                    timeline.append({
                        "pid": selected.pid,
                        "start": current_time,
                        "end": current_time + selected.burst_time
                    })
                    current_time += selected.burst_time
                    selected.completion_time = current_time
                    selected.turnaround_time = selected.completion_time - selected.arrival_time
                    selected.waiting_time = selected.turnaround_time - selected.burst_time
                    completed.append(selected)
                    
            completed.sort(key=lambda p: p.pid)
            processes = completed
        else:
            # PREEMPTIVE PRIORITY
            last_pid = None
            block_start = 0
            
            while len(completed) < len(processes):
                available = [p for p in processes if p.arrival_time <= current_time and p.remaining_time > 0]
                
                if not available:
                    uncompleted = [p for p in processes if p.remaining_time > 0]
                    if uncompleted:
                        next_arrival = min(p.arrival_time for p in uncompleted)
                        if last_pid != "IDLE":
                            if last_pid is not None:
                                timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                            last_pid = "IDLE"
                            block_start = current_time
                        current_time = next_arrival
                        continue
                    else:
                        break
                        
                # Sort: priority first, then arrival_time as a tie-breaker
                available.sort(key=lambda p: (p.priority if lower_is_higher else -p.priority, p.arrival_time))
                selected = available[0]
                
                if selected.start_time == -1:
                    selected.start_time = current_time
                    selected.response_time = current_time - selected.arrival_time
                    
                if last_pid != selected.pid:
                    if last_pid is not None:
                        timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                    last_pid = selected.pid
                    block_start = current_time
                    
                selected.remaining_time -= 1
                current_time += 1
                
                if selected.remaining_time == 0:
                    selected.completion_time = current_time
                    selected.turnaround_time = selected.completion_time - selected.arrival_time
                    selected.waiting_time = selected.turnaround_time - selected.burst_time
                    completed.append(selected)
                    
            if last_pid is not None:
                timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                
            processes.sort(key=lambda p: p.pid)
            
        avg_waiting = sum(p.waiting_time for p in processes) / len(processes) if processes else 0
        avg_turnaround = sum(p.turnaround_time for p in processes) / len(processes) if processes else 0
        
        algorithm_name = f"Priority [{'Preemptive' if preemptive else 'Non-preemptive'}]"
        
        return {
            "algorithm": algorithm_name,
            "timeline": timeline,
            "processes": [p.to_dict() for p in processes],
            "average_waiting_time": round(avg_waiting, 2),
            "average_turnaround_time": round(avg_turnaround, 2)
        }

    @staticmethod
    def run_multilevel_queue(
        processes_data: List[Dict[str, Any]],
        queues_config: List[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Multilevel Queue (MLQ) CPU Scheduling.
        Supports fixed-priority preemptive scheduling between queues:
        Queue 0 (High Priority) Scheduler defaults to Round Robin (quantum=2).
        Queue 1 (Low Priority) Scheduler defaults to FCFS.
        We can fully model preemption of Queue 1 by Queue 0.
        """
        processes = [Process(**p) for p in processes_data]
        timeline = []
        current_time = 0
        
        # Configurations of Queues
        if not queues_config:
            queues_config = [
                {"queue_id": 0, "algorithm": "RR", "quantum": 2, "name": "System/Interactive (High Priority)"},
                {"queue_id": 1, "algorithm": "FCFS", "name": "Batch (Low Priority)"}
            ]
            
        # Keep track of active states
        last_pid = None
        block_start = 0
        
        # Multi-level active run state
        completed = []
        total_p = len(processes)
        
        # We can implement a tick-based simulator for preemptive MLQ
        # Queue 0 processes always preempt Queue 1 processes.
        # Within Queue 0, Round Robin runs with quantum slicing.
        # Within Queue 1, FCFS runs when Queue 0 is completely empty.
        
        # Round robin state tracker inside Queue 0:
        q0_rr_tracker = {}  # pid -> elapsed remaining current quantum slot
        q0_ready = []       # Queue of processes currently active in Queue 0
        q0_visited = set()
        
        # Queue 1 FCFS state tracker:
        # FCFS processes run sequentially. If a Queue 1 process is running and a Queue 0 process arrives,
        # the Q1 process is preempted and put back at the head of its queue or has its remaining time tracked.
        
        while len(completed) < total_p:
            # 1. Update Ready processes at current_time
            arrived_q0 = [p for p in processes if p.arrival_time <= current_time and p.queue_id == 0 and p.remaining_time > 0]
            arrived_q1 = [p for p in processes if p.arrival_time <= current_time and p.queue_id == 1 and p.remaining_time > 0]
            
            # Enqueue to Q0 ready queue if not visited
            for p in arrived_q0:
                if p.pid not in q0_visited:
                    q0_ready.append(p)
                    q0_visited.add(p.pid)
                    
            # 2. Schedule
            selected_process = None
            
            if q0_ready:
                # High priority active
                selected_process = q0_ready[0]
                
                # Check response tracking
                if selected_process.start_time == -1:
                    selected_process.start_time = current_time
                    selected_process.response_time = current_time - selected_process.arrival_time
                    
                # Tracks RR slots
                q0_rr_tracker[selected_process.pid] = q0_rr_tracker.get(selected_process.pid, 0) + 1
                
            elif arrived_q1:
                # Sort Q1 processes by arrival to do classical FCFS within Q1
                arrived_q1.sort(key=lambda p: p.arrival_time)
                selected_process = arrived_q1[0]
                
                if selected_process.start_time == -1:
                    selected_process.start_time = current_time
                    selected_process.response_time = current_time - selected_process.arrival_time
                    
            if selected_process is None:
                # IDLE State
                uncompleted = [p for p in processes if p.remaining_time > 0]
                if uncompleted:
                    next_arrival = min(p.arrival_time for p in uncompleted)
                    if last_pid != "IDLE":
                        if last_pid is not None:
                            timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                        last_pid = "IDLE"
                        block_start = current_time
                    current_time = next_arrival
                    continue
                else:
                    break
                    
            # Record timeline block changes
            if last_pid != selected_process.pid:
                if last_pid is not None:
                    timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                last_pid = selected_process.pid
                block_start = current_time
                
            # Run selected process for 1 tick
            selected_process.remaining_time -= 1
            current_time += 1
            
            # Handle Queue 0 Round Robin transitions
            if selected_process.queue_id == 0:
                cur_quantum = q0_rr_tracker.get(selected_process.pid, 0)
                # Check if quantum limit of 2 reached, or if process completed
                if selected_process.remaining_time == 0:
                    selected_process.completion_time = current_time
                    selected_process.turnaround_time = selected_process.completion_time - selected_process.arrival_time
                    selected_process.waiting_time = selected_process.turnaround_time - selected_process.burst_time
                    completed.append(selected_process)
                    q0_ready.pop(0)
                    if selected_process.pid in q0_rr_tracker:
                        del q0_rr_tracker[selected_process.pid]
                elif cur_quantum >= 2:
                    # Quantum expired - Preempt within Queue 0
                    q0_ready.pop(0)
                    # Put newly arrived in queue first
                    next_arrived_q0 = [p for p in processes if p.arrival_time <= current_time and p.queue_id == 0 and p.remaining_time > 0 and p.pid not in q0_visited]
                    for p in next_arrived_q0:
                        q0_ready.append(p)
                        q0_visited.add(p.pid)
                    # Re-enqueue preempted Q0 process
                    q0_ready.append(selected_process)
                    # Reset tracker to 0
                    q0_rr_tracker[selected_process.pid] = 0
            else:
                # Queue 1 FCFS complete block handling
                if selected_process.remaining_time == 0:
                    selected_process.completion_time = current_time
                    selected_process.turnaround_time = selected_process.completion_time - selected_process.arrival_time
                    selected_process.waiting_time = selected_process.turnaround_time - selected_process.burst_time
                    completed.append(selected_process)
                    
        if last_pid is not None:
            timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
            
        processes.sort(key=lambda p: p.pid)
        avg_waiting = sum(p.waiting_time for p in processes) / len(processes) if processes else 0
        avg_turnaround = sum(p.turnaround_time for p in processes) / len(processes) if processes else 0
        
        return {
            "algorithm": "Multilevel Queue (MLQ) [Q0: RR, Q1: FCFS]",
            "timeline": timeline,
            "processes": [p.to_dict() for p in processes],
            "average_waiting_time": round(avg_waiting, 2),
            "average_turnaround_time": round(avg_turnaround, 2)
        }


def run_all_simulations(
    processes: List[Dict[str, Any]],
    quantum: int = 2,
    lower_is_higher: bool = True,
) -> Dict[str, Any]:
    """Runs all algorithms side-by-side on the provided processes.

    NOTE: The JSON keys returned here MUST match the frontend AlgorithmKey values.
    Frontend expects:
      FCFS, SJF, SRTF, RR, PriorityNP, PriorityP, MLQ
    """
    results: Dict[str, Any] = {}

    # Reset helper
    def get_clean_processes():
        return [p.copy() for p in processes]

    results["FCFS"] = CPU_Scheduler.run_fcfs(get_clean_processes())
    results["SJF"] = CPU_Scheduler.run_sjf(get_clean_processes())
    results["SRTF"] = CPU_Scheduler.run_srtf(get_clean_processes())

    # Frontend single RR result (uses incoming quantum)
    results["RR"] = CPU_Scheduler.run_round_robin(get_clean_processes(), quantum=quantum)

    # Frontend priority keys
    results["PriorityNP"] = CPU_Scheduler.run_priority(
        get_clean_processes(),
        preemptive=False,
        lower_is_higher=lower_is_higher,
    )
    results["PriorityP"] = CPU_Scheduler.run_priority(
        get_clean_processes(),
        preemptive=True,
        lower_is_higher=lower_is_higher,
    )

    results["MLQ"] = CPU_Scheduler.run_multilevel_queue(get_clean_processes())

    return results



if __name__ == "__main__":
    # Check if executed as a script with JSON data passed via standard input or CLI arguments
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        try:
            input_data = sys.stdin.read()
            payload = json.loads(input_data)
            processes = payload.get("processes", [])
            quantum = payload.get("quantum", 2)
            lower_is_higher = payload.get("lower_is_higher", True)

            # Execute and output JSON
            all_sims = run_all_simulations(
                processes,
                quantum=quantum,
                lower_is_higher=lower_is_higher,
            )
            print(json.dumps(all_sims, indent=2))
            sys.exit(0)
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            sys.exit(1)
            
    # Standard CLI usage demonstration
    print("=" * 60)
    print("Operating Systems (COMP6697001) - CPU Scheduling Simulator")
    print("=" * 60)
    
    sample_processes = [
        {"pid": "P1", "arrival_time": 0, "burst_time": 8, "priority": 3, "queue_id": 0},
        {"pid": "P2", "arrival_time": 1, "burst_time": 4, "priority": 1, "queue_id": 0},
        {"pid": "P3", "arrival_time": 2, "burst_time": 9, "priority": 4, "queue_id": 1},
        {"pid": "P4", "arrival_time": 3, "burst_time": 5, "priority": 2, "queue_id": 1},
    ]
    
    print("\n[Input Processes]:")
    print(f"{'Process ID':<12} {'Arrival Time':<14} {'Burst Time':<12} {'Priority':<10} {'Queue ID':<10}")
    for p in sample_processes:
        print(f"{p['pid']:<12} {p['arrival_time']:<14} {p['burst_time']:<12} {p['priority']:<10} {p['queue_id']:<10}")
        
    # Execute FCFS
    fcfs_result = CPU_Scheduler.run_fcfs(sample_processes)
    print("\n" + "=" * 40)
    print(fcfs_result["algorithm"])
    print("=" * 40)
    print(format_gantt_text(fcfs_result["timeline"]))
    print(f"Average Waiting Time: {fcfs_result['average_waiting_time']}")
    print(f"Average Turnaround Time: {fcfs_result['average_turnaround_time']}")
    
    # Execute SRTF (Preemptive SJF)
    srtf_result = CPU_Scheduler.run_srtf(sample_processes)
    print("\n" + "=" * 40)
    print(srtf_result["algorithm"])
    print("=" * 40)
    print(format_gantt_text(srtf_result["timeline"]))
    print(f"Average Waiting Time: {srtf_result['average_waiting_time']}")
    print(f"Average Turnaround Time: {srtf_result['average_turnaround_time']}")
    
    # Execute Round Robin
    rr_result = CPU_Scheduler.run_round_robin(sample_processes, quantum=2)
    print("\n" + "=" * 40)
    print(rr_result["algorithm"])
    print("=" * 40)
    print(format_gantt_text(rr_result["timeline"]))
    print(f"Average Waiting Time: {rr_result['average_waiting_time']}")
    print(f"Average Turnaround Time: {rr_result['average_turnaround_time']}")
    
    # Execute MLQ
    mlq_result = CPU_Scheduler.run_multilevel_queue(sample_processes)
    print("\n" + "=" * 40)
    print(mlq_result["algorithm"])
    print("=" * 40)
    print(format_gantt_text(mlq_result["timeline"]))
    print(f"Average Waiting Time: {mlq_result['average_waiting_time']}")
    print(f"Average Turnaround Time: {mlq_result['average_turnaround_time']}")
