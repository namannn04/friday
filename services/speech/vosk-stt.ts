import decode from "audio-decode";
import { ensureVoskModel } from "./model-download";

let cachedModelPath: string | null = null;

function floatTo16BitPCM(float32Array: Float32Array): Buffer {
  const buffer = Buffer.alloc(float32Array.length * 2);
  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    buffer.writeInt16LE(sample < 0 ? sample * 0x8000 : sample * 0x7fff, i * 2);
  }
  return buffer;
}

function resampleTo16k(sourceData: Float32Array, sourceRate: number): Buffer {
  const targetRate = 16000;
  if (sourceRate === targetRate) {
    return floatTo16BitPCM(sourceData);
  }

  const ratio = sourceRate / targetRate;
  const newLength = Math.round(sourceData.length / ratio);
  const resampled = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    resampled[i] = sourceData[Math.floor(i * ratio)] ?? 0;
  }

  return floatTo16BitPCM(resampled);
}

export async function transcribeAudioBuffer(
  audioBuffer: ArrayBuffer,
  onProgress?: (message: string) => void
): Promise<{ text: string; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vosk = require("vosk") as {
      setLogLevel: (level: number) => void;
      Model: new (path: string) => {
        free: () => void;
      };
      Recognizer: new (opts: { model: unknown; sampleRate: number }) => {
        acceptWaveform: (data: Buffer) => boolean;
        finalResult: () => { text?: string };
        free: () => void;
      };
    };

    const modelPath = cachedModelPath || (await ensureVoskModel(onProgress));
    cachedModelPath = modelPath;

    onProgress?.("Decoding audio...");
    const raw =
      audioBuffer instanceof ArrayBuffer
        ? Buffer.from(audioBuffer)
        : Buffer.from(audioBuffer as Uint8Array);
    const decoded = await decode(raw);
    const channelData =
      "getChannelData" in decoded && typeof decoded.getChannelData === "function"
        ? decoded.getChannelData(0)
        : decoded.channelData[0];
    const sampleRate = decoded.sampleRate;
    const pcm = resampleTo16k(channelData, sampleRate);

    onProgress?.("Transcribing locally...");
    vosk.setLogLevel(-1);
    const model = new vosk.Model(modelPath);
    const recognizer = new vosk.Recognizer({ model, sampleRate: 16000 });

    const chunkSize = 4096;
    for (let offset = 0; offset < pcm.length; offset += chunkSize) {
      recognizer.acceptWaveform(pcm.subarray(offset, offset + chunkSize));
    }

    const result = recognizer.finalResult();
    recognizer.free();
    model.free();

    const text = (result.text || "").trim();
    if (!text) {
      return { text: "", error: "No speech detected. Try speaking louder or closer to the mic." };
    }

    return { text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    return { text: "", error: message };
  }
}

export function isOfflineSpeechAvailable(): boolean {
  return true;
}
