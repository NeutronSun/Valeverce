import { NextResponse } from "next/server";
import { AuthCookie } from "../../../../../src/server/auth/AuthCookie.js";
import { AuthService } from "../../../../../src/server/auth/AuthService.js";

export async function PUT(request, { params }) {
  try {
    const token = request.cookies.get(AuthCookie.COOKIE_NAME)?.value ?? "";
    const { id } = await params;
    const payload = await request.json();
    const deck = await AuthService.updateValeverceDeckForToken(token, id, payload.deck ?? payload);
    return NextResponse.json({ deck });
  } catch (error) {
    const publicError = AuthService.publicError(error);
    return NextResponse.json({ error: publicError.message }, { status: publicError.statusCode });
  }
}

export async function DELETE(request, { params }) {
  try {
    const token = request.cookies.get(AuthCookie.COOKIE_NAME)?.value ?? "";
    const { id } = await params;
    const deleted = await AuthService.deleteValeverceDeckForToken(token, id);
    return NextResponse.json({ deleted });
  } catch (error) {
    const publicError = AuthService.publicError(error);
    return NextResponse.json({ error: publicError.message }, { status: publicError.statusCode });
  }
}
