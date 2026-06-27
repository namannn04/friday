"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { AppSettings } from "@/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [foldersText, setFoldersText] = useState("");

  useEffect(() => {
    window.electronAPI?.getSettings().then((s) => {
      setSettings(s);
      setFoldersText(s.allowedFolders.join("\n"));
    });
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings || !window.electronAPI) return;

    const updated = await window.electronAPI.updateSettings({
      ...settings,
      allowedFolders: foldersText.split("\n").map((f) => f.trim()).filter(Boolean),
    });
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060d18] text-cyan-100">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060d18] text-cyan-50">
      <header className="border-b border-cyan-500/20 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-xl font-bold">FRIDAY Settings</h1>
          <Link href="/" className="text-sm text-cyan-400 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6 p-6">
        <section className="rounded-xl border border-cyan-500/20 bg-[#0a1628]/80 p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase text-cyan-400">AI Provider</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Provider
              <select
                value={settings.aiProvider}
                onChange={(e) =>
                  setSettings({ ...settings, aiProvider: e.target.value as AppSettings["aiProvider"] })
                }
                className="mt-1 w-full rounded-lg border border-cyan-500/30 bg-black/30 px-3 py-2"
              >
                <option value="ollama">Ollama (local, default)</option>
                <option value="openai">OpenAI (future)</option>
                <option value="groq">Groq (future)</option>
              </select>
            </label>
            <label className="block text-sm">
              Ollama Model
              <input
                value={settings.ollamaModel}
                onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
                className="mt-1 w-full rounded-lg border border-cyan-500/30 bg-black/30 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              Ollama Base URL
              <input
                value={settings.ollamaBaseUrl}
                onChange={(e) => setSettings({ ...settings, ollamaBaseUrl: e.target.value })}
                className="mt-1 w-full rounded-lg border border-cyan-500/30 bg-black/30 px-3 py-2"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-cyan-500/20 bg-[#0a1628]/80 p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase text-cyan-400">Safety & Folders</h2>
          <label className="mb-4 block text-sm">
            Safety Mode
            <select
              value={settings.safetyMode}
              onChange={(e) =>
                setSettings({ ...settings, safetyMode: e.target.value as AppSettings["safetyMode"] })
              }
              className="mt-1 w-full rounded-lg border border-cyan-500/30 bg-black/30 px-3 py-2"
            >
              <option value="strict">Strict (recommended)</option>
              <option value="normal">Normal</option>
            </select>
          </label>
          <label className="block text-sm">
            Allowed Folders (one per line)
            <textarea
              value={foldersText}
              onChange={(e) => setFoldersText(e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-lg border border-cyan-500/30 bg-black/30 px-3 py-2 font-mono text-xs"
            />
          </label>
          <label className="mt-4 block text-sm">
            Custom Workspace Folder
            <input
              value={settings.customWorkspaceFolder || ""}
              onChange={(e) => setSettings({ ...settings, customWorkspaceFolder: e.target.value })}
              className="mt-1 w-full rounded-lg border border-cyan-500/30 bg-black/30 px-3 py-2"
            />
          </label>
        </section>

        <section className="rounded-xl border border-cyan-500/20 bg-[#0a1628]/80 p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase text-cyan-400">Voice</h2>
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.voiceEnabled}
                onChange={(e) => setSettings({ ...settings, voiceEnabled: e.target.checked })}
              />
              Enable voice input
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.conversationMode ?? true}
                onChange={(e) => setSettings({ ...settings, conversationMode: e.target.checked })}
              />
              Conversation mode (human-like chat + auto voice reply)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.voiceAutoSpeak}
                onChange={(e) => setSettings({ ...settings, voiceAutoSpeak: e.target.checked })}
              />
              Auto-speak typed command responses
            </label>
            <label className="block">
              TTS Rate: {settings.ttsRate}
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.ttsRate}
                onChange={(e) => setSettings({ ...settings, ttsRate: parseFloat(e.target.value) })}
                className="mt-2 w-full"
              />
            </label>
          </div>
        </section>

        <button
          type="submit"
          className="rounded-lg bg-cyan-600 px-6 py-3 text-sm font-medium text-white hover:bg-cyan-500"
        >
          Save Settings
        </button>
        {saved && <span className="ml-3 text-sm text-emerald-400">Saved!</span>}
      </form>
    </div>
  );
}
