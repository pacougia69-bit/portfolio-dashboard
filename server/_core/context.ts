import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Default demo user - app works without authentication
  const defaultUser: User = {
    id: 1,
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

  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication disabled - always use default demo user
    user = defaultUser;
  }

  // If no authenticated user, use default demo user
  if (!user) {
    user = defaultUser;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
