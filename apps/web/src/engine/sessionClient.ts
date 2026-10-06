import { io, type Socket } from "socket.io-client";
import type { SessionState } from "@audius-radio/shared-types";
import { api } from "../lib/api";
import { usePlaybackStore } from "../stores/playbackStore";
import { useSessionStore } from "../stores/sessionStore";
import { radio } from "./radio";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";
// In production the API may sit on another domain than the site (Vercel proxies /api but can't proxy websockets).
const SOCKET_ORIGIN = import.meta.env.VITE_SOCKET_URL ?? new URL(API_BASE_URL, window.location.origin).origin;
const ACK_TIMEOUT_MS = 8_000;
/** Listeners seek only when they drift further than this from the room's clock. */
const DRIFT_TOLERANCE_MS = 500;
const UPCOMING_SHARED = 5;

interface JoinAck {
  ok: boolean;
  error?: string;
  isHost?: boolean;
  state?: SessionState;
}

const session = () => useSessionStore.getState();

/** Connects this browser to a shared listening room, either as the host or as a listener. */
class SessionClient {
  private socket: Socket | null = null;
  private unsubscribeHost: (() => void) | null = null;
  private lastReportedId: string | null = null;

  private open(): Socket {
    this.socket?.disconnect();
    // A fresh short-lived token on every (re)connect: cookies don't reach the API host when it's on another domain.
    const socket = io(SOCKET_ORIGIN, {
      withCredentials: true,
      auth: (cb) => {
        api
          .socketToken()
          .then(({ token }) => cb({ token }))
          .catch(() => cb({}));
      },
    });
    this.socket = socket;
    socket.on("session:listeners", ({ count }: { count: number }) => session().set({ listeners: count }));
    socket.on("disconnect", () => {
      if (session().status === "live") session().set({ status: "reconnecting" });
    });
    socket.on("connect", () => {
      // After a dropped connection, rejoin the room so the server resumes sending to this socket.
      const { joinCode, status } = session();
      if (joinCode && status === "reconnecting") {
        void this.joinRoom(socket, joinCode).then(() => {
          session().set({ status: "live" });
          // The server may have restarted and lost the room's track: the host re-reports what's playing.
          if (session().role === "host") {
            this.lastReportedId = null;
            this.reportHostTrack(socket, usePlaybackStore.getState());
          }
        });
      }
    });
    return socket;
  }

  private joinRoom(socket: Socket, joinCode: string): Promise<JoinAck> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The session server didn't respond")), ACK_TIMEOUT_MS);
      socket.emit("session:join", { joinCode }, (ack: JoinAck) => {
        clearTimeout(timer);
        if (ack.ok) resolve(ack);
        else reject(new Error(ack.error ?? "Could not join the session"));
      });
    });
  }

  /** Starts a session for whatever is on air; listeners follow this browser's playback. */
  async host(stationId: string | null): Promise<void> {
    session().set({ status: "connecting", error: null });
    try {
      const { session: created } = await api.createSession(stationId);
      const socket = this.open();
      await this.joinRoom(socket, created.joinCode);
      session().set({ role: "host", joinCode: created.joinCode, status: "live", listeners: 1 });
      this.followHostPlayback(socket);
    } catch (err) {
      this.teardown();
      session().set({ status: "error", error: err instanceof Error ? err.message : "Could not start the session" });
    }
  }

  /**
   * Reports each new track to the room once its audio has actually started, along with how far in
   * it already is, so the server's clock matches what the host is hearing.
   */
  private followHostPlayback(socket: Socket): void {
    this.lastReportedId = null;
    this.reportHostTrack(socket, usePlaybackStore.getState());
    this.unsubscribeHost = usePlaybackStore.subscribe((s) => this.reportHostTrack(socket, s));
  }

  private reportHostTrack(socket: Socket, s: ReturnType<typeof usePlaybackStore.getState>): void {
    if (!s.current || !s.isPlaying || s.positionSec <= 0 || s.current.id === this.lastReportedId) return;
    this.lastReportedId = s.current.id;
    socket.emit("session:track-change", {
      track: s.current,
      upNext: s.upNext.slice(0, UPCOMING_SHARED),
      positionMs: Math.round(s.positionSec * 1000),
    });
  }

  /** Joins as a listener. Call from a click so the browser allows audio. */
  async join(joinCode: string): Promise<void> {
    session().set({ status: "connecting", error: null });
    try {
      const socket = this.open();
      const ack = await this.joinRoom(socket, joinCode.toUpperCase());
      radio.setSyncMode(true);
      session().set({ role: ack.isHost ? "host" : "guest", joinCode: joinCode.toUpperCase(), status: "live" });

      socket.on("session:track-change", (state: SessionState) => void this.apply(state));
      socket.on("session:resync", ({ trackId, positionMs }: { trackId: string; positionMs: number }) =>
        this.correctDrift(trackId, positionMs),
      );
      socket.on("session:ended", () => {
        this.teardown();
        session().set({ status: "ended" });
      });

      if (ack.state) await this.apply(ack.state);
    } catch (err) {
      this.teardown();
      session().set({ status: "error", error: err instanceof Error ? err.message : "Could not join the session" });
    }
  }

  private async apply(state: SessionState): Promise<void> {
    if (!state.track) return;
    await radio.playSynced(state.track, state.positionMs / 1000, state.upNext);
  }

  private correctDrift(trackId: string, serverMs: number): void {
    const { current, positionSec, isPlaying } = usePlaybackStore.getState();
    if (!isPlaying || current?.id !== trackId) return;
    if (Math.abs(positionSec * 1000 - serverMs) > DRIFT_TOLERANCE_MS) radio.seek(serverMs / 1000);
  }

  /** Host ends the party for everyone; a listener just leaves. */
  leave(): void {
    if (session().role === "host") this.socket?.emit("session:end");
    const wasGuest = session().role === "guest";
    this.teardown();
    if (wasGuest) radio.pause();
    session().reset();
  }

  private teardown(): void {
    this.unsubscribeHost?.();
    this.unsubscribeHost = null;
    this.socket?.disconnect();
    this.socket = null;
    radio.setSyncMode(false);
  }
}

export const sessionClient = new SessionClient();
