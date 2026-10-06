import type { PublicUser } from "@audius-radio/shared-types";
import { useUserStore } from "../stores/userStore";

/** The signed-in user. Only call from routes rendered inside `AuthedLayout`, which guarantees one exists. */
export function useCurrentUser(): PublicUser {
  const user = useUserStore((s) => s.user);
  if (!user) throw new Error("useCurrentUser called without a signed-in user");
  return user;
}
