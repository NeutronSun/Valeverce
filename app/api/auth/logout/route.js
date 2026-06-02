import { NextResponse } from "next/server";
import { AuthCookie } from "../../../../src/server/auth/AuthCookie.js";
import { AuthService } from "../../../../src/server/auth/AuthService.js";

export async function POST(request) {
  const token = request.cookies.get(AuthCookie.COOKIE_NAME)?.value ?? "";
  try {
    await AuthService.logout(token);
  } catch (error) {
    console.error("Sessione non eliminata da Mongo", error?.message ?? error);
  }

  const response = NextResponse.json({ ok: true });
  AuthCookie.clear(response);
  return response;
}
