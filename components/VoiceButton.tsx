"use client";

interface VoiceButtonProps {
  recording: boolean;
  transcribing?: boolean;
  electronReady: boolean;
  onToggle: () => void;
  onNeedElectron?: () => void;
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
    </svg>
  );
}

export function VoiceButton({
  recording,
  transcribing = false,
  electronReady,
  onToggle,
  onNeedElectron,
}: VoiceButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!electronReady) {
      onNeedElectron?.();
      return;
    }

    if (!transcribing) onToggle();
  };

  if (!electronReady) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-2 border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
        title="Voice works in the FRIDAY desktop app — not in Chrome/browser"
      >
        <MicIcon />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={transcribing}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
        recording
          ? "border-red-400 bg-red-500/20 text-red-200 shadow-lg shadow-red-500/30 animate-pulse"
          : transcribing
            ? "border-amber-400 bg-amber-500/20 text-amber-200 animate-pulse cursor-wait"
            : "border-cyan-400/60 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/20"
      }`}
      title={
        transcribing
          ? "Transcribing locally…"
          : recording
            ? "Stop recording"
            : "Start voice command (offline)"
      }
      aria-label={recording ? "Stop recording" : "Start voice command"}
    >
      <MicIcon />
    </button>
  );
}
