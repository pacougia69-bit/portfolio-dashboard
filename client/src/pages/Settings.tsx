/**
 * Settings Page - Dark Terminal Theme
 * PIN management, data export/import, danger zone
 * Electric Cyan accents, glassmorphism cards
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, Key, Shield, Trash2, AlertTriangle, Download, Database, Lock } from 'lucide-react';

export default function Settings() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, changePin, resetPin } = useAuth();
  const { assets, clearAllData, exportToCSV } = usePortfolio();
  
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, setLocation]);

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (newPin.length < 4) {
      setPinError('Neuer PIN muss mindestens 4 Zeichen haben');
      return;
    }

    if (newPin !== confirmNewPin) {
      setPinError('Neue PINs stimmen nicht überein');
      return;
    }

    const success = changePin(oldPin, newPin);
    if (success) {
      toast.success('PIN erfolgreich geändert');
      setOldPin('');
      setNewPin('');
      setConfirmNewPin('');
    } else {
      setPinError('Aktueller PIN ist falsch');
    }
  };

  const handleResetAll = () => {
    clearAllData();
    resetPin();
    toast.success('Alle Daten wurden gelöscht');
    setLocation('/');
  };

  const handleExportBackup = () => {
    const backup = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      assets: assets,
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Backup exportiert');
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center h-16">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/dashboard')} className="mr-4">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display font-bold text-lg">Einstellungen</h1>
            <p className="text-xs text-muted-foreground">Sicherheit & Datenverwaltung</p>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-2xl space-y-6">
        {/* PIN Change Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                PIN ändern
              </CardTitle>
              <CardDescription>
                Ändern Sie Ihren Zugangs-PIN für mehr Sicherheit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Aktueller PIN</Label>
                  <Input
                    type="password"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    maxLength={8}
                    className="font-mono bg-input/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Neuer PIN</Label>
                    <Input
                      type="password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      maxLength={8}
                      className="font-mono bg-input/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PIN bestätigen</Label>
                    <Input
                      type="password"
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      maxLength={8}
                      className="font-mono bg-input/50"
                    />
                  </div>
                </div>
                {pinError && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {pinError}
                  </p>
                )}
                <Button type="submit" className="w-full">
                  <Lock className="w-4 h-4 mr-2" />
                  PIN ändern
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data Management Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Datenverwaltung
              </CardTitle>
              <CardDescription>
                Exportieren Sie Ihre Daten als Backup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium">JSON Backup</p>
                  <p className="text-sm text-muted-foreground">Vollständiges Backup aller Portfolio-Daten</p>
                </div>
                <Button variant="outline" onClick={handleExportBackup}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportieren
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium">CSV Export</p>
                  <p className="text-sm text-muted-foreground">Assets als CSV-Datei exportieren</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const csv = exportToCSV();
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `portfolio_${new Date().toISOString().split('T')[0]}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                    toast.success('CSV exportiert');
                  }}
                  disabled={assets.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportieren
                </Button>
              </div>

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Datenschutz-Hinweis</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Alle Ihre Daten werden ausschließlich lokal in Ihrem Browser gespeichert. 
                      Es werden keine Daten an Server übertragen. Erstellen Sie regelmäßig Backups, 
                      da das Löschen der Browser-Daten auch Ihre Portfolio-Daten löscht.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-card border-destructive/30">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Gefahrenzone
              </CardTitle>
              <CardDescription>
                Irreversible Aktionen. Bitte mit Vorsicht verwenden.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <div>
                  <p className="font-medium text-destructive">Alle Daten löschen</p>
                  <p className="text-sm text-muted-foreground">
                    Löscht alle Portfolio-Daten und den PIN unwiderruflich.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Zurücksetzen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-card border-destructive/30">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-5 h-5" />
                        Sind Sie sicher?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Diese Aktion kann nicht rückgängig gemacht werden. Alle Ihre Portfolio-Daten 
                        und Ihr PIN werden unwiderruflich gelöscht. Erstellen Sie vorher ein Backup, 
                        wenn Sie Ihre Daten behalten möchten.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleResetAll}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Ja, alles löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* App Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="text-center text-sm text-muted-foreground py-8">
            <p className="font-display gradient-text text-lg mb-2">Portfolio Dashboard</p>
            <p>Version 1.0.0</p>
            <p className="mt-2">Alle Finanzdaten in Euro (€)</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
