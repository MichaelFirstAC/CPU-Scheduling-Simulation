import express from "express";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";

import { TSScheduler, ProcessInput } from "./src/utils/scheduler_engine.ts";

const app = express();
const PORT = 3000;

app.use(express.json());



// REST Backend API Router

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", python_available: true });
});

// Added route to fetch core python script content dynamically
app.get("/api/get-python-code", async (req, res) => {
  try {
    const pythonScriptPath = path.join(process.cwd(), "src", "python", "cpu_scheduler.py");
    const code = await fs.readFile(pythonScriptPath, "utf-8");
    res.json({ success: true, code });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to read python code: ${err.message}` });
  }
});

// 2. Run simulation via Python executable (with TypeScript fallback)
app.post("/api/simulate-python", async (req, res) => {
  const { processes, quantum, lower_is_higher } = req.body;

  if (!Array.isArray(processes) || processes.length === 0) {
    return res.status(400).json({ error: "Invalid or empty processes list" });
  }

  // Double check inputs are normalized
  const normalizedProcesses: ProcessInput[] = processes.map((p: any) => ({
    pid: String(p.pid || p.id),
    arrival_time: Number(p.arrival_time ?? p.arrivalTime ?? 0),
    burst_time: Number(p.burst_time ?? p.burstTime ?? 1),
    priority: Number(p.priority ?? 0),
    queue_id: Number(p.queue_id ?? p.queueId ?? 0),
  }));

  const quantumVal = Number(quantum || 2);
  const lowerIsHigherVal = lower_is_higher !== false;

  // Let's attempt to run the Python Scheduler
  try {
    const pythonScriptPath = path.join(process.cwd(), "src", "python", "cpu_scheduler.py");
    const pyProcess = spawn("python3", [pythonScriptPath, "--json"]);

    let outputData = "";
    let errorData = "";

    pyProcess.stdin.write(
      JSON.stringify({
        processes: normalizedProcesses,
        quantum: quantumVal,
        lower_is_higher: lowerIsHigherVal,
      })
    );
    pyProcess.stdin.end();

    pyProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });

    pyProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    pyProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const parsedResult = JSON.parse(outputData.trim());
          return res.json({
            success: true,
            source: "python",
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
        // Python process exited with non-zero. Fallback to TypeScript scheduler
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
    // Spawning Python failed completely (e.g. python3 not installed in container)
    // Seamlessly fallback to the TypeScript engine of identical algorithms
    const tsResults = TSScheduler.runAll(normalizedProcesses, quantumVal, lowerIsHigherVal);
    return res.json({
      success: true,
      source: "typescript_fallback_no_env",
      error: `Python is unavailable or failed to execute: ${err.message}. Seamlessly fell back to matching TS simulation engine.`,
      results: tsResults,
    });
  }
});


// Serve frontend with Vite middleware in development or express static in production
async function main() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running at http://0.0.0.0:${PORT} [NODE_ENV=${process.env.NODE_ENV || "development"}]`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
});
