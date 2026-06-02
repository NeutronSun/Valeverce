import { NextResponse } from "next/server";
import { AuthCookie } from "../../../../src/server/auth/AuthCookie.js";
import { AuthService } from "../../../../src/server/auth/AuthService.js";

export async function POST(request) {
  try {
    const payload = await request.json();
    const result = await AuthService.register(payload);
    const response = NextResponse.json({ auth: result.auth });
    AuthCookie.set(response, result.token);
    return response;
  } catch (error) {
    const publicError = AuthService.publicError(error);
    return NextResponse.json({ error: publicError.message }, { status: publicError.statusCode });
  }
}
