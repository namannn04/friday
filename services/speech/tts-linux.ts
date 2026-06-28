import { execFile, spawn } from "child_process";
import fs from "fs";
import { promisify } from "util";
import { PIPER_BIN, PIPER_DIR, VOICE_MODEL, isPiperInstalled } from "./piper-install";

const execFileAsync = promisify(execFile);

function isPiperAvailable(): boolean {
  return isPiperInstalled();
}

function cleanText(text: string): string {
  return text
    .replace(/[\n\r]+/g, ". ")
    .replace(/["\\`$]/g, "")
    .replace(/\*/g, "")
    .replace(/\[.*?\]/g, "")
    .trim()
    .slice(0, 500);
}

/**
 * Speak via Piper TTS (neural, human-sounding voice).
 * Piper outputs raw PCM which we pipe directly to aplay.
 */
async function speakWithPiper(text: string): Promise<boolean> {
  if (!isPiperAvailable()) return false;

  return new Promise((resolve) => {
    const env = {
      ...process.env,
      LD_LIBRARY_PATH: PIPER_DIR,
    };

    let settled = false;
    const done = (ok: boolean) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };

    // Piper writes raw PCM to stdout → aplay plays it
    const piper = spawn(PIPER_BIN, ["--model", VOICE_MODEL, "--output-raw"], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const aplay = spawn("aplay", ["-r", "22050", "-f", "S16_LE", "-c", "1", "-t", "raw", "-"], {
      stdio: ["pipe", "ignore", "ignore"],
    });

    piper.stdout?.pipe(aplay.stdin);

    piper.stdin?.write(text);
    piper.stdin?.end();

    piper.on("error", () => done(false));
    aplay.on("error", () => done(false));

    // Resolve when aplay finishes (speech done)
    aplay.on("close", (code) => done(code === 0));

    // Safety timeout — never block more than 30s
    setTimeout(() => {
      try { piper.kill(); } catch { /* */ }
      try { aplay.kill(); } catch { /* */ }
      done(false);
    }, 30000);
  });
}

/**
 * Fallback: spd-say / espeak when Piper is unavailable.
 */
async function speakWithEspeak(text: string): Promise<boolean> {
  const fallbacks: Array<[string, string[]]> = [
    ["spd-say", ["-w", "-r", "15", "-p", "20", "-y", "en-GB+f3", text]],
    ["spd-say", ["-w", "-r", "15", text]],
    ["espeak-ng", ["-v", "en-us", "-s", "165", "-p", "50", text]],
    ["espeak", ["-v", "en-us", "-s", "165", "-p", "50", text]],
  ];

  for (const [cmd, args] of fallbacks) {
    try {
      await execFileAsync(cmd, args, { timeout: 60000 });
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Main entry point called by the orchestrator on every response.
 * Uses Piper (neural/human voice) and falls back to spd-say/espeak.
 */
export async function speakOnLinux(text: string): Promise<boolean> {
  const clean = cleanText(text);
  if (!clean) return false;

  // Try Piper first (human-sounding neural voice)
  try {
    const ok = await speakWithPiper(clean);
    if (ok) return true;
  } catch {
    // fall through to espeak
  }

  // Fallback to espeak-based engines
  return speakWithEspeak(clean);
}
