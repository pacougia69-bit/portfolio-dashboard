import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

// Demo user for development/demo mode (no authentication required)
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

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Always use demo user - no authentication required
  const user: User = defaultUser;
  console.log("[Context] Using demo user:", user.email);

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
