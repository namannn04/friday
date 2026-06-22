"use client";

import type { CommandResponse } from "@/types";

interface ResponsePanelProps {
  response: CommandResponse | null;
  loading: boolean;
}

export function ResponsePanel({ response, loading }: ResponsePanelProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-cyan-500/20 bg-[#0a1628]/80 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-400">
        Assistant Response
      </h3>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-cyan-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          Processing command...
        </div>
      )}

      {!loading && !response && (
        <p className="text-sm text-slate-500">
          FRIDAY is ready. Ask a question, search files, or run a safe local action.
        </p>
      )}

      {response && !loading && (
        <div className="space-y-3 overflow-y-auto text-sm">
          {response.interpretation && (
            <div>
              <p className="text-xs uppercase text-slate-500">Interpretation</p>
              <p className="text-cyan-100">{response.interpretation}</p>
            </div>
          )}

          {response.toolName && (
            <div>
              <p className="text-xs uppercase text-slate-500">Selected Tool</p>
              <p className="text-cyan-200">
                {response.toolName}
                {response.requiresConfirmation && " (confirmation required)"}
              </p>
            </div>
          )}

          {response.fromWebSearch && (
            <p className="rounded bg-blue-500/10 px-2 py-1 text-xs text-blue-300">
              Result from web search
            </p>
          )}

          <div>
            <p className="text-xs uppercase text-slate-500">Result</p>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-cyan-50/90">
              {response.finalMessage}
            </pre>
          </div>

          {response.error && response.status === "error" && (
            <p className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-300">{response.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
