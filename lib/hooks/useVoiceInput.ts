"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceInputOptions {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  onProgress?: (message: string | null) => void;
}

function floatToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1, 1] range first
    const s = Math.max(-1, Math.min(1, samples[i]));
    // Convert to 16-bit signed integer
    out[i] = s < 0 ? Math.floor(s * 0x8000) : Math.floor(s * 0x7fff);
  }
  return out;
}

function resampleTo16k(samples: Float32Array, sourceRate: number): Int16Array {
  const targetRate = 16000;
  if (Math.abs(sourceRate - targetRate) < 100) {
    return floatToInt16(samples);
  }
  const ratio = sourceRate / targetRate;
  const newLength = Math.round(samples.length / ratio);
  const resampled = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    resampled[i] = samples[Math.floor(i * ratio)] ?? 0;
  }
  return floatToInt16(resampled);
}

export function useVoiceInput({ onResult, onError, onProgress }: UseVoiceInputOptions) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [electronVoice, setElectronVoice] = useState(
    () => typeof window !== "undefined" && !!window.electronAPI?.transcribePcm
  );

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const framesRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(48000);
  const isCapturingRef = useRef(false);

  useEffect(() => {
    setElectronVoice(!!window.electronAPI?.transcribePcm);
  }, []);

  const stopStream = useCallback(() => {
    isCapturingRef.current = false;
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioContextRef.current?.state !== "closed") {
      void audioContextRef.current?.close();
    }
    audioContextRef.current = null;
  }, []);

  const transcribePcm = useCallback(
    async (pcm: Int16Array) => {
      const api = window.electronAPI;
      if (!api?.transcribePcm) {
        onError?.("Restart the app: npm run dev — then use the FRIDAY desktop window.");
        return;
      }

      setTranscribing(true);
      onProgress?.("Understanding what you said…");

      try {
        // Send a plain ArrayBuffer over IPC (no Buffer dependency in renderer).
        const arrayBuffer = pcm.buffer.slice(
          pcm.byteOffset,
          pcm.byteOffset + pcm.byteLength
        ) as ArrayBuffer;

        if (arrayBuffer.byteLength < 3200) {
          onError?.("Recording too short. Speak for at least 2 seconds.");
          return;
        }

        console.log(
          `[Voice] Sending ${arrayBuffer.byteLength} bytes (~${(arrayBuffer.byteLength / 32000).toFixed(1)}s) to speech engine`
        );

        // Race between transcription and timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Transcription timed out after 30 seconds")), 30000);
        });

        const result = await Promise.race([
          api.transcribePcm(arrayBuffer),
          timeoutPromise,
        ]);

        if (result.error) {
          console.error("[Voice] Transcription error:", result.error);
          onError?.(result.error);
        } else if (result.text && result.text.trim()) {
          console.log("[Voice] Transcribed:", result.text);
          onResult(result.text.trim());
        } else {
          onError?.("No speech detected. Speak louder and closer to the mic, then try again.");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transcription failed";
        console.error("[Voice] Exception:", message);
        if (message.includes("timeout")) {
          onError?.("Speech recognition is taking too long. Try restarting the app.");
        } else {
          onError?.(message);
        }
      } finally {
        setTranscribing(false);
        onProgress?.(null);
      }
    },
    [onError, onProgress, onResult]
  );

  const stopRecording = useCallback(async () => {
    setRecording(false);
    isCapturingRef.current = false;

    const frames = framesRef.current;
    const rate = sampleRateRef.current;
    framesRef.current = [];

    stopStream();

    if (frames.length === 0) {
      onError?.("No audio captured. Check microphone permissions in system settings and try again.");
      return;
    }

    const total = frames.reduce((sum, f) => sum + f.length, 0);
    
    // Check for silent/empty audio (all values near zero)
    const merged = new Float32Array(total);
    let offset = 0;
    let maxAmplitude = 0;
    for (const frame of frames) {
      merged.set(frame, offset);
      for (let i = 0; i < frame.length; i++) {
        const abs = Math.abs(frame[i]);
        if (abs > maxAmplitude) maxAmplitude = abs;
      }
      offset += frame.length;
    }

    // If audio is too quiet (max amplitude < 0.01), likely no speech
    if (maxAmplitude < 0.01) {
      onError?.("Audio too quiet. Speak louder and closer to your microphone.");
      return;
    }

    const pcm = resampleTo16k(merged, rate);

    // ~0.5s minimum at 16kHz for better accuracy
    if (pcm.length < 8000) {
      onError?.("Recording too short. Speak for at least 2-3 seconds, then click mic again.");
      return;
    }

    await transcribePcm(pcm);
  }, [onError, stopStream, transcribePcm]);

  const startRecording = useCallback(async () => {
    if (recording || transcribing) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.("Microphone not available.");
      return;
    }

    onProgress?.("Starting microphone…");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      framesRef.current = [];

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Required after user click — otherwise mic captures silence
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      sampleRateRef.current = audioContext.sampleRate;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      isCapturingRef.current = true;

      processor.onaudioprocess = (event) => {
        if (!isCapturingRef.current) return;
        framesRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setRecording(true);
      onProgress?.("Speak now… click mic again when finished.");
    } catch (err) {
      stopStream();
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        onError?.("Microphone blocked. Allow mic for FRIDAY in system settings.");
      } else {
        onError?.(err instanceof Error ? err.message : "Could not access microphone.");
      }
      onProgress?.(null);
    }
  }, [onError, onProgress, recording, stopStream, transcribing]);

  const toggle = useCallback(() => {
    if (transcribing) return;
    if (recording) {
      void stopRecording();
    } else {
      void startRecording();
    }
  }, [recording, startRecording, stopRecording, transcribing]);

  return {
    recording,
    transcribing,
    supported: electronVoice,
    electronVoice,
    toggle,
    stopRecording,
  };
}
