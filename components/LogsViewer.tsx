"use client";

import type { ActionLogEntry } from "@/types";

interface LogsViewerProps {
  logs: ActionLogEntry[];
  onClear: () => void;
}

export function LogsViewer({ logs, onClear }: LogsViewerProps) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-[#0a1628]/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Action Logs</h3>
        <button
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-cyan-300"
        >
          Clear
        </button>
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto text-xs">
        {logs.length === 0 ? (
          <p className="text-slate-500">No actions logged yet.</p>
        ) : (
          logs.slice(0, 30).map((log) => (
            <div key={log.id} className="rounded border border-cyan-500/10 bg-black/20 p-2">
              <div className="flex justify-between text-slate-500">
                <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={log.result === "success" ? "text-emerald-400" : log.result === "blocked" ? "text-red-400" : "text-amber-400"}>
                  {log.result}
                </span>
              </div>
              <p className="text-cyan-100">{log.command}</p>
              {log.tool && <p className="text-slate-400">{log.tool}{log.path ? ` · ${log.path}` : ""}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
