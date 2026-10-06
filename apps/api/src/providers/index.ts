import type { ProviderId } from "@audius-radio/shared-types";
import type { MusicProvider } from "./MusicProvider.js";
import { AudiusProvider } from "./audius/AudiusProvider.js";

const providers: Partial<Record<ProviderId, MusicProvider>> = {
  audius: new AudiusProvider(),
};

export function getProvider(id: ProviderId = "audius"): MusicProvider {
  const provider = providers[id];
  if (!provider) throw new Error(`Unknown music provider: ${id}`);
  return provider;
}
