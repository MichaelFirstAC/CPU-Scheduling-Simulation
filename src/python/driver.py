#!/usr/bin/env python3
"""
Operating Systems final assessment (COMP6697001) - CPU Scheduling CLI Driver

This script imports cpu_scheduler.py and runs all required scheduling techniques 
(FCFS, SJF, SRTF, RR, Priority, MLQ) from custom inputs, outputs comparative 
metrics, and prints text-based visual Gantt charts.

Usage:
    python driver.py

This file is meant as a standalone CLI testing harness for the cpu_scheduler module.
It defines its own sample process workload and calls run_all_simulations() to exercise
all 7 algorithms at once, then prints human-readable output for each.
"""

# Import the scheduler module — both the class, the convenience function, and the text formatter
from cpu_scheduler import CPU_Scheduler, run_all_simulations, format_gantt_text

def run_driver_simulation():
    """
    Main driver function that runs all CPU scheduling algorithms on a sample
    process workload and prints the results to standard output.

    Steps:
        1. Define a sample workload of 4 processes with mixed attributes.
        2. Print the input process table.
        3. Call run_all_simulations() to execute all 7 algorithms in one shot.
        4. Iterate over each algorithm's result and print:
           - A text-based Gantt chart
           - Per-process metrics table (PID, arrival, burst, completion, TAT, WT)
           - Average Waiting Time (AWT) and Average Turnaround Time (ATAT)
    """
    print("=" * 70)
    print("COMP6697001 - Operating Systems: CPU Scheduler Testing Driver")
    print("=" * 70)

    # 1. Setting up sample workloads
    # Each dict must include: pid, arrival_time, burst_time, priority, queue_id
    processes = [
        {"pid": "P1", "arrival_time": 0, "burst_time": 6, "priority": 2, "queue_id": 0},  # Q0: High priority (RR)
        {"pid": "P2", "arrival_time": 2, "burst_time": 4, "priority": 1, "queue_id": 0},  # Q0: Highest priority
        {"pid": "P3", "arrival_time": 3, "burst_time": 8, "priority": 4, "queue_id": 1},  # Q1: Low priority (FCFS)
        {"pid": "P4", "arrival_time": 5, "burst_time": 2, "priority": 3, "queue_id": 1},  # Q1: Low priority (FCFS)
    ]

    # Print the input process table for verification before running simulations
    print("\n[Input Processes]:")
    print(f"{'PID':<6} | {'Arrival':<10} | {'Burst':<8} | {'Priority':<10} | {'Queue ID (MLQ)':<15}")
    print("-" * 55)
    for p in processes:
        print(f"{p['pid']:<6} | {p['arrival_time']:<10} | {p['burst_time']:<8} | {p['priority']:<10} | {p['queue_id']:<15}")

    # 2. Run All Simulations side-by-side
    # run_all_simulations returns a dict keyed by AlgorithmKey (FCFS, SJF, SRTF, RR, PriorityNP, PriorityP, MLQ)
    print("\nRunning algorithms...")
    all_results = run_all_simulations(processes)

    # 3. Output results and ASCII Gantt Charts
    # Iterate over each algorithm result and print a formatted report
    for key, res in all_results.items():
        print("\n" + "#" * 60)
        print(f" Algorithm: {res['algorithm']}")  # Full descriptive name of the algorithm
        print("#" * 60)

        # Print the ASCII Gantt chart showing execution order and time blocks
        print("\nGantt Chart Execution:")
        print(format_gantt_text(res['timeline']))

        # Print per-process metrics table (completion time, TAT, WT for each process)
        print(f"\n{'PID':<6} | {'Arrival':<10} | {'Burst':<8} | {'Completion':<12} | {'Turnaround (TAT)':<16} | {'Waiting (WT)':<12}")
        print("-" * 75)
        for p in res['processes']:
            print(f"{p['pid']:<6} | {p['arrival_time']:<10} | {p['burst_time']:<8} | {p['completion_time']:<12} | {p['turnaround_time']:<16} | {p['waiting_time']:<12}")

        # Print aggregate performance metrics for this algorithm
        print("-" * 75)
        print(f"Average Waiting Time (AWT)       : {res['average_waiting_time']} ms")
        print(f"Average Turnaround Time (ATAT)   : {res['average_turnaround_time']} ms")

    # Final confirmation message
    print("\n" + "=" * 70)
    print("Driver Execution Complete successfully!")
    print("=" * 70)

# Entry point: only runs when executed directly (not imported as a module)
if __name__ == "__main__":
    run_driver_simulation()
