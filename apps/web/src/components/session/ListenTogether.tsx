import { useState } from "react";
import { sessionClient } from "../../engine/sessionClient";
import { usePlaybackStore } from "../../stores/playbackStore";
import { useSessionStore } from "../../stores/sessionStore";

const button =
  "rounded-xl bg-ink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-500 disabled:cursor-not-allowed disabled:opacity-50";

export function joinLink(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

/** Host controls: start a listening party for whatever is on air and share the link. */
export function ListenTogether() {
  const { role, joinCode, listeners, status, error } = useSessionStore();
  const stationId = usePlaybackStore((s) => s.stationId);
  const [copied, setCopied] = useState(false);

  const hosting = role === "host" && joinCode;

  const copy = async () => {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinLink(joinCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the link is shown on screen to copy by hand */
    }
  };

  return (
    <section aria-label="Listen together" className="rounded-2xl bg-ink-700 p-4 shadow-card">
      <h2 className="text-lg font-bold">Listen together</h2>
      {hosting ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-white/70" role="status">
            {listeners === 1 ? "Just you so far" : `${listeners} listening`}
            {status === "reconnecting" && " - reconnecting..."}
          </p>
          <p className="break-all rounded-lg bg-ink-800 px-3 py-2 font-mono text-sm">{joinLink(joinCode)}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => void copy()}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <button type="button" className={button} onClick={() => sessionClient.leave()}>
              End party
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-white/70">Share your station with friends. Everyone hears the same track at the same moment.</p>
          <button
            type="button"
            className={button}
            disabled={status === "connecting"}
            onClick={() => void sessionClient.host(stationId)}
          >
            {status === "connecting" ? "Starting..." : "Start a listening party"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
