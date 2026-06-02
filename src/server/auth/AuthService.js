import { AuthError } from "./AuthError.js";
import { CookieParser } from "./CookieParser.js";
import { AuthCookie } from "./AuthCookie.js";
import { PasswordHasher } from "./PasswordHasher.js";
import { AccountRepository } from "../repositories/AccountRepository.js";
import { SessionRepository } from "../repositories/SessionRepository.js";
import { ProfileRepository } from "../repositories/ProfileRepository.js";
import { DeckRepository } from "../repositories/DeckRepository.js";
import { ProgressRepository } from "../repositories/ProgressRepository.js";

export class AuthService {
  static MAX_NICK_LENGTH = 18;
  static MIN_PASSWORD_LENGTH = 6;

  static accounts = new AccountRepository();
  static sessions = new SessionRepository();
  static profiles = new ProfileRepository();
  static decks = new DeckRepository();
  static progress = new ProgressRepository();

  static async register(payload) {
    const nick = AuthService.normalizeNick(payload?.nick);
    const password = AuthService.normalizePassword(payload?.password);
    const normalizedNick = AuthService.normalizeUniqueNick(nick);

    if (!nick) {
      throw new AuthError("Nick obbligatorio");
    }

    if (password.length < AuthService.MIN_PASSWORD_LENGTH) {
      throw new AuthError(`Password minima ${AuthService.MIN_PASSWORD_LENGTH} caratteri`);
    }

    const existing = await AuthService.accounts.findByNormalizedNick(normalizedNick);
    if (existing) {
      throw new AuthError("Nick gia registrato", 409);
    }

    const passwordHash = await PasswordHasher.hash(password);
    const account = await AuthService.accounts.create({ nick, normalizedNick, passwordHash });
    const profile = await AuthService.profiles.upsertForAccount(
      account.id,
      {
        ...(payload?.profile ?? {}),
        username: nick
      },
      nick
    );
    const progress = await AuthService.progress.ensureForAccount(account.id);
    const session = await AuthService.sessions.createForAccount(account.id);

    return {
      token: session.token,
      auth: AuthService.serializeAuth({ account, profile, decks: [], progress })
    };
  }

  static async login(payload) {
    const nick = AuthService.normalizeNick(payload?.nick);
    const password = AuthService.normalizePassword(payload?.password);
    const account = await AuthService.accounts.findByNormalizedNick(AuthService.normalizeUniqueNick(nick));

    if (!account || !(await PasswordHasher.verify(password, account.passwordHash))) {
      throw new AuthError("Nick o password non validi", 401);
    }

    await AuthService.accounts.touchLogin(account.id);
    const freshAccount = await AuthService.accounts.findById(account.id);
    const profile = await AuthService.ensureProfile(freshAccount);
    const decks = await AuthService.decks.listUtilityDecks(account.id);
    const progress = await AuthService.progress.ensureForAccount(account.id);
    const session = await AuthService.sessions.createForAccount(account.id);

    return {
      token: session.token,
      auth: AuthService.serializeAuth({ account: freshAccount, profile, decks, progress })
    };
  }

  static async logout(token) {
    await AuthService.sessions.deleteByToken(token);
  }

  static async getAuthSnapshotFromCookieHeader(cookieHeader) {
    const token = CookieParser.get(cookieHeader, AuthCookie.COOKIE_NAME);
    return AuthService.getAuthSnapshotFromToken(token);
  }

  static async getAuthSnapshotFromToken(token) {
    const accountId = await AuthService.sessions.findAccountIdByToken(token);
    if (!accountId) {
      return null;
    }

    const account = await AuthService.accounts.findById(accountId);
    if (!account) {
      return null;
    }

    const profile = await AuthService.ensureProfile(account);
    const decks = await AuthService.decks.listUtilityDecks(account.id);
    const progress = await AuthService.progress.ensureForAccount(account.id);

    return AuthService.serializeAuth({ account, profile, decks, progress });
  }

  static async saveProfileForToken(token, profileInput) {
    const auth = await AuthService.getAuthSnapshotFromToken(token);
    if (!auth) {
      throw new AuthError("Sessione non valida", 401);
    }

    const profile = await AuthService.saveProfileForAccountId(auth.account.id, profileInput, auth.account.nick);
    return {
      ...auth,
      profile
    };
  }

  static async saveProfileForAccountId(accountId, profileInput, fallbackUsername = "Player") {
    return AuthService.profiles.upsertForAccount(accountId, profileInput, fallbackUsername);
  }

  static async saveUtilityDecksForToken(token, decks) {
    const auth = await AuthService.getAuthSnapshotFromToken(token);
    if (!auth) {
      throw new AuthError("Sessione non valida", 401);
    }

    const nextDecks = await AuthService.decks.replaceUtilityDecks(auth.account.id, decks);
    return {
      ...auth,
      decks: nextDecks
    };
  }

  static async recordGameFinishedForAccount(accountId, result) {
    if (!accountId) {
      return;
    }

    await AuthService.progress.recordGameFinished(accountId, result);
  }

  static async ensureProfile(account) {
    const existingProfile = await AuthService.profiles.getByAccountId(account.id);
    if (existingProfile) {
      return existingProfile;
    }

    return AuthService.profiles.upsertForAccount(account.id, { username: account.nick }, account.nick);
  }

  static serializeAuth({ account, profile, decks, progress }) {
    return {
      account: {
        id: account.id,
        nick: account.nick,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        lastLoginAt: account.lastLoginAt
      },
      profile,
      decks: Array.isArray(decks) ? decks : [],
      progress
    };
  }

  static normalizeNick(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, AuthService.MAX_NICK_LENGTH);
  }

  static normalizeUniqueNick(value) {
    return AuthService.normalizeNick(value).toLocaleLowerCase("it-IT");
  }

  static normalizePassword(value) {
    return String(value ?? "");
  }

  static publicError(error) {
    if (error instanceof AuthError) {
      return {
        message: error.message,
        statusCode: error.statusCode
      };
    }

    return {
      message: "Errore server account",
      statusCode: 500
    };
  }
}
