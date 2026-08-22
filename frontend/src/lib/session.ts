import { ApiError, api } from "@/lib/api";
import type { User } from "@/lib/types";

/**
 * Fetch the signed-in user, or null.
 *
 * On 401 the session cookie is present but no longer usable — expired, signed
 * with a rotated secret, or naming an account that no longer exists. The cookie
 * is httpOnly, so only the server can remove it; if we leave it in place the
 * route guard keeps admitting us to `/` while `/login` redirects back to `/`,
 * and the app spins between the two forever.
 */
export async function loadCurrentUser(): Promise<User | null> {
  try {
    return await api.get<User>("/api/users/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Best effort: if this fails the loop is still possible, but there is
      // nothing better to try from here.
      await api.post("/api/auth/logout").catch(() => {});
    }
    return null;
  }
}
