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
    """
    Represents a single OS process (task/thread) in the scheduling simulation.

    Each process has static attributes (arrival time, burst time, priority, queue)
    and dynamic attributes that are updated during simulation (remaining time,
    start time, completion time, waiting time, turnaround time, response time).
    """

    def __init__(
        self,
        pid: str,
        arrival_time: int,
        burst_time: int,
        priority: int = 0,
        queue_id: int = 0,
    ):
        """
        Initialize a Process object.

        Args:
            pid (str): Unique process identifier (e.g. "P1", "P2").
            arrival_time (int): The clock tick at which this process enters the ready queue.
            burst_time (int): Total CPU time required by this process to complete.
            priority (int): Priority number used in Priority Scheduling algorithms.
                            Interpretation (lower vs higher = higher priority) is
                            controlled externally by the `lower_is_higher` flag.
            queue_id (int): The MLQ queue this process belongs to.
                            0 = High Priority Queue (Round Robin),
                            1 = Low Priority Queue (FCFS).
        """
        self.pid = str(pid)
        self.arrival_time = int(arrival_time)
        self.burst_time = int(burst_time)
        self.priority = int(priority)
        self.queue_id = int(queue_id)

        # --- Dynamic simulation state counters ---
        # remaining_time tracks how much CPU burst time is still left (for preemptive algos)
        self.remaining_time = self.burst_time
        # start_time: first clock tick where this process is assigned to CPU (-1 = not started)
        self.start_time = -1
        # completion_time: clock tick when the process finishes completely (-1 = not done)
        self.completion_time = -1
        # waiting_time: total time spent waiting in the ready queue (not executing)
        self.waiting_time = 0
        # turnaround_time: total time from arrival to completion (completion - arrival)
        self.turnaround_time = 0
        # response_time: time from arrival to first CPU assignment (start_time - arrival_time)
        self.response_time = -1

    def reset(self):
        """
        Reset all dynamic simulation counters back to their initial state.

        Used when rerunning the same process set through multiple algorithms,
        ensuring that each algorithm starts from a clean slate.
        """
        self.remaining_time = self.burst_time
        self.start_time = -1
        self.completion_time = -1
        self.waiting_time = 0
        self.turnaround_time = 0
        self.response_time = -1

    def to_dict(self) -> Dict[str, Any]:
        """
        Serialize this Process into a JSON-compatible dictionary.

        Returns:
            dict: Contains all static and computed dynamic fields.
                  Matches the ProcessRunResult interface expected by the frontend.
        """
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
    """
    Generates an ASCII art representation of the Gantt chart.

    Builds a simple text-based Gantt chart from the list of execution blocks.
    Each block is represented as a box with the process PID centered inside it.
    The width of each box scales with the block's duration.

    Args:
        timeline (list): A list of Gantt blocks, each with 'pid', 'start', and 'end' keys.

    Returns:
        str: A multi-line string containing the ASCII Gantt chart.
    """
    if not timeline:
        return "Empty Timeline"

    # Top border of the Gantt chart boxes
    top_line = "+"
    # Middle row containing process PIDs
    mid_line = "|"
    # Bottom row with time tick labels
    bottom_line = "0"

    for block in timeline:
        pid_str = f" {block['pid']} "
        duration = block["end"] - block["start"]
        # Width is at least as wide as the PID label, scaled by duration
        width = max(len(pid_str), duration * 2)

        top_line += "-" * width + "+"
        mid_line += f"{block['pid']}".center(width) + "|"
        bottom_line += str(block["end"]).rjust(width + 1)

    # Build bottom time axis with correct spacing alignment
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
    """
    Collection of static methods implementing various CPU scheduling algorithms.

    All methods accept a raw list of process dictionaries and return a standardized
    result dict containing the algorithm name, Gantt timeline, per-process metrics,
    and average waiting/turnaround times.

    The returned dict structure always matches the SimulationResult interface
    expected by the TypeScript frontend.
    """

    @staticmethod
    def run_fcfs(processes_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        First Come First Serve (FCFS) CPU Scheduling.

        Non-preemptive. Processes are executed strictly in order of their
        arrival time. If the CPU is idle between process arrivals, an IDLE
        block is inserted into the timeline.

        Time Complexity: O(n log n) due to sorting by arrival time.
        Space Complexity: O(n) for the timeline.

        Characteristics:
        - Simple and fair in arrival order.
        - Prone to the "Convoy Effect" (long processes block short ones).
        - No starvation.

        Args:
            processes_data (list): Raw process dicts with pid, arrival_time,
                                   burst_time, priority, queue_id fields.

        Returns:
            dict: SimulationResult-compatible dict with algorithm name, timeline,
                  per-process stats, and averages.
        """
        # Instantiate Process objects and sort by arrival time (FCFS order)
        processes = [Process(**p) for p in processes_data]
        processes.sort(key=lambda p: p.arrival_time)

        timeline = []
        current_time = 0  # Simulated clock

        for p in processes:
            if current_time < p.arrival_time:
                # CPU is idle while waiting for the next process to arrive
                timeline.append({
                    "pid": "IDLE",
                    "start": current_time,
                    "end": p.arrival_time
                })
                current_time = p.arrival_time

            # Record when this process first gets the CPU
            p.start_time = current_time
            # Response time = time from arrival until first CPU assignment
            p.response_time = p.start_time - p.arrival_time
            timeline.append({
                "pid": p.pid,
                "start": current_time,
                "end": current_time + p.burst_time
            })
            # Advance clock by this process's full burst time (non-preemptive)
            current_time += p.burst_time
            p.completion_time = current_time
            # TAT = completion - arrival
            p.turnaround_time = p.completion_time - p.arrival_time
            # WT = TAT - burst (time not spent executing)
            p.waiting_time = p.turnaround_time - p.burst_time

        # Compute averages across all processes
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
        """
        Shortest Job First (Non-preemptive) CPU Scheduling.

        At every scheduling decision point, picks the arrived process with
        the smallest burst_time. If two processes have the same burst time,
        arrival_time is used as a tiebreaker (FCFS among equals).

        Non-preemptive: once a process starts, it runs to completion.

        Characteristics:
        - Optimal average waiting time among non-preemptive algorithms.
        - Prone to starvation of long processes if shorter ones keep arriving.
        - Requires advance knowledge of burst times (not realistic in production).

        Args:
            processes_data (list): Raw process dicts.

        Returns:
            dict: SimulationResult-compatible dict.
        """
        processes = [Process(**p) for p in processes_data]
        timeline = []
        current_time = 0
        completed = []  # Tracks finished processes in order of completion

        while len(completed) < len(processes):
            # Find processes that have arrived and are not yet completed
            available = [p for p in processes if p.arrival_time <= current_time and p not in completed]

            if not available:
                # No process ready — advance time to the next arriving process
                uncompleted = [p for p in processes if p not in completed]
                if uncompleted:
                    next_arrival = min(p.arrival_time for p in uncompleted)
                    # Insert idle gap into the timeline
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
                selected = available[0]  # Process with shortest burst time

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

        # Sort completed processes back to support standardized outputs (by PID)
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
        """
        Shortest Remaining Time First (SRTF) [Preemptive SJF] CPU Scheduling.

        Preemptive extension of SJF. At every clock tick, the scheduler checks
        whether a newly arrived process has a shorter remaining time than the
        currently running process. If so, the running process is preempted.

        Uses a tick-by-tick simulation (1 unit per iteration) to accurately
        capture preemptions at any point during execution.

        Characteristics:
        - Optimal average waiting time of all scheduling algorithms.
        - High context-switch overhead due to frequent preemptions.
        - Can cause severe starvation for long-burst processes.

        Args:
            processes_data (list): Raw process dicts.

        Returns:
            dict: SimulationResult-compatible dict.
        """
        processes = [Process(**p) for p in processes_data]
        timeline = []
        current_time = 0
        completed = []

        # Track the last running PID and the start of the current contiguous block
        # to merge consecutive same-process ticks into a single Gantt block
        last_pid = None
        block_start = 0

        while len(completed) < len(processes):
            # Get all processes that have arrived and still have remaining burst time
            available = [p for p in processes if p.arrival_time <= current_time and p.remaining_time > 0]

            if not available:
                # CPU IDLE — advance to next arriving process
                uncompleted = [p for p in processes if p.remaining_time > 0]
                if uncompleted:
                    next_arrival = min(p.arrival_time for p in uncompleted)
                    # Only create a new IDLE block if we weren't already idle
                    if last_pid != "IDLE":
                        if last_pid is not None:
                            # Flush the previous process block before going idle
                            timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                        last_pid = "IDLE"
                        block_start = current_time
                    current_time = next_arrival
                    continue
                else:
                    # All processes are done
                    break

            # Pick process with shortest remaining time (preemptive SJF)
            # Arrival time breaks ties to ensure deterministic ordering
            available.sort(key=lambda p: (p.remaining_time, p.arrival_time))
            selected = available[0]

            # Record first CPU assignment for response time calculation
            if selected.start_time == -1:
                selected.start_time = current_time
                selected.response_time = current_time - selected.arrival_time

            # Timeline boundary management: detect process switches
            if last_pid != selected.pid:
                if last_pid is not None:
                    # Flush the previous block before switching
                    timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                last_pid = selected.pid
                block_start = current_time

            # Execute for exactly 1 clock tick (enables checking preemption every tick)
            selected.remaining_time -= 1
            current_time += 1

            # Check if the process just finished
            if selected.remaining_time == 0:
                selected.completion_time = current_time
                selected.turnaround_time = selected.completion_time - selected.arrival_time
                selected.waiting_time = selected.turnaround_time - selected.burst_time
                completed.append(selected)

        # Append the very last running block to the timeline
        if last_pid is not None:
            timeline.append({"pid": last_pid, "start": block_start, "end": current_time})

        # Sort output by PID for consistent table display
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
        """
        Round Robin (RR) CPU Scheduling with precise arrival tracking.

        Each process is given a fixed CPU time slice (quantum). After the quantum
        expires, the running process is preempted and placed back at the end of
        the ready queue. Newly arrived processes are added to the queue between
        quantum slices (after the current slice ends but before re-enqueuing
        the preempted process).

        Characteristics:
        - Fair: every process gets equal CPU time slices.
        - Low response time for interactive/short tasks.
        - Higher average turnaround than SJF for the same workload.
        - Context-switch overhead increases with smaller quantum values.

        Args:
            processes_data (list): Raw process dicts.
            quantum (int): Maximum CPU time per scheduling slice (default=2).

        Returns:
            dict: SimulationResult-compatible dict.
        """
        processes = [Process(**p) for p in processes_data]
        # Pre-sort by arrival time for correct initial queue ordering
        processes.sort(key=lambda p: p.arrival_time)

        timeline = []
        current_time = 0
        ready_queue = []   # FIFO queue of Process objects
        visited = set()    # Set of PIDs already enqueued (to avoid double-adding)
        completed_count = 0

        # Find initial processes at time 0 and seed the ready queue
        for p in processes:
            if p.arrival_time <= current_time:
                ready_queue.append(p)
                visited.add(p.pid)

        while completed_count < len(processes):
            if not ready_queue:
                # Ready queue is empty — advance time to next arriving process
                uncompleted = [p for p in processes if p.remaining_time > 0]
                if uncompleted:
                    next_arrival = min(p.arrival_time for p in uncompleted)
                    # Record idle gap in Gantt timeline
                    timeline.append({
                        "pid": "IDLE",
                        "start": current_time,
                        "end": next_arrival
                    })
                    current_time = next_arrival
                    # Update ready queue with newly arrived processes
                    for p in processes:
                        if p.arrival_time <= current_time and p.pid not in visited and p.remaining_time > 0:
                            ready_queue.append(p)
                            visited.add(p.pid)
                else:
                    break  # All processes completed

            if ready_queue:
                # Dequeue the front process (FIFO)
                current_process = ready_queue.pop(0)

                # Track response time on first CPU assignment
                if current_process.start_time == -1:
                    current_process.start_time = current_time
                    current_process.response_time = current_time - current_process.arrival_time

                # Execute for min(quantum, remaining_time) ticks
                exec_time = min(quantum, current_process.remaining_time)

                timeline.append({
                    "pid": current_process.pid,
                    "start": current_time,
                    "end": current_time + exec_time
                })

                current_time += exec_time
                current_process.remaining_time -= exec_time

                # Add newly arrived processes BEFORE re-enqueuing the preempted process
                # This ensures new arrivals are scheduled before the preempted process
                for p in processes:
                    if p.arrival_time <= current_time and p.pid not in visited and p.remaining_time > 0:
                        ready_queue.append(p)
                        visited.add(p.pid)

                # Re-add current process to back of queue if not finished
                if current_process.remaining_time > 0:
                    ready_queue.append(current_process)
                else:
                    # Process completed in this quantum slice
                    current_process.completion_time = current_time
                    current_process.turnaround_time = current_process.completion_time - current_process.arrival_time
                    current_process.waiting_time = current_process.turnaround_time - current_process.burst_time
                    completed_count += 1

        # Sort output by PID for consistent display
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
        """
        Priority CPU Scheduling. Supports both Preemptive and Non-preemptive modes.

        Processes are selected based on their priority number. The `lower_is_higher`
        flag determines the mapping:
          - lower_is_higher=True:  priority=1 beats priority=4 (Unix-style)
          - lower_is_higher=False: priority=4 beats priority=1 (Windows-style)

        Arrival time is used as a tiebreaker when priorities are equal (FCFS among equals).

        Non-Preemptive Mode:
            Once a process starts executing, it runs to completion even if a higher
            priority process arrives during its execution.

        Preemptive Mode:
            At every clock tick, the scheduler re-evaluates available processes.
            If a newly arrived process has higher priority than the current one,
            the current process is preempted immediately.

        Characteristics:
        - Enables differentiated service for critical vs. background tasks.
        - Preemptive variant can cause starvation of low-priority processes.

        Args:
            processes_data (list): Raw process dicts.
            preemptive (bool): If True, use preemptive priority scheduling.
            lower_is_higher (bool): If True, numerically lower priority value = higher priority.

        Returns:
            dict: SimulationResult-compatible dict.
        """
        processes = [Process(**p) for p in processes_data]
        timeline = []
        current_time = 0
        completed = []

        # Priority mapping helper:
        # If lower_is_higher is True: sort ascending by priority number (1 = highest priority)
        # If lower_is_higher is False: sort descending by priority number (4 = highest priority)
        # We achieve this by using +priority or -priority as the sort key respectively.

        if not preemptive:
            # ── NON-PREEMPTIVE PRIORITY ──────────────────────────────────────────
            while len(completed) < len(processes):
                # Get all processes that have arrived and aren't done yet
                available = [p for p in processes if p.arrival_time <= current_time and p not in completed]

                if not available:
                    # CPU idle — jump to next arriving process
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
                    # Sort by priority first, then arrival_time as a FCFS tie-breaker
                    available.sort(key=lambda p: (p.priority if lower_is_higher else -p.priority, p.arrival_time))
                    selected = available[0]  # Highest priority process

                    # Record first CPU assignment
                    selected.start_time = current_time
                    selected.response_time = selected.start_time - selected.arrival_time
                    timeline.append({
                        "pid": selected.pid,
                        "start": current_time,
                        "end": current_time + selected.burst_time
                    })
                    # Run to completion (non-preemptive)
                    current_time += selected.burst_time
                    selected.completion_time = current_time
                    selected.turnaround_time = selected.completion_time - selected.arrival_time
                    selected.waiting_time = selected.turnaround_time - selected.burst_time
                    completed.append(selected)

            # Re-order output by PID for consistent display
            completed.sort(key=lambda p: p.pid)
            processes = completed

        else:
            # ── PREEMPTIVE PRIORITY ──────────────────────────────────────────────
            # Uses tick-by-tick simulation similar to SRTF
            last_pid = None
            block_start = 0

            while len(completed) < len(processes):
                # All processes that have arrived and still have remaining time
                available = [p for p in processes if p.arrival_time <= current_time and p.remaining_time > 0]

                if not available:
                    # CPU idle — advance to next arrival
                    uncompleted = [p for p in processes if p.remaining_time > 0]
                    if uncompleted:
                        next_arrival = min(p.arrival_time for p in uncompleted)
                        if last_pid != "IDLE":
                            if last_pid is not None:
                                # Flush current process block before idle
                                timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                            last_pid = "IDLE"
                            block_start = current_time
                        current_time = next_arrival
                        continue
                    else:
                        break

                # Sort: highest priority process first, arrival_time as tie-breaker
                available.sort(key=lambda p: (p.priority if lower_is_higher else -p.priority, p.arrival_time))
                selected = available[0]

                # Record first CPU assignment for response time
                if selected.start_time == -1:
                    selected.start_time = current_time
                    selected.response_time = current_time - selected.arrival_time

                # Detect process switch and record the previous block
                if last_pid != selected.pid:
                    if last_pid is not None:
                        timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                    last_pid = selected.pid
                    block_start = current_time

                # Execute for 1 tick then re-evaluate priority (enables preemption)
                selected.remaining_time -= 1
                current_time += 1

                # Check if this process just completed
                if selected.remaining_time == 0:
                    selected.completion_time = current_time
                    selected.turnaround_time = selected.completion_time - selected.arrival_time
                    selected.waiting_time = selected.turnaround_time - selected.burst_time
                    completed.append(selected)

            # Flush the last running block
            if last_pid is not None:
                timeline.append({"pid": last_pid, "start": block_start, "end": current_time})

            # Sort output by PID
            processes.sort(key=lambda p: p.pid)

        # Compute average metrics
        avg_waiting = sum(p.waiting_time for p in processes) / len(processes) if processes else 0
        avg_turnaround = sum(p.turnaround_time for p in processes) / len(processes) if processes else 0

        # Build a descriptive algorithm name for the results
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

        Organizes processes into fixed priority levels (queues) with their own
        scheduling policy within each level. Queue 0 always preempts Queue 1.

        Queue Definitions:
            Queue 0 (High Priority) — System/Interactive jobs:
                Uses Round Robin with quantum=2. These processes preempt Q1.
            Queue 1 (Low Priority) — Batch/background jobs:
                Uses FCFS. Only runs when Q0 is completely empty.

        Mechanism:
            - Tick-by-tick simulation to support inter-queue preemption.
            - Q0 processes use a per-process RR quantum tracker (q0_rr_tracker).
            - When a Q0 process's quantum expires, it is cycled to the back of Q0.
            - Q1 runs FCFS: the earliest-arrived Q1 process runs until Q0 is empty
              or until it finishes.

        Characteristics:
        - Guarantees interactive processes are prioritized over background work.
        - No starvation in Q0 (RR is fair within Q0).
        - Q1 processes can starve if Q0 never empties.

        Args:
            processes_data (list): Raw process dicts. Each process must have a
                                   `queue_id` field (0 or 1) to determine its queue.
            queues_config (list, optional): Queue configuration overrides (not fully
                                            used in current implementation; reserved
                                            for future extension).

        Returns:
            dict: SimulationResult-compatible dict.
        """
        processes = [Process(**p) for p in processes_data]
        timeline = []
        current_time = 0

        # Default queue configuration (can be overridden via queues_config parameter)
        if not queues_config:
            queues_config = [
                {"queue_id": 0, "algorithm": "RR", "quantum": 2, "name": "System/Interactive (High Priority)"},
                {"queue_id": 1, "algorithm": "FCFS", "name": "Batch (Low Priority)"}
            ]

        # Track Gantt block boundaries across process switches
        last_pid = None
        block_start = 0

        # Completion tracking
        completed = []
        total_p = len(processes)

        # ── Queue 0 (High Priority — Round Robin) State ───────────────────────
        # q0_rr_tracker: maps pid -> current consecutive ticks used in this quantum slot
        #   When this count reaches 2 (the RR quantum), the process is cycled to back of Q0.
        q0_rr_tracker = {}  # pid -> elapsed remaining current quantum slot
        q0_ready = []       # FIFO queue of Process objects in Queue 0
        q0_visited = set()  # PIDs already added to q0_ready (to avoid double-enqueuing)

        # ── Queue 1 (Low Priority — FCFS) State ──────────────────────────────
        # Q1 processes run sequentially under FCFS. If a Q0 process arrives while
        # a Q1 process is running, the Q1 process is implicitly preempted because
        # the tick-based loop will switch to the Q0 process on the next iteration.
        # Q1 remaining_time tracks partial progress between Q0 preemptions.

        while len(completed) < total_p:
            # ── Step 1: Update ready process lists at current_time ─────────────
            # Find all Q0 processes that have arrived with remaining work
            arrived_q0 = [p for p in processes if p.arrival_time <= current_time and p.queue_id == 0 and p.remaining_time > 0]
            # Find all Q1 processes that have arrived with remaining work
            arrived_q1 = [p for p in processes if p.arrival_time <= current_time and p.queue_id == 1 and p.remaining_time > 0]

            # Enqueue newly arrived Q0 processes into the Q0 ready queue
            for p in arrived_q0:
                if p.pid not in q0_visited:
                    q0_ready.append(p)
                    q0_visited.add(p.pid)

            # ── Step 2: Select the process to run this tick ────────────────────
            selected_process = None

            if q0_ready:
                # Q0 takes absolute priority — select head of Q0 ready queue
                selected_process = q0_ready[0]

                # Record first CPU assignment for response time
                if selected_process.start_time == -1:
                    selected_process.start_time = current_time
                    selected_process.response_time = current_time - selected_process.arrival_time

                # Increment the quantum slot counter for this Q0 process
                q0_rr_tracker[selected_process.pid] = q0_rr_tracker.get(selected_process.pid, 0) + 1

            elif arrived_q1:
                # Q0 is empty — run the earliest arrived Q1 process (FCFS within Q1)
                arrived_q1.sort(key=lambda p: p.arrival_time)
                selected_process = arrived_q1[0]

                # Record first CPU assignment for response time
                if selected_process.start_time == -1:
                    selected_process.start_time = current_time
                    selected_process.response_time = current_time - selected_process.arrival_time

            if selected_process is None:
                # ── Both queues empty — CPU is IDLE ───────────────────────────
                uncompleted = [p for p in processes if p.remaining_time > 0]
                if uncompleted:
                    next_arrival = min(p.arrival_time for p in uncompleted)
                    # Start IDLE block in the Gantt chart
                    if last_pid != "IDLE":
                        if last_pid is not None:
                            timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                        last_pid = "IDLE"
                        block_start = current_time
                    current_time = next_arrival
                    continue
                else:
                    break  # All processes completed

            # ── Step 3: Record Gantt block boundary ───────────────────────────
            if last_pid != selected_process.pid:
                if last_pid is not None:
                    # Flush the previous process block
                    timeline.append({"pid": last_pid, "start": block_start, "end": current_time})
                last_pid = selected_process.pid
                block_start = current_time

            # ── Step 4: Execute for exactly 1 clock tick ──────────────────────
            selected_process.remaining_time -= 1
            current_time += 1

            # ── Step 5: Handle post-tick state transitions ────────────────────
            if selected_process.queue_id == 0:
                # Q0 process: check if quantum expired or process finished
                cur_quantum = q0_rr_tracker.get(selected_process.pid, 0)

                if selected_process.remaining_time == 0:
                    # Process completed — remove from Q0 and record completion
                    selected_process.completion_time = current_time
                    selected_process.turnaround_time = selected_process.completion_time - selected_process.arrival_time
                    selected_process.waiting_time = selected_process.turnaround_time - selected_process.burst_time
                    completed.append(selected_process)
                    q0_ready.pop(0)  # Remove completed process from front of Q0
                    if selected_process.pid in q0_rr_tracker:
                        del q0_rr_tracker[selected_process.pid]  # Clean up tracker

                elif cur_quantum >= 2:
                    # Quantum expired (used >= 2 ticks) — preempt and cycle to back of Q0
                    q0_ready.pop(0)
                    # First, add any newly arrived Q0 processes that appeared this tick
                    next_arrived_q0 = [p for p in processes if p.arrival_time <= current_time and p.queue_id == 0 and p.remaining_time > 0 and p.pid not in q0_visited]
                    for p in next_arrived_q0:
                        q0_ready.append(p)
                        q0_visited.add(p.pid)
                    # Re-enqueue the preempted process at the back of Q0
                    q0_ready.append(selected_process)
                    # Reset the quantum counter for this process
                    q0_rr_tracker[selected_process.pid] = 0

            else:
                # Q1 (FCFS) process: only complete action when it finishes
                if selected_process.remaining_time == 0:
                    selected_process.completion_time = current_time
                    selected_process.turnaround_time = selected_process.completion_time - selected_process.arrival_time
                    selected_process.waiting_time = selected_process.turnaround_time - selected_process.burst_time
                    completed.append(selected_process)

        # Flush the last Gantt block
        if last_pid is not None:
            timeline.append({"pid": last_pid, "start": block_start, "end": current_time})

        # Sort output by PID for consistent display
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
    """
    Runs all 7 scheduling algorithms side-by-side on the provided process set.

    Each algorithm receives its own independent copy of the process list so that
    the simulation of one algorithm doesn't affect the others.

    NOTE: The JSON keys returned here MUST match the frontend AlgorithmKey values.
    Frontend expects:
      FCFS, SJF, SRTF, RR, PriorityNP, PriorityP, MLQ

    Args:
        processes (list): Raw process dicts (pid, arrival_time, burst_time, priority, queue_id).
        quantum (int): Round Robin time quantum (default=2).
        lower_is_higher (bool): Priority mapping direction for Priority algorithms.
                                 True=lower number is higher priority (Unix-style).

    Returns:
        dict: A map of AlgorithmKey -> SimulationResult for all 7 algorithms.
    """
    results: Dict[str, Any] = {}

    # Helper to get a fresh independent copy of the process list for each algorithm.
    # Using dict.copy() creates shallow copies of the process dicts, which is
    # sufficient since Process.__init__ casts all values to int/str primitives.
    def get_clean_processes():
        return [p.copy() for p in processes]

    # ── Core Algorithms ───────────────────────────────────────────────────────
    results["FCFS"] = CPU_Scheduler.run_fcfs(get_clean_processes())
    results["SJF"] = CPU_Scheduler.run_sjf(get_clean_processes())
    results["SRTF"] = CPU_Scheduler.run_srtf(get_clean_processes())

    # Round Robin uses the quantum value from the caller (configurable via frontend slider)
    results["RR"] = CPU_Scheduler.run_round_robin(get_clean_processes(), quantum=quantum)

    # ── Priority Algorithms (both modes) ─────────────────────────────────────
    # PriorityNP = Non-Preemptive Priority
    results["PriorityNP"] = CPU_Scheduler.run_priority(
        get_clean_processes(),
        preemptive=False,
        lower_is_higher=lower_is_higher,
    )
    # PriorityP = Preemptive Priority
    results["PriorityP"] = CPU_Scheduler.run_priority(
        get_clean_processes(),
        preemptive=True,
        lower_is_higher=lower_is_higher,
    )

    # ── Advanced: Multilevel Queue ────────────────────────────────────────────
    results["MLQ"] = CPU_Scheduler.run_multilevel_queue(get_clean_processes())

    return results



if __name__ == "__main__":
    # ── JSON API Mode (called by the Node.js Express backend) ─────────────────
    # When invoked with --json flag, reads a JSON payload from stdin,
    # runs all simulations, and writes JSON results to stdout.
    # This is the integration point with the web frontend via server.ts.
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        try:
            # Read the entire stdin as a JSON payload
            input_data = sys.stdin.read()
            payload = json.loads(input_data)
            processes = payload.get("processes", [])
            quantum = payload.get("quantum", 2)
            lower_is_higher = payload.get("lower_is_higher", True)

            # Execute all simulations and write JSON output to stdout
            all_sims = run_all_simulations(
                processes,
                quantum=quantum,
                lower_is_higher=lower_is_higher,
            )
            print(json.dumps(all_sims, indent=2))
            sys.exit(0)  # Success
        except Exception as e:
            # Output error as JSON so the server can parse and handle it gracefully
            print(json.dumps({"error": str(e)}))
            sys.exit(1)  # Failure

    # ── Standard CLI Demo Mode ────────────────────────────────────────────────
    # When run directly without arguments, demonstrates all algorithms on a
    # predefined sample workload and prints human-readable ASCII output.
    print("=" * 60)
    print("Operating Systems (COMP6697001) - CPU Scheduling Simulator")
    print("=" * 60)

    # Sample workload: 4 processes with mixed priorities and queue assignments
    sample_processes = [
        {"pid": "P1", "arrival_time": 0, "burst_time": 8, "priority": 3, "queue_id": 0},
        {"pid": "P2", "arrival_time": 1, "burst_time": 4, "priority": 1, "queue_id": 0},
        {"pid": "P3", "arrival_time": 2, "burst_time": 9, "priority": 4, "queue_id": 1},
        {"pid": "P4", "arrival_time": 3, "burst_time": 5, "priority": 2, "queue_id": 1},
    ]

    # Print input process table header
    print("\n[Input Processes]:")
    print(f"{'Process ID':<12} {'Arrival Time':<14} {'Burst Time':<12} {'Priority':<10} {'Queue ID':<10}")
    for p in sample_processes:
        print(f"{p['pid']:<12} {p['arrival_time']:<14} {p['burst_time']:<12} {p['priority']:<10} {p['queue_id']:<10}")

    # ── Run and display FCFS ──────────────────────────────────────────────────
    fcfs_result = CPU_Scheduler.run_fcfs(sample_processes)
    print("\n" + "=" * 40)
    print(fcfs_result["algorithm"])
    print("=" * 40)
    print(format_gantt_text(fcfs_result["timeline"]))
    print(f"Average Waiting Time: {fcfs_result['average_waiting_time']}")
    print(f"Average Turnaround Time: {fcfs_result['average_turnaround_time']}")

    # ── Run and display SRTF (Preemptive SJF) ────────────────────────────────
    srtf_result = CPU_Scheduler.run_srtf(sample_processes)
    print("\n" + "=" * 40)
    print(srtf_result["algorithm"])
    print("=" * 40)
    print(format_gantt_text(srtf_result["timeline"]))
    print(f"Average Waiting Time: {srtf_result['average_waiting_time']}")
    print(f"Average Turnaround Time: {srtf_result['average_turnaround_time']}")

    # ── Run and display Round Robin (quantum=2) ───────────────────────────────
    rr_result = CPU_Scheduler.run_round_robin(sample_processes, quantum=2)
    print("\n" + "=" * 40)
    print(rr_result["algorithm"])
    print("=" * 40)
    print(format_gantt_text(rr_result["timeline"]))
    print(f"Average Waiting Time: {rr_result['average_waiting_time']}")
    print(f"Average Turnaround Time: {rr_result['average_turnaround_time']}")

    # ── Run and display Multilevel Queue ─────────────────────────────────────
    mlq_result = CPU_Scheduler.run_multilevel_queue(sample_processes)
    print("\n" + "=" * 40)
    print(mlq_result["algorithm"])
    print("=" * 40)
    print(format_gantt_text(mlq_result["timeline"]))
    print(f"Average Waiting Time: {mlq_result['average_waiting_time']}")
    print(f"Average Turnaround Time: {mlq_result['average_turnaround_time']}")
