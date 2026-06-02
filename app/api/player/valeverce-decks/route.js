import { NextResponse } from "next/server";
import { AuthCookie } from "../../../../src/server/auth/AuthCookie.js";
import { AuthService } from "../../../../src/server/auth/AuthService.js";

export async function GET(request) {
  try {
    const token = request.cookies.get(AuthCookie.COOKIE_NAME)?.value ?? "";
    const decks = await AuthService.listValeverceDecksForToken(token);
    return NextResponse.json({ decks });
  } catch (error) {
    const publicError = AuthService.publicError(error);
    return NextResponse.json({ error: publicError.message }, { status: publicError.statusCode });
  }
}

export async function POST(request) {
  try {
    const token = request.cookies.get(AuthCookie.COOKIE_NAME)?.value ?? "";
    const payload = await request.json();
    const deck = await AuthService.createValeverceDeckForToken(token, payload.deck ?? payload);
    return NextResponse.json({ deck });
  } catch (error) {
    const publicError = AuthService.publicError(error);
    return NextResponse.json({ error: publicError.message }, { status: publicError.statusCode });
  }
}
