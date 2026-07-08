import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App, { UNLOCK_SESSION_KEY, LAST_ACTIVITY_KEY } from "./App";
import "./index.css";

const queryClient = new QueryClient();

// Wenn die Session ungueltig/abgelaufen ist (z.B. Cookie weg), soll die App
// wieder die PIN-Sperre zeigen statt kaputte Seiten mit Fehlermeldungen -
// einmal automatisch neu laden statt in einem kaputten Zustand haengenzubleiben.
let hasReloadedForAuth = false;
function handlePossibleAuthError(error: unknown) {
  const code = (error as { data?: { code?: string } } | undefined)?.data?.code;
  if (code === "UNAUTHORIZED" && !hasReloadedForAuth) {
    hasReloadedForAuth = true;
    sessionStorage.removeItem(UNLOCK_SESSION_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
    window.location.reload();
  }
}

// Log errors for debugging
queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    console.error("[API Query Error]", error);
    handlePossibleAuthError(error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    console.error("[API Mutation Error]", error);
    handlePossibleAuthError(error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
