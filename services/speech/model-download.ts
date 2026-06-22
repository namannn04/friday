import { execFile } from "child_process";
import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const MODEL_NAME = "vosk-model-small-en-us-0.15";
const MODEL_URL = `https://alphacephei.com/vosk/models/${MODEL_NAME}.zip`;
const MODELS_DIR = path.join(os.homedir(), ".friday-assistant", "models");

export function getModelPath(): string {
  return path.join(MODELS_DIR, MODEL_NAME);
}

export function isModelInstalled(): boolean {
  const modelPath = getModelPath();
  return fs.existsSync(path.join(modelPath, "am", "final.mdl"));
}

export async function ensureVoskModel(
  onProgress?: (message: string) => void
): Promise<string> {
  if (isModelInstalled()) {
    return getModelPath();
  }

  onProgress?.("Downloading offline speech model (~40MB, one-time)...");
  fs.mkdirSync(MODELS_DIR, { recursive: true });

  const zipPath = path.join(MODELS_DIR, `${MODEL_NAME}.zip`);

  await downloadFile(MODEL_URL, zipPath);
  onProgress?.("Extracting speech model...");

  try {
    await execFileAsync("unzip", ["-o", zipPath, "-d", MODELS_DIR]);
  } catch {
    await execFileAsync("tar", ["-xf", zipPath, "-C", MODELS_DIR]).catch(() => {
      throw new Error(
        "Could not extract Vosk model. Install unzip: sudo apt install unzip"
      );
    });
  }

  fs.unlinkSync(zipPath);

  if (!isModelInstalled()) {
    throw new Error("Vosk model download failed. Please try again.");
  }

  return getModelPath();
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirect = response.headers.location;
          if (!redirect) {
            reject(new Error("Redirect without location"));
            return;
          }
          file.close();
          fs.unlinkSync(dest);
          downloadFile(redirect, dest).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}
