export class AuthCookie {
  static COOKIE_NAME = "valeverce_session";
  static MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

  static getOptions() {
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AuthCookie.MAX_AGE_SECONDS
    };
  }

  static set(response, token) {
    response.cookies.set(AuthCookie.COOKIE_NAME, token, AuthCookie.getOptions());
  }

  static clear(response) {
    response.cookies.set(AuthCookie.COOKIE_NAME, "", {
      ...AuthCookie.getOptions(),
      maxAge: 0
    });
  }
}
