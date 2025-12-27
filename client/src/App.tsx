import { useState, useEffect, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import PinLock from "./components/PinLock";
import Login from "./pages/Login";

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

// PIN Lock Context
const PIN_UNLOCKED_KEY = 'pin_unlocked_at';
const PIN_LOCK_TIMEOUT_KEY = 'pin_lock_timeout';

function usePinLock(isAuthenticated: boolean) {
  const [isLocked, setIsLocked] = useState(true);
  const [checkingPin, setCheckingPin] = useState(true);
  const { data: pinStatus, isLoading: pinStatusLoading } = trpc.settings.getPinStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const verifyPinMutation = trpc.settings.verifyPin.useMutation();

  // Check if PIN is enabled and if we should show lock screen
  useEffect(() => {
    if (!isAuthenticated) return;
    if (pinStatusLoading) return;
    
    if (!pinStatus?.enabled) {
      setIsLocked(false);
      setCheckingPin(false);
      return;
    }

    // Check if we have a valid unlock session
    const unlockedAt = localStorage.getItem(PIN_UNLOCKED_KEY);
    const lockTimeout = pinStatus.autoLockMinutes * 60 * 1000; // Convert to ms
    
    if (unlockedAt) {
      const timeSinceUnlock = Date.now() - parseInt(unlockedAt);
      if (timeSinceUnlock < lockTimeout) {
        setIsLocked(false);
      } else {
        localStorage.removeItem(PIN_UNLOCKED_KEY);
        setIsLocked(true);
      }
    } else {
      setIsLocked(true);
    }
    
    setCheckingPin(false);
  }, [pinStatus, pinStatusLoading]);

  // Auto-lock after inactivity
  useEffect(() => {
    if (!pinStatus?.enabled || isLocked) return;

    let inactivityTimer: NodeJS.Timeout;
    const lockTimeout = pinStatus.autoLockMinutes * 60 * 1000;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      localStorage.setItem(PIN_UNLOCKED_KEY, String(Date.now()));
      inactivityTimer = setTimeout(() => {
        setIsLocked(true);
        localStorage.removeItem(PIN_UNLOCKED_KEY);
      }, lockTimeout);
    };

    // Listen for user activity
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    // Initial timer
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [pinStatus, isLocked]);

  // Also lock when tab becomes hidden
  useEffect(() => {
    if (!pinStatus?.enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Store the time when tab was hidden
        localStorage.setItem('pin_hidden_at', String(Date.now()));
      } else {
        // Check if we should lock based on how long tab was hidden
        const hiddenAt = localStorage.getItem('pin_hidden_at');
        if (hiddenAt) {
          const hiddenDuration = Date.now() - parseInt(hiddenAt);
          const lockTimeout = pinStatus.autoLockMinutes * 60 * 1000;
          if (hiddenDuration > lockTimeout) {
            setIsLocked(true);
            localStorage.removeItem(PIN_UNLOCKED_KEY);
          }
          localStorage.removeItem('pin_hidden_at');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pinStatus]);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const result = await verifyPinMutation.mutateAsync({ pin });
      return result.valid;
    } catch {
      return false;
    }
  }, [verifyPinMutation]);

  const unlock = useCallback(() => {
    localStorage.setItem(PIN_UNLOCKED_KEY, String(Date.now()));
    setIsLocked(false);
  }, []);

  return {
    isLocked: pinStatus?.enabled && isLocked,
    checkingPin: checkingPin || pinStatusLoading,
    verifyPin,
    unlock,
    pinEnabled: pinStatus?.enabled || false,
  };
}

// Protected Route Component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Lade...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedRoute component={DashboardPage} />}
      </Route>
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardPage} />}
      </Route>
      <Route path="/portfolio">
        {() => <ProtectedRoute component={PortfolioPage} />}
      </Route>
      <Route path="/watchlist">
        {() => <ProtectedRoute component={WatchlistPage} />}
      </Route>
      <Route path="/strategie">
        {() => <ProtectedRoute component={StrategiePage} />}
      </Route>
      <Route path="/dividenden">
        {() => <ProtectedRoute component={DividendenPage} />}
      </Route>
      <Route path="/simulator">
        {() => <ProtectedRoute component={SimulatorPage} />}
      </Route>
      <Route path="/notizen">
        {() => <ProtectedRoute component={NotizenPage} />}
      </Route>
      <Route path="/einstellungen">
        {() => <ProtectedRoute component={EinstellungenPage} />}
      </Route>
      <Route path="/ki-assistent">
        {() => <ProtectedRoute component={AIAssistantPage} />}
      </Route>
      <Route path="/hilfe">
        {() => <ProtectedRoute component={HilfePage} />}
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const { isLocked, checkingPin, verifyPin, unlock } = usePinLock(isAuthenticated);

  // Show loading while checking auth and PIN status
  if (authLoading || (isAuthenticated && checkingPin)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Lade...</p>
        </div>
      </div>
    );
  }

  // Show PIN lock screen if locked
  if (isAuthenticated && isLocked) {
    return (
      <PinLock
        title="Portfolio Manager"
        subtitle="Geben Sie Ihren PIN ein"
        onUnlock={unlock}
        verifyPin={verifyPin}
      />
    );
  }

  return <Router />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
