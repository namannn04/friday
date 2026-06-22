"use client";

import type { SystemStatus } from "@/types";

interface SystemStatusPanelProps {
  status: SystemStatus | null;
}

export function SystemStatusPanel({ status }: SystemStatusPanelProps) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-[#0a1628]/80 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-400">
        System Status
      </h3>
      {!status ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <ul className="space-y-2 text-sm">
          <StatusRow label="Electron" value={status.electronReady ? "Ready" : "Browser mode"} ok={status.electronReady} />
          <StatusRow label="Ollama" value={status.ollamaOnline ? "Online" : "Offline"} ok={status.ollamaOnline} />
          <StatusRow label="Model" value={status.ollamaModel} ok={status.ollamaOnline} />
          <StatusRow label="Platform" value={status.platform} ok />
          <StatusRow label="Allowed Folders" value={String(status.allowedFolderCount)} ok={status.allowedFolderCount > 0} />
        </ul>
      )}
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={`flex items-center gap-2 ${ok ? "text-emerald-400" : "text-amber-400"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
        {value}
      </span>
    </li>
  );
}
