import { useState, useEffect, useCallback, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PinLock from "./components/PinLock";
import { trpc } from "@/lib/trpc";

// Pages - all accessible without authentication
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
import RebalancingPage from "./pages/RebalancingPage";
import MediaInsightsPage from "./pages/MediaInsightsPage";
import DebugPage from "./pages/DebugPage";

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
      <Route path="/rebalancing" component={RebalancingPage} />
      <Route path="/einstellungen" component={EinstellungenPage} />
      <Route path="/ki-assistent" component={AIAssistantPage} />
      <Route path="/mediathek" component={MediaInsightsPage} />
      <Route path="/hilfe" component={HilfePage} />
      <Route path="/debug" component={DebugPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

const UNLOCK_SESSION_KEY = 'portfolio_unlocked_session';
const LAST_ACTIVITY_KEY = 'portfolio_last_activity';

function AppWithPinLock() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isCheckingPin, setIsCheckingPin] = useState<boolean>(true);
  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch PIN status from backend
  const { data: pinStatus, isLoading: isPinStatusLoading } = trpc.settings.getPinStatus.useQuery(
    undefined,
    {
      // Only fetch if we think we're unlocked or haven't checked yet
      enabled: true,
      refetchOnWindowFocus: true,
    }
  );

  // Verify PIN mutation
  const verifyPinMutation = trpc.settings.verifyPin.useMutation();

  // Check if user is unlocked on mount
  useEffect(() => {
    const checkUnlockStatus = () => {
      // If PIN is loading, wait
      if (isPinStatusLoading) {
        return;
      }

      // If PIN is not enabled, user is always unlocked
      if (!pinStatus?.enabled) {
        setIsUnlocked(true);
        setIsCheckingPin(false);
        return;
      }

      // Check session storage for unlock status
      const sessionUnlocked = sessionStorage.getItem(UNLOCK_SESSION_KEY);
      const lastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY);

      if (sessionUnlocked === 'true' && lastActivity) {
        // Check if auto-lock time has passed
        const lastActivityTime = parseInt(lastActivity, 10);
        const now = Date.now();
        const autoLockMs = (pinStatus?.autoLockMinutes || 5) * 60 * 1000;

        if (now - lastActivityTime < autoLockMs) {
          // Still within auto-lock window
          setIsUnlocked(true);
          updateLastActivity();
        } else {
          // Auto-lock time has passed
          lockApp();
        }
      } else {
        // Not unlocked in session
        setIsUnlocked(false);
      }

      setIsCheckingPin(false);
    };

    checkUnlockStatus();
  }, [pinStatus, isPinStatusLoading]);

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }, []);

  // Lock the app
  const lockApp = useCallback(() => {
    setIsUnlocked(false);
    sessionStorage.removeItem(UNLOCK_SESSION_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);

    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
      activityTimerRef.current = null;
    }
  }, []);

  // Setup activity tracking and auto-lock
  useEffect(() => {
    if (!isUnlocked || !pinStatus?.enabled) {
      return;
    }

    const autoLockMs = (pinStatus?.autoLockMinutes || 5) * 60 * 1000;

    // Reset auto-lock timer
    const resetTimer = () => {
      updateLastActivity();

      // Clear existing timer
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
      }

      // Set new timer
      activityTimerRef.current = setTimeout(() => {
        lockApp();
      }, autoLockMs);
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
      }
    };
  }, [isUnlocked, pinStatus, updateLastActivity, lockApp]);

  // Handle PIN verification
  const handleUnlock = async (pin: string): Promise<boolean> => {
    try {
      const result = await verifyPinMutation.mutateAsync({ pin });

      if (result.valid) {
        setIsUnlocked(true);
        sessionStorage.setItem(UNLOCK_SESSION_KEY, 'true');
        updateLastActivity();
        return true;
      }

      return false;
    } catch (error) {
      console.error('PIN-Verifizierung fehlgeschlagen:', error);
      // Return false to show error in PinLock component
      return false;
    }
  };

  // Show loading state while checking PIN status
  if (isCheckingPin || isPinStatusLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show PIN lock if:
  // 1. PIN is enabled in settings
  // 2. User is not unlocked
  if (pinStatus?.enabled && !isUnlocked) {
    return (
      <PinLock
        onUnlock={() => setIsUnlocked(true)}
        title="Dashboard gesperrt"
        subtitle="Geben Sie Ihren PIN ein, um fortzufahren"
        pinLength={4}
        verifyPin={handleUnlock}
      />
    );
  }

  // Normal app render
  return <Router />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AppWithPinLock />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
