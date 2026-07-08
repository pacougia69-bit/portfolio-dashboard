import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { readSessionCookie, verifySessionToken, DEMO_USER_ID } from "./session";

// Einzelnutzer-App - es gibt genau diesen einen Account
const defaultUser: User = {
  id: DEMO_USER_ID,
  openId: 'demo-user',
  name: 'Demo User',
  email: 'demo@portfolio.local',
  loginMethod: 'none',
  role: 'user',
  pin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Nur mit gueltigem Session-Cookie (nach PIN-Eingabe gesetzt) gibt es einen
  // eingeloggten Nutzer. Ohne Cookie bleibt user=null -> protectedProcedure
  // lehnt ab (siehe requireUser-Middleware in trpc.ts).
  const token = readSessionCookie(opts.req);
  const userId = verifySessionToken(token);

  return {
    req: opts.req,
    res: opts.res,
    user: userId === DEMO_USER_ID ? defaultUser : null,
  };
}
