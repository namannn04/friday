import { ChildProcess, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { ensureVoskModel } from "./model-download";

/**
 * Vosk speech-to-text runs in a SEPARATE process using the system Node binary.
 *
 * Why: vosk depends on ffi-napi, whose native bindings are compiled against the
 * system Node ABI. Loading them inside Electron's runtime throws
 * "Error in native callback". Running Vosk on the system `node` avoids this.
 */

interface PendingRequest {
  resolve: (value: { text: string; error?: string }) => void;
  timer: NodeJS.Timeout;
}

let worker: ChildProcess | null = null;
let workerReady: Promise<void> | null = null;
let requestCounter = 0;
const pending = new Map<number, PendingRequest>();

function resolveNodeBinary(): string {
  if (process.env.FRIDAY_NODE_PATH && fs.existsSync(process.env.FRIDAY_NODE_PATH)) {
    return process.env.FRIDAY_NODE_PATH;
  }
  const candidates = ["/usr/bin/node", "/usr/local/bin/node", "/opt/homebrew/bin/node"];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "node"; // rely on PATH as a last resort
}

function resolveWorkerPath(): string {
  // After build, the worker is copied next to main.js (dist-electron/).
  const bundled = path.join(__dirname, "vosk-worker.cjs");
  if (fs.existsSync(bundled)) return bundled;

  // Dev fallback: source location.
  const source = path.join(process.cwd(), "services", "speech", "vosk-worker.cjs");
  if (fs.existsSync(source)) return source;

  return bundled;
}

function failAllPending(error: string): void {
  for (const [, req] of pending) {
    clearTimeout(req.timer);
    req.resolve({ text: "", error });
  }
  pending.clear();
}

function killWorker(): void {
  if (worker) {
    try {
      worker.kill();
    } catch {
      // ignore
    }
  }
  worker = null;
  workerReady = null;
}

async function startWorker(onProgress?: (msg: string) => void): Promise<void> {
  const modelPath = await ensureVoskModel(onProgress);
  const nodeBin = resolveNodeBinary();
  const workerPath = resolveWorkerPath();
  const projectRoot = path.join(__dirname, "..");

  onProgress?.("Loading speech model…");

  return new Promise<void>((resolve, reject) => {
    const child = spawn(nodeBin, [workerPath, modelPath], {
      cwd: fs.existsSync(path.join(projectRoot, "node_modules")) ? projectRoot : process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let settled = false;
    let stdoutBuffer = "";

    const startupTimeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        killWorker();
        reject(new Error("Speech worker took too long to start."));
      }
    }, 20000);

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      let idx;
      while ((idx = stdoutBuffer.indexOf("\n")) >= 0) {
        const line = stdoutBuffer.slice(0, idx).trim();
        stdoutBuffer = stdoutBuffer.slice(idx + 1);
        if (!line) continue;

        let msg: { type?: string; id?: number; text?: string; error?: string };
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }

        if (msg.type === "ready") {
          if (!settled) {
            settled = true;
            clearTimeout(startupTimeout);
            worker = child;
            resolve();
          }
        } else if (msg.type === "fatal") {
          if (!settled) {
            settled = true;
            clearTimeout(startupTimeout);
            killWorker();
            reject(new Error(msg.error || "Speech worker failed to start"));
          }
        } else if (msg.type === "result" && typeof msg.id === "number") {
          const req = pending.get(msg.id);
          if (req) {
            pending.delete(msg.id);
            clearTimeout(req.timer);
            req.resolve({ text: msg.text || "", error: msg.error });
          }
        }
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.error("[Vosk worker]", text);
    });

    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(startupTimeout);
        reject(new Error(`Could not start speech worker (${nodeBin}): ${err.message}`));
      }
      killWorker();
      failAllPending("Speech worker crashed. Try again.");
    });

    child.on("exit", () => {
      killWorker();
      failAllPending("Speech worker stopped. Try again.");
    });
  });
}

async function ensureWorker(onProgress?: (msg: string) => void): Promise<void> {
  if (worker && !worker.killed) return;
  if (!workerReady) {
    workerReady = startWorker(onProgress).catch((err) => {
      workerReady = null;
      throw err;
    });
  }
  return workerReady;
}

export async function transcribePcm16(
  pcmBuffer: Buffer,
  sampleRate = 16000,
  onProgress?: (message: string) => void,
  retryCount = 0
): Promise<{ text: string; error?: string }> {
  if (!Buffer.isBuffer(pcmBuffer) || pcmBuffer.length < 3200) {
    return { text: "", error: "Recording too short. Speak for at least 2 seconds." };
  }
  if (pcmBuffer.length % 2 !== 0) {
    return { text: "", error: "Invalid audio format (corrupted buffer)." };
  }

  try {
    await ensureWorker(onProgress);
  } catch (err) {
    return {
      text: "",
      error: err instanceof Error ? err.message : "Could not start speech engine.",
    };
  }

  if (!worker || !worker.stdin) {
    return { text: "", error: "Speech engine not available. Restart the app." };
  }

  onProgress?.("Transcribing…");

  // Write PCM to a temp file; the worker reads and deletes it.
  const tmpFile = path.join(os.tmpdir(), `friday-pcm-${Date.now()}-${Math.random().toString(36).slice(2)}.pcm`);
  try {
    fs.writeFileSync(tmpFile, pcmBuffer);
  } catch (err) {
    return {
      text: "",
      error: `Could not buffer audio: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  const id = ++requestCounter;

  const result = await new Promise<{ text: string; error?: string }>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ text: "", error: "Transcription timed out. Try again." });
    }, 30000);

    pending.set(id, { resolve, timer });

    try {
      worker!.stdin!.write(JSON.stringify({ id, file: tmpFile, sampleRate }) + "\n");
    } catch (err) {
      pending.delete(id);
      clearTimeout(timer);
      resolve({
        text: "",
        error: `Could not reach speech engine: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  });

  // If the worker died mid-request, retry once with a fresh worker.
  if (
    result.error &&
    (result.error.includes("crashed") || result.error.includes("stopped")) &&
    retryCount === 0
  ) {
    killWorker();
    return transcribePcm16(pcmBuffer, sampleRate, onProgress, retryCount + 1);
  }

  if (result.error) {
    return result;
  }

  if (!result.text) {
    return { text: "", error: "No speech detected. Speak louder and closer to the mic." };
  }

  return { text: result.text };
}

export function resetVoskEngine(): void {
  failAllPending("Speech engine reset.");
  killWorker();
}

export function isVoskReady(): boolean {
  return worker !== null && !worker.killed;
}
