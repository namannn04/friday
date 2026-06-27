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
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
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
        const buffer = new Uint8Array(pcm).buffer;
        const result = await api.transcribePcm(buffer);

        if (result.error) {
          onError?.(result.error);
        } else if (result.text) {
          onResult(result.text);
        } else {
          onError?.("No speech detected. Speak louder and try again.");
        }
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Transcription failed");
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
      onError?.("No audio captured. Allow microphone access and try again.");
      return;
    }

    const total = frames.reduce((sum, f) => sum + f.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const frame of frames) {
      merged.set(frame, offset);
      offset += frame.length;
    }

    const pcm = resampleTo16k(merged, rate);

    // ~0.4s minimum at 16kHz
    if (pcm.length < 6400) {
      onError?.("Too short. Click mic, speak clearly for 2 seconds, click mic again.");
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
