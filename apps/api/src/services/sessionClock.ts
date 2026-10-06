/** Server-authoritative playback clock for shared sessions. All values are milliseconds. */

/** How far into the current track the room is, given when it started (both server time). */
export function positionMs(startedAt: number, now: number): number {
  return Math.max(0, now - startedAt);
}

/** Whether a listener's local position has drifted far enough from the server's to need a seek. */
export function needsResync(localMs: number, serverMs: number, toleranceMs = 500): boolean {
  return Math.abs(localMs - serverMs) > toleranceMs;
}
