import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Configuration for more natural TTS voice */
const TTS_CONFIG = {
  rate: 15, // slightly faster than default (0) for natural pace
  pitch: 20, // slightly higher pitch for friendlier tone
  volume: 0, // default volume
  voice: "en-GB+f3", // British English female voice, more natural than default
};

export async function speakOnLinux(text: string): Promise<boolean> {
  const clean = text
    .replace(/[\n\r]+/g, ". ")
    .replace(/["\\`$]/g, "")
    .replace(/\*/g, "")
    .trim()
    .slice(0, 450);

  if (!clean) return false;

  // Primary: spd-say with optimized settings for more natural voice
  const spdSayArgs = [
    "-w", // wait until speech finishes
    "-r", TTS_CONFIG.rate.toString(), // speech rate
    "-p", TTS_CONFIG.pitch.toString(), // pitch
    "-i", TTS_CONFIG.volume.toString(), // volume
    "-y", TTS_CONFIG.voice, // synthesis voice
    clean,
  ];

  // Fallback commands with improved settings
  const commands: Array<[string, string[]]> = [
    ["spd-say", spdSayArgs],
    ["spd-say", ["-w", "-r", "15", clean]], // fallback without voice selection
    ["espeak-ng", ["-v", "en-us", "-s", "165", "-p", "50", clean]], // natural speed and pitch
    ["espeak", ["-v", "en-us", "-s", "165", "-p", "50", clean]],
    ["festival", ["--tts"]], // festival reads from stdin
  ];

  for (const [cmd, args] of commands) {
    try {
      if (cmd === "festival") {
        await execFileAsync(cmd, args, { timeout: 60000, input: clean });
      } else {
        await execFileAsync(cmd, args, { timeout: 60000 });
      }
      return true;
    } catch {
      continue;
    }
  }

  return false;
}
