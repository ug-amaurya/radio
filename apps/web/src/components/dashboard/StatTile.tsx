export function StatTile({ value, label, highlight = false }: { value: string | number; label: string; highlight?: boolean }) {
  return (
    <div
      className={`flex min-w-0 flex-col justify-center rounded-2xl px-4 py-4 text-center ${
        highlight ? "bg-lilac text-ink-900" : "bg-ink-700 text-white"
      }`}
    >
      <p className={`truncate text-2xl font-bold ${highlight ? "" : "text-lilac"}`}>{value}</p>
      <p className={`truncate text-sm ${highlight ? "text-ink-900/80" : "text-white/80"}`}>{label}</p>
    </div>
  );
}
