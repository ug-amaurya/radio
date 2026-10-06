import { useSleepTimer } from "../../hooks/useSleepTimer";
import { useSleepStore } from "../../stores/sleepStore";

const PRESETS = [15, 30, 60];
const EXTEND_MIN = 15;

function format(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const buttonClass =
  "min-h-11 rounded-xl bg-ink-600 px-4 py-2 text-sm text-white transition hover:bg-ink-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lilac";

export function SleepTimerMenu() {
  const { remainingSec } = useSleepTimer();
  const { start, extend, cancel } = useSleepStore();

  if (remainingSec !== null) {
    return (
      <div className="flex flex-wrap items-center justify-start gap-2" role="group" aria-label="Sleep timer">
        <span className="text-sm text-white/80">
          Sleep in <span className="font-mono">{format(remainingSec)}</span>
        </span>
        <button type="button" className={buttonClass} onClick={() => extend(EXTEND_MIN)}>
          +{EXTEND_MIN} min
        </button>
        <button type="button" className={buttonClass} onClick={cancel}>
          Cancel timer
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-start gap-2" role="group" aria-label="Sleep timer">
      <span className="text-sm text-white/60">Sleep timer</span>
      {PRESETS.map((minutes) => (
        <button key={minutes} type="button" className={buttonClass} onClick={() => start(minutes)}>
          {minutes} min
        </button>
      ))}
    </div>
  );
}
