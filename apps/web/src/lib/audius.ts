
// TODO: verify exact SDK method names against docs.audius.co (they change between major versions).
// Kept in one module so the rest of the app only depends on startLogin / completeLogin.
// The SDK is large and Node-flavoured, so it is loaded lazily: the app renders without it.
let sdkPromise: Promise<Awaited<ReturnType<typeof createSdk>>> | null = null;

async function createSdk() {
  const { sdk } = await import("@audius/sdk");
  return sdk({
    appName: "Audius Radio",
    apiKey: import.meta.env.VITE_AUDIUS_API_KEY,
    redirectUri: import.meta.env.VITE_AUDIUS_REDIRECT_URI ?? `${window.location.origin}/callback`,
  } as Parameters<typeof sdk>[0]);
}

function getSdk() {
  return (sdkPromise ??= createSdk());
}

/** Redirects to Audius to log in. Only `read` scope is requested. */
export async function startLogin(): Promise<void> {
  const audiusSdk = await getSdk();
  await audiusSdk.oauth!.login({ scope: "read" });
}

/** Handles the redirect back from Audius and returns the signed JWT to send to our backend. */
export async function completeAudiusRedirect(): Promise<string> {
  const audiusSdk = await getSdk();
  const result = (await (audiusSdk.oauth as unknown as { handleRedirect: () => Promise<{ token?: string } | string> }).handleRedirect());
  const token = typeof result === "string" ? result : result?.token;
  if (!token) throw new Error("Audius did not return a login token");
  return token;
}
