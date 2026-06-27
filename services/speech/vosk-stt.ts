import { ensureVoskModel } from "./model-download";

type VoskRecognizer = {
  acceptWaveform: (data: Buffer) => boolean;
  finalResult: () => { text?: string };
  free: () => void;
};

type VoskModule = {
  setLogLevel: (level: number) => void;
  Model: new (path: string) => { free: () => void };
  Recognizer: new (opts: { model: unknown; sampleRate: number }) => VoskRecognizer;
};

let voskModule: VoskModule | null = null;
let cachedModel: InstanceType<VoskModule["Model"]> | null = null;
let cachedModelPath: string | null = null;

function loadVosk(): VoskModule {
  if (!voskModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    voskModule = require("vosk") as VoskModule;
    voskModule.setLogLevel(-1);
  }
  return voskModule;
}

async function getModel(onProgress?: (msg: string) => void) {
  const modelPath = cachedModelPath || (await ensureVoskModel(onProgress));
  cachedModelPath = modelPath;

  if (!cachedModel) {
    onProgress?.("Loading speech model…");
    const vosk = loadVosk();
    cachedModel = new vosk.Model(modelPath);
  }

  return { vosk: loadVosk(), model: cachedModel };
}

export async function transcribePcm16(
  pcmBuffer: Buffer,
  sampleRate = 16000,
  onProgress?: (message: string) => void
): Promise<{ text: string; error?: string }> {
  if (pcmBuffer.length < 3200) {
    return { text: "", error: "Recording too short. Speak for at least 2 seconds." };
  }

  let recognizer: VoskRecognizer | null = null;

  try {
    const { vosk, model } = await getModel(onProgress);
    onProgress?.("Transcribing…");

    recognizer = new vosk.Recognizer({ model, sampleRate });

    const chunkSize = 8000;
    for (let offset = 0; offset < pcmBuffer.length; offset += chunkSize) {
      recognizer.acceptWaveform(pcmBuffer.subarray(offset, offset + chunkSize));
    }

    const result = recognizer.finalResult();
    const text = (result.text || "").trim();

    if (!text) {
      return { text: "", error: "No speech detected. Speak louder and closer to the mic." };
    }

    return { text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    if (message.includes("native callback")) {
      return {
        text: "",
        error: "Speech engine glitch. Try again — speak clearly for 2–3 seconds.",
      };
    }
    return { text: "", error: message };
  } finally {
    try {
      recognizer?.free();
    } catch {
      // ignore cleanup errors
    }
  }
}

export function resetVoskEngine(): void {
  try {
    cachedModel?.free();
  } catch {
    // ignore
  }
  cachedModel = null;
}
