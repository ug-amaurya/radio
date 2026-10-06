import { StationsPanel } from "../components/dashboard/StationsPanel";
import { useCurrentUser } from "../hooks/useCurrentUser";

export default function Stations() {
  const user = useCurrentUser();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-black">Stations</h1>
        <p className="mt-1 text-white/70">Tune in to a preset, or build your own from a genre, a search or your playlists.</p>
      </header>
      <StationsPanel isGuest={user.isGuest} variant="full" />
    </div>
  );
}
