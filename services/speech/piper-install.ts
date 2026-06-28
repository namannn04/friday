/**
 * Auto-installs Piper TTS binary + voice model on first use.
 * Everything is stored under ~/.friday-assistant/piper/ — no sudo needed.
 */
import { execFile } from "child_process";
import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const PIPER_DIR = path.join(os.homedir(), ".friday-assistant", "piper");
export const PIPER_BIN = path.join(PIPER_DIR, "piper");
export const VOICE_DIR = path.join(PIPER_DIR, "voices");
export const VOICE_MODEL = path.join(VOICE_DIR, "en_US-amy-medium.onnx");
export const VOICE_CONFIG = path.join(VOICE_DIR, "en_US-amy-medium.onnx.json");

const PIPER_RELEASE =
  "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz";
const VOICE_BASE =
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium";

export function isPiperInstalled(): boolean {
  return fs.existsSync(PIPER_BIN) && fs.existsSync(VOICE_MODEL) && fs.existsSync(VOICE_CONFIG);
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = (u: string) =>
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlinkSync(dest);
          const loc = res.headers.location;
          if (!loc) { reject(new Error("Redirect with no location")); return; }
          download(loc, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${u}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", (e) => { fs.unlink(dest, () => {}); reject(e); });
    req(url);
  });
}

export async function ensurePiper(
  onProgress?: (msg: string) => void
): Promise<void> {
  if (isPiperInstalled()) return;

  fs.mkdirSync(PIPER_DIR, { recursive: true });
  fs.mkdirSync(VOICE_DIR, { recursive: true });

  // 1. Download and extract the Piper binary
  const tarPath = path.join(os.tmpdir(), "piper.tar.gz");
  onProgress?.("Downloading Piper TTS engine (~26 MB, one-time)…");
  await download(PIPER_RELEASE, tarPath);

  onProgress?.("Extracting Piper…");
  await execFileAsync("tar", ["-xzf", tarPath, "-C", PIPER_DIR, "--strip-components=1"]);
  fs.unlinkSync(tarPath);

  if (!fs.existsSync(PIPER_BIN)) {
    throw new Error("Piper binary not found after extraction.");
  }

  // 2. Download voice model and config
  onProgress?.("Downloading Amy voice model (~61 MB, one-time)…");
  await Promise.all([
    download(`${VOICE_BASE}/en_US-amy-medium.onnx`, VOICE_MODEL),
    download(`${VOICE_BASE}/en_US-amy-medium.onnx.json`, VOICE_CONFIG),
  ]);

  if (!isPiperInstalled()) {
    throw new Error("Piper voice model installation failed.");
  }

  onProgress?.("Piper TTS ready.");
}
