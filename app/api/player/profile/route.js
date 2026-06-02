import { NextResponse } from "next/server";
import { AuthCookie } from "../../../../src/server/auth/AuthCookie.js";
import { AuthService } from "../../../../src/server/auth/AuthService.js";

export async function POST(request) {
  try {
    const token = request.cookies.get(AuthCookie.COOKIE_NAME)?.value ?? "";
    const payload = await request.json();
    const auth = await AuthService.saveProfileForToken(token, payload.profile ?? payload);
    return NextResponse.json({ auth });
  } catch (error) {
    const publicError = AuthService.publicError(error);
    return NextResponse.json({ error: publicError.message }, { status: publicError.statusCode });
  }
}
