import { useToastStore } from "../../stores/toastStore";

/** Transient notifications above the player bar. Errors use role="alert" so screen readers announce them at once. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-24 z-40 flex flex-col items-center gap-2 md:bottom-28">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink-600 px-4 py-3 text-sm text-white shadow-card"
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white/80 hover:bg-ink-500"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
