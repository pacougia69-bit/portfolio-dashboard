import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Pages
import DashboardPage from "./pages/DashboardPage";
import PortfolioPage from "./pages/PortfolioPage";
import WatchlistPage from "./pages/WatchlistPage";
import StrategiePage from "./pages/StrategiePage";
import DividendenPage from "./pages/DividendenPage";
import SimulatorPage from "./pages/SimulatorPage";
import NotizenPage from "./pages/NotizenPage";
import EinstellungenPage from "./pages/EinstellungenPage";
import AIAssistantPage from "./pages/AIAssistantPage";
import HilfePage from "./pages/HilfePage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/portfolio" component={PortfolioPage} />
      <Route path="/watchlist" component={WatchlistPage} />
      <Route path="/strategie" component={StrategiePage} />
      <Route path="/dividenden" component={DividendenPage} />
      <Route path="/simulator" component={SimulatorPage} />
      <Route path="/notizen" component={NotizenPage} />
      <Route path="/einstellungen" component={EinstellungenPage} />
      <Route path="/ki-assistent" component={AIAssistantPage} />
      <Route path="/hilfe" component={HilfePage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
