"use client";

import type { CommandResponse } from "@/types";

interface CommandHistoryProps {
  history: CommandResponse[];
}

export function CommandHistory({ history }: CommandHistoryProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-cyan-500/20 bg-[#0a1628]/80 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-400">
        Command History
      </h3>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No commands yet. Try typing or speaking a command.</p>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-cyan-500/10 bg-black/20 p-3 text-sm"
            >
              <p className="font-medium text-cyan-100">{item.command}</p>
              <p className="mt-1 text-xs text-slate-400">
                {item.toolName || "—"} · {item.status}
                {item.riskLevel ? ` · ${item.riskLevel}` : ""}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
