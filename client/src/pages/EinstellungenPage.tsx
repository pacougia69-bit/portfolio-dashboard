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
import TaxManagement from '@/components/TaxManagement';
import {
  Settings, Upload, Download, Trash2, FileJson, Database,
  AlertTriangle, RefreshCw, User, Lock, Shield, Eye, EyeOff, FileText, History,
  Sparkles, Plus, Edit, Trash, GripVertical
} from 'lucide-react';

export default function EinstellungenPage() {
  const { user } = useAuth();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  
  // DKB PDF Import State
  const [isPdfUploading, setIsPdfUploading] = useState(false);
  
  // PIN State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState('5');

  // Template State
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templatePrompt, setTemplatePrompt] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [templateIcon, setTemplateIcon] = useState('');
  const [templateSortOrder, setTemplateSortOrder] = useState('0');
  
  // Fetch data
  const { data: portfolio = [], refetch: refetchPortfolio } = trpc.portfolio.list.useQuery();
  const { data: watchlist = [], refetch: refetchWatchlist } = trpc.watchlist.list.useQuery();
  const { data: dividends = [], refetch: refetchDividends } = trpc.dividends.list.useQuery({});
  const { data: pinStatus, refetch: refetchPinStatus } = trpc.settings.getPinStatus.useQuery();
  const { data: transactions = [] } = trpc.transactions.list.useQuery();
  const { data: templates = [], refetch: refetchTemplates } = trpc.ai.listTemplates.useQuery();
  
  // Mutations
  const importPortfolio = trpc.portfolio.import.useMutation({
    onSuccess: (data) => {
      const total = (data.imported?.portfolio || 0) + (data.imported?.watchlist || 0);
      toast.success(`Import erfolgreich: ${data.imported?.portfolio || 0} Portfolio, ${data.imported?.watchlist || 0} Watchlist (${total} gesamt)`);
      setIsImportDialogOpen(false);
      setJsonInput('');
      refetchPortfolio();
      refetchWatchlist();
    },
    onError: (error) => toast.error(error.message),
  });
  
  const uploadDKBPDF = trpc.transactions.uploadDKBPDF.useMutation({
    onSuccess: (data) => {
      setIsPdfUploading(false);
      if (data.duplicate) {
        toast.warning(data.message);
      } else if (data.success) {
        toast.success(data.message);
        refetchPortfolio();
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      setIsPdfUploading(false);
      toast.error(error.message || 'Fehler beim Importieren der PDF');
    },
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

  const createTemplate = trpc.ai.createTemplate.useMutation({
    onSuccess: () => {
      toast.success('Vorlage wurde erstellt');
      setIsTemplateDialogOpen(false);
      resetTemplateForm();
      refetchTemplates();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateTemplate = trpc.ai.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success('Vorlage wurde aktualisiert');
      setIsTemplateDialogOpen(false);
      resetTemplateForm();
      refetchTemplates();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteTemplate = trpc.ai.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success('Vorlage wurde gelöscht');
      refetchTemplates();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetTemplates = trpc.ai.resetTemplates.useMutation({
    onSuccess: () => {
      toast.success('Vorlagen wurden zurückgesetzt');
      refetchTemplates();
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
  
  const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Bitte wählen Sie eine PDF-Datei aus');
      return;
    }
    
    setIsPdfUploading(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      
      uploadDKBPDF.mutate({ pdfBase64: base64 });
    };
    reader.onerror = () => {
      setIsPdfUploading(false);
      toast.error('Fehler beim Lesen der PDF-Datei');
    };
    reader.readAsArrayBuffer(file);
    
    // Reset input
    e.target.value = '';
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

  const resetTemplateForm = () => {
    setEditingTemplate(null);
    setTemplateTitle('');
    setTemplatePrompt('');
    setTemplateCategory('');
    setTemplateIcon('');
    setTemplateSortOrder('0');
  };

  const handleOpenTemplateDialog = (template?: any) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateTitle(template.title);
      setTemplatePrompt(template.prompt);
      setTemplateCategory(template.category || '');
      setTemplateIcon(template.icon || '');
      setTemplateSortOrder(String(template.sortOrder || 0));
    } else {
      resetTemplateForm();
    }
    setIsTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!templateTitle.trim() || !templatePrompt.trim()) {
      toast.error('Titel und Prompt sind erforderlich');
      return;
    }

    const data = {
      title: templateTitle,
      prompt: templatePrompt,
      category: templateCategory || undefined,
      icon: templateIcon || undefined,
      sortOrder: parseInt(templateSortOrder) || 0,
    };

    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, ...data });
    } else {
      createTemplate.mutate(data);
    }
  };

  const handleDeleteTemplate = (id: number) => {
    if (confirm('Möchten Sie diese Vorlage wirklich löschen?')) {
      deleteTemplate.mutate({ id });
    }
  };

  const handleResetTemplates = () => {
    if (confirm('Möchten Sie alle Vorlagen auf die Standardwerte zurücksetzen? Dies löscht alle benutzerdefinierten Vorlagen!')) {
      resetTemplates.mutate();
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

        {/* Tax Management */}
        <TaxManagement />

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
                        pin: undefined, // Don't send PIN when only changing auto-lock time
                        enabled: pinStatus?.enabled || false,
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

        {/* KI-Vorlagen */}
        <Card className="glass-card">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  KI-Vorlagen
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Verwalten Sie Ihre KI-Assistenten Vorlagen
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleResetTemplates} disabled={resetTemplates.isPending}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${resetTemplates.isPending ? 'animate-spin' : ''}`} />
                  Zurücksetzen
                </Button>
                <Button size="sm" onClick={() => handleOpenTemplateDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Neue Vorlage
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Keine Vorlagen vorhanden</p>
                <p className="text-xs mt-1">Erstellen Sie Ihre erste KI-Vorlage</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates
                  .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
                  .map((template: any) => (
                    <div
                      key={template.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-xl">
                        {template.icon || '💡'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{template.title}</p>
                            {template.category && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                                {template.category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenTemplateDialog(template)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              disabled={deleteTemplate.isPending}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.prompt}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <GripVertical className="w-3 h-3" />
                            Reihenfolge: {template.sortOrder || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Template Dialog */}
        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                {editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
              </DialogTitle>
              <DialogDescription>
                Erstellen Sie eine Vorlage für häufige KI-Anfragen
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Titel *</Label>
                  <Input
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                    placeholder="z.B. Portfolio-Analyse"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Prompt *</Label>
                  <Textarea
                    value={templatePrompt}
                    onChange={(e) => setTemplatePrompt(e.target.value)}
                    placeholder="Der vollständige Prompt für den KI-Assistenten..."
                    rows={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kategorie</Label>
                  <Input
                    value={templateCategory}
                    onChange={(e) => setTemplateCategory(e.target.value)}
                    placeholder="z.B. Analyse, Investition"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Icon (Emoji)</Label>
                  <Input
                    value={templateIcon}
                    onChange={(e) => setTemplateIcon(e.target.value)}
                    placeholder="📊"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sortierung</Label>
                  <Input
                    type="number"
                    value={templateSortOrder}
                    onChange={(e) => setTemplateSortOrder(e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsTemplateDialogOpen(false);
                  resetTemplateForm();
                }}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={createTemplate.isPending || updateTemplate.isPending}
              >
                {(createTemplate.isPending || updateTemplate.isPending) ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {editingTemplate ? 'Aktualisieren' : 'Erstellen'}
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

        {/* DKB PDF Import */}
        <Card className="glass-card">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Käufe & Verkäufe (DKB-PDF Import)
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              DKB-Abrechnungen importieren und Portfolio automatisch aktualisieren
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 space-y-4">
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Laden Sie Ihre DKB-Wertpapierabrechnungen (PDF) hoch. Das System erkennt automatisch Käufe und Verkäufe, 
                aktualisiert Ihre Portfolio-Positionen und berechnet Durchschnittseinkaufspreise.
              </p>
              <div className="flex flex-col gap-3">
                <label className="cursor-pointer">
                  <div className={`flex items-center justify-center w-full h-20 border-2 border-dashed rounded-lg transition-colors ${
                    isPdfUploading 
                      ? 'border-primary bg-primary/10 cursor-not-allowed' 
                      : 'border-primary/30 hover:border-primary/60 bg-primary/5'
                  }`}>
                    <div className="text-center">
                      {isPdfUploading ? (
                        <>
                          <RefreshCw className="w-6 h-6 mx-auto mb-2 text-primary animate-spin" />
                          <p className="text-sm text-muted-foreground">Wird importiert...</p>
                        </>
                      ) : (
                        <>
                          <FileText className="w-6 h-6 mx-auto mb-2 text-primary/60" />
                          <p className="text-sm font-medium">DKB-PDF hochladen</p>
                          <p className="text-xs text-muted-foreground">Wertpapierabrechnung (Kauf/Verkauf)</p>
                        </>
                      )}
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handlePDFUpload}
                    disabled={isPdfUploading}
                    className="hidden"
                  />
                </label>
                <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <p className="font-medium mb-1">💡 So funktioniert's:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>PDF-Abrechnung von DKB hochladen</li>
                    <li>System erkennt automatisch Duplikate</li>
                    <li>Portfolio wird automatisch aktualisiert</li>
                    <li>Durchschnittseinkaufspreis wird neu berechnet</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        {transactions.length > 0 && (
          <Card className="glass-card">
            <CardHeader className="p-3 sm:p-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <History className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Transaktionshistorie
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Importierte Käufe und Verkäufe ({transactions.length})
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="space-y-2">
                {transactions.map((transaction: any) => (
                  <div
                    key={transaction.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.type === 'Kauf' || transaction.type === 'Sparplan'
                        ? 'bg-green-500/20 text-green-600'
                        : 'bg-red-500/20 text-red-600'
                    }`}>
                      {transaction.type === 'Kauf' || transaction.type === 'Sparplan' ? '↑' : '↓'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{transaction.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.wkn && `WKN: ${transaction.wkn} • `}
                            ISIN: {transaction.isin}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-medium text-sm ${
                            transaction.type === 'Kauf' || transaction.type === 'Sparplan'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {transaction.type === 'Kauf' || transaction.type === 'Sparplan' ? '+' : '-'}
                            {transaction.quantity.toFixed(4)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.totalAmount.toFixed(2)} €
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          transaction.type === 'Sparplan'
                            ? 'bg-blue-500/20 text-blue-600'
                            : transaction.type === 'Kauf'
                            ? 'bg-green-500/20 text-green-600'
                            : 'bg-red-500/20 text-red-600'
                        }`}>
                          {transaction.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(transaction.date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Kurs: {transaction.price.toFixed(2)} €</span>
                        {transaction.fees > 0 && (
                          <span>Gebühren: {transaction.fees.toFixed(2)} €</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
