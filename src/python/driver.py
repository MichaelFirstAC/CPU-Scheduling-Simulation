#!/usr/bin/env python3
"""
Operating Systems final assessment (COMP6697001) - CPU Scheduling CLI Driver

This script imports cpu_scheduler.py and runs all required scheduling techniques 
(FCFS, SJF, SRTF, RR, Priority, MLQ) from custom inputs, outputs comparative 
metrics, and prints text-based visual Gantt charts.
"""

from cpu_scheduler import CPU_Scheduler, run_all_simulations, format_gantt_text

def run_driver_simulation():
    print("=" * 70)
    print("COMP6697001 - Operating Systems: CPU Scheduler Testing Driver")
    print("=" * 70)

    # 1. Setting up sample workloads
    processes = [
        {"pid": "P1", "arrival_time": 0, "burst_time": 6, "priority": 2, "queue_id": 0},
        {"pid": "P2", "arrival_time": 2, "burst_time": 4, "priority": 1, "queue_id": 0},
        {"pid": "P3", "arrival_time": 3, "burst_time": 8, "priority": 4, "queue_id": 1},
        {"pid": "P4", "arrival_time": 5, "burst_time": 2, "priority": 3, "queue_id": 1},
    ]

    print("\n[Input Processes]:")
    print(f"{'PID':<6} | {'Arrival':<10} | {'Burst':<8} | {'Priority':<10} | {'Queue ID (MLQ)':<15}")
    print("-" * 55)
    for p in processes:
        print(f"{p['pid']:<6} | {p['arrival_time']:<10} | {p['burst_time']:<8} | {p['priority']:<10} | {p['queue_id']:<15}")

    # 2. Run All Simulations side-by-side
    print("\nRunning algorithms...")
    all_results = run_all_simulations(processes)

    # 3. Output results and ASCII Gantt Charts
    for key, res in all_results.items():
        print("\n" + "#" * 60)
        print(f" Algorithm: {res['algorithm']}")
        print("#" * 60)

        # Print Gantt
        print("\nGantt Chart Execution:")
        print(format_gantt_text(res['timeline']))

        # Print statistics table
        print(f"\n{'PID':<6} | {'Arrival':<10} | {'Burst':<8} | {'Completion':<12} | {'Turnaround (TAT)':<16} | {'Waiting (WT)':<12}")
        print("-" * 75)
        for p in res['processes']:
            print(f"{p['pid']:<6} | {p['arrival_time']:<10} | {p['burst_time']:<8} | {p['completion_time']:<12} | {p['turnaround_time']:<16} | {p['waiting_time']:<12}")

        print("-" * 75)
        print(f"Average Waiting Time (AWT)       : {res['average_waiting_time']} ms")
        print(f"Average Turnaround Time (ATAT)   : {res['average_turnaround_time']} ms")

    print("\n" + "=" * 70)
    print("Driver Execution Complete successfully!")
    print("=" * 70)

if __name__ == "__main__":
    run_driver_simulation()
