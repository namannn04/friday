"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { CommandHistory } from "@/components/CommandHistory";
import { LogsViewer } from "@/components/LogsViewer";
import { ResponsePanel } from "@/components/ResponsePanel";
import { SystemStatusPanel } from "@/components/SystemStatus";
import { ToolsList } from "@/components/ToolsList";
import { VoiceButton } from "@/components/VoiceButton";
import { useElectron } from "@/lib/hooks/useElectron";
import { useVoiceInput } from "@/lib/hooks/useVoiceInput";
import { speakResponse } from "@/lib/speech/tts-client";
import type { ActionLogEntry, AppSettings, CommandResponse, SystemStatus, ToolDefinition } from "@/types";

export function Dashboard() {
  const { isElectron, getSettings, getSystemStatus, getTools } = useElectron();
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CommandResponse | null>(null);
  const [history, setHistory] = useState<CommandResponse[]>([]);
  const [logs, setLogs] = useState<ActionLogEntry[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [voiceDraft, setVoiceDraft] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [confirmPreview, setConfirmPreview] = useState<string | undefined>();
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmTool, setConfirmTool] = useState<string | undefined>();
  const [confirmRisk, setConfirmRisk] = useState<string | undefined>();
  const [existingFile, setExistingFile] = useState(false);
  const [lastCommand, setLastCommand] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const settingsRef = useRef<AppSettings | null>(null);
  settingsRef.current = settings;

  const sayAloud = useCallback(async (text: string) => {
    const s = settingsRef.current;
    if (!text || s?.voiceEnabled === false) return;
    setIsSpeaking(true);
    try {
      await speakResponse(text, s);
    } finally {
      setTimeout(() => setIsSpeaking(false), 500);
    }
  }, []);

  const refreshMeta = useCallback(async () => {
    const [s, t, l] = await Promise.all([
      getSystemStatus(),
      getTools(),
      window.electronAPI?.getLogs() ?? Promise.resolve([]),
    ]);
    setStatus(s);
    setTools(t);
    setLogs(l);
    const cfg = await getSettings();
    setSettings(cfg);
  }, [getSettings, getSystemStatus, getTools]);

  useEffect(() => {
    refreshMeta();
    const interval = setInterval(refreshMeta, 15000);
    return () => clearInterval(interval);
  }, [refreshMeta]);

  const handleResponse = useCallback(
    (res: CommandResponse, cmd: string) => {
      setResponse(res);
      setHistory((prev) => [res, ...prev].slice(0, 50));
      refreshMeta();

      if (res.status === "pending_confirmation" && res.pendingActionId) {
        setPendingActionId(res.pendingActionId);
        setConfirmPreview(res.preview);
        setConfirmTitle(res.finalMessage);
        setConfirmTool(res.toolName);
        setConfirmRisk(res.riskLevel);
        setExistingFile(res.finalMessage.includes("already exists"));
        setLastCommand(cmd);
        setConfirmOpen(true);
      }

      const toSpeak = res.speakMessage || res.finalMessage;
      if (res.voiceSpoken) {
        setIsSpeaking(true);
        setTimeout(() => setIsSpeaking(false), 3000);
      } else if (toSpeak && res.status !== "clarification") {
        void sayAloud(toSpeak);
      }
    },
    [refreshMeta, sayAloud]
  );

  const runCommand = useCallback(
    async (
      text: string,
      options?: {
        confirmed?: boolean;
        pendingActionId?: string;
        writeMode?: "append" | "rename" | "cancel";
        newFileName?: string;
        fromVoice?: boolean;
      }
    ) => {
      if (!window.electronAPI) {
        setResponse({
          id: "browser",
          command: text,
          finalMessage: "Run the desktop app with `npm run dev` to use FRIDAY with Electron and local tools.",
          requiresConfirmation: false,
          status: "error",
        });
        return;
      }

      setLoading(true);
      try {
        const res = await window.electronAPI.processCommand({
          command: text,
          confirmed: options?.confirmed,
          pendingActionId: options?.pendingActionId,
          writeMode: options?.writeMode,
          newFileName: options?.newFileName,
          fromVoice: options?.fromVoice,
        });
        handleResponse(res, text);
      } finally {
        setLoading(false);
      }
    },
    [handleResponse]
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = command.trim();
    if (!text) return;
    setLastCommand(text);
    await runCommand(text);
    setCommand("");
  };

  const [voiceProgress, setVoiceProgress] = useState<string | null>(null);

  const handleVoiceResult = useCallback(
    async (text: string) => {
      setCommand(text);
      setVoiceProgress(null);
      setVoiceDraft(null);
      setLastCommand(text);
      await runCommand(text, { fromVoice: true });
      setCommand("");
    },
    [runCommand]
  );

  const handleVoiceError = useCallback(
    (err: string) => {
      setVoiceProgress(null);
      setResponse({
        id: "voice-error",
        command: "",
        finalMessage: `Voice error: ${err}`,
        requiresConfirmation: false,
        status: "error",
        error: err,
      });
      void sayAloud("Sorry, I couldn't hear that. Please try again.");
    },
    [sayAloud]
  );

  const voice = useVoiceInput({
    onResult: handleVoiceResult,
    onError: handleVoiceError,
    onProgress: setVoiceProgress,
  });

  const showElectronHelp = useCallback(() => {
    setResponse({
      id: "electron-help",
      command: "",
      finalMessage:
        "Voice & file tools work only in the FRIDAY desktop window (Electron), not in Chrome.\n\n" +
        "1. Run: npm run dev\n" +
        "2. Use the separate \"FRIDAY Assistant\" app window (check your taskbar)\n" +
        "3. Do NOT open localhost:3000 in Chrome\n\n" +
        "In the desktop app: click mic → speak → click mic again → Approve → Execute.",
      requiresConfirmation: false,
      status: "clarification",
    });
  }, []);

  const approveVoiceDraft = async () => {
    if (!voiceDraft) return;
    setLastCommand(voiceDraft);
    await runCommand(voiceDraft);
    setVoiceDraft(null);
  };

  return (
    <div className="min-h-screen bg-[#060d18] text-cyan-50">
      <header className="border-b border-cyan-500/20 bg-[#0a1628]/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-500">Local Desktop Assistant</p>
            <h1 className="text-2xl font-bold text-cyan-100">
              FRIDAY <span className="text-cyan-500/60">// Jarvis-inspired MVP</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {!isElectron && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
                <strong>Browser mode</strong> — Mic, files & AI tools need the{" "}
                <strong>FRIDAY Assistant</strong> desktop window. Run{" "}
                <code className="rounded bg-black/30 px-1">npm run dev</code> and use that window,
                not Chrome.
              </div>
            )}
            <Link
              href="/settings"
              className="rounded-lg border border-cyan-500/30 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10"
            >
              Settings
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <div className="rounded-xl border border-cyan-500/20 bg-[#0a1628]/80 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <VoiceButton
                recording={voice.recording}
                transcribing={voice.transcribing}
                electronReady={isElectron && voice.electronVoice}
                onToggle={voice.toggle}
                onNeedElectron={showElectronHelp}
              />
              <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder='Try: "List all PDF files in my Downloads" or "Search Google for Groq API"'
                className="flex-1 rounded-lg border border-cyan-500/30 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !command.trim()}
                className="rounded-lg bg-cyan-600 px-6 py-3 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                Execute
              </button>
              </form>
            </div>

            {voiceProgress && (
              <p className="mt-2 text-xs text-cyan-400">{voiceProgress}</p>
            )}

            {voice.recording && (
              <p className="mt-2 text-xs text-amber-300">
                ● Listening… speak naturally, then click mic again.
              </p>
            )}

            {voice.transcribing && (
              <p className="mt-2 text-xs text-cyan-300">Thinking…</p>
            )}

            {isSpeaking && (
              <p className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                FRIDAY is speaking…
              </p>
            )}

            {isElectron && (
              <p className="mt-2 text-xs text-slate-500">
                Mic: click → speak → click again. Typed or spoken — FRIDAY replies in voice.
              </p>
            )}

            {voiceDraft && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-black/20 p-3 text-sm">
                <span className="text-slate-400">Voice:</span>
                <span className="flex-1 text-cyan-100">{voiceDraft}</span>
                <button onClick={approveVoiceDraft} className="text-emerald-400 hover:underline">
                  Approve
                </button>
                <button onClick={() => setVoiceDraft(null)} className="text-red-300 hover:underline">
                  Discard
                </button>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              {[
                "Check whether resume.pdf exists in Downloads",
                "Open my latest screenshot",
                "Create a file called ideas.md in Documents",
                "Open VS Code",
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setCommand(example)}
                  className="rounded-full border border-cyan-500/10 px-3 py-1 hover:border-cyan-500/30 hover:text-cyan-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="grid min-h-[320px] gap-4 md:grid-cols-2">
            <ResponsePanel response={response} loading={loading} />
            <CommandHistory history={history} />
          </div>

          <LogsViewer
            logs={logs}
            onClear={async () => {
              await window.electronAPI?.clearLogs();
              refreshMeta();
            }}
          />
        </section>

        <aside className="space-y-4">
          <SystemStatusPanel status={status} />
          <ToolsList tools={tools} />
          <div className="rounded-xl border border-cyan-500/20 bg-[#0a1628]/80 p-4 text-xs text-slate-400">
            <p className="mb-2 font-semibold text-cyan-400">Safety Rules (v1)</p>
            <ul className="list-inside list-disc space-y-1">
              <li>No shell commands from AI</li>
              <li>No file deletion</li>
              <li>Allowed folders only</li>
              <li>Confirmation for medium-risk actions</li>
              <li>High-risk actions blocked</li>
            </ul>
          </div>
        </aside>
      </main>

      <ConfirmationModal
        open={confirmOpen}
        title={confirmTitle}
        preview={confirmPreview}
        toolName={confirmTool}
        riskLevel={confirmRisk}
        existingFile={existingFile}
        onConfirm={async () => {
          setConfirmOpen(false);
          if (pendingActionId) {
            await runCommand(lastCommand, { confirmed: true, pendingActionId });
          }
        }}
        onAppend={async () => {
          setConfirmOpen(false);
          if (pendingActionId) {
            await runCommand(lastCommand, { confirmed: true, pendingActionId, writeMode: "append" });
          }
        }}
        onRename={async (newName) => {
          setConfirmOpen(false);
          if (pendingActionId) {
            await runCommand(lastCommand, {
              confirmed: true,
              pendingActionId,
              writeMode: "rename",
              newFileName: newName,
            });
          }
        }}
        onCancel={async () => {
          setConfirmOpen(false);
          if (pendingActionId) {
            await runCommand(lastCommand, { confirmed: true, pendingActionId, writeMode: "cancel" });
          }
        }}
      />
    </div>
  );
}
