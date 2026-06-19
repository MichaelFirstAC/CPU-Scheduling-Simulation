/**
 * server.ts — Express.js backend server for the CPU Scheduling Simulator.
 *
 * This server acts as the bridge between the React frontend and the Python
 * scheduling engine. It exposes REST API endpoints that:
 *   1. Serve the Python source code to the frontend SourceViewer component.
 *   2. Execute the Python cpu_scheduler.py script with process inputs and
 *      return JSON simulation results.
 *   3. Fall back gracefully to the TypeScript TSScheduler when Python is
 *      unavailable (e.g., containerized environments without Python).
 *
 * In development mode, it integrates with Vite's dev server middleware for
 * HMR (Hot Module Replacement). In production, it serves the built /dist files.
 *
 * Architecture:
 *   Frontend (React/Vite) <-> Express API <-> Python subprocess (cpu_scheduler.py)
 *                                          <-> TSScheduler (TS fallback)
 */

import express from "express";
import dotenv from "dotenv";

// Load environment variables from .env.local before any other imports
dotenv.config({ path: ".env.local" });
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process"; // Used to launch the Python subprocess
import { createServer as createViteServer } from "vite";

// Import the TypeScript fallback scheduler (mirrors Python algorithms exactly)
import { TSScheduler, ProcessInput } from "./src/utils/scheduler_engine.ts";

const app = express();
const PORT = 3000; // Server port — frontend proxies API requests here

// Parse incoming JSON request bodies
app.use(express.json());



// ── REST Backend API Routes ────────────────────────────────────────────────────

// Health Check endpoint — used to verify the server is alive
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", python_available: true });
});

/**
 * GET /api/get-python-code
 *
 * Reads the cpu_scheduler.py source file from disk and returns it as a
 * JSON string. Used by the SourceViewer component to display the Python
 * source code in the "Python Source Package" tab.
 *
 * Returns:
 *   { success: true, code: "<source code string>" }
 *   { error: "<message>" } on failure (500)
 */
app.get("/api/get-python-code", async (req, res) => {
  try {
    // Resolve the absolute path to the Python script in the project
    const pythonScriptPath = path.join(process.cwd(), "src", "python", "cpu_scheduler.py");
    const code = await fs.readFile(pythonScriptPath, "utf-8");
    res.json({ success: true, code });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to read python code: ${err.message}` });
  }
});

/**
 * POST /api/simulate-python
 *
 * Main simulation endpoint. Accepts a list of processes and scheduling
 * parameters, runs the Python cpu_scheduler.py script as a child process,
 * and returns the simulation results as JSON.
 *
 * Request body:
 *   {
 *     processes: ProcessInput[],   // Array of process definitions
 *     quantum: number,             // Round Robin time quantum
 *     lower_is_higher: boolean     // Priority mapping direction
 *   }
 *
 * Execution flow:
 *   1. Validate and normalize inputs.
 *   2. Spawn python3 with cpu_scheduler.py --json flag.
 *   3. Write the JSON payload to Python's stdin.
 *   4. Collect stdout (results) and stderr (errors) from the Python process.
 *   5. On success: return { success: true, source: "python", results: {...} }
 *   6. On Python parse error or exit failure: fall back to TSScheduler.
 *   7. On spawn failure (Python not installed): fall back to TSScheduler.
 *
 * Fallback sources:
 *   "python"                        — Python ran successfully
 *   "typescript_fallback_parse_error" — Python ran but output wasn't valid JSON
 *   "typescript_fallback_exec_error"  — Python exited with non-zero code
 *   "typescript_fallback_no_env"      — Python could not be spawned at all
 */
app.post("/api/simulate-python", async (req, res) => {
  const { processes, quantum, lower_is_higher } = req.body;

  // Validate that we received a non-empty process array
  if (!Array.isArray(processes) || processes.length === 0) {
    return res.status(400).json({ error: "Invalid or empty processes list" });
  }

  // Normalize all process fields to ensure consistent types regardless of how
  // the frontend transmitted the data (snake_case vs camelCase, string vs number)
  const normalizedProcesses: ProcessInput[] = processes.map((p: any) => ({
    pid: String(p.pid || p.id),
    arrival_time: Number(p.arrival_time ?? p.arrivalTime ?? 0),
    burst_time: Number(p.burst_time ?? p.burstTime ?? 1),
    priority: Number(p.priority ?? 0),
    queue_id: Number(p.queue_id ?? p.queueId ?? 0),
  }));

  // Normalize scheduling parameters with safe defaults
  const quantumVal = Number(quantum || 2);
  const lowerIsHigherVal = lower_is_higher !== false; // Default true (Unix-style priority)

  // Attempt to run the Python Scheduler as a subprocess
  try {
    const pythonScriptPath = path.join(process.cwd(), "src", "python", "cpu_scheduler.py");
    // Spawn python3 with the --json flag which enables stdin/stdout JSON mode
    const pyProcess = spawn("python3", [pythonScriptPath, "--json"]);

    let outputData = ""; // Accumulate Python stdout (the JSON result)
    let errorData = "";  // Accumulate Python stderr (error messages)

    // Send the process payload to Python via stdin as a JSON string
    pyProcess.stdin.write(
      JSON.stringify({
        processes: normalizedProcesses,
        quantum: quantumVal,
        lower_is_higher: lowerIsHigherVal,
      })
    );
    pyProcess.stdin.end(); // Signal EOF to Python (it reads until stdin closes)

    // Collect stdout chunks as they arrive
    pyProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });

    // Collect stderr chunks (Python errors, tracebacks)
    pyProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    // Handle process exit
    pyProcess.on("close", (code) => {
      if (code === 0) {
        // Python exited successfully — parse and return the JSON output
        try {
          const parsedResult = JSON.parse(outputData.trim());
          return res.json({
            success: true,
            source: "python", // Signals to frontend that Python was used
            results: parsedResult,
          });
        } catch (e: any) {
          // If JSON parse of Python stdout fails, fallback to TS
          const tsResults = TSScheduler.runAll(normalizedProcesses, quantumVal, lowerIsHigherVal);
          return res.json({
            success: true,
            source: "typescript_fallback_parse_error",
            error: `Failed to parse Python output: ${e.message}`,
            results: tsResults,
          });
        }
      } else {
        // Python process exited with non-zero exit code — fallback to TypeScript scheduler
        const tsResults = TSScheduler.runAll(normalizedProcesses, quantumVal, lowerIsHigherVal);
        return res.json({
          success: true,
          source: "typescript_fallback_exec_error",
          error: `Python process exited with code ${code}: ${errorData.trim()}`,
          results: tsResults,
        });
      }
    });
  } catch (err: any) {
    // Spawning Python failed completely (e.g. python3 not installed in this environment)
    // Seamlessly fall back to the TypeScript engine which implements identical algorithms
    const tsResults = TSScheduler.runAll(normalizedProcesses, quantumVal, lowerIsHigherVal);
    return res.json({
      success: true,
      source: "typescript_fallback_no_env",
      error: `Python is unavailable or failed to execute: ${err.message}. Seamlessly fell back to matching TS simulation engine.`,
      results: tsResults,
    });
  }
});


/**
 * main() — Starts the Express server and wires up the Vite middleware or
 * static file serving depending on the NODE_ENV.
 *
 * Development: Uses Vite in middleware mode for hot-module replacement.
 * Production: Serves the pre-built static files from /dist.
 *
 * Binds to 0.0.0.0 to be accessible from all network interfaces
 * (important for containerized/cloud environments).
 */
async function main() {
  if (process.env.NODE_ENV !== "production") {
    // Development — attach Vite dev server as middleware for HMR + fast refresh
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa", // Single Page Application mode
    });
    app.use(vite.middlewares);
  } else {
    // Production — serve the built bundle from /dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Catch-all: serve index.html for any unmatched route (SPA client-side routing)
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start listening — bind to all interfaces so the app is reachable in any deployment
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running at http://0.0.0.0:${PORT} [NODE_ENV=${process.env.NODE_ENV || "development"}]`);
  });
}

// Launch the server, with top-level error handling
main().catch((err) => {
  console.error("Failed to start server:", err);
});
