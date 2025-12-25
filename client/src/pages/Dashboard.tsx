/**
 * Dashboard Page - Dark Terminal Theme
 * Portfolio overview with charts, asset list, and quick actions
 * Electric Cyan accents, glassmorphism cards, monospace numbers
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolio, Asset } from '@/contexts/PortfolioContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Plus, Upload, Download, Settings, LogOut,
  Wallet, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, Pencil, Trash2,
  FileSpreadsheet, AlertCircle, FileJson
} from 'lucide-react';
import {
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar
} from 'recharts';

const ASSET_TYPES = [
  { value: 'stock', label: 'Aktie' },
  { value: 'etf', label: 'ETF' },
  { value: 'crypto', label: 'Krypto' },
  { value: 'bond', label: 'Anleihe' },
  { value: 'commodity', label: 'Rohstoff' },
  { value: 'other', label: 'Sonstiges' },
];

const CHART_COLORS = [
  'oklch(0.75 0.15 195)', // cyan
  'oklch(0.65 0.18 220)', // blue
  'oklch(0.55 0.2 280)',  // purple
  'oklch(0.50 0.22 300)', // violet
  'oklch(0.70 0.2 145)',  // green
  'oklch(0.65 0.15 60)',  // orange
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { assets, stats, addAsset, updateAsset, deleteAsset, importFromCSV, importFromJSON, exportToCSV, exportToJSON } = usePortfolio();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isJsonImportDialogOpen, setIsJsonImportDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [csvInput, setCsvInput] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    type: 'stock' as Asset['type'],
    quantity: '',
    purchasePrice: '',
    currentPrice: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, setLocation]);

  const handleLogout = () => {
    logout();
    setLocation('/');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      symbol: '',
      type: 'stock',
      quantity: '',
      purchasePrice: '',
      currentPrice: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const handleAddAsset = () => {
    if (!formData.name || !formData.symbol || !formData.quantity || !formData.purchasePrice) {
      toast.error('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    addAsset({
      name: formData.name,
      symbol: formData.symbol.toUpperCase(),
      type: formData.type,
      quantity: parseFloat(formData.quantity.replace(',', '.')),
      purchasePrice: parseFloat(formData.purchasePrice.replace(',', '.')),
      currentPrice: parseFloat(formData.currentPrice.replace(',', '.')) || parseFloat(formData.purchasePrice.replace(',', '.')),
      purchaseDate: formData.purchaseDate,
      notes: formData.notes || undefined,
    });

    toast.success('Asset hinzugefügt');
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleEditAsset = () => {
    if (!editingAsset) return;

    updateAsset(editingAsset.id, {
      name: formData.name,
      symbol: formData.symbol.toUpperCase(),
      type: formData.type,
      quantity: parseFloat(formData.quantity.replace(',', '.')),
      purchasePrice: parseFloat(formData.purchasePrice.replace(',', '.')),
      currentPrice: parseFloat(formData.currentPrice.replace(',', '.')),
      purchaseDate: formData.purchaseDate,
      notes: formData.notes || undefined,
    });

    toast.success('Asset aktualisiert');
    setIsEditDialogOpen(false);
    setEditingAsset(null);
    resetForm();
  };

  const openEditDialog = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      symbol: asset.symbol,
      type: asset.type,
      quantity: asset.quantity.toString(),
      purchasePrice: asset.purchasePrice.toString(),
      currentPrice: asset.currentPrice.toString(),
      purchaseDate: asset.purchaseDate,
      notes: asset.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteAsset = (id: string) => {
    deleteAsset(id);
    toast.success('Asset gelöscht');
  };

  const handleImport = () => {
    if (!csvInput.trim()) {
      toast.error('Bitte fügen Sie CSV-Daten ein');
      return;
    }

    const result = importFromCSV(csvInput);
    
    if (result.success > 0) {
      toast.success(`${result.success} Assets importiert`);
    }
    if (result.errors.length > 0) {
      toast.error(`${result.errors.length} Fehler beim Import`);
    }

    setIsImportDialogOpen(false);
    setCsvInput('');
  };

  const handleExport = () => {
    const csv = exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportiert');
  };

  const handleJsonImport = () => {
    if (!jsonInput.trim()) {
      toast.error('Bitte fügen Sie JSON-Daten ein');
      return;
    }

    const result = importFromJSON(jsonInput);
    
    if (result.success > 0) {
      toast.success(`${result.success} Assets importiert`);
    }
    if (result.errors.length > 0) {
      result.errors.forEach(err => toast.error(err));
    }

    setIsJsonImportDialogOpen(false);
    setJsonInput('');
  };

  const handleJsonExport = () => {
    const json = exportToJSON();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanzplaner_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('JSON Backup exportiert');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonInput(content);
    };
    reader.readAsText(file);
  };

  // Prepare chart data
  const pieData = ASSET_TYPES.map(type => {
    const typeAssets = assets.filter(a => a.type === type.value);
    const value = typeAssets.reduce((sum, a) => sum + (a.quantity * a.currentPrice), 0);
    return { name: type.label, value };
  }).filter(d => d.value > 0);

  const assetPerformanceData = assets.map(asset => ({
    name: asset.symbol,
    gain: ((asset.currentPrice - asset.purchasePrice) / asset.purchasePrice) * 100,
    value: asset.quantity * asset.currentPrice,
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg gradient-text">Portfolio Dashboard</h1>
              <p className="text-xs text-muted-foreground">Alle Werte in EUR</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/settings')}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-card glow-hover">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Gesamtwert</span>
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
                <p className="font-mono text-2xl font-bold tabular-nums">
                  {formatCurrency(stats.totalValue)}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card glow-hover">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Investiert</span>
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="font-mono text-2xl font-bold tabular-nums">
                  {formatCurrency(stats.totalInvested)}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card glow-hover">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Gewinn/Verlust</span>
                  {stats.totalGain >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-[oklch(0.70_0.2_145)]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <p className={`font-mono text-2xl font-bold tabular-nums ${stats.totalGain >= 0 ? 'value-positive' : 'value-negative'}`}>
                  {formatCurrency(stats.totalGain)}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass-card glow-hover">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Rendite</span>
                  {stats.totalGainPercent >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-[oklch(0.70_0.2_145)]" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <p className={`font-mono text-2xl font-bold tabular-nums ${stats.totalGainPercent >= 0 ? 'value-positive' : 'value-negative'}`}>
                  {formatPercent(stats.totalGainPercent)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Allocation Pie Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-primary" />
                  Allokation nach Typ
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: 'oklch(0.17 0.008 285)',
                            border: '1px solid oklch(0.30 0.02 250)',
                            borderRadius: '8px',
                            color: 'oklch(0.95 0.01 250)',
                          }}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Keine Daten vorhanden
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Performance Bar Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Performance nach Asset
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assetPerformanceData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={assetPerformanceData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.02 250 / 0.3)" />
                        <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} stroke="oklch(0.60 0.02 250)" />
                        <YAxis type="category" dataKey="name" width={60} stroke="oklch(0.60 0.02 250)" />
                        <Tooltip
                          formatter={(value: number) => `${value.toFixed(2)}%`}
                          contentStyle={{
                            backgroundColor: 'oklch(0.17 0.008 285)',
                            border: '1px solid oklch(0.30 0.02 250)',
                            borderRadius: '8px',
                            color: 'oklch(0.95 0.01 250)',
                          }}
                        />
                        <Bar 
                          dataKey="gain" 
                          fill="oklch(0.75 0.15 195)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Keine Daten vorhanden
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap gap-3">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Asset hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50 max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Neues Asset</DialogTitle>
                <DialogDescription>Fügen Sie ein neues Asset zu Ihrem Portfolio hinzu.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Apple Inc."
                      className="bg-input/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Symbol *</Label>
                    <Input
                      value={formData.symbol}
                      onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                      placeholder="AAPL"
                      className="bg-input/50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as Asset['type'] })}>
                    <SelectTrigger className="bg-input/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Anzahl *</Label>
                    <Input
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="10"
                      className="bg-input/50 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kaufpreis (€) *</Label>
                    <Input
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                      placeholder="150,00"
                      className="bg-input/50 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aktueller Preis (€)</Label>
                    <Input
                      value={formData.currentPrice}
                      onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                      placeholder="175,00"
                      className="bg-input/50 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kaufdatum</Label>
                    <Input
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="bg-input/50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notizen</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optionale Notizen..."
                    className="bg-input/50"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Abbrechen</Button>
                <Button onClick={handleAddAsset}>Hinzufügen</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                CSV Import
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50 max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">CSV Import</DialogTitle>
                <DialogDescription>
                  Importieren Sie Assets aus einer CSV-Datei. Format: Name;Symbol;Typ;Anzahl;Kaufpreis;Aktueller Preis;Kaufdatum;Notizen
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted/30 rounded-lg text-xs font-mono text-muted-foreground">
                  Name;Symbol;Typ;Anzahl;Kaufpreis;Aktueller Preis;Kaufdatum;Notizen<br/>
                  Apple Inc.;AAPL;stock;10;150,00;175,00;2024-01-15;Langfristig
                </div>
                <textarea
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder="CSV-Daten hier einfügen..."
                  className="w-full h-40 p-3 bg-input/50 border border-border rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Abbrechen</Button>
                <Button onClick={handleImport}>Importieren</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleExport} disabled={assets.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            CSV Export
          </Button>

          {/* JSON Import Dialog */}
          <Dialog open={isJsonImportDialogOpen} onOpenChange={setIsJsonImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" className="bg-primary hover:bg-primary/90">
                <FileJson className="w-4 h-4 mr-2" />
                Backup laden
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-primary" />
                  Backup importieren
                </DialogTitle>
                <DialogDescription>
                  Laden Sie Ihr Finanzplaner-Backup (JSON-Datei) oder fügen Sie den Inhalt direkt ein.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <label className="flex-1">
                    <div className="flex items-center justify-center w-full h-24 border-2 border-dashed border-primary/30 rounded-lg cursor-pointer hover:border-primary/60 transition-colors bg-primary/5">
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-primary/60" />
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
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">oder einfügen</span>
                  </div>
                </div>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='{"portfolio": [...], "watchlist": [...]}'
                  className="w-full h-48 p-3 bg-input/50 border border-border rounded-lg font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {jsonInput && (
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-sm text-primary flex items-center gap-2">
                      <FileJson className="w-4 h-4" />
                      Backup erkannt - {jsonInput.length.toLocaleString()} Zeichen
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsJsonImportDialogOpen(false); setJsonInput(''); }}>Abbrechen</Button>
                <Button onClick={handleJsonImport} disabled={!jsonInput.trim()}>Importieren</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleJsonExport} disabled={assets.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            JSON Backup
          </Button>
        </div>

        {/* Assets Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                Portfolio ({assets.length} Assets)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assets.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground font-medium border-b border-border/50">
                      <div className="col-span-3">Asset</div>
                      <div className="col-span-1 text-right">Typ</div>
                      <div className="col-span-2 text-right">Anzahl</div>
                      <div className="col-span-2 text-right">Wert</div>
                      <div className="col-span-2 text-right">Gewinn/Verlust</div>
                      <div className="col-span-2 text-right">Aktionen</div>
                    </div>
                    
                    {/* Table Rows */}
                    <AnimatePresence>
                      {assets.map((asset, index) => {
                        const value = asset.quantity * asset.currentPrice;
                        const invested = asset.quantity * asset.purchasePrice;
                        const gain = value - invested;
                        const gainPercent = ((asset.currentPrice - asset.purchasePrice) / asset.purchasePrice) * 100;

                        return (
                          <motion.div
                            key={asset.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.05 }}
                            className="grid grid-cols-12 gap-2 px-4 py-3 rounded-lg hover:bg-muted/30 transition-colors items-center"
                          >
                            <div className="col-span-3">
                              <p className="font-medium">{asset.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{asset.symbol}</p>
                            </div>
                            <div className="col-span-1 text-right">
                              <span className="text-xs px-2 py-1 rounded bg-muted/50">
                                {ASSET_TYPES.find(t => t.value === asset.type)?.label}
                              </span>
                            </div>
                            <div className="col-span-2 text-right font-mono tabular-nums">
                              {asset.quantity.toLocaleString('de-DE')}
                            </div>
                            <div className="col-span-2 text-right font-mono tabular-nums">
                              {formatCurrency(value)}
                            </div>
                            <div className="col-span-2 text-right">
                              <p className={`font-mono tabular-nums ${gain >= 0 ? 'value-positive' : 'value-negative'}`}>
                                {formatCurrency(gain)}
                              </p>
                              <p className={`text-xs font-mono ${gainPercent >= 0 ? 'value-positive' : 'value-negative'}`}>
                                {gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%
                              </p>
                            </div>
                            <div className="col-span-2 flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(asset)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteAsset(asset.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                  <p>Noch keine Assets vorhanden</p>
                  <p className="text-sm">Fügen Sie Ihr erstes Asset hinzu oder importieren Sie eine CSV-Datei.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="glass-card border-border/50 max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Asset bearbeiten</DialogTitle>
              <DialogDescription>Aktualisieren Sie die Details dieses Assets.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-input/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Symbol *</Label>
                  <Input
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    className="bg-input/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as Asset['type'] })}>
                  <SelectTrigger className="bg-input/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Anzahl *</Label>
                  <Input
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="bg-input/50 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kaufpreis (€) *</Label>
                  <Input
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="bg-input/50 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Aktueller Preis (€)</Label>
                  <Input
                    value={formData.currentPrice}
                    onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                    className="bg-input/50 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kaufdatum</Label>
                  <Input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="bg-input/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notizen</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-input/50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleEditAsset}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
