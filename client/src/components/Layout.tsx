/**
 * Main Layout with Sidebar
 * Wraps all authenticated pages
 * Supports collapsible sidebar and mobile-responsive design
 */

import { ReactNode, useState, useEffect } from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  // Sync with sidebar collapsed state from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  
  // Track if we're on mobile
  const [isMobile, setIsMobile] = useState(false);

  // Listen for localStorage changes (when sidebar toggles)
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('sidebar-collapsed');
      setIsCollapsed(saved === 'true');
    };

    // Check periodically for changes (since storage event doesn't fire in same tab)
    const interval = setInterval(handleStorageChange, 100);
    
    return () => clearInterval(interval);
  }, []);
  
  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // On mobile, sidebar is hidden by default (hamburger menu)
  const marginLeft = isMobile ? '0' : (isCollapsed ? '4rem' : '16rem');

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main 
        className="min-h-screen transition-all duration-300"
        style={{ marginLeft }}
      >
        <div className="p-3 sm:p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
