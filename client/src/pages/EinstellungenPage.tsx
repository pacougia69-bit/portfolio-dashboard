/**
 * Einstellungen Page - Finanzplaner
 * Backup Import/Export, Daten-Management, PIN-Sperre
 */

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  Settings, Upload, Download, Trash2, FileJson, Database,
  AlertTriangle, RefreshCw, User, Lock, Shield, Eye, EyeOff
} from 'lucide-react';

export default function EinstellungenPage() {
  const { user } = useAuth();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  
  // PIN State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState('5');
  
  // Fetch data
  const { data: portfolio = [], refetch: refetchPortfolio } = trpc.portfolio.list.useQuery();
  const { data: watchlist = [], refetch: refetchWatchlist } = trpc.watchlist.list.useQuery();
  const { data: dividends = [], refetch: refetchDividends } = trpc.dividends.list.useQuery({});
  const { data: pinStatus, refetch: refetchPinStatus } = trpc.settings.getPinStatus.useQuery();
  
  // Mutations
  const importPortfolio = trpc.portfolio.import.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} Positionen importiert`);
      setIsImportDialogOpen(false);
      setJsonInput('');
      refetchPortfolio();
      refetchWatchlist();
    },
    onError: (error) => toast.error(error.message),
  });
  
  const setPin = trpc.settings.setPin.useMutation({
    onSuccess: () => {
      toast.success('PIN wurde gespeichert');
      setIsPinDialogOpen(false);
      setNewPin('');
      setConfirmPin('');
      refetchPinStatus();
    },
    onError: (error) => toast.error(error.message),
  });
  
  const removePin = trpc.settings.removePin.useMutation({
    onSuccess: () => {
      toast.success('PIN wurde deaktiviert');
      refetchPinStatus();
    },
    onError: (error) => toast.error(error.message),
  });
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonInput(event.target?.result as string);
    };
    reader.readAsText(file);
  };
  
  const handleImportJSON = () => {
    if (!jsonInput.trim()) {
      toast.error('Bitte JSON-Daten eingeben');
      return;
    }
    
    try {
      const data = JSON.parse(jsonInput);
      importPortfolio.mutate({
        portfolio: data.portfolio || data.assets || [],
        watchlist: data.watchlist || [],
      });
    } catch (e) {
      toast.error('Ungültiges JSON-Format');
    }
  };
  
  const handleExportJSON = () => {
    const exportData = {
      portfolio: portfolio.map(p => ({
        wkn: p.wkn,
        ticker: p.ticker,
        name: p.name,
        type: p.type,
        category: p.category,
        amount: p.amount,
        buyPrice: p.buyPrice,
        currentPrice: p.currentPrice,
        status: p.status,
        notes: p.notes,
      })),
      watchlist: watchlist.map(w => ({
        ticker: w.ticker,
        name: w.name,
        currentPrice: w.currentPrice,
        targetPrice: w.targetPrice,
        notes: w.notes,
      })),
      exportDate: new Date().toISOString(),
      version: '2.0',
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanzplaner_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Backup exportiert');
  };
  
  const handleSetPin = () => {
    if (newPin.length < 4 || newPin.length > 6) {
      toast.error('PIN muss 4-6 Ziffern haben');
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      toast.error('PIN darf nur Ziffern enthalten');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('PINs stimmen nicht überein');
      return;
    }
    
    setPin.mutate({
      pin: newPin,
      enabled: true,
      autoLockMinutes: parseInt(autoLockMinutes),
    });
  };
  
  const handleTogglePin = (enabled: boolean) => {
    if (enabled) {
      setIsPinDialogOpen(true);
    } else {
      removePin.mutate();
    }
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="pt-12 sm:pt-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
            Einstellungen
          </h1>
          <p className="text-muted-foreground text-xs sm:text-base">
            Daten und Einstellungen
          </p>
        </div>

        {/* User Info */}
        <Card className="glass-card">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Benutzer
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm sm:text-base truncate">{user?.name || 'Benutzer'}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Angemeldet via OAuth</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PIN-Sperre */}
        <Card className="glass-card">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              PIN-Sperre
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Schützen Sie Ihre App mit einem PIN-Code
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">PIN aktivieren</Label>
                <p className="text-xs text-muted-foreground">
                  {pinStatus?.enabled 
                    ? 'PIN-Sperre ist aktiv' 
                    : 'App ohne PIN-Abfrage öffnen'}
                </p>
              </div>
              <Switch
                checked={pinStatus?.enabled || false}
                onCheckedChange={handleTogglePin}
              />
            </div>
            
            {pinStatus?.enabled && (
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsPinDialogOpen(true)}
                  className="flex-1"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  PIN ändern
                </Button>
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-xs whitespace-nowrap">Auto-Sperre:</Label>
                  <Select 
                    value={String(pinStatus?.autoLockMinutes || 5)}
                    onValueChange={(value) => {
                      setPin.mutate({
                        pin: '', // Will be ignored if PIN already set
                        enabled: true,
                        autoLockMinutes: parseInt(value),
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Min</SelectItem>
                      <SelectItem value="5">5 Min</SelectItem>
                      <SelectItem value="15">15 Min</SelectItem>
                      <SelectItem value="30">30 Min</SelectItem>
                      <SelectItem value="60">60 Min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* PIN Dialog */}
        <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                {pinStatus?.enabled ? 'PIN ändern' : 'PIN festlegen'}
              </DialogTitle>
              <DialogDescription>
                Geben Sie einen 4-6 stelligen PIN ein
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Neuer PIN</Label>
                <div className="relative">
                  <Input
                    type={showPin ? 'text' : 'password'}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••"
                    className="font-mono text-center text-lg tracking-widest pr-10"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>PIN bestätigen</Label>
                <Input
                  type={showPin ? 'text' : 'password'}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••"
                  className="font-mono text-center text-lg tracking-widest"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label>Auto-Sperre nach</Label>
                <Select value={autoLockMinutes} onValueChange={setAutoLockMinutes}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Minute</SelectItem>
                    <SelectItem value="5">5 Minuten</SelectItem>
                    <SelectItem value="15">15 Minuten</SelectItem>
                    <SelectItem value="30">30 Minuten</SelectItem>
                    <SelectItem value="60">60 Minuten</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsPinDialogOpen(false);
                setNewPin('');
                setConfirmPin('');
              }}>
                Abbrechen
              </Button>
              <Button onClick={handleSetPin} disabled={setPin.isPending}>
                {setPin.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Data Stats */}
        <Card className="glass-card">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Database className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Datenübersicht
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="p-2 sm:p-4 rounded-lg bg-muted/50">
                <p className="text-lg sm:text-2xl font-bold font-mono">{portfolio.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Portfolio</p>
              </div>
              <div className="p-2 sm:p-4 rounded-lg bg-muted/50">
                <p className="text-lg sm:text-2xl font-bold font-mono">{watchlist.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Watchlist</p>
              </div>
              <div className="p-2 sm:p-4 rounded-lg bg-muted/50">
                <p className="text-lg sm:text-2xl font-bold font-mono">{dividends.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Dividenden</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Import/Export */}
        <Card className="glass-card">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <FileJson className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Backup & Import
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Backup erstellen oder importieren
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              {/* Import Dialog */}
              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Upload className="w-4 h-4 mr-2" />
                    Importieren
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Backup importieren</DialogTitle>
                    <DialogDescription>
                      Laden Sie Ihr Finanzplaner-Backup (JSON-Datei)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-4">
                      <label className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-center w-full h-24 border-2 border-dashed border-primary/30 rounded-lg hover:border-primary/60 transition-colors bg-primary/5">
                          <div className="text-center">
                            <FileJson className="w-8 h-8 mx-auto mb-2 text-primary/60" />
                            <p className="text-sm text-muted-foreground">JSON-Datei auswählen</p>
                          </div>
                        </div>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <Textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder="Oder JSON hier einfügen..."
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                      Abbrechen
                    </Button>
                    <Button onClick={handleImportJSON} disabled={!jsonInput.trim() || importPortfolio.isPending}>
                      {importPortfolio.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Importiere...
                        </>
                      ) : (
                        'Importieren'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" onClick={handleExportJSON} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Exportieren
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-destructive text-sm sm:text-base">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              Gefahrenzone
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Diese Aktionen können nicht rückgängig gemacht werden
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Alle Daten löschen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alle Daten löschen?</DialogTitle>
                  <DialogDescription>
                    Diese Aktion löscht alle Ihre Portfolio-Positionen, Watchlist-Einträge und Dividenden.
                    Diese Aktion kann nicht rückgängig gemacht werden.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      toast.info('Funktion noch nicht implementiert');
                      setIsDeleteDialogOpen(false);
                    }}
                  >
                    Ja, alle Daten löschen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
