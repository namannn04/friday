"use client";

import { useState } from "react";

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  preview?: string;
  riskLevel?: string;
  toolName?: string;
  existingFile?: boolean;
  onConfirm: () => void;
  onAppend?: () => void;
  onRename?: (newName: string) => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  open,
  title,
  preview,
  riskLevel,
  toolName,
  existingFile,
  onConfirm,
  onAppend,
  onRename,
  onCancel,
}: ConfirmationModalProps) {
  const [newName, setNewName] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-cyan-500/30 bg-[#0d1b2a] p-6 shadow-2xl shadow-cyan-500/10">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <h2 className="text-lg font-semibold text-cyan-100">Safety Confirmation Required</h2>
        </div>

        <p className="mb-2 text-sm text-cyan-50">{title}</p>

        {toolName && (
          <p className="mb-2 text-xs uppercase tracking-wider text-cyan-400/80">
            Tool: {toolName} · Risk: {riskLevel || "medium"}
          </p>
        )}

        {preview && (
          <pre className="mb-4 max-h-48 overflow-auto rounded-lg border border-cyan-500/20 bg-black/40 p-3 text-xs text-cyan-100/90 whitespace-pre-wrap">
            {preview}
          </pre>
        )}

        {existingFile ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-300">File already exists. Choose an action:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onAppend}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-500"
              >
                Append
              </button>
              <div className="flex flex-1 gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="new-filename.md"
                  className="flex-1 rounded-lg border border-cyan-500/30 bg-black/30 px-3 py-2 text-sm text-white"
                />
                <button
                  onClick={() => newName && onRename?.(newName)}
                  className="rounded-lg bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-500"
                >
                  Rename
                </button>
              </div>
              <button
                onClick={onCancel}
                className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            >
              Confirm & Execute
            </button>
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
