import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function speakOnLinux(text: string): Promise<boolean> {
  const clean = text
    .replace(/[\n\r]+/g, ". ")
    .replace(/["\\`$]/g, "")
    .trim()
    .slice(0, 450);

  if (!clean) return false;

  const commands: Array<[string, string[]]> = [
    ["spd-say", ["-w", clean]], // -w = wait until speech finishes
    ["espeak-ng", ["-s", "150", clean]],
    ["espeak", ["-s", "150", clean]],
  ];

  for (const [cmd, args] of commands) {
    try {
      await execFileAsync(cmd, args, { timeout: 60000 });
      return true;
    } catch {
      continue;
    }
  }

  return false;
}
