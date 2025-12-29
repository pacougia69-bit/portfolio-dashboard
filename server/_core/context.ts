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
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: new Date(),
  isActive: true,
  preferences: null,
  avatarUrl: null,
  bio: null,
  location: null,
  website: null,
  twoFactorEnabled: false,
  emailVerified: true,
  phoneNumber: null,
  phoneVerified: false,
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

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
