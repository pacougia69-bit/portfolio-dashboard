export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Get the app base URL from environment or use current origin as fallback
export const getAppUrl = () => {
  // In production, use the environment variable
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL;
  }
  
  // In development or if not set, use window.location.origin
  // This ensures the app works regardless of where it's deployed
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  
  // Final fallback (should rarely be used)
  return "https://portfolio-dashboard-production-e5c1.up.railway.app";
};

// Get login URL - uses the app URL
export const getLoginUrl = () => {
  const baseUrl = getAppUrl();
  // Ensure trailing slash is removed before adding path
  return baseUrl.replace(/\/$/, "") + "/login";
};