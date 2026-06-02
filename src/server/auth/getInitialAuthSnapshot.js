import { cookies } from "next/headers";
import { AuthCookie } from "./AuthCookie.js";
import { AuthService } from "./AuthService.js";

export async function getInitialAuthSnapshot() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AuthCookie.COOKIE_NAME)?.value ?? "";
    return AuthService.getAuthSnapshotFromToken(token);
  } catch {
    return null;
  }
}
