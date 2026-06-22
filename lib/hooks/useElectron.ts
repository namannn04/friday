"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppSettings, SystemStatus, ToolDefinition } from "@/types";

export function useElectron() {
  const [ready, setReady] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!window.electronAPI);
    setReady(true);
  }, []);

  const getSettings = useCallback(async (): Promise<AppSettings> => {
    if (window.electronAPI) return window.electronAPI.getSettings();
    return {
      aiProvider: "ollama",
      ollamaBaseUrl: "http://127.0.0.1:11434",
      ollamaModel: "llama3.2",
      allowedFolders: [],
      safetyMode: "strict",
      voiceEnabled: true,
      voiceAutoSpeak: true,
      ttsRate: 1,
    };
  }, []);

  const getSystemStatus = useCallback(async (): Promise<SystemStatus> => {
    if (window.electronAPI) return window.electronAPI.getSystemStatus();
    return {
      ollamaOnline: false,
      ollamaModel: "llama3.2",
      platform: "browser",
      allowedFolderCount: 0,
      electronReady: false,
    };
  }, []);

  const getTools = useCallback(async (): Promise<ToolDefinition[]> => {
    if (window.electronAPI) return window.electronAPI.getTools();
    return [];
  }, []);

  return { ready, isElectron, getSettings, getSystemStatus, getTools };
}

export function speakText(text: string, rate = 1): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
