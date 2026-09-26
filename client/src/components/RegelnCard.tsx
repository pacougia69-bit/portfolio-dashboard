/** Startseiten-Karte "Meine Regeln": klein, eingeklappt, Regeln auf einen Blick. Nur Erinnerung, keine Anweisung. */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListChecks, ChevronDown, ChevronUp } from 'lucide-react';
import { ANLAGE_REGELN } from '@shared/regeln';

export default function RegelnCard() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="glass-card">
      <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left"
        >
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <ListChecks className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Meine Regeln ({ANLAGE_REGELN.length})
          </CardTitle>
          <span className="ml-auto text-muted-foreground">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        {!open && (
          <p className="pl-6 text-xs sm:text-sm text-muted-foreground">
            Vor jeder Entscheidung kurz lesen. Tippen zum Aufklappen.
          </p>
        )}
      </CardHeader>
      {open && (
        <CardContent className="p-3 sm:p-6 pt-0">
          <ol className="list-decimal pl-5 space-y-2 text-xs sm:text-sm">
            {ANLAGE_REGELN.map((r) => (
              <li key={r.id} className="text-foreground">{r.text}</li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] sm:text-xs text-muted-foreground">
            Das sind deine eigenen Vorsätze als Erinnerung, keine Kauf- oder Verkaufsanweisung.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
