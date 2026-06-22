"use client";

import type { ToolDefinition } from "@/types";

interface ToolsListProps {
  tools: ToolDefinition[];
}

const riskColors: Record<string, string> = {
  low: "text-emerald-400 border-emerald-500/30",
  medium: "text-amber-400 border-amber-500/30",
  high: "text-red-400 border-red-500/30",
};

export function ToolsList({ tools }: ToolsListProps) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-[#0a1628]/80 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-400">
        Available Tools
      </h3>
      <div className="space-y-2">
        {tools.map((tool) => (
          <div
            key={tool.name}
            className={`rounded-lg border bg-black/20 p-2 ${riskColors[tool.riskLevel]}`}
          >
            <p className="text-xs font-semibold">{tool.name}</p>
            <p className="text-[11px] text-slate-400">{tool.description}</p>
            <p className="mt-1 text-[10px] uppercase">
              {tool.riskLevel} · {tool.requiresConfirmation ? "confirm" : "auto"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
