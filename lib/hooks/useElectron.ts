"use client";

import { useCallback, useEffect, useState } from "react";
import { initSpeech, speakResponse, stopSpeaking } from "@/lib/speech/tts-client";
import type { AppSettings, SystemStatus, ToolDefinition } from "@/types";

export { speakResponse, stopSpeaking, initSpeech };

export function useElectron() {
  const [ready, setReady] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!window.electronAPI);
    initSpeech();
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
      conversationMode: true,
      ttsRate: 0.92,
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
