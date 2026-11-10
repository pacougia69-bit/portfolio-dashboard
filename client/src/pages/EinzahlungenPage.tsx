/**
 * Eingezahlt / Gewinn - Finanzplaner
 * Was ist netto ins Depot geflossen, und was ist daraus geworden?
 * Rechenlogik und Zahlen: shared/einzahlungen.ts (aus DKB-Depotauszuegen und Umsatzliste).
 */

import { useMemo } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { PiggyBank } from 'lucide-react';
import {
  EINZAHLUNGS_ZEITRAEUME,
  UMSATZLISTE_STAND,
  berechneZeitraum,
  berechneGesamt,
} from '@shared/einzahlungen';

const eur = (value: number) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);

const eurMitVorzeichen = (value: number) => (value > 0 ? '+' : '') + eur(value);

const vorzeichenFarbe = (value: number) =>
  value > 0 ? 'text-green-500' : value < 0 ? 'text-red-500' : 'text-foreground';

export default function EinzahlungenPage() {
  const { data: portfolio = [], isLoading } = trpc.portfolio.list.useQuery();

  // Gleiche Rechnung wie im Dashboard (DashboardPage "totalValue").
  const heutigerDepotwert = useMemo(
    () =>
      portfolio.reduce(
        (sum, p) => sum + (p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice),
        0,
      ),
    [portfolio],
  );

  const zeitraeume = useMemo(
    () => EINZAHLUNGS_ZEITRAEUME.map((z) => berechneZeitraum(z, heutigerDepotwert)),
    [heutigerDepotwert],
  );
  const gesamt = useMemo(
    () => berechneGesamt(EINZAHLUNGS_ZEITRAEUME, heutigerDepotwert),
    [heutigerDepotwert],
  );

  if (isLoading || !gesamt) {
    return (
      <Layout>
        <div className="space-y-6 pt-12 sm:pt-0">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="pt-12 sm:pt-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
            <PiggyBank className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            Eingezahlt / Gewinn
          </h1>
          <p className="text-muted-foreground text-xs sm:text-base">
            Seit {gesamt.von}: Was ist netto ins Depot geflossen, und was ist daraus geworden?
          </p>
        </div>

        {/* Die drei Zahlen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Netto eingezahlt</CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">{eur(gesamt.nettoEingezahlt)}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Käufe minus Verkäufe seit {gesamt.von}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Depotwert heute</CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">{eur(gesamt.endWert)}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Am {gesamt.von} waren es {eur(gesamt.startWert)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ergebnis (Gewinn / Verlust)</CardDescription>
              <CardTitle className={`text-2xl sm:text-3xl ${vorzeichenFarbe(gesamt.ergebnis)}`}>
                {eurMitVorzeichen(gesamt.ergebnis)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Depotwert heute − Startwert − netto eingezahlt + Erträge
            </CardContent>
          </Card>
        </div>

        {/* Pro Zeitraum */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Pro Zeitraum</CardTitle>
            <CardDescription>Jahr für Jahr, damit man sieht, wann es gelaufen ist</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">Zeitraum</th>
                    <th className="py-2 pr-4 font-medium text-right">Start</th>
                    <th className="py-2 pr-4 font-medium text-right">Netto eingezahlt</th>
                    <th className="py-2 pr-4 font-medium text-right">Ende</th>
                    <th className="py-2 pr-4 font-medium text-right">Erträge</th>
                    <th className="py-2 font-medium text-right">Ergebnis</th>
                  </tr>
                </thead>
                <tbody>
                  {[...zeitraeume, gesamt].map((z, i, alle) => {
                    const istSumme = i === alle.length - 1;
                    return (
                      <tr
                        key={z.label}
                        className={`border-b border-border/50 ${istSumme ? 'font-semibold' : ''}`}
                      >
                        <td className="py-2 pr-4 whitespace-nowrap">{z.label}</td>
                        <td className="py-2 pr-4 text-right whitespace-nowrap">{eur(z.startWert)}</td>
                        <td className="py-2 pr-4 text-right whitespace-nowrap">
                          {eur(z.nettoEingezahlt)}
                        </td>
                        <td className="py-2 pr-4 text-right whitespace-nowrap">{eur(z.endWert)}</td>
                        <td className="py-2 pr-4 text-right whitespace-nowrap">{eur(z.ertraege)}</td>
                        <td
                          className={`py-2 text-right whitespace-nowrap ${vorzeichenFarbe(z.ergebnis)}`}
                        >
                          {eurMitVorzeichen(z.ergebnis)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Details eingeklappt */}
        <details className="rounded-lg border border-border p-4 text-sm">
          <summary className="cursor-pointer font-medium">So ist gerechnet und was fehlt</summary>
          <div className="mt-3 space-y-2 text-muted-foreground">
            <p>
              <strong className="text-foreground">Startwerte:</strong> DKB-Jahresdepotauszüge zum
              31.12.2024 ({eur(EINZAHLUNGS_ZEITRAEUME[0].startWert)}) und 31.12.2025 (
              {eur(EINZAHLUNGS_ZEITRAEUME[1].startWert)}).
            </p>
            <p>
              <strong className="text-foreground">Netto eingezahlt:</strong> alle Käufe (auch
              Sparplan, inklusive Gebühren) minus alle Verkäufe, aus der DKB-Umsatzliste vom{' '}
              {UMSATZLISTE_STAND}. Steuern auf Verkäufe sind in den Abrechnungen schon abgezogen.
            </p>
            <p>
              <strong className="text-foreground">Erträge:</strong> ausgezahlte Dividenden und
              Fondserträge.
            </p>
            <p>
              <strong className="text-foreground">Nicht enthalten:</strong> die Zeit vor 2025 und
              das VL-Depot bei Oskar (Baader Bank).
            </p>
            <p>
              <strong className="text-foreground">Aktualisieren:</strong> Die Zahlen stehen fest im
              Code (<code>shared/einzahlungen.ts</code>). Für einen neuen Stand die aktuelle
              DKB-Umsatzliste als PDF an Claude geben. Der Depotwert „heute" kommt live aus dem
              Dashboard.
            </p>
          </div>
        </details>
      </div>
    </Layout>
  );
}
