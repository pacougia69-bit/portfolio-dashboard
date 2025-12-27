export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Get the login URL for OAuth authentication
 * Uses VITE_APP_URL environment variable in production
 * Falls back to localhost:3000 in development
 */
export const getLoginUrl = () => {
  // In production, VITE_APP_URL should be set to the Railway app URL
  // In development, it defaults to localhost:3000
  const appUrl = import.meta.env.VITE_APP_URL;
  
  if (!appUrl) {
    // Development fallback
    return "http://localhost:3000/";
  }
  
  // Ensure URL ends with /
  return appUrl.endsWith('/') ? appUrl : `${appUrl}/`;
};