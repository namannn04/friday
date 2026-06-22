"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceInputOptions {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  onProgress?: (message: string | null) => void;
}

function pickRecorderMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function useVoiceInput({ onResult, onError, onProgress }: UseVoiceInputOptions) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [electronVoice, setElectronVoice] = useState(
    () => typeof window !== "undefined" && !!window.electronAPI?.transcribeAudio
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");

  useEffect(() => {
    setElectronVoice(!!window.electronAPI?.transcribeAudio);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      const api = window.electronAPI;
      if (!api?.transcribeAudio) {
        onError?.("Voice requires the FRIDAY desktop app (Electron).");
        return;
      }

      if (blob.size < 500) {
        onError?.("Recording too short. Click mic, speak 2–3 seconds, then click mic again.");
        return;
      }

      setTranscribing(true);
      onProgress?.("Processing voice locally (first time may download ~40MB model)...");

      try {
        const buffer = await blob.arrayBuffer();
        const result = await api.transcribeAudio(buffer);

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

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.requestData();
      } catch {
        // ignore if not supported
      }
      recorder.stop();
    }
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (recording || transcribing) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.("Microphone API not available in this environment.");
      return;
    }

    onProgress?.("Requesting microphone access...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickRecorderMimeType();
      mimeTypeRef.current = mimeType || "audio/webm";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopStream();
        setRecording(false);
        onError?.("Recording failed. Check microphone permissions.");
      };

      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        await transcribeBlob(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      onProgress?.("Recording… click mic again when done speaking.");
    } catch (err) {
      stopStream();
      setRecording(false);
      const name = err instanceof Error ? err.name : "";
      const message = err instanceof Error ? err.message : "Microphone access denied";

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        onError?.("Microphone blocked. Allow mic access for FRIDAY in system settings.");
      } else if (name === "NotFoundError") {
        onError?.("No microphone found. Connect a mic and try again.");
      } else {
        onError?.(message);
      }
      onProgress?.(null);
    }
  }, [onError, onProgress, recording, stopStream, transcribeBlob, transcribing]);

  const toggle = useCallback(() => {
    if (transcribing) return;
    if (recording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [recording, startRecording, stopRecording, transcribing]);

  return {
    recording,
    transcribing,
    supported: electronVoice || !!navigator.mediaDevices?.getUserMedia,
    electronVoice,
    toggle,
    stopRecording,
  };
}
