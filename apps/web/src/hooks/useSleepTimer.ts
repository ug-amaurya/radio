import { useEffect, useState } from "react";
import { radio } from "../engine/radio";
import { useSleepStore } from "../stores/sleepStore";

export const SLEEP_FADE_SEC = 10;

/** Ticks the sleep timer. At expiry the audio fades out over SLEEP_FADE_SEC, pauses, and the timer clears. */
export function useSleepTimer() {
  const endsAt = useSleepStore((s) => s.endsAt);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  useEffect(() => {
    if (endsAt === null) {
      setRemainingSec(null);
      return;
    }
    const tick = () => {
      const left = Math.ceil((endsAt - Date.now()) / 1000);
      if (left <= 0) {
        useSleepStore.getState().cancel();
        void radio.fadeOutAndPause(SLEEP_FADE_SEC);
        return;
      }
      setRemainingSec(left);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);

  return { remainingSec };
}
