import { useSearchParams } from "react-router-dom";
import { TrendingGrid } from "../components/dashboard/TrendingGrid";
import { GENRES } from "../lib/genres";

const chip = "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition";

export default function Trending() {
  const [params, setParams] = useSearchParams();
  const genre = params.get("genre") ?? undefined;

  const choose = (g?: string) => setParams(g ? { genre: g } : {}, { replace: true });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-black">Trending</h1>
        <p className="mt-1 text-white/70">What&apos;s hot on Audius this week. Pick a genre to narrow it down.</p>
      </header>

      <div role="group" aria-label="Genre" className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          aria-pressed={!genre}
          onClick={() => choose()}
          className={`${chip} ${!genre ? "bg-lilac text-ink-900" : "bg-ink-700 text-white/80 hover:bg-ink-600"}`}
        >
          All
        </button>
        {GENRES.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={genre === g}
            onClick={() => choose(g)}
            className={`${chip} ${genre === g ? "bg-lilac text-ink-900" : "bg-ink-700 text-white/80 hover:bg-ink-600"}`}
          >
            {g}
          </button>
        ))}
      </div>

      <TrendingGrid
        genre={genre}
        limit={24}
        title={genre ? `Trending in ${genre}` : "Trending now"}
        gridClass="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
      />
    </div>
  );
}
