"use client";

import type { AppSettings } from "@/types";
import { prepareTextForSpeech } from "@/lib/speech/text-for-speech";

export { prepareTextForSpeech };

let voicesReady = false;

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) voicesReady = true;
  return voices;
}

export function initSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    voicesReady = true;
    loadVoices();
  };
}

function speakBrowser(text: string, rate: number): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = loadVoices();
  const preferred =
    voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    voices[0];
  if (preferred) utterance.voice = preferred;
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

/** Fallback TTS in renderer (browser mode). Electron speaks via main process. */
export async function speakResponse(
  text: string,
  settings?: Pick<AppSettings, "ttsRate" | "voiceEnabled"> | null
): Promise<void> {
  if (settings?.voiceEnabled === false) return;

  const prepared = prepareTextForSpeech(text);
  if (!prepared) return;

  const rate = settings?.ttsRate ?? 0.92;

  if (window.electronAPI?.speak) {
    try {
      const ok = await window.electronAPI.speak(prepared);
      if (ok) return;
    } catch {
      // fall through
    }
  }

  speakBrowser(prepared, rate);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
