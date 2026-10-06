import { randomUUID } from "node:crypto";

export const GUEST_PREFIX = "guest:";

export function isGuestUser(user: { audiusUserId: string }): boolean {
  return user.audiusUserId.startsWith(GUEST_PREFIX);
}

export function createGuestIdentity() {
  const id = randomUUID();
  return {
    audiusUserId: `${GUEST_PREFIX}${id}`,
    handle: `guest-${id.slice(0, 6)}`,
    displayName: "Guest",
  };
}
