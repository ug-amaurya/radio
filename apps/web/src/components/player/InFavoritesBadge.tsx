import { useFavoritesStore } from "../../stores/favoritesStore";

export function InFavoritesBadge({ trackId }: { trackId: string }) {
  const isFavorite = useFavoritesStore((s) => s.ids.has(trackId));
  if (!isFavorite) return null;
  return (
    <span className="rounded-full bg-lilac px-3 py-0.5 text-xs font-bold text-ink-900">
      ♥ In your favorites
    </span>
  );
}
