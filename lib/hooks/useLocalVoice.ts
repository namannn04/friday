"use client";

import { useCallback, useRef, useState } from "react";

interface UseLocalVoiceOptions {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  onProgress?: (message: string) => void;
}

export function useLocalVoice({ onResult, onError, onProgress }: UseLocalVoiceOptions) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [supported, setSupported] = useState(
    typeof window !== "undefined" && !!window.electronAPI?.transcribeAudio
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!window.electronAPI?.transcribeAudio) {
      onError?.("Local voice requires the Electron desktop app.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        chunksRef.current = [];

        if (blob.size < 1000) {
          onError?.("Recording too short. Hold the mic button and speak clearly.");
          setTranscribing(false);
          return;
        }

        setTranscribing(true);
        onProgress?.("Processing voice locally...");

        try {
          const buffer = await blob.arrayBuffer();
          const api = window.electronAPI;
          if (!api) {
            onError?.("Electron API not available.");
            return;
          }
          const result = await api.transcribeAudio(buffer);

          if (result.error) {
            onError?.(result.error);
          } else if (result.text) {
            onResult(result.text);
          } else {
            onError?.("No speech detected. Try again.");
          }
        } catch (err) {
          onError?.(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
      setSupported(true);
    } catch (err) {
      stopStream();
      const message = err instanceof Error ? err.message : "Microphone access denied";
      onError?.(
        message.includes("NotAllowed") || message.includes("Permission")
          ? "Microphone permission denied. Allow mic access in system settings."
          : message
      );
    }
  }, [onError, onProgress, onResult, stopStream]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  return {
    listening: recording,
    transcribing,
    supported,
    start,
    stop,
  };
}
