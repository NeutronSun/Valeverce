import { NextResponse } from "next/server";
import { AuthCookie } from "../../../../src/server/auth/AuthCookie.js";
import { AuthService } from "../../../../src/server/auth/AuthService.js";

export async function GET(request) {
  try {
    const token = request.cookies.get(AuthCookie.COOKIE_NAME)?.value ?? "";
    const auth = await AuthService.getAuthSnapshotFromToken(token);
    if (!auth) {
      return NextResponse.json({ auth: null }, { status: 401 });
    }

    return NextResponse.json({ auth });
  } catch (error) {
    const publicError = AuthService.publicError(error);
    return NextResponse.json({ error: publicError.message }, { status: publicError.statusCode });
  }
}
