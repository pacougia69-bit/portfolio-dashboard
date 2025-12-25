import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Home page - redirects to Login
 */
export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation('/login');
  }, [setLocation]);

  return null;
}
