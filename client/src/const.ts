export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Temporäre Version ohne externes OAuth-Portal
export const getLoginUrl = () => {
  return import.meta.env.VITE_APP_URL || "https://portfolio-dashboard-production-e5c1.up.railway.app/";
};