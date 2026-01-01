import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

// Demo user - always returned, no authentication required
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
  // Always return demo user - no authentication logic
  return {
    req: opts.req,
    res: opts.res,
    user: defaultUser,
  };
}
