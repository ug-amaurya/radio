import { useEffect } from "react";
import { radio } from "../engine/radio";
import { resolveShortcut } from "../lib/shortcuts";
import { usePlaybackStore } from "../stores/playbackStore";

/** Global player keys: Space play/pause, arrows seek and volume, N next track. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      const action = resolveShortcut({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        target: el && { tagName: el.tagName, role: el.getAttribute("role"), isContentEditable: el.isContentEditable },
      });
      const { current, positionSec, durationSec, volume } = usePlaybackStore.getState();
      if (!action || !current) return;

      e.preventDefault(); // stop Space / arrows from also scrolling the page
      switch (action.type) {
        case "toggle":
          void radio.toggle();
          break;
        case "next":
          void radio.next();
          break;
        case "seek":
          radio.seek(Math.min(Math.max(positionSec + action.deltaSec, 0), durationSec || positionSec));
          break;
        case "volume":
          radio.setVolume(Math.min(Math.max(volume + action.delta, 0), 1));
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
