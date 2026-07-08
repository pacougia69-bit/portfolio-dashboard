import crypto from "crypto";
import type { Request, Response } from "express";

/**
 * Einfache, abhaengigkeitsfreie Session fuer eine Einzelnutzer-App:
 * Nach erfolgreicher PIN-Pruefung bekommt der Browser ein signiertes,
 * httpOnly-Cookie. Jede geschuetzte Anfrage muss dieses Cookie mitbringen -
 * ohne Cookie kein Zugriff auf Depotdaten, egal ob per Browser, curl oder Bot.
 */

export const SESSION_COOKIE_NAME = "portfolio_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage
export const DEMO_USER_ID = 1; // Einzelnutzer-App - es gibt nur diesen einen Account

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  // Fallback: aus der (ohnehin geheimen) Datenbank-URL ableiten, damit die
  // Session auch ohne zusaetzliche Railway-Variable ueber Neustarts hinweg
  // gueltig bleibt. Fuer echte Mehrnutzer-Systeme waere ein eigenes Secret
  // Pflicht - hier reicht das, weil DATABASE_URL selbst schon ein Geheimnis ist.
  if (process.env.DATABASE_URL) {
    return crypto.createHash("sha256").update(process.env.DATABASE_URL).update("session-v1").digest("hex");
  }
  console.warn("⚠️  Weder SESSION_SECRET noch DATABASE_URL gesetzt - Sessions sind nur fuer diesen Prozesslauf gueltig.");
  return "dev-only-insecure-fallback-secret";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

export function createSessionToken(userId: number): string {
  const expires = Date.now() + SESSION_MAX_AGE_MS;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userIdStr, expiresStr, signature] = parts;
  const payload = `${userIdStr}.${expiresStr}`;
  const expected = sign(payload);

  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;

  const userId = Number(userIdStr);
  return Number.isFinite(userId) ? userId : null;
}

export function readSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

export function setSessionCookie(res: Response, userId: number): void {
  const token = createSessionToken(userId);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}

// Bremse gegen automatisiertes Durchprobieren der PIN. Global statt pro-IP,
// weil es nur einen legitimen Nutzer gibt - reicht fuer diesen Zweck.
const PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const PIN_MAX_FAILED_ATTEMPTS = 10;
let pinFailureTimestamps: number[] = [];

export function checkPinRateLimit(): void {
  const now = Date.now();
  pinFailureTimestamps = pinFailureTimestamps.filter((t) => t > now - PIN_ATTEMPT_WINDOW_MS);
  if (pinFailureTimestamps.length >= PIN_MAX_FAILED_ATTEMPTS) {
    const resetInMinutes = Math.ceil((pinFailureTimestamps[0] + PIN_ATTEMPT_WINDOW_MS - now) / 60000);
    throw new Error(`Zu viele falsche PIN-Versuche. Bitte in ${resetInMinutes} Minute(n) erneut versuchen.`);
  }
}

export function recordFailedPinAttempt(): void {
  pinFailureTimestamps.push(Date.now());
}

export function resetPinRateLimit(): void {
  pinFailureTimestamps = [];
}
