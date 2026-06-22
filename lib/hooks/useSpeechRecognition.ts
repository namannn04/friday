"use client";

import { useEffect, useRef, useState } from "react";

interface SpeechRecognitionResultEvent {
  results: { isFinal: boolean; [index: number]: { transcript: string } }[];
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface UseSpeechRecognitionOptions {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition({ onResult, onError }: UseSpeechRecognitionOptions) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? (window as Window & { webkitSpeechRecognition?: new () => BrowserSpeechRecognition }).SpeechRecognition ||
          (window as Window & { webkitSpeechRecognition?: new () => BrowserSpeechRecognition }).webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }

    setSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || "")
        .join("");
      if (event.results[event.results.length - 1]?.isFinal) {
        onResult(transcript.trim());
        setListening(false);
      }
    };

    recognition.onerror = (event) => {
      onError?.(event.error);
      setListening(false);
    };

    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, [onResult, onError]);

  const start = () => {
    if (!recognitionRef.current) return;
    setListening(true);
    recognitionRef.current.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return { listening, supported, start, stop };
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}
