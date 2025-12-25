/**
 * Sidebar Navigation - Dark Terminal Theme
 * Persistent navigation for all pages with tRPC integration
 * Collapsible on desktop and mobile
 */

import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Briefcase,
  Eye,
  Target,
  Coins,
  Calculator,
  StickyNote,
  Settings,
  LogOut,
  TrendingUp,
  Menu,
  X,
  Bot,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { path: '/watchlist', label: 'Watchlist', icon: Eye },
  { path: '/strategie', label: 'Strategie', icon: Target },
  { path: '/dividenden', label: 'Dividenden', icon: Coins },
  { path: '/simulator', label: 'Simulator', icon: Calculator },
  { path: '/notizen', label: 'Notizen', icon: StickyNote },
  { path: '/ki-assistent', label: 'KI-Assistent', icon: Bot },
  { path: '/hilfe', label: 'Hilfe', icon: HelpCircle },
  { path: '/einstellungen', label: 'Einstellungen', icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Desktop collapsed state - persisted in localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  
  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);
  
  // Fetch portfolio data from backend
  const { data: portfolio = [] } = trpc.portfolio.list.useQuery();
  
  // Calculate stats from portfolio
  const stats = useMemo(() => {
    const totalWealth = portfolio.reduce((sum, p) => {
      const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
      return sum + value;
    }, 0);
    
    const totalInvested = portfolio.reduce((sum, p) => sum + p.amount * p.buyPrice, 0);
    const totalGain = totalWealth - totalInvested;
    const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    
    return {
      totalWealth,
      totalInvested,
      totalGain,
      totalGainPercent,
      positionCount: portfolio.length,
    };
  }, [portfolio]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M €`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k €`;
    }
    return `${value.toFixed(0)} €`;
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <>
      {/* Mobile Menu Button - larger touch target */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-3 rounded-lg bg-card border border-border shadow-lg touch-target"
        aria-label="Menü öffnen"
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-card border-r border-border z-40 transition-all duration-300',
          'flex flex-col',
          isCollapsed ? 'w-16' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={cn('p-4 border-b border-border', isCollapsed && 'px-2')}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0',
              isCollapsed ? 'w-10 h-10' : 'w-10 h-10'
            )}>
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="font-display font-bold text-lg whitespace-nowrap">Finanzplaner</h1>
                <p className="text-xs text-muted-foreground whitespace-nowrap">Portfolio Manager</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className={cn('p-4 border-b border-border', isCollapsed && 'p-2')}>
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="glass-card p-2 rounded-lg text-center cursor-default">
                  <p className="font-mono text-sm font-bold text-primary">
                    {formatCurrencyShort(stats.totalWealth)}
                  </p>
                  <p className={cn(
                    'text-xs font-mono',
                    stats.totalGainPercent >= 0 ? 'text-green-400' : 'text-red-400'
                  )}>
                    {stats.totalGainPercent >= 0 ? '+' : ''}{stats.totalGainPercent.toFixed(0)}%
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-mono">{formatCurrency(stats.totalWealth)}</p>
                <p className={cn(
                  'text-xs',
                  stats.totalGain >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {stats.totalGain >= 0 ? '+' : ''}{formatCurrency(stats.totalGain)} ({stats.totalGainPercent.toFixed(1)}%)
                </p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="glass-card p-3 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Gesamtvermögen</p>
              <p className="font-mono text-xl font-bold text-primary">
                {formatCurrency(stats.totalWealth)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  'text-xs font-mono',
                  stats.totalGain >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {stats.totalGain >= 0 ? '+' : ''}{formatCurrency(stats.totalGain)}
                </span>
                <span className={cn(
                  'text-xs',
                  stats.totalGainPercent >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  ({stats.totalGainPercent >= 0 ? '+' : ''}{stats.totalGainPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path || (location === '/' && item.path === '/dashboard');
              
              const linkContent = (
                <Link
                  href={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-primary/10 text-primary border-l-2 border-primary',
                    isCollapsed && 'justify-center px-2'
                  )}
                >
                  <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-primary')} />
                  {!isCollapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
                </Link>
              );
              
              return (
                <li key={item.path}>
                  {isCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {linkContent}
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    linkContent
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse Toggle Button (Desktop only) */}
        <div className="hidden lg:block p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'w-full justify-center text-muted-foreground hover:text-foreground',
              !isCollapsed && 'justify-start gap-2'
            )}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span>Einklappen</span>
              </>
            )}
          </Button>
        </div>

        {/* Logout */}
        <div className={cn('p-2 border-t border-border', !isCollapsed && 'p-4')}>
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-muted-foreground hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Abmelden
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              Abmelden
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}
