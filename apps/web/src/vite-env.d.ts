/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AUDIUS_API_KEY: string;
  /** Websocket host when the API is on a different domain than the site. */
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_AUDIUS_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
