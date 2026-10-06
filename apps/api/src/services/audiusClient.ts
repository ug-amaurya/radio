import axios from "axios";
import { env } from "../env.js";

const API_BASE_URL = "https://api.audius.co/v1";

export interface AudiusProfile {
  userId: string;
  handle: string;
  name: string | null;
}

/**
 * Verifies a "Log in with Audius" JWT with Audius itself and returns the verified profile.
 * Never trust a profile claimed by the client - only what Audius returns for the token.
 * TODO: confirm the verify endpoint/response shape against docs.audius.co when wiring up real credentials.
 */
export async function verifyAudiusToken(token: string): Promise<AudiusProfile> {
  const { data } = await axios.get<{ data?: { userId?: string; handle?: string; name?: string } }>(
    `${API_BASE_URL}/users/verify_token`,
    {
      params: { token, api_key: env.AUDIUS_API_KEY },
      headers: { Authorization: `Bearer ${env.AUDIUS_BEARER_TOKEN}` },
    },
  );
  const profile = data.data;
  if (!profile?.userId || !profile.handle) {
    throw new Error("Audius token verification returned no user");
  }
  return { userId: profile.userId, handle: profile.handle, name: profile.name ?? null };
}
