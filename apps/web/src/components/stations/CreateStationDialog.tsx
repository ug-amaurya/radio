import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CreateStationRequest, PlaylistSummary, Station } from "@audius-radio/shared-types";
import { api } from "../../lib/api";
import { GENRES, MOODS } from "../../lib/genres";
import { isPresetName } from "../../lib/stations";

type Source = "trending" | "search" | "playlist" | "favorites";

const SOURCES: { id: Source; label: string; hint: string; needsAccount?: boolean }[] = [
  { id: "trending", label: "Genre", hint: "Trending tracks, optionally in one genre" },
  { id: "search", label: "Search", hint: "Tracks matching a keyword or artist" },
  { id: "playlist", label: "Playlists", hint: "Mix of your Audius playlists", needsAccount: true },
  { id: "favorites", label: "Favorites", hint: "Tracks you've favorited on Audius", needsAccount: true },
];

const field = "w-full rounded-xl bg-ink-800 px-3 py-2.5 text-sm text-white placeholder:text-white/40";
const label = "mb-1.5 block text-sm font-semibold";

interface Props {
  open: boolean;
  isGuest: boolean;
  /** When set, the dialog edits this station instead of creating a new one. Remount (via `key`) to switch stations. */
  station?: Station | null;
  onClose: () => void;
  onSaved: (station: Station, mode: "created" | "updated") => void;
}

const SOURCE_BY_TYPE: Record<Station["sourceType"], Source> = {
  audius_trending: "trending",
  audius_search: "search",
  audius_playlist: "playlist",
  audius_favorites: "favorites",
  custom_mix: "trending",
};

export function CreateStationDialog({ open, isGuest, station = null, onClose, onSaved }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const refs = (station?.sourceRefs ?? {}) as { genre?: string; query?: string; playlistIds?: string[] };
  const editing = station !== null;
  const [name, setName] = useState(station?.name ?? "");
  const [source, setSource] = useState<Source>(station ? SOURCE_BY_TYPE[station.sourceType] : "trending");
  const [genre, setGenre] = useState(refs.genre ?? "");
  const [query, setQuery] = useState(refs.query ?? "");
  const [playlists, setPlaylists] = useState<PlaylistSummary[] | null>(null);
  const [playlistIds, setPlaylistIds] = useState<string[]>(refs.playlistIds ?? []);
  const [mood, setMood] = useState(station?.mood ?? "");
  const [djMode, setDjMode] = useState(station?.djMode ?? false);
  const [crossfadeSec, setCrossfadeSec] = useState(station?.crossfadeSec ?? 5);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync the native <dialog> with the `open` prop.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Load the user's playlists the first time that source is chosen.
  useEffect(() => {
    if (source !== "playlist" || playlists || isGuest) return;
    api
      .playlists()
      .then((r) => setPlaylists(r.playlists))
      .catch(() => setError("Couldn't load your playlists."));
  }, [source, playlists, isGuest]);

  const reset = () => {
    setName("");
    setSource("trending");
    setGenre("");
    setQuery("");
    setPlaylistIds([]);
    setMood("");
    setDjMode(false);
    setCrossfadeSec(5);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Give your station a name.");
    if (!(editing && trimmed.toLowerCase() === station!.name.toLowerCase()) && isPresetName(trimmed)) return setError("That name is used by a built-in station. Pick another.");
    if (source === "search" && !query.trim()) return setError("Enter a search term.");
    if (source === "playlist" && playlistIds.length === 0) return setError("Pick at least one playlist.");

    const body: CreateStationRequest = {
      name: trimmed,
      mood: mood || null,
      sourceType:
        source === "trending"
          ? "audius_trending"
          : source === "search"
            ? "audius_search"
            : source === "playlist"
              ? "audius_playlist"
              : "audius_favorites",
      sourceRefs:
        source === "trending"
          ? genre
            ? { genre }
            : {}
          : source === "search"
            ? { query: query.trim() }
            : source === "playlist"
              ? { playlistIds }
              : {},
      djMode,
      crossfadeSec,
    };

    setSaving(true);
    setError(null);
    try {
      if (station) {
        onSaved((await api.updateStation(station.id, body)).station, "updated");
      } else {
        const created = (await api.createStation(body)).station;
        reset();
        onSaved(created, "created");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the station.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="create-station-title"
      className="m-auto w-[min(92vw,34rem)] rounded-3xl bg-ink-700 p-0 text-white shadow-card backdrop:bg-black/60"
    >
      <form onSubmit={(e) => void submit(e)} className="max-h-[90vh] space-y-5 overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <h2 id="create-station-title" className="text-2xl font-bold">
            {editing ? "Edit station" : "New station"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-white/60 hover:text-white">
            ✕
          </button>
        </div>

        <div>
          <label htmlFor="station-name" className={label}>
            Name
          </label>
          <input
            id="station-name"
            className={field}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Late night drive"
            required
          />
        </div>

        <fieldset>
          <legend className={label}>Music from</legend>
          <div className="grid grid-cols-2 gap-2">
            {SOURCES.map((s) => {
              const locked = s.needsAccount && isGuest;
              return (
                <label
                  key={s.id}
                  className={`cursor-pointer rounded-xl p-3 text-sm transition has-[:checked]:bg-lilac has-[:checked]:text-ink-900 ${
                    locked ? "cursor-not-allowed bg-ink-800 opacity-40" : "bg-ink-800 hover:bg-ink-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="source"
                    className="sr-only"
                    checked={source === s.id}
                    disabled={locked}
                    onChange={() => setSource(s.id)}
                  />
                  <span className="block font-semibold">{s.label}</span>
                  <span className="block text-xs opacity-80">{locked ? "Needs an Audius account" : s.hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {source === "trending" && (
          <div>
            <label htmlFor="station-genre" className={label}>
              Genre
            </label>
            <select id="station-genre" className={field} value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">Any genre</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        )}

        {source === "search" && (
          <div>
            <label htmlFor="station-query" className={label}>
              Search term
            </label>
            <input
              id="station-query"
              className={field}
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="artist, track or keyword"
            />
          </div>
        )}

        {source === "playlist" && (
          <fieldset>
            <legend className={label}>Your playlists</legend>
            {!playlists && <p className="text-sm text-white/60">Loading...</p>}
            {playlists && playlists.length === 0 && <p className="text-sm text-white/60">You have no playlists on Audius yet.</p>}
            <div className="max-h-44 space-y-1 overflow-y-auto">
              {playlists?.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-ink-800 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={playlistIds.includes(p.id)}
                    onChange={(e) =>
                      setPlaylistIds((ids) => (e.target.checked ? [...ids, p.id].slice(0, 10) : ids.filter((id) => id !== p.id)))
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-white/50">{p.trackCount} tracks</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <span className={label}>Mood (optional)</span>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mood === m}
                onClick={() => setMood(mood === m ? "" : m)}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  mood === m ? "bg-lilac text-ink-900" : "bg-ink-800 text-white/80 hover:bg-ink-600"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-ink-800 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block font-semibold">DJ mode</span>
              <span className="block text-xs text-white/60">Crossfade between tracks</span>
            </span>
            <input type="checkbox" className="h-5 w-5" checked={djMode} onChange={(e) => setDjMode(e.target.checked)} />
          </label>
          {djMode && (
            <label className="mt-3 flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0">Fade: {crossfadeSec}s</span>
              <input
                type="range"
                min={3}
                max={10}
                step={1}
                value={crossfadeSec}
                onChange={(e) => setCrossfadeSec(Number(e.target.value))}
                className="range-lilac"
                style={{ "--fill": `${((crossfadeSec - 3) / 7) * 100}%` } as React.CSSProperties}
              />
            </label>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm text-white/70 hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-lilac px-5 py-2.5 font-bold text-ink-900 transition hover:bg-lilac-300 disabled:opacity-60"
          >
            {saving ? "Saving..." : editing ? "Save changes" : "Create & tune in"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
