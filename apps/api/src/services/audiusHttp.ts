import axios, { AxiosError } from "axios";
import { env } from "../env.js";
import { recordAudiusCall } from "./audiusUsage.js";

// TODO: Audius recommends discovering a host via https://api.audius.co; confirm against docs.audius.co.
const http = axios.create({
  baseURL: "https://api.audius.co/v1",
  params: { app_name: "audius-radio", api_key: env.AUDIUS_API_KEY },
  headers: { Authorization: `Bearer ${env.AUDIUS_BEARER_TOKEN}` },
  timeout: 10_000,
});

const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET against the Audius API (the free plan allows 10 req/s), retrying 429s with exponential backoff. */
export async function audiusGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    void recordAudiusCall();
    try {
      const { data } = await http.get<{ data: T }>(path, { params });
      return data.data;
    } catch (err) {
      const status = err instanceof AxiosError ? err.response?.status : undefined;
      if (status !== 429 || attempt >= MAX_RETRIES) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
}
