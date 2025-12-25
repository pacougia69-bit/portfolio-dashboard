/**
 * Login Page - OAuth Authentication
 * Redirects to OAuth if not authenticated
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, LogIn, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  useEffect(() => {
    if (user) {
      setLocation('/dashboard');
    }
  }, [user, setLocation]);

  const handleLogin = () => {
    // Redirect to OAuth login
    window.location.href = `${import.meta.env.VITE_OAUTH_PORTAL_URL}?app_id=${import.meta.env.VITE_APP_ID}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background with hero image */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/images/hero-bg.png)' }}
      />
      
      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/80 to-background/95" />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 grid-pattern opacity-30" />
      
      {/* Content */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 mb-4"
            >
              <Shield className="w-10 h-10 text-primary glow-cyan" />
            </motion.div>
            <h1 className="font-display text-3xl font-bold gradient-text mb-2">
              Finanzplaner
            </h1>
            <p className="text-muted-foreground">
              Portfolio-Analyse & Altersvorsorge
            </p>
          </div>

          {/* Login Card */}
          <Card className="glass-card glow-hover">
            <CardHeader className="text-center pb-4">
              <CardTitle className="font-display text-xl flex items-center justify-center gap-2">
                <LogIn className="w-5 h-5 text-primary" />
                Anmelden
              </CardTitle>
              <CardDescription>
                Melden Sie sich an, um auf Ihr Portfolio zuzugreifen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleLogin}
                className="w-full h-12 font-display text-base bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <LogIn className="w-5 h-5 mr-2" />
                Mit Manus anmelden
              </Button>

              {/* Info Text */}
              <p className="text-xs text-muted-foreground text-center mt-6">
                Ihre Daten werden sicher in der Cloud gespeichert.
                <br />
                Zugriff von überall, auf allen Geräten.
              </p>
            </CardContent>
          </Card>

          {/* Visual decoration */}
          <div className="mt-8 flex justify-center">
            <img 
              src="/images/login-visual.png" 
              alt="" 
              className="w-32 h-auto opacity-50"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
