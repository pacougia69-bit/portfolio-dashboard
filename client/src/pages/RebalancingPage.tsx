/**
 * Portfolio Rebalancing Seite
 * Berechnet optimale Verteilung von Extra-Kapital basierend auf Untergewichtung
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TrendingDown, TrendingUp, Calculator, RefreshCw, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import Layout from '@/components/Layout';

export default function RebalancingPage() {
  const [amount, setAmount] = useState<number>(5000);
  const [inputValue, setInputValue] = useState<string>('5000');

  // Fetch rebalancing analysis
  const { data, isLoading, error, refetch } = trpc.rebalancing.analyze.useQuery(
    { amount },
    {
      enabled: amount > 0,
    }
  );

  const handleAmountChange = (value: string) => {
    setInputValue(value);
    const numValue = parseFloat(value.replace(',', '.'));
    if (!isNaN(numValue) && numValue >= 0) {
      setAmount(numValue);
    }
  };

  const handleCalculate = () => {
    refetch();
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Portfolio-Rebalancing</h1>
          <p className="text-muted-foreground">
            Berechnen Sie die optimale Verteilung von Extra-Kapital basierend auf Ihrer Ziel-Allokation
          </p>
        </div>

        {/* Eingabefeld für Betrag */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Verfügbares Kapital
            </CardTitle>
            <CardDescription>
              Geben Sie den Betrag ein, den Sie investieren möchten
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="amount">Betrag in €</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="100"
                  value={inputValue}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="5000"
                  className="text-lg"
                />
              </div>
              <Button onClick={handleCalculate} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Berechnen
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Fehler</AlertTitle>
            <AlertDescription>
              {error.message || 'Fehler beim Laden der Analyse'}
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {data && !isLoading && (
          <>
            {/* Portfolio Übersicht */}
            <Card>
              <CardHeader>
                <CardTitle>Portfolio-Übersicht</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Aktueller Portfolio-Wert</p>
                    <p className="text-2xl font-bold">
                      {data.totalPortfolioValue.toLocaleString('de-DE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} €
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Zu investieren</p>
                    <p className="text-2xl font-bold text-green-600">
                      {amount.toLocaleString('de-DE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} €
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Untergewichtete Gruppen</p>
                    <p className="text-2xl font-bold">{data.underweightGroups.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Keine Untergewichtung */}
            {data.allocation.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Perfekt allokiert</AlertTitle>
                <AlertDescription>
                  Ihr Portfolio ist bereits perfekt allokiert oder übergewichtet. Es gibt keine
                  untergewichteten Gruppen, die Extra-Kapital benötigen.
                </AlertDescription>
              </Alert>
            )}

            {/* Investitions-Verteilung */}
            {data.allocation.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Empfohlene Investitions-Verteilung</CardTitle>
                  <CardDescription>
                    Verteilen Sie Ihr Kapital auf die untergewichteten Gruppen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ETF-Gruppe</TableHead>
                        <TableHead className="text-right">Ist-Anteil</TableHead>
                        <TableHead className="text-right">Soll-Anteil</TableHead>
                        <TableHead className="text-right">Differenz</TableHead>
                        <TableHead className="text-right">Euro-Betrag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.allocation.map((item) => {
                        const group = data.underweightGroups.find(
                          (g) => g.category === item.category
                        );
                        return (
                          <TableRow key={item.category}>
                            <TableCell className="font-medium">{item.category}</TableCell>
                            <TableCell className="text-right">
                              {group?.currentPercent.toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {group?.targetPercent.toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="flex items-center justify-end gap-1 text-red-600">
                                <TrendingDown className="w-4 h-4" />
                                {Math.abs(group?.difference || 0).toFixed(2)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {item.amount.toLocaleString('de-DE', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} €
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="border-t-2">
                        <TableCell colSpan={4} className="font-semibold">
                          Gesamt
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {data.summary.totalInvested.toLocaleString('de-DE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} €
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Übergewichtete Gruppen */}
            {data.overweightGroups.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Übergewichtete Gruppen</CardTitle>
                  <CardDescription>
                    Diese Gruppen erhalten kein zusätzliches Kapital
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ETF-Gruppe</TableHead>
                        <TableHead className="text-right">Ist-Anteil</TableHead>
                        <TableHead className="text-right">Soll-Anteil</TableHead>
                        <TableHead className="text-right">Differenz</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.overweightGroups.map((group) => (
                        <TableRow key={group.category}>
                          <TableCell className="font-medium">{group.category}</TableCell>
                          <TableCell className="text-right">
                            {group.currentPercent.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right">
                            {group.targetPercent.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="flex items-center justify-end gap-1 text-orange-600">
                              <TrendingUp className="w-4 h-4" />
                              +{group.difference.toFixed(2)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Hinweise */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Hinweis</AlertTitle>
              <AlertDescription>
                Die Berechnung basiert auf Ihrer konfigurierten Ziel-Allokation in den Einstellungen.
                Die Euro-Beträge werden proportional zur Untergewichtung verteilt, um Ihr Portfolio
                optimal zu balancieren.
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>
    </Layout>
  );
}
