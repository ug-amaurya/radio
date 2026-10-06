import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export function GuestButton() {
  const { continueAsGuest } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await continueAsGuest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a guest session.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="rounded-full border border-gray-500 px-6 py-3 font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Starting..." : "Continue as guest"}
      </button>
      <p className="max-w-xs text-center text-xs text-gray-400">
        Can&apos;t reach Audius login (it&apos;s blocked in some regions)? Guests get trending and search stations, but no
        favorites or playlists.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
