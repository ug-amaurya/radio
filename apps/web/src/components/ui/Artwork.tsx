import { useEffect, useState } from "react";

interface Props {
  src?: string;
  fallbacks?: string[];
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
}

/**
 * Audius artwork lives on third-party content nodes and any one of them can be down.
 * On a load error, try the same file on the mirror nodes, then show a placeholder.
 */
export function Artwork({ src, fallbacks = [], alt = "", className = "", loading }: Props) {
  const sources = src ? [src, ...fallbacks] : [];
  const key = sources.join("|");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setAttempt(0), [key]);

  const current = sources[attempt];
  if (!current) {
    return (
      <div role={alt ? "img" : undefined} aria-label={alt || undefined} className={`grid place-items-center bg-ink-600 text-lilac/60 ${className}`}>
        <span aria-hidden="true">♪</span>
      </div>
    );
  }
  return <img src={current} alt={alt} loading={loading} onError={() => setAttempt((a) => a + 1)} className={className} />;
}
