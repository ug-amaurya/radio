import { useConnectionStore } from "../stores/connectionStore";
import { toast } from "../stores/toastStore";
import type {
  AuthCallbackRequest,
  CreateSessionResponse,
  CreateStationRequest,
  FeedbackResponse,
  LogListenRequest,
  PlaylistsResponse,
  RateTrackRequest,
  SessionPreviewResponse,
  SessionUserResponse,
  StationResponse,
  StationsResponse,
  StreamUrlResponse,
  TracksResponse,
} from "@audius-radio/shared-types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (err) {
    // fetch only rejects on network-level failure (not HTTP errors).
    useConnectionStore.getState().setOnline(false);
    throw err;
  }
  if (!useConnectionStore.getState().online) useConnectionStore.getState().setOnline(true);

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const message = body.error ?? `Request failed with status ${res.status}`;
    // 4xx are usually handled where they happen (forms, login); server trouble and rate limits need telling.
    if (res.status >= 500 || res.status === 429) toast.error(message);
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  callback: (payload: AuthCallbackRequest) =>
    request<SessionUserResponse>("/auth/callback", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  guest: () => request<SessionUserResponse>("/auth/guest", { method: "POST" }),
  me: () => request<SessionUserResponse>("/auth/me"),
  trending: (genre?: string) =>
    request<TracksResponse>(`/catalog/trending${genre ? `?genre=${encodeURIComponent(genre)}` : ""}`),
  search: (q: string) => request<TracksResponse>(`/catalog/search?q=${encodeURIComponent(q)}`),
  streamUrl: (trackId: string) =>
    request<StreamUrlResponse>(`/catalog/tracks/${encodeURIComponent(trackId)}/stream`),
  favorites: () => request<TracksResponse>("/library/favorites"),
  stations: () => request<StationsResponse>("/stations"),
  createStation: (body: CreateStationRequest) =>
    request<StationResponse>("/stations", { method: "POST", body: JSON.stringify(body) }),
  updateStation: (id: string, body: Partial<CreateStationRequest>) =>
    request<StationResponse>(`/stations/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteStation: (id: string) => request<void>(`/stations/${id}`, { method: "DELETE" }),
  playlists: () => request<PlaylistsResponse>("/library/playlists"),
  stationQueue: (stationId: string, count = 10) =>
    request<TracksResponse>(`/stations/${stationId}/queue?count=${count}`),
  logListen: (body: LogListenRequest) =>
    request<void>("/history", { method: "POST", body: JSON.stringify(body) }),
  rateTrack: (body: RateTrackRequest) =>
    request<void>("/feedback", { method: "POST", body: JSON.stringify(body) }),
  ratings: (trackIds: string[]) =>
    request<FeedbackResponse>(`/feedback?trackIds=${trackIds.map(encodeURIComponent).join(",")}`),
  createSession: (stationId?: string | null) =>
    request<CreateSessionResponse>("/sessions", { method: "POST", body: JSON.stringify(stationId ? { stationId } : {}) }),
  getSession: (joinCode: string) =>
    request<SessionPreviewResponse>(`/sessions/${encodeURIComponent(joinCode)}`),
  socketToken: () => request<{ token: string }>("/auth/socket-token"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
};

export { ApiError };
